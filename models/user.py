from db_init import db
from flask_login import UserMixin
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from .reactions import Reaction

class User(db.Model, UserMixin):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    display_name = db.Column(db.String(64))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    email_verified = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    avatar_filename = db.Column(db.String(120))
    locked = db.Column(db.Boolean, default=False)

    sent_messages = db.relationship(
        'Message',
        cascade='all, delete-orphan',
        foreign_keys='Message.sender_id',
        back_populates='sender'
    )

    received_messages = db.relationship(
        'Message',
        cascade='all, delete-orphan',
        foreign_keys='Message.recipient_id',
        back_populates='recipient'
    )

    last_active = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    current_page = db.Column(db.String(255), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    @property
    def is_active(self):
        return self.email_verified
    
    @property
    def is_admin_user(self):
        return self.is_admin

    def get_id(self):
        return str(self.id)
