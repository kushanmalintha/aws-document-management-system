from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserProfileUpdateRequest(BaseModel):
    display_name: str = Field(
        min_length=1,
        max_length=255,
    )