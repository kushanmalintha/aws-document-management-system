import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class DocumentStatus(str, Enum):
    PENDING_UPLOAD = "PENDING_UPLOAD"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"
    DELETED = "DELETED"


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_documents_id_user_id"),
        ForeignKeyConstraint(
            ["folder_id", "user_id"],
            ["folders.id", "folders.user_id"],
            name="fk_documents_folder_owner",
            # PostgreSQL 15+ supports setting only the nullable FK column to NULL.
            ondelete="SET NULL (folder_id)",
        ),
        CheckConstraint("size_bytes > 0", name="ck_documents_size_bytes_positive"),
        CheckConstraint(
            "current_version >= 1",
            name="ck_documents_current_version_positive",
        ),
        CheckConstraint(
            "status IN ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DELETED')",
            name="ck_documents_status_valid",
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
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    current_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(
        String(50),
        nullable=False,
        default=DocumentStatus.PENDING_UPLOAD,
        server_default=DocumentStatus.PENDING_UPLOAD.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", back_populates="documents")
    folder = relationship(
        "Folder", foreign_keys=[folder_id], back_populates="documents"
    )
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    activities = relationship(
        "Activity",
        foreign_keys="Activity.document_id",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    shares = relationship(
        "DocumentShare",
        foreign_keys="DocumentShare.document_id",
        back_populates="document",
        cascade="all, delete-orphan",
    )
