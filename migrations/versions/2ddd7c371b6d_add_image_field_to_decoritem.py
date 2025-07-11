"""Add image field to DecorItem

Revision ID: 2ddd7c371b6d
Revises: 01d97b437a07
Create Date: 2025-06-01 17:56:34.531943

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2ddd7c371b6d'
down_revision = '01d97b437a07'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('decor_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image', sa.String(length=200), nullable=False))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('decor_item', schema=None) as batch_op:
        batch_op.drop_column('image')

    # ### end Alembic commands ###
