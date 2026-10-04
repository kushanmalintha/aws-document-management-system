from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentResponse


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


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

    db.commit()

    return None