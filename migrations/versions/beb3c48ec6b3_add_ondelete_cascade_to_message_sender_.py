"""Add ondelete cascade to Message sender/recipient

Revision ID: beb3c48ec6b3
Revises: 11cfe7e2cb3b
Create Date: 2025-06-01 01:59:08.531353

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'beb3c48ec6b3'
down_revision = '11cfe7e2cb3b'
branch_labels = None
depends_on = None


with op.batch_alter_table('message', schema=None) as batch_op:
    batch_op.drop_constraint('fk_message_recipient_id', type_='foreignkey', if_exists=True)
    batch_op.drop_constraint('fk_message_sender_id', type_='foreignkey', if_exists=True)

    batch_op.create_foreign_key(
        'fk_message_recipient_id', 'user', ['recipient_id'], ['id'], ondelete='CASCADE'
    )
    batch_op.create_foreign_key(
        'fk_message_sender_id', 'user', ['sender_id'], ['id'], ondelete='CASCADE'
    )

