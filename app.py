import os
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session, abort, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail, Message
from sqlalchemy import Boolean, Column
from utils.metadata_scraper import extract_metadata
from db_init import db
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from utils.email import confirm_verification_token, send_verification_email

app = Flask(__name__)

app.config['MAIL_SERVER'] = 'smtp.zoho.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'admin@social-democracy.net'
app.config['MAIL_PASSWORD'] = 'fluFfy4ferrEt$areNice9'  # use Zoho app password here
app.config['MAIL_DEFAULT_SENDER'] = 'admin@social-democracy.net'

mail = Mail(app)

app.secret_key = os.environ.get('SECRET_KEY', 'dev-default-key')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please log in to continue.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///dev.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Constants
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# Flask config (optional fallback, not enforced unless you hook into it)
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

from news_system import NewsArticle, NewsComment, Vote
migrate = Migrate(app, db)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    email_verified = db.Column(db.Boolean, default=False)
    avatar_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    avatar_filename = db.Column(db.String(120))


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
    
@app.route('/media/<path:filename>')
def media(filename):
    print("Serving from /mnt/storage:", filename)
    return send_from_directory('mnt/storage', filename)

@app.route('/media/avatars/<filename>')
def avatar(filename):
    print("Serving avatar:", filename)
    return send_from_directory('/mnt/storage/avatars', filename)


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

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = db.session.get(User, session['user_id'])

    if request.method == 'POST':
        # Handle avatar upload
        file = request.files.get('avatar')
        if file and allowed_file(file.filename):
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            if file_size > MAX_FILE_SIZE:
                flash("Avatar image is too large (max 2MB).")
                return redirect(request.url)

            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{user.username}.{ext}"
            path = os.path.join('/mnt/storage/avatars', filename)
            file.save(path)
            user.avatar_filename = filename
            db.session.commit()

        elif file and file.filename:
            flash("Invalid file type. Please upload a PNG, JPG, JPEG, or GIF.")
            return redirect(request.url)

        # Update bio
        user.bio = request.form.get('bio', '')
        db.session.commit()
        flash("Profile updated.")
        return redirect(url_for('profile'))

    return render_template('profile.html', user=user)

def is_admin():
    return session.get('user_id') and User.query.get(session['user_id']).is_admin

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return redirect(url_for('register'))

        # Check if user exists
        if User.query.filter((User.username == username) | (User.email == email)).first():
            flash('Username or email already taken.')
            return redirect(url_for('register'))

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        from utils.email import send_verification_email
        send_verification_email(user, mail)

        session['user_id'] = user.id
        session['username'] = user.username
        flash('Registration successful, verification email sent.')
        return redirect(url_for('register'))

    return render_template('register.html')

@app.route('/verify/<token>')
def verify_email(token):
    email = confirm_verification_token(token)
    if not email:
        flash('Invalid or expired verification link.', 'danger')
        return redirect(url_for('login'))

    user = User.query.filter_by(email=email).first_or_404()

    if user.email_verified:
        flash('Your email is already verified. You can log in.', 'info')
    else:
        user.email_verified = True
        db.session.commit()
        flash('Email verified successfully! You may now log in.', 'success')

    return redirect(url_for('login'))

@app.route('/resend_verification_email', methods=['GET', 'POST'])
def resend_verification_email():
    if request.method == 'POST':
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()

        if not user:
            flash('No account found with that email.', 'danger')
        elif user.email_verified:
            flash('Email is already verified.', 'info')
        else:
            send_verification_email(user, mail)
            flash('Verification email resent.', 'success')

        return redirect(url_for('register.html'))

    return render_template('register.html')

@app.context_processor
def inject_user():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        return dict(current_user=user)
    return dict(current_user=None)

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
            if not user.email_verified:
                flash('Please verify your email before logging in.', 'warning')
                return redirect(url_for('login'))

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

@app.route('/vote', methods=['POST'])
@login_required
def vote():
    data = request.get_json()
    comment_id = data.get('comment_id')
    value = data.get('value')  # Should be +1 or -1
    user_id = session['user_id']

    if value not in [1, -1]:
        return jsonify({'error': 'Invalid vote value'}), 400

    existing_vote = Vote.query.filter_by(user_id=user_id, comment_id=comment_id).first()

    if existing_vote:
        if existing_vote.value == value:
            # Unvote (toggle off)
            db.session.delete(existing_vote)
        else:
            # Switch vote
            existing_vote.value = value
    else:
        # New vote
        new_vote = Vote(user_id=user_id, comment_id=comment_id, value=value)
        db.session.add(new_vote)

    db.session.commit()

    # Return new total score
    total_score = db.session.query(db.func.sum(Vote.value)).filter_by(comment_id=comment_id).scalar() or 0
    return jsonify({'score': total_score})


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

@app.route('/edit_profile', methods=['GET', 'POST'])
def edit_profile():
    return render_template('edit_profile.html')

# Create tables if they don't exist
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
