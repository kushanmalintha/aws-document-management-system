import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_folders_id_user_id"),
        ForeignKeyConstraint(
            ["parent_folder_id", "user_id"],
            ["folders.id", "folders.user_id"],
            name="fk_folders_parent_folder_owner",
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="folders")
    parent_folder = relationship(
        "Folder",
        remote_side=[id, user_id],
        foreign_keys=[parent_folder_id],
        back_populates="children",
    )
    children = relationship(
        "Folder",
        foreign_keys=[parent_folder_id],
        back_populates="parent_folder",
        cascade="all, delete-orphan",
    )
    documents = relationship(
        "Document",
        foreign_keys="Document.folder_id",
        back_populates="folder",
        passive_deletes="all",
    )
