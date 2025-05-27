"""Convert published to Date

Revision ID: a9151e841193
Revises: f33a469986e5
Create Date: 2025-05-26 20:32:18.352782

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9151e841193'
down_revision = 'f33a469986e5'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('news_article', 'published')
    op.add_column('news_article', sa.Column('published', sa.Date(), nullable=True))

def downgrade():
    op.drop_column('news_article', 'published')
    op.add_column('news_article', sa.Column('published', sa.String(length=100), nullable=True))

    # ### end Alembic commands ###
