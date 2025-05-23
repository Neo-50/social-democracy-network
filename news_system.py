from db_init import db
from datetime import datetime

class NewsArticle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(300), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    authors = db.Column(db.String(200), nullable=True)
    published = db.Column(db.String(100), nullable=True)
    source = db.Column(db.String(100), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship('NewsComment', backref='article', lazy=True)

class NewsComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    article_id = db.Column(db.Integer, db.ForeignKey('news_article.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE', name='fk_news_comment_user_id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('news_comment.id'))

    replies = db.relationship(
        'NewsComment',
        backref=db.backref('parent', remote_side=[id]),
        cascade='all, delete-orphan'
    )

    user = db.relationship('User', back_populates='comments')

