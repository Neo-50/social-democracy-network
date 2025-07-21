from db_init import db
from datetime import datetime

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE', name='fk_message_sender_id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE', name='fk_message_recipient_id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)

    sender = db.relationship(
        'User',
        foreign_keys=[sender_id],
        back_populates='sent_messages'
    )

    recipient = db.relationship(
        'User',
        foreign_keys=[recipient_id],
        back_populates='received_messages'
    )
