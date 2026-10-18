import hashlib
import logging
import mimetypes
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

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.document_version import DocumentVersion
from app.models.folder import Folder
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentVersionResponse
from app.services.activity_service import record_activity
from app.services.storage import storage_service

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)

logger = logging.getLogger(__name__)

ALLOWED_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
}

UPLOAD_CHUNK_SIZE = 1024 * 1024

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
    # A filename is user-supplied input, so do not use it as
    # a storage path.
    original_filename = (file.filename or "").replace("\\", "/")
    filename = original_filename.rsplit("/", 1)[-1].strip()

    if not filename or filename in {".", ".."}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid filename is required",
        )

    if len(filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot exceed 255 characters",
        )

    extension = filename.rsplit(".", 1)[-1].lower()
    if "." not in filename:
        extension = ""
    else:
        extension = f".{extension}"

    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="This file extension is not allowed",
        )

    # Check folder ownership before writing anything.
    if folder_id is not None:
        folder = db.get(Folder, folder_id)

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

    # Count actual bytes rather than trusting the client's
    # Content-Length or MIME type.
    size_bytes = 0

    while True:
        chunk = await file.read(UPLOAD_CHUNK_SIZE)

        if not chunk:
            break

        size_bytes += len(chunk)

        if size_bytes > settings.max_upload_size_bytes:
            await file.close()

            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="File exceeds the maximum upload size",
            )

    if size_bytes == 0:
        await file.close()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty files are not allowed",
        )

    await file.seek(0)

    # Determine a content type based on the allowed filename
    # extension instead of blindly trusting the client header.
    content_type = (
        mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )

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
    storage_attempted = False

    try:
        # Create the pending row within the current transaction.
        db.flush()

        # Use a generated key, not the original filename.
        storage_key = (
            f"documents/{current_user.id}/"
            f"{document.id}/v1/{uuid4().hex}{extension}"
        )

        storage_attempted = True

        storage_service.save(
            file.file,
            storage_key,
        )

        document.s3_key = storage_key
        document.status = DocumentStatus.UPLOADED
        document.current_version = 1

        initial_version = DocumentVersion(
            document_id=document.id,
            version_number=1,
            s3_key=storage_key,
            size_bytes=size_bytes,
            checksum=None,
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
        if storage_attempted and storage_key is not None:
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

    # Keep the same file extension because the current model
    # stores filename and content type on Document, not per version.
    original_extension = (
        PurePosixPath(document.name).suffix.lower()
    )
    uploaded_filename = (file.filename or "").replace("\\", "/")
    uploaded_filename = uploaded_filename.rsplit("/", 1)[-1].strip()
    uploaded_extension = PurePosixPath(uploaded_filename).suffix.lower()

    if not uploaded_filename or uploaded_extension != original_extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new version must use the same file extension",
        )

    if original_extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="This file extension is not allowed",
        )

    # Count actual bytes and calculate a SHA-256 checksum.
    size_bytes = 0
    checksum = hashlib.sha256()

    while True:
        chunk = await file.read(UPLOAD_CHUNK_SIZE)

        if not chunk:
            break

        size_bytes += len(chunk)

        if size_bytes > settings.max_upload_size_bytes:
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="File exceeds the maximum upload size",
            )

        checksum.update(chunk)

    if size_bytes == 0:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty files are not allowed",
        )

    await file.seek(0)

    new_version_number = document.current_version + 1
    storage_key = (
        f"documents/{current_user.id}/"
        f"{document.id}/v{new_version_number}/"
        f"{uuid4().hex}{original_extension}"
    )

    storage_attempted = False

    try:
        # Store the new file at a unique path first.
        storage_attempted = True
        storage_service.save(file.file, storage_key)

        # Record the new version in the same DB transaction
        # that updates the current document metadata.
        new_version = DocumentVersion(
            document_id=document.id,
            version_number=new_version_number,
            s3_key=storage_key,
            size_bytes=size_bytes,
            checksum=checksum.hexdigest(),
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
        if storage_attempted:
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
    except FileNotFoundError as exc:
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
    except FileNotFoundError as exc:
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