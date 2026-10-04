from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    folder_id: UUID | None
    name: str
    content_type: str
    size_bytes: int
    current_version: int
    status: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None