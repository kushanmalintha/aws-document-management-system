from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folder import (
    FolderCreateRequest,
    FolderResponse,
    FolderUpdateRequest,
)
from app.services.activity_service import record_activity


router = APIRouter(prefix="/folders", tags=["Folders"])


@router.post(
    "",
    response_model=FolderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_folder(
    request: FolderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.parent_folder_id is not None:
        parent_folder = db.get(Folder, request.parent_folder_id)

        if parent_folder is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent folder not found",
            )

        if parent_folder.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to the parent folder",
            )

    folder = Folder(
        user_id=current_user.id,
        parent_folder_id=request.parent_folder_id,
        name=request.name.strip(),
    )

    db.add(folder)

    record_activity(
        db=db,
        user_id=current_user.id,
        action="FOLDER_CREATED",
        metadata_json={
            "name": folder.name,
            "parent_folder_id": (
                str(folder.parent_folder_id)
                if folder.parent_folder_id
                else None
            ),
        },
    )

    db.commit()
    db.refresh(folder)

    return FolderResponse.model_validate(folder)


@router.get(
    "",
    response_model=list[FolderResponse],
)
def list_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folders = (
        db.query(Folder)
        .filter(Folder.user_id == current_user.id)
        .order_by(Folder.name.asc())
        .all()
    )

    return [
        FolderResponse.model_validate(folder)
        for folder in folders
    ]


@router.get(
    "/{folder_id}",
    response_model=FolderResponse,
)
def get_folder(
    folder_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    return FolderResponse.model_validate(folder)


@router.put(
    "/{folder_id}",
    response_model=FolderResponse,
)
def update_folder(
    folder_id: UUID,
    request: FolderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    folder.name = request.name.strip()

    record_activity(
        db=db,
        user_id=current_user.id,
        action="FOLDER_RENAMED",
        metadata_json={"name": folder.name},
    )

    db.commit()
    db.refresh(folder)

    return FolderResponse.model_validate(folder)


@router.delete(
    "/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_folder(
    folder_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    deleted_folder_name = folder.name

    record_activity(
        db=db,
        user_id=current_user.id,
        action="FOLDER_DELETED",
        metadata_json={"name": deleted_folder_name},
    )

    db.delete(folder)
    db.commit()

    return None