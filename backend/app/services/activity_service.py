
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.activity import Activity


def record_activity(
    db: Session,
    user_id: UUID,
    action: str,
    document_id: UUID | None = None,
    metadata_json: dict | None = None,
) -> Activity:
    activity = Activity(
        user_id=user_id,
        document_id=document_id,
        action=action,
        metadata_json=metadata_json,
    )

    db.add(activity)
    return activity
