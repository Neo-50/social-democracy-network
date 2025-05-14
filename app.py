import os
from datetime import datetime

from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session, abort
from flask_sqlalchemy import SQLAlchemy

from utils.metadata_scraper import extract_metadata
from db_init import db
from news_system import NewsArticle, NewsComment
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-default-key')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please log in to continue.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    email_verified = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f'<Post {self.title}>'

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/activism')
def activism():
    # Placeholder: Replace with actual environment content
    return render_template('activism.html')

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

@app.route('/about')
def about():
    # Placeholder: Replace with actual veganism content
    return render_template('about.html')

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
    return render_template('news.html', articles=articles, is_admin=is_admin)

def is_admin():
    return session.get('user_id') and User.query.get(session['user_id']).is_admin

@app.route('/delete_comment/<int:comment_id>', methods=['POST'])
@login_required
def delete_comment(comment_id):
    comment = NewsComment.query.get_or_404(comment_id)

    if session['user_id'] != comment.user_id and not is_admin():
        abort(403)  # forbidden

    db.session.delete(comment)
    db.session.commit()
    return redirect(url_for('news'))

@app.route('/delete_article/<int:article_id>', methods=['POST'])
def delete_article(article_id):
    if not is_admin():
        flash("Access denied.")
        return redirect(url_for('news'))

    article = NewsArticle.query.get_or_404(article_id)
    db.session.delete(article)
    db.session.commit()
    flash("Article deleted.")
    return redirect(url_for('news'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            flash('Logged in successfully!')
            return redirect(url_for('news'))

        flash('Invalid email or password')
        return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out.')
    return redirect(url_for('news'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        # Check if user exists
        if User.query.filter((User.username == username) | (User.email == email)).first():
            flash('Username or email already taken.')
            return redirect(url_for('register'))

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        session['user_id'] = user.id
        session['username'] = user.username
        flash('Registration successful!')
        return redirect(url_for('news'))

    return render_template('register.html')

@app.route('/comment/<int:article_id>', methods=['POST'])
@login_required
def add_comment(article_id):
    content = request.form.get('content')
    parent_id = request.form.get('parent_id')
    if parent_id:
        parent_id = int(parent_id)

    if content:
        comment = NewsComment(
            content=content,
            article_id=article_id,
            user_id=session['user_id'],
            parent_id=parent_id if parent_id else None
        )
        db.session.add(comment)
        db.session.commit()

    return redirect(url_for('news'))

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

# Create tables if they don't exist
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
