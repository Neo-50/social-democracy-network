import os
from datetime import datetime

from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy

from utils.metadata_scraper import extract_metadata
from db_init import db
from news_system import NewsArticle, NewsComment

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Post model
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f'<Post {self.title}>'

# Routes for the news app
@app.route('/news', methods=['GET', 'POST'])
def news():
    if request.method == 'POST':
        url = request.form['url']
        metadata = extract_metadata(url)
        
        article = NewsArticle(
            url=url,
            title=metadata["title"],
            description=metadata["description"],
            image_url=metadata["image_url"],
            authors=metadata["authors"],
            published=metadata["published"],
            source=metadata["source"]
        )

        db.session.add(article)
        db.session.commit()
        return redirect(url_for('news'))

    articles = NewsArticle.query.order_by(NewsArticle.timestamp.desc()).all()
    return render_template('news.html', articles=articles)

# Routes for the forum app
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/new_post', methods=['GET', 'POST'])
def new_post():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        
        new_post = Post(title=title, content=content)
        db.session.add(new_post)
        db.session.commit()
        
        return redirect(url_for('forum'))

    return render_template('new_post.html')

@app.route('/environment')
def environment():
    # Placeholder: Replace with actual environment content
    return render_template('environment.html')

@app.route('/veganism')
def veganism():
    # Placeholder: Replace with actual veganism content
    return render_template('veganism.html')

@app.route('/forum')
def forum():
    posts = Post.query.order_by(Post.id.desc()).all()
    return render_template('forum.html', posts=posts)

# Create tables if they don't exist
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
