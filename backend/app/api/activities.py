
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.activity import Activity
from app.models.user import User
from app.schemas.activity import ActivityResponse


router = APIRouter(
    prefix="/activities",
    tags=["Activities"],
)


@router.get("", response_model=list[ActivityResponse])
def list_activities(
    document_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Activity).filter(
        Activity.user_id == current_user.id
    )

    if document_id is not None:
        query = query.filter(
            Activity.document_id == document_id
        )

    activities = (
        query
        .order_by(
            Activity.created_at.desc(),
            Activity.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        ActivityResponse.model_validate(activity)
        for activity in activities
    ]
