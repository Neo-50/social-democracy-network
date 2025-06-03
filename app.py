import os
from db_init import db
from models import User, NewsArticle, NewsComment, Message
from datetime import datetime, timedelta, timezone
from dateutil import parser
import re
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer
from markupsafe import Markup
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session, abort, send_from_directory, current_app
from flask_login import current_user, login_user, login_required, logout_user, LoginManager
from flask_migrate import Migrate
from flask_mail import Mail
from flask_mail import Message as flask_message
from utils.metadata_scraper import extract_metadata
from werkzeug.exceptions import RequestEntityTooLarge
from utils.email import confirm_verification_token, send_verification_email
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback_dev_key')
app.config['SESSION_COOKIE_SECURE'] = True  # Required for HTTPS-only cookies
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Good default for login forms
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevents JavaScript from accessing session cookie

app.config['MAIL_SERVER'] = 'smtp.zoho.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'admin@social-democracy.net'
app.config['MAIL_PASSWORD'] = 'fLuffy2feRret$arENice7'  # use Zoho app password here
app.config['MAIL_DEFAULT_SENDER'] = 'admin@social-democracy.net'

app.config['MAX_CONTENT_LENGTH'] = 1.8 * 1024 * 1024  # 2 MB limit

serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

mail = Mail(app)
basedir = os.path.abspath(os.path.dirname(__file__))
if os.environ.get("FLASK_ENV") == "production":
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'site.db')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please log in to continue.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=12)

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlite3 import Connection as SQLite3Connection

@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, SQLite3Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

login_manager.session_protection = "strong"
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Constants
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# Flask config (optional fallback, not enforced unless you hook into it)
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

migrate = Migrate(app, db)

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/news', methods=['GET', 'POST'])
def news():
    if request.method == 'POST':
        if not session.get('user_id'):
            flash("You must be logged in to post an article.", "danger")
            return redirect(url_for('news'))

        url = request.form['url']
        
        existing_article = NewsArticle.query.filter_by(url=url).first()
        if existing_article:
            flash("This article has already been submitted.", "danger")
            return redirect(url_for('news'))

        category = request.form.get('category', '').strip()
        metadata = extract_metadata(url)
        published_str=metadata.get("published", "")
        article = NewsArticle(
            url=url,
            category=category,
            title=metadata["title"],
            description=metadata["description"],
            image_url=metadata["image_url"],
            authors=metadata["authors"],
            published = parser.parse(published_str).date() if published_str else None,
            source=metadata["source"],
            user_id=session.get("user_id")
        )
        db.session.add(article)
        db.session.commit()
        flash("Article submitted successfully!", "success")

        return redirect(url_for('news'))  # 🚨 Prevent falling through to render

    # GET logic
    selected_category = request.args.get('category')
    highlight_id = request.args.get("article", type=int)
    sort_order = request.args.get('sort', 'desc')
    order_func = NewsArticle.published.asc() if sort_order == 'asc' else NewsArticle.published.desc()

    if selected_category:
        articles = NewsArticle.query \
            .filter_by(category=selected_category) \
            .filter(NewsArticle.id != highlight_id) \
            .order_by(order_func) \
            .all()
    else:
        articles = NewsArticle.query \
            .filter(NewsArticle.id != highlight_id) \
            .order_by(order_func) \
            .all()
    
    highlighted = None
    try:
        highlight_id_int = int(highlight_id) if highlight_id is not None else None
        if highlight_id_int is not None:
            highlighted = NewsArticle.query.get(highlight_id_int)
            if highlighted:
                articles.insert(0, highlighted)
    except (ValueError, TypeError):
        highlighted = None

    count = len(articles)

    return render_template(
        'news.html',
        articles=articles,
        is_admin=is_admin,
        highlight_id=highlight_id,
        article_to_highlight=highlighted,
        selected_category=selected_category,
        count=count
    )

@app.route('/activism')
def activism():
    return render_template('activism.html')

@app.route('/environment')
def environment():
    return render_template('environment.html')

@app.route('/veganism')
def veganism():
    return render_template('veganism.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))

    user = current_user
    file = request.files.get('avatar')
    
    if request.method == 'POST':
        if file and file.filename:
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)

            if file_size > MAX_FILE_SIZE:
                flash("Avatar image is too large (max 2MB).", "danger")
                return redirect(request.url)

            if allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"{user.username}.{ext}"
                path = os.path.join('/mnt/storage/avatars', filename)
                file.save(path)
                user.avatar_filename = filename
            else:
                flash("Invalid file type. Please upload a PNG, JPG, JPEG, or GIF.")
                return redirect(request.url)

        user.bio = request.form.get('bio', '')
        db.session.commit()
        flash("Profile updated.", "success")
        return redirect(url_for('profile'))

    return render_template('profile.html', user=user)

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


        flash('Registration successful. Please check your email to verify your account.', 'info')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/messages', methods=['GET', 'POST'])
@app.route('/messages/<username>', methods=['GET', 'POST'])
@login_required
def messages(username=None):
    user_id = session.get("user_id")

    recipient = None  # initialize here in case it's used below

    if username:
        recipient = User.query.filter_by(username=username).first_or_404()

    conversations = User.query.join(
        Message,
        ((Message.sender_id == User.id) & (Message.recipient_id == user_id)) |
        ((Message.recipient_id == User.id) & (Message.sender_id == user_id))
    ).filter(User.id != user_id).distinct().all()

    # Get all other users for the dropdown
    all_users = User.query.filter(User.id != user_id).order_by(User.username).all()

    messages = []

    # Send message logic
    if request.method == 'POST':
        recipient_id = request.form.get('recipient_id', type=int)
        content = request.form.get('content', '').strip()
        recipient = User.query.get(recipient_id)

        if recipient and content:
            msg = Message(sender_id=user_id, recipient_id=recipient.id, content=content)
            db.session.add(msg)
            db.session.commit()
            flash("Message sent!", "success")

            return redirect(url_for('messages', recipient_id=recipient.username))

    # If a recipient was selected (or just messaged), show the thread
    if recipient:
        messages = Message.query.filter(
            ((Message.sender_id == user_id) & (Message.recipient_id == recipient.id)) |
            ((Message.sender_id == recipient.id) & (Message.recipient_id == user_id))
        ).order_by(Message.timestamp).all()

        # Mark as read
        for msg in messages:
            if msg.recipient_id == user_id and not msg.read:
                msg.read = True
        db.session.commit()

    return render_template(
        'messages.html',
        users=all_users,
        messages=messages,
        recipient=recipient,
        conversations=conversations
    )

@app.route('/media/<path:filename>')
def media(filename):
    print("Serving from /mnt/storage:", filename)
    return send_from_directory('mnt/storage', filename)

@app.route('/media/avatars/<filename>')
def avatar(filename):
    if os.environ.get('FLASK_ENV') != 'production':
        base_path = os.path.join(current_app.root_path, 'mnt', 'storage', 'avatars')
    else:
        base_path = '/mnt/storage/avatars'

    full_path = os.path.join(base_path, filename)
    print(">>> Attempting to serve avatar from:", full_path)

    return send_from_directory(base_path, filename)

@app.template_filter('datetimeformat')
def datetimeformat(value, format="%B %d, %Y"):
    try:
        return value.strftime(format)
    except (AttributeError, ValueError, TypeError):
        return value

@app.route('/update_category/<int:article_id>', methods=['POST'])
@login_required
def update_article_category(article_id):
    if not current_user.is_admin:
        abort(403)

    new_category = request.form.get('new-category', '').strip()
    article = NewsArticle.query.get_or_404(article_id)
    article.category = new_category
    db.session.commit()
    flash('Category updated successfully.', 'success')
    print(f"New category submitted: {new_category}")
    return redirect(url_for('news'))

@app.before_request
def log_incoming_request():
    print("Request received:", request.method, request.path)

@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(e):
    flash("File is too large. Max size is 2MB.")
    return redirect(request.url)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/edit_article/<int:article_id>', methods=['POST'])
@login_required
def edit_article(article_id):
    if not is_admin():
        abort(403)

    article = NewsArticle.query.get_or_404(article_id)
    article.title = request.form.get('title') or article.title
    article.source = request.form.get('source') or article.source
    article.description = request.form.get('description') or article.description
    pub = request.form.get('published')
    if pub:
        try:
            article.published = datetime.strptime(pub, "%Y-%m-%d").date()
        except ValueError:
            flash("Invalid date format. Use YYYY-MM-DD.", "danger")

    db.session.commit()
    flash("Article updated.", "success")
    return redirect(url_for('news'))

def is_admin():
    return current_user.is_authenticated and current_user.is_admin

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

@app.route('/admin_tools')
@login_required
def admin_tools():
    if not current_user.is_admin:
        abort(403)  # Forbidden
    users = User.query.all()
    return render_template('admin_tools.html', users=users)

@app.route('/comment/<int:article_id>', methods=['POST'])
@login_required
def add_comment(article_id):
    content = request.form.get('comment-content')
    parent_id = request.form.get('parent_id')
    if parent_id:
        parent_id = int(parent_id)

    if content:
        comment = NewsComment(
            content=content,
            article_id=article_id,
            user_id=current_user.get_id(),
            parent_id=parent_id if parent_id else None
        )
        db.session.add(comment)
        db.session.commit()
    flash("Comment posted successfully.", "success")
    return redirect(url_for('news'))

@app.route('/delete_comment/<int:comment_id>', methods=['POST'])
@login_required
def delete_comment(comment_id):
    comment = NewsComment.query.get_or_404(comment_id)

    if int(current_user.get_id()) != comment.user_id and not is_admin():
        abort(403)

    db.session.delete(comment)
    db.session.commit()
    flash("Comment deleted successfully.", "success")
    return redirect(url_for('news'))

@app.route('/delete_article/<int:article_id>', methods=['POST'])
def delete_article(article_id):
    if 'user_id' not in session:
        flash("Access denied.")
        return redirect(url_for('news'))

    article = NewsArticle.query.get_or_404(article_id)
    user = User.query.get(session['user_id'])

    if not (user.is_admin or article.user_id == user.id):
        flash("Access denied.")
        return redirect(url_for('news'))

    db.session.delete(article)
    db.session.commit()
    flash("Article deleted.")
    return redirect(url_for('news'))

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out.')
    return redirect(url_for('news'))

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    if current_user.is_anonymous:
        flash("You're not logged in.", "error")
        return redirect(url_for('login'))

    user_id_from_form = request.form.get('user_id')
    if str(current_user.get_id()) != user_id_from_form:
        flash("Invalid request.", "error")
        return redirect(url_for('profile', username=current_user.username))

    user = current_user._get_current_object()
    db.session.delete(user)
    db.session.commit()
    logout_user()
    session.clear()
    flash("Your account has been deleted.", "success")
    return redirect(url_for('home'))

@app.route('/admin_delete_user/<int:user_id>', methods=['POST'])
@login_required
def admin_delete_user(user_id):
    if not current_user.is_admin:
        abort(403)

    user = User.query.get_or_404(user_id)

    if user.id == current_user.id:
        flash("You can't delete your own account from the admin panel.", "error")
        return redirect(url_for('admin_tools'))

    db.session.delete(user)
    db.session.commit()
    flash(f"User '{user.username}' has been deleted.", "success")
    return redirect(url_for('admin_tools'))

@app.route('/emojis/<filename>')
def emoji(filename):
    return send_from_directory('/mnt/storage/emojis', filename)

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
            session.permanent = True
            login_user(user)
            session['user_id'] = user.id

            return redirect(url_for('home'))

        flash('Invalid email or password')

        if user:
            print("Entered password (raw):", password)
            print("Stored hash:", user.password_hash)
        else:
            print("No user found for email:", email)

        return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password_token(token):
    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=3600)
    except Exception:
        flash("The reset link is invalid or has expired.")
        return redirect(url_for('login'))

    user = User.query.filter_by(email=email).first_or_404()

    if request.method == 'POST':
        new_password = request.form['password']
        user.set_password(new_password)
        db.session.commit()
        flash("Your password has been successfully reset.")
        return redirect(url_for('login'))

    return render_template(
        'change_password.html',
        show_reset_form=True,
        reset_token=token
    )

@app.route('/admin/reset_password/<int:user_id>', methods=['POST'])
@login_required
def reset_password_admin(user_id):
    if not current_user.is_admin:
        flash("Access denied.")
        return redirect(url_for('home'))

    user = User.query.get_or_404(user_id)
    new_password = request.form['new_password']
    user.set_password = generate_password_hash(new_password)
    db.session.commit()
    flash(f"Password reset for user {user.username}")
    return redirect(url_for('admin_tools'))

@app.route('/forgot_password', methods=['POST'])
def forgot_password():
    email = request.form['email']
    user = User.query.filter_by(email=email).first()
    if user:
        token = serializer.dumps(user.email, salt='password-reset-salt')

        reset_url = url_for('reset_password_token', token=token, _external=True)

        if not app.debug and '127.0.0.1' in reset_url:
            reset_url = reset_url.replace('127.0.0.1:5000', 'social-democracy.net')

        msg = flask_message(
            "Reset Your Password for Social Democracy Network",
            recipients=[user.email],
            body=f"Click the link below to reset your password:\n\n{reset_url}"
        )

        mail.send(msg)

        flash("A reset link has been sent to your email.")
    else:
        flash("If the email exists, a reset link will be sent.")
    return redirect(url_for('login'))

@app.context_processor
def inject_user():
    if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
        user = User.query.get(current_user.get_id())
        return dict(current_user_obj=user)
    return dict(current_user_obj=None)

@app.context_processor
def inject_timezone():
    return {'timezone': timezone}

@app.template_filter("emojify")
def emojify(content):
    def replace(match):
        name = match.group(1)
        # Try each extension
        for ext in ['.png', '.gif', '.webp']:
            path = os.path.join('mnt/storage/emojis', name + ext)
            if os.path.exists(path):
                return f'<img src="media/emojis/{name}{ext}" alt="{name}" class="inline-emoji">'
        return match.group(0)  # fallback, keep text if not found

    return Markup(re.sub(r":([a-zA-Z0-9_]+):", replace, content))

'''
@app.route('/forum')
def forum():
    posts = Post.query.order_by(Post.id.desc()).all()
    return render_template('forum.html', posts=posts)

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)

 class Post(db.Model):
     id = db.Column(db.Integer, primary_key=True)
     title = db.Column(db.String(200), nullable=False)
     content = db.Column(db.Text, nullable=False)
     def __repr__(self):
         return f'<Post {self.title}>'
'''