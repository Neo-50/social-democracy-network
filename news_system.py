from db_init import db
from datetime import datetime

class NewsArticle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(300), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    authors = db.Column(db.String(200), nullable=True)
    published = db.Column(db.String(100), nullable=True)  # ✅ new
    source = db.Column(db.String(100), nullable=True)     # ✅ new
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship('NewsComment', backref='article', lazy=True)

class NewsComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    article_id = db.Column(db.Integer, db.ForeignKey('news_article.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
