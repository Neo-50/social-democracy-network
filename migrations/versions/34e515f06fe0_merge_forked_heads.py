"""merge forked heads

Revision ID: 34e515f06fe0
Revises: beb3c48ec6b3, efd2c036de97
Create Date: 2025-07-23 16:45:10.630783

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '34e515f06fe0'
down_revision = ('beb3c48ec6b3', 'efd2c036de97')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
