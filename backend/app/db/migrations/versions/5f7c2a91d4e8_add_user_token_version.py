"""add user token version for account-wide logout revocation

Revision ID: 5f7c2a91d4e8
Revises: 39da3f9f768c
Create Date: 2026-11-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5f7c2a91d4e8"
down_revision: Union[str, Sequence[str], None] = "39da3f9f768c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
