import hashlib
import logging
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.document import Document, DocumentStatus
from app.models.document_version import DocumentVersion
from app.services.activity_service import record_activity
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


_ALLOWED_TRANSITIONS = {
    DocumentStatus.PENDING_UPLOAD: {DocumentStatus.UPLOADED, DocumentStatus.DELETED},
    DocumentStatus.UPLOADED: {
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        DocumentStatus.DELETED,
    },
    DocumentStatus.PROCESSING: {
        DocumentStatus.UPLOADED,
        DocumentStatus.READY,
        DocumentStatus.FAILED,
        DocumentStatus.DELETED,
    },
    DocumentStatus.READY: {DocumentStatus.UPLOADED, DocumentStatus.DELETED},
    DocumentStatus.FAILED: {DocumentStatus.UPLOADED, DocumentStatus.DELETED},
    DocumentStatus.DELETED: set(),
}


def transition_document_status(
    document: Document,
    new_status: DocumentStatus,
) -> None:
    """Apply an explicitly permitted document lifecycle transition."""
    current_status = DocumentStatus(document.status)
    target_status = DocumentStatus(new_status)

    if target_status not in _ALLOWED_TRANSITIONS[current_status]:
        raise ValueError(
            f"Invalid document status transition: "
            f"{current_status.value} -> {target_status.value}"
        )

    document.status = target_status


def schedule_document_processing(
    background_tasks: BackgroundTasks,
    document_id: UUID,
    version_number: int,
) -> None:
    """Queue a version check after its upload transaction has committed."""
    background_tasks.add_task(process_document, document_id, version_number)


def _calculate_checksum(storage_key: str) -> str:
    stored_file = storage_service.read(storage_key)
    digest = hashlib.sha256()

    try:
        while chunk := stored_file.read(1024 * 1024):
            digest.update(chunk)
    finally:
        stored_file.close()

    return digest.hexdigest()


def _finish_processing(
    db: Session,
    document_id: UUID,
    version_number: int,
    target_status: DocumentStatus,
    failure_reason: str | None = None,
) -> None:
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .with_for_update()
        .first()
    )

    # A newer upload or soft deletion may have superseded this task while
    # the file was being inspected. Never overwrite that newer state.
    if (
        document is None
        or document.deleted_at is not None
        or document.current_version != version_number
        or document.status != DocumentStatus.PROCESSING
    ):
        return

    transition_document_status(document, target_status)

    action = (
        "DOCUMENT_PROCESSING_COMPLETED"
        if target_status == DocumentStatus.READY
        else "DOCUMENT_PROCESSING_FAILED"
    )
    metadata = {
        "version_number": version_number,
        "status": target_status.value,
    }
    if failure_reason:
        metadata["reason"] = failure_reason[:500]

    record_activity(
        db=db,
        user_id=document.user_id,
        action=action,
        document_id=document.id,
        metadata_json=metadata,
    )
    db.commit()


def process_document(document_id: UUID, version_number: int) -> None:
    """Verify a stored document version in a local FastAPI background task.

    The task owns its database session. It is intentionally process-local and
    is not a durable job queue.
    """
    db = SessionLocal()

    try:
        document = (
            db.query(Document)
            .filter(Document.id == document_id)
            .with_for_update()
            .first()
        )

        if (
            document is None
            or document.deleted_at is not None
            or document.current_version != version_number
            or document.status != DocumentStatus.UPLOADED
        ):
            return

        version = (
            db.query(DocumentVersion)
            .filter(
                DocumentVersion.document_id == document_id,
                DocumentVersion.version_number == version_number,
            )
            .first()
        )

        if version is None:
            logger.warning(
                "Document version missing before processing: %s v%s",
                document_id,
                version_number,
            )
            transition_document_status(document, DocumentStatus.PROCESSING)
            db.commit()
            _finish_processing(
                db,
                document_id,
                version_number,
                DocumentStatus.FAILED,
                "Document version metadata is missing",
            )
            return

        storage_key = version.s3_key
        expected_checksum = version.checksum

        transition_document_status(document, DocumentStatus.PROCESSING)
        db.commit()

        failure_reason = None
        target_status = DocumentStatus.READY

        try:
            if not expected_checksum:
                raise ValueError("Stored checksum is missing")

            actual_checksum = _calculate_checksum(storage_key)
            if actual_checksum != expected_checksum:
                raise ValueError("Stored file checksum does not match metadata")
        except Exception as exc:
            target_status = DocumentStatus.FAILED
            failure_reason = str(exc)
            logger.warning(
                "Document processing failed for %s v%s: %s",
                document_id,
                version_number,
                exc,
            )

        _finish_processing(
            db,
            document_id,
            version_number,
            target_status,
            failure_reason,
        )

    except Exception:
        db.rollback()
        logger.exception(
            "Unexpected document processing error for %s v%s",
            document_id,
            version_number,
        )
    finally:
        db.close()
