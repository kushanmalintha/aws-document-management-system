"""enforce database ownership and value integrity

Revision ID: 7b2c1f8e4a91
Revises: 5f7c2a91d4e8
Create Date: 2026-11-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7b2c1f8e4a91"
down_revision: Union[str, Sequence[str], None] = "5f7c2a91d4e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _assert_existing_data_is_valid() -> None:
    """Refuse to add constraints if existing rows violate the new rules."""
    checks = (
        (
            "a folder references a parent owned by another user",
            """SELECT EXISTS (
                SELECT 1 FROM folders child
                JOIN folders parent ON parent.id = child.parent_folder_id
                WHERE child.user_id <> parent.user_id
            )""",
        ),
        (
            "a document references a folder owned by another user",
            """SELECT EXISTS (
                SELECT 1 FROM documents d
                JOIN folders f ON f.id = d.folder_id
                WHERE d.user_id <> f.user_id
            )""",
        ),
        (
            "an activity references a document owned by another user",
            """SELECT EXISTS (
                SELECT 1 FROM activities a
                JOIN documents d ON d.id = a.document_id
                WHERE a.user_id <> d.user_id
            )""",
        ),
        (
            "a document share owner does not own the referenced document",
            """SELECT EXISTS (
                SELECT 1 FROM document_shares s
                JOIN documents d ON d.id = s.document_id
                WHERE s.owner_id <> d.user_id
            )""",
        ),
        (
            "a user has a negative token version",
            "SELECT EXISTS (SELECT 1 FROM users WHERE token_version < 0)",
        ),
        (
            "a document has a non-positive size or current version, or an invalid status",
            """SELECT
                EXISTS (SELECT 1 FROM documents WHERE size_bytes <= 0)
                OR EXISTS (SELECT 1 FROM documents WHERE current_version < 1)
                OR EXISTS (
                    SELECT 1 FROM documents
                    WHERE status NOT IN (
                        'PENDING_UPLOAD', 'UPLOADED', 'PROCESSING',
                        'READY', 'FAILED', 'DELETED'
                    )
                )""",
        ),
        (
            "a document version has a non-positive version number or size",
            """SELECT EXISTS (
                SELECT 1 FROM document_versions
                WHERE version_number < 1 OR size_bytes <= 0
            )""",
        ),
    )
    bind = op.get_bind()
    for description, statement in checks:
        if bind.execute(sa.text(statement)).scalar():
            raise RuntimeError(
                "Cannot apply database-integrity migration: existing data contains "
                f"{description}. Correct the affected records explicitly, then retry."
            )


def upgrade() -> None:
    _assert_existing_data_is_valid()

    op.create_unique_constraint(
        "uq_folders_id_user_id", "folders", ["id", "user_id"]
    )
    op.create_unique_constraint(
        "uq_documents_id_user_id", "documents", ["id", "user_id"]
    )

    op.drop_constraint(
        "folders_parent_folder_id_fkey", "folders", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_folders_parent_folder_owner",
        "folders", "folders",
        ["parent_folder_id", "user_id"], ["id", "user_id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "documents_folder_id_fkey", "documents", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_documents_folder_owner",
        "documents", "folders",
        ["folder_id", "user_id"], ["id", "user_id"],
        # PostgreSQL 15+ sets only folder_id to NULL, preserving document ownership.
        ondelete="SET NULL (folder_id)",
    )

    op.drop_constraint(
        "activities_document_id_fkey", "activities", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_activities_document_owner",
        "activities", "documents",
        ["document_id", "user_id"], ["id", "user_id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "document_shares_document_id_fkey", "document_shares", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_document_shares_document_owner",
        "document_shares", "documents",
        ["document_id", "owner_id"], ["id", "user_id"],
        ondelete="CASCADE",
    )

    op.create_check_constraint(
        "ck_users_token_version_non_negative", "users", "token_version >= 0"
    )
    op.create_check_constraint(
        "ck_documents_size_bytes_positive", "documents", "size_bytes > 0"
    )
    op.create_check_constraint(
        "ck_documents_current_version_positive", "documents", "current_version >= 1"
    )
    op.create_check_constraint(
        "ck_documents_status_valid",
        "documents",
        "status IN ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DELETED')",
    )
    op.create_check_constraint(
        "ck_document_versions_version_number_positive",
        "document_versions", "version_number >= 1",
    )
    op.create_check_constraint(
        "ck_document_versions_size_bytes_positive",
        "document_versions", "size_bytes > 0",
    )

    op.alter_column("users", "role", server_default="user")
    op.alter_column("users", "is_active", server_default=sa.text("true"))
    op.alter_column("documents", "current_version", server_default="1")
    op.alter_column("documents", "status", server_default="PENDING_UPLOAD")
    op.alter_column("document_shares", "permission", server_default="read")


def downgrade() -> None:
    op.alter_column("document_shares", "permission", server_default=None)
    op.alter_column("documents", "status", server_default=None)
    op.alter_column("documents", "current_version", server_default=None)
    op.alter_column("users", "is_active", server_default=None)
    op.alter_column("users", "role", server_default=None)

    op.drop_constraint(
        "ck_document_versions_size_bytes_positive", "document_versions", type_="check"
    )
    op.drop_constraint(
        "ck_document_versions_version_number_positive", "document_versions", type_="check"
    )
    op.drop_constraint("ck_documents_status_valid", "documents", type_="check")
    op.drop_constraint(
        "ck_documents_current_version_positive", "documents", type_="check"
    )
    op.drop_constraint(
        "ck_documents_size_bytes_positive", "documents", type_="check"
    )
    op.drop_constraint(
        "ck_users_token_version_non_negative", "users", type_="check"
    )

    op.drop_constraint(
        "fk_document_shares_document_owner", "document_shares", type_="foreignkey"
    )
    op.create_foreign_key(
        "document_shares_document_id_fkey",
        "document_shares", "documents", ["document_id"], ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "fk_activities_document_owner", "activities", type_="foreignkey"
    )
    op.create_foreign_key(
        "activities_document_id_fkey",
        "activities", "documents", ["document_id"], ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "fk_documents_folder_owner", "documents", type_="foreignkey"
    )
    op.create_foreign_key(
        "documents_folder_id_fkey",
        "documents", "folders", ["folder_id"], ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint(
        "fk_folders_parent_folder_owner", "folders", type_="foreignkey"
    )
    op.create_foreign_key(
        "folders_parent_folder_id_fkey",
        "folders", "folders", ["parent_folder_id"], ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("uq_documents_id_user_id", "documents", type_="unique")
    op.drop_constraint("uq_folders_id_user_id", "folders", type_="unique")
