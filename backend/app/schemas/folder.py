from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_folder_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Folder name cannot be empty")

        return value


class FolderUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Folder name cannot be empty")

        return value


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    parent_folder_id: UUID | None
    name: str
    created_at: datetime
    updated_at: datetime