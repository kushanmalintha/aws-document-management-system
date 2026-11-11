import logging
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import PurePosixPath
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.document_version import DocumentVersion
from app.models.folder import Folder
from app.models.user import User
from app.schemas.document import (
    DocumentResponse,
    DocumentVersionResponse,
    MoveDocumentRequest,
    RenameDocumentRequest,
)
from app.services.activity_service import record_activity
from app.services.storage import storage_service
from app.services.upload_validation import (
    UPLOAD_CHUNK_SIZE,
    UploadValidationError,
    inspect_upload,
    normalize_upload_filename,
)

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)

logger = logging.getLogger(__name__)


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: UUID | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        filename, extension = normalize_upload_filename(
            file.filename,
            settings.allowed_document_extensions,
            settings.max_upload_filename_length,
        )
    except UploadValidationError as exc:
        await file.close()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    # Check folder ownership before writing anything.
    if folder_id is not None:
        folder = db.get(Folder, folder_id)

        if folder is None:
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found",
            )

        if folder.user_id != current_user.id:
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this folder",
            )

    try:
        inspection = await run_in_threadpool(
            inspect_upload, file.file, filename, extension, settings.max_upload_size_bytes
        )
    except UploadValidationError as exc:
        await file.close()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    size_bytes = inspection.size_bytes
    content_type = inspection.content_type

    document = Document(
        user_id=current_user.id,
        folder_id=folder_id,
        name=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        current_version=1,
        s3_key=None,
        status=DocumentStatus.PENDING_UPLOAD,
    )

    db.add(document)

    storage_key: str | None = None
    storage_saved = False

    try:
        # Create the pending row within the current transaction.
        db.flush()

        # Use a generated key, not the original filename.
        storage_key = (
            f"documents/{current_user.id}/"
            f"{document.id}/v1/{uuid4().hex}{extension}"
        )

        storage_service.save(file.file, storage_key)
        storage_saved = True

        document.s3_key = storage_key
        document.status = DocumentStatus.UPLOADED
        document.current_version = 1

        initial_version = DocumentVersion(
            document_id=document.id,
            version_number=1,
            s3_key=storage_key,
            size_bytes=size_bytes,
            checksum=inspection.checksum,
        )

        db.add(initial_version)

        record_activity(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_UPLOADED",
            document_id=document.id,
            metadata_json={
                "name": document.name,
                "size_bytes": size_bytes,
                "version_number": 1,
            },
        )

        db.commit()

    except Exception as exc:
        db.rollback()

        # Compensate for a partial or successful file write if
        # the database transaction did not complete.
        if storage_saved and storage_key is not None:
            try:
                storage_service.delete(storage_key)
            except Exception:
                logger.exception(
                    "Could not clean up failed upload %s",
                    storage_key,
                )

        logger.exception("Document upload failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be uploaded",
        ) from exc

    finally:
        await file.close()

    db.refresh(document)

    return DocumentResponse.model_validate(document)

@router.get(
    "",
    response_model=list[DocumentResponse],
)
def list_documents(
    search: str | None = Query(default=None),
    folder_id: UUID | None = Query(default=None),
    content_type: str | None = Query(default=None),
    sort_by: str = Query(
        default="created_at",
        pattern="^(created_at|name)$",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Document)
        .filter(
            Document.user_id == current_user.id,
            Document.deleted_at.is_(None),
        )
    )

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            Document.name.ilike(search_pattern)
        )

    if folder_id is not None:
        query = query.filter(
            Document.folder_id == folder_id
        )

    if content_type:
        query = query.filter(
            Document.content_type == content_type
        )

    if sort_by == "name":
        if sort_order == "asc":
            query = query.order_by(Document.name.asc())
        else:
            query = query.order_by(Document.name.desc())
    else:
        if sort_order == "asc":
            query = query.order_by(Document.created_at.asc())
        else:
            query = query.order_by(Document.created_at.desc())

    documents = query.all()

    return [
        DocumentResponse.model_validate(document)
        for document in documents
    ]


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    if document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return DocumentResponse.model_validate(document)



@router.patch(
    "/{document_id}",
    response_model=DocumentResponse,
)
def rename_document(
    document_id: UUID,
    request: RenameDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    try:
        new_name, new_extension = normalize_upload_filename(
            request.name,
            settings.allowed_document_extensions,
            settings.max_upload_filename_length,
        )
    except UploadValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    current_extension = PurePosixPath(document.name).suffix.lower()
    if new_extension != current_extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The document extension cannot be changed",
        )

    old_name = document.name
    if new_name == old_name:
        return DocumentResponse.model_validate(document)

    document.name = new_name
    record_activity(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_RENAMED",
        document_id=document.id,
        metadata_json={"old_name": old_name, "new_name": new_name},
    )

    try:
        db.commit()
        db.refresh(document)
    except Exception as exc:
        db.rollback()
        logger.exception("Document rename failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be renamed",
        ) from exc

    return DocumentResponse.model_validate(document)


@router.patch(
    "/{document_id}/move",
    response_model=DocumentResponse,
)
def move_document(
    document_id: UUID,
    request: MoveDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    destination_folder_id = request.folder_id
    if destination_folder_id is not None:
        folder = db.get(Folder, destination_folder_id)
        if folder is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found",
            )
        if folder.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this folder",
            )

    old_folder_id = document.folder_id
    if old_folder_id == destination_folder_id:
        return DocumentResponse.model_validate(document)

    document.folder_id = destination_folder_id
    record_activity(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_MOVED",
        document_id=document.id,
        metadata_json={
            "old_folder_id": str(old_folder_id) if old_folder_id else None,
            "new_folder_id": (
                str(destination_folder_id) if destination_folder_id else None
            ),
        },
    )

    try:
        db.commit()
        db.refresh(document)
    except Exception as exc:
        db.rollback()
        logger.exception("Document move failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be moved",
        ) from exc

    return DocumentResponse.model_validate(document)

@router.post(
    "/{document_id}/versions",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document_version(
    document_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Lock the document row while calculating the next version.
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .with_for_update()
        .first()
    )

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    if not document.s3_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document has no current stored file",
        )

    try:
        uploaded_filename, uploaded_extension = normalize_upload_filename(
            file.filename,
            settings.allowed_document_extensions,
            settings.max_upload_filename_length,
        )
    except UploadValidationError as exc:
        await file.close()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    original_extension = PurePosixPath(document.name).suffix.lower()
    if uploaded_extension != original_extension:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new version must use the same file extension",
        )

    try:
        inspection = await run_in_threadpool(
            inspect_upload, file.file, uploaded_filename, uploaded_extension,
            settings.max_upload_size_bytes,
        )
    except UploadValidationError as exc:
        await file.close()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    size_bytes = inspection.size_bytes

    new_version_number = document.current_version + 1
    storage_key = (
        f"documents/{current_user.id}/"
        f"{document.id}/v{new_version_number}/"
        f"{uuid4().hex}{original_extension}"
    )

    storage_saved = False

    try:
        # Store the new file at a unique path first.
        storage_service.save(file.file, storage_key)
        storage_saved = True

        # Record the new version in the same DB transaction
        # that updates the current document metadata.
        new_version = DocumentVersion(
            document_id=document.id,
            version_number=new_version_number,
            s3_key=storage_key,
            size_bytes=size_bytes,
            checksum=inspection.checksum,
        )

        db.add(new_version)

        document.current_version = new_version_number
        document.s3_key = storage_key
        document.size_bytes = size_bytes
        document.status = DocumentStatus.UPLOADED

        record_activity(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_VERSION_UPLOADED",
            document_id=document.id,
            metadata_json={
                "name": document.name,
                "version_number": new_version_number,
                "size_bytes": size_bytes,
            },
        )

        db.commit()
        db.refresh(document)

    except Exception as exc:
        db.rollback()

        # Remove the new file if the database update fails.
        if storage_saved:
            try:
                storage_service.delete(storage_key)
            except Exception:
                logger.exception(
                    "Could not clean up failed document version %s",
                    storage_key,
                )

        logger.exception("Document version upload failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document version could not be uploaded",
        ) from exc

    finally:
        await file.close()

    return DocumentResponse.model_validate(document)


@router.get(
    "/{document_id}/versions",
    response_model=list[DocumentVersionResponse],
)
def list_document_versions(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    versions = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.version_number.asc())
        .all()
    )

    return [
        DocumentVersionResponse.model_validate(version)
        for version in versions
    ]

@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    if document.deleted_at is not None or not document.s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    try:
        stored_file = storage_service.read(document.s3_key)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored document not found",
        ) from exc

    try:
        record_activity(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_DOWNLOADED",
            document_id=document.id,
            metadata_json={
                "name": document.name,
                "version_number": document.current_version,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        stored_file.close()
        logger.exception("Could not record document download activity")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The download could not be recorded",
        )

    safe_filename = quote(document.name, safe="")

    return StreamingResponse(
        iter(
            lambda: stored_file.read(UPLOAD_CHUNK_SIZE),
            b"",
        ),
        media_type=document.content_type,
        headers={
            "Content-Disposition": (
                f"attachment; filename*=UTF-8''{safe_filename}"
            ),
            "Content-Length": str(document.size_bytes),
            "X-Content-Type-Options": "nosniff",
        },
        background=BackgroundTask(stored_file.close),
    )

@router.delete(
    "/{document_id}/versions/{version_number}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document_version(
    document_id: UUID,
    version_number: int = Path(ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Serialize version mutations for this document.
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .with_for_update()
        .first()
    )

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    version = (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.document_id == document.id,
            DocumentVersion.version_number == version_number,
        )
        .first()
    )

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version not found",
        )

    if version.version_number == document.current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The current document version cannot be deleted",
        )

    # Keep a recoverable copy until the metadata transaction commits. This
    # allows the stored object to be restored if the database operation fails.
    backup = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
    storage_deleted = False

    try:
        stored_file = storage_service.read(version.s3_key)
        try:
            shutil.copyfileobj(stored_file, backup)
        finally:
            stored_file.close()

        backup.seek(0)
        storage_service.delete(version.s3_key)
        storage_deleted = True

        db.delete(version)
        db.commit()

    except Exception as exc:
        db.rollback()

        if storage_deleted:
            try:
                backup.seek(0)
                storage_service.save(backup, version.s3_key)
            except Exception as restore_exc:
                logger.exception(
                    "Could not restore document version %s after a failed deletion",
                    version.s3_key,
                )
                backup.close()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "The version deletion failed and its stored file "
                        "could not be restored"
                    ),
                ) from restore_exc

        logger.exception("Document version deletion failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document version could not be deleted",
        ) from exc

    finally:
        backup.close()

    return None


@router.get(
    "/{document_id}/versions/{version_number}/download",
)
def download_document_version(
    document_id: UUID,
    version_number: int = Path(ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None or document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    version = (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.document_id == document.id,
            DocumentVersion.version_number == version_number,
        )
        .first()
    )

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version not found",
        )

    try:
        stored_file = storage_service.read(version.s3_key)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored document version not found",
        ) from exc

    try:
        record_activity(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_VERSION_DOWNLOADED",
            document_id=document.id,
            metadata_json={
                "name": document.name,
                "version_number": version.version_number,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        stored_file.close()
        logger.exception("Could not record document version download activity")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The version download could not be recorded",
        )

    safe_filename = quote(document.name, safe="")

    return StreamingResponse(
        iter(
            lambda: stored_file.read(UPLOAD_CHUNK_SIZE),
            b"",
        ),
        media_type=document.content_type,
        headers={
            "Content-Disposition": (
                f"attachment; filename*=UTF-8''{safe_filename}"
            ),
            "Content-Length": str(version.size_bytes),
            "X-Content-Type-Options": "nosniff",
        },
        background=BackgroundTask(stored_file.close),
    )

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this document",
        )

    if document.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    document.deleted_at = datetime.now(timezone.utc)
    document.status = DocumentStatus.DELETED

    record_activity(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_DELETED",
        document_id=document.id,
        metadata_json={"name": document.name},
    )

    db.commit()

    return None