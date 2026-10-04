from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserProfileResponse,
    UserProfileUpdateRequest,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get(
    "/me",
    response_model=UserProfileResponse,
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    return UserProfileResponse.model_validate(current_user)


@router.put(
    "/me",
    response_model=UserProfileResponse,
)
def update_current_user_profile(
    request: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.display_name = request.display_name

    db.commit()
    db.refresh(current_user)

    return UserProfileResponse.model_validate(current_user)