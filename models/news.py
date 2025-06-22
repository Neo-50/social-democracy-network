from db_init import db
from datetime import datetime, timezone
import html

class NewsArticle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL', name='fk_news_article_user_id'), nullable=True)
    url = db.Column(db.String(300), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    authors = db.Column(db.String(200), nullable=True)
    published = db.Column(db.Date, nullable=True)
    source = db.Column(db.String(100), nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    category = db.Column(db.String(50), nullable=True)
    needs_scrape = db.Column(db.Boolean, default=False)

    def formatted_description(self):
        if self.description:
            safe = html.escape(self.description)
            return safe.replace('\n', '<br />')
        return ''

    comments = db.relationship('NewsComment', backref='article', cascade='all, delete-orphan', lazy=True)

class NewsComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    article_id = db.Column(
        db.Integer,
        db.ForeignKey('news_article.id', ondelete='CASCADE', name='fk_news_comment_article_id'),
        nullable=False
    )
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('user.id', ondelete='CASCADE', name='fk_news_comment_user_id'), 
        nullable=False
    )
    parent_id = db.Column(
        db.Integer,
        db.ForeignKey('news_comment.id', name='fk_news_comment_parent_id'),
        nullable=True
    )
    def formatted_content(self):
        return self.content

    replies = db.relationship(
        'NewsComment',
        backref=db.backref('parent', remote_side=[id]),
        cascade='all, delete-orphan'
    )