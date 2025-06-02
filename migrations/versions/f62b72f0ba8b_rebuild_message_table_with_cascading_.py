"""Rebuild message table with cascading deletes

Revision ID: f62b72f0ba8b
Revises: 11cfe7e2cb3b
Create Date: 2025-06-01 18:03:30.245533

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f62b72f0ba8b'
down_revision = '11cfe7e2cb3b'
branch_labels = None
depends_on = None

"""Rebuild message table with cascade delete on sender/recipient"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Rename old table
    op.rename_table('message', 'message_old')

    # Recreate new table with proper constraints
    op.create_table(
        'message',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sender_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE', name='fk_message_sender_id'), nullable=False),
        sa.Column('recipient_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE', name='fk_message_recipient_id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('read', sa.Boolean(), nullable=True)
    )

    # Copy data over
    op.execute("""
        INSERT INTO message (id, sender_id, recipient_id, content, timestamp, read)
        SELECT id, sender_id, recipient_id, content, timestamp, read FROM message_old
    """)

    # Drop old table
    op.drop_table('message_old')

def downgrade():
    # Reverse the upgrade steps
    op.rename_table('message', 'message_new')

    op.create_table(
        'message',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sender_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('recipient_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('read', sa.Boolean(), nullable=True)
    )

    op.execute("""
        INSERT INTO message (id, sender_id, recipient_id, content, timestamp, read)
        SELECT id, sender_id, recipient_id, content, timestamp, read FROM message_new
    """)

    op.drop_table('message_new')
