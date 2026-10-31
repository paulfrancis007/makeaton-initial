"""enable btree_gist extension

Revision ID: 0001_enable_btree_gist
Revises:
Create Date: 2026-10-31 12:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_enable_btree_gist"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # btree_gist extension is required for GiST exclusion constraints on UUID and DATE ranges
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")


def downgrade() -> None:
    # Reversible migration: drop extension on rollback
    op.execute("DROP EXTENSION IF EXISTS btree_gist;")
