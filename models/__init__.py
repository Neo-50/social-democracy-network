from db_init import db
from .user import User
from .news import NewsArticle, NewsComment
from .message import Message
from .chat import ChatMessage

NewsArticle.user = db.relationship('User', backref='articles')
NewsComment.user = db.relationship('User', back_populates='comments')
User.comments = db.relationship('NewsComment', back_populates='user', cascade='all, delete-orphan')

__all__ = ["User", "NewsArticle", "NewsComment", "Message"]
