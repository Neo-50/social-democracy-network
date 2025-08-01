import os
import logging
import random
import string
from bleach import clean
from bleach.css_sanitizer import CSSSanitizer
from bs4 import BeautifulSoup
from db_init import db
from models import User, NewsArticle, NewsComment, Message, ChatMessage, Reaction
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from dateutil import parser
import re
import subprocess
from itsdangerous import URLSafeTimedSerializer
from markupsafe import Markup
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session, abort, send_from_directory, Response, jsonify, g
from flask_login import current_user, login_user, login_required, logout_user, LoginManager
from flask_socketio import SocketIO, emit, join_room
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_mail import Mail
from flask_mail import Message as flask_message
from utils.metadata_scraper import extract_metadata
from werkzeug.exceptions import RequestEntityTooLarge
from utils.metadata_scraper import try_youtube_scrape
from utils.email_utils import confirm_verification_token, send_verification_email
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 30 * 1024 * 1024  # 30MB
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback_dev_key')
app.config['SESSION_COOKIE_SECURE'] = True  # Required for HTTPS-only cookies
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Good default for login forms
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevents JavaScript from accessing session cookie

app.config['MAIL_SERVER'] = 'smtp.zoho.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'admin@social-democracy.net'
app.config['MAIL_PASSWORD'] = 'QA50y5Xp320F'  # use Zoho app password here
app.config['MAIL_DEFAULT_SENDER'] = 'admin@social-democracy.net'
print("MAX_CONTENT_LENGTH:", app.config["MAX_CONTENT_LENGTH"])

serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

mail = Mail(app)
basedir = os.path.abspath(os.path.dirname(__file__))
if os.environ.get("FLASK_ENV") == "production":
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'site.db')

print("Using DB:", app.config['SQLALCHEMY_DATABASE_URI'])

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

from sqlalchemy import event, or_
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

migrate = Migrate(app, db)
csrf = CSRFProtect(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@login_manager.user_loader
def load_user(user_id):
    user = User.query.get(int(user_id))
    if user and not user.locked:
        return user
    return User.query.get(int(user_id))

@app.before_request
def update_user_last_active():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            if current_user.is_authenticated and user.locked:
                logout_user()
                if 'locked_flash_sent' not in session:
                    flash("Your account has been locked.", "error")
                    session['locked_flash_sent'] = True
                if request.endpoint != 'login':
                    return redirect(url_for('login'))

            now = datetime.now(timezone.utc)
            if not user.last_active or (
                now - user.last_active.replace(tzinfo=timezone.utc)
            ).total_seconds() > 30:
                user.last_active = now
                user.current_page = request.path  # optional
                db.session.commit()

            g.current_user = user

def get_online_users():
    app.logger.info('Handler reached')
    threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    return User.query.filter(User.last_active >= threshold).all()

def get_offline_users():
    threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    return User.query.filter(
        or_(User.last_active < threshold, User.last_active == None)
    ).all()

@app.route('/active-users')
@login_required
def active_users(): 
    online = get_online_users()
    offline = get_offline_users()
    def user_data(user):
        return {
            'id': user.id,
            'username': user.username,
            'display_name': user.display_name or user.username,
            'bio': user.bio or "No bio available",
            'avatar_url': url_for('media', filename=f'avatars/{user.avatar_filename}') if user.avatar_filename else url_for('media', filename='avatars/default_avatar.png')
        }
    return jsonify({
        'online': [user_data(u) for u in online],
        'offline': [user_data(u) for u in offline],
})

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
        needs_scrape = metadata.get("needs_scrape", False)
        
        # scrape_id = request.args.get("scrape", type=int)

        article = NewsArticle(
            url=url,
            category=category,
            title=metadata["title"],
            description=metadata["description"],
            image_url=metadata["image_url"],
            authors=metadata["authors"],
            published = parser.parse(published_str).date() if published_str else None,
            source=metadata["source"],
            needs_scrape=needs_scrape,
            user_id=session.get("user_id")
        )
        db.session.add(article)
        db.session.commit()
        flash("Article submitted successfully!", "success")

        # Background metadata scrape
        if needs_scrape:
            subprocess.Popen([
            "systemd-run", "--user", "--scope",
            "-p", "MemoryMax=500M",
            "--working-directory=/home/doug/social-democracy-network",
            "/home/doug/.local/bin/poetry", "run", "python", "utils/scraper_worker.py",
            str(article.id), url
        ])
        if needs_scrape:
            return redirect(url_for("news", category=article.category, article=article.id, scrape=article.id))
        else:
            return redirect(url_for("news", category=article.category, article=article.id))

    # GET logic
    selected_category = request.args.get('category')
    highlight_id = request.args.get("article", type=int)
    scrape_id = request.args.get("scrape", type=int)
    sort_order = request.args.get('sort', 'desc')
    limit = request.args.get('limit', '20')
    order_func = NewsArticle.published.asc() if sort_order == 'asc' else NewsArticle.published.desc()
    

    if selected_category:
        articles_query = NewsArticle.query \
            .filter_by(category=selected_category) \
            .filter(NewsArticle.id != highlight_id) \
            .order_by(order_func)
    else:
        articles_query = NewsArticle.query \
            .filter(NewsArticle.id != highlight_id) \
            .order_by(order_func)
    
    if limit != 'all':
        try:
            limit_int = int(limit)
            articles = articles_query.limit(limit_int).all()
        except ValueError:
            articles = articles_query.limit(20).all()
    else:
        articles = articles_query.all()

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

    for article in articles:
        if "youtube.com" in article.url or "youtu.be" in article.url:
            scraped = extract_metadata(article.url)
            if scraped and scraped.get("embed_html"):
                article.embed_html = scraped["embed_html"]

    # Use `group_concat` on SQLite and `array_agg` on Postgres
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith("sqlite"):
        reactions = (
            db.session.query(
                Reaction.target_id,
                Reaction.emoji,
                func.count(Reaction.id).label("count"),
                func.group_concat(Reaction.user_id).label("user_ids")
            )
            .filter(Reaction.target_type == "news")
            .group_by(Reaction.target_id, Reaction.emoji)
            .all()
        )

        # Convert the user_ids string into list of ints (safe for empty strings)
        reaction_map = {}
        for r in reactions:
            key = f"news:{r.target_id}"  # Use string key from the beginning

            if key not in reaction_map:
                reaction_map[key] = []

            user_ids = [int(uid) for uid in r.user_ids.split(",")] if r.user_ids else []

            reaction_map[key].append({
                "emoji": r.emoji,
                "count": r.count,
                "user_ids": user_ids,
                "target_id": r.target_id,
            })

    else:
        # Assume Postgres
        reactions = (
            db.session.query(
                Reaction.target_id,
                Reaction.emoji,
                func.count(Reaction.id).label("count"),
                func.array_agg(Reaction.user_id).label("user_ids"),
            )
            .filter(Reaction.target_type == "news")
            .group_by(Reaction.target_id, Reaction.emoji)
            .all()
        )

        reaction_map = {}
        for r in reactions:
            key_str = f"news:{r.target_id}"
            if key_str not in reaction_map:
                reaction_map[key_str] = []

            reaction_map[key_str].append({
                "emoji": r.emoji,
                "count": r.count,
                "user_ids": r.user_ids,
                "target_id": r.target_id,
            })

    return render_template(
        'news.html',
        articles=articles,
        is_admin=is_admin,
        highlight_id=highlight_id,
        scrape_id=scrape_id,
        article_to_highlight=highlighted,
        selected_category=selected_category,
        count=count,
        reaction_map=reaction_map
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

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user = current_user)

@app.route('/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    file = request.files.get('avatar')
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{current_user.username}.{ext}"
        path = get_media_path('avatars', filename)
        file.save(path)

        current_user.avatar_filename = filename
        db.session.commit()
        flash("Avatar updated", "success")
    return redirect(url_for('profile'))

@app.route('/admin/upload_avatar/<int:user_id>', methods=['POST'])
@login_required
def admin_upload_avatar(user_id):
    if not current_user.is_admin:
        abort(403)

    user = User.query.get_or_404(user_id)
    file = request.files.get('avatar')

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user.username}.{ext}"
        path = get_media_path('avatars', filename)
        file.save(path)

        user.avatar_filename = filename
        db.session.commit()

        flash(f"Updated avatar for {user.username}", "success")
    else:
        flash("Invalid file format", "error")

    return redirect(url_for('admin_tools'))

@app.route('/update_display_name', methods=['POST'])
@login_required
def update_display_name():
    new_name = request.form.get('display_name', '').strip()
    
    try:
        current_user.display_name = new_name
        db.session.commit()
        flash('Display name updated successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Failed to update display name: {e}', 'danger')

    return redirect(url_for('profile'))

@app.route('/update_bio', methods=['POST'])
@login_required
def update_bio():
    current_user.bio = request.form.get('bio', '')
    db.session.commit()
    flash("Profile updated.", "success")
    return redirect(url_for('profile'))

@app.route('/profile_change_password', methods=['POST'])
@login_required
def profile_change_password():
    new = request.form.get('new_password')
    confirm = request.form.get('confirm_password')

    if new != confirm:
        flash("Passwords do not match.", "danger")
        return redirect(url_for('profile'))

    if len(new) < 8:
        flash("Password must be at least 8 characters long.", "danger")
        return redirect(url_for('profile'))

    current_user.set_password(new)
    db.session.commit()
    flash("Password changed", "success")
    return redirect(url_for('profile'))

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
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

@socketio.on("toggle_reaction", namespace="/reactions")
@login_required
def toggle_reaction(data):
    app.logger.info("Toggle reaction called")
    emoji = data.get("emoji")
    target_type = data.get("target_type")
    target_id = data.get("target_id")
    users = data.get("users")
    action = data.get("action")
    
    if not emoji or not target_type or not target_id or action not in {"add", "remove"}:
        print('Data error on toggle_reaction: ', emoji, target_type, target_id, action)
        return

    reaction = Reaction.query.filter_by(
        user_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
        emoji=emoji
    ).first()

    if action == "add" and not reaction:
        reaction = Reaction(
            user_id=current_user.id,
            target_type=target_type,
            target_id=target_id,
            emoji=emoji,
        )
        db.session.add(reaction)

    elif action == "remove" and reaction:
        db.session.delete(reaction)

    db.session.commit()
    
    print(f"[toggle_reaction] Emitting reaction_update: {emoji=} {target_type=} {target_id=} {current_user.id=} {users} {action=}")
    socketio.emit("reaction_update", {
		"emoji": emoji,
		"target_type": target_type,
		"target_id": target_id,
		"user_id": current_user.id,
        "users": users,
		"action": action,
		"room_id": "news",
	}, namespace="/reactions")


@app.route('/check_metadata_status/<int:article_id>')
def check_metadata_status(article_id):
    article = NewsArticle.query.get(article_id)
    if not article:
        return {"status": "not_found"}, 404

    complete = article and not article.needs_scrape and article.title and article.description != f"Blocked by {article.source}"
    if complete:
        return {"status": "ready"}

    return {"status": "pending"}

@app.route("/chat")
@login_required
def chat():
    messages = ChatMessage.query.order_by(ChatMessage.timestamp.asc()).all()
    return render_template("chat.html", messages=messages)

@app.route("/chat_intro")
def chat_intro():
    return render_template("chat_intro.html", messages=messages)

@app.route('/.well-known/matrix/<path:filename>')
def well_known_matrix(filename):
    full_path = os.path.join(app.root_path, 'static', '.well-known', 'matrix')
    with open(os.path.join(full_path, filename)) as f:
        contents = f.read()
    response = Response(contents, mimetype='application/json')
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def get_media_path(*parts):
    return os.path.join(app.root_path, 'mnt', 'storage', *parts)

@app.route('/media/<path:filename>')
def media(filename):
    full_media_path = get_media_path()  # Base: /mnt/storage
    print("Serving from:", full_media_path, "Filename:", filename)
    return send_from_directory(full_media_path, filename)   

@app.route('/media/widgets/<path:filename>')
def widget_static(filename):
    return send_from_directory('static/widgets', filename)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        # Basic password rules
        if len(password) < 8 or not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
            flash('Password must be at least 8 characters long and contain both letters and numbers.', 'danger')
            return redirect(url_for('register'))

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

        from utils.email_utils import send_verification_email
        send_verification_email(user, mail)


        flash('Registration successful. Please check your email to verify your account.', 'info')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/messages', methods=['GET'])
@app.route('/messages/<username>', methods=['GET'])
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

@app.route('/clear-notifs', methods=['POST'])
@login_required
def clear_notifs():
    user_id = session.get('user_id')
    if user_id:
        messages = Message.query.filter(
            Message.recipient_id == user_id,
            Message.read == False
        ).all()
        for msg in messages:
            msg.read = True
        db.session.commit()
        return {'success': True}
    return {'success': False}, 400

@app.route('/api/debug_message_ids')
def debug_ids():
    return jsonify([m.id for m in Message.query.all()])

@app.route('/api/send_message', methods=['POST'])
@login_required
def api_send_message():
    print('SENDING MESSAGE')
    user_id = session.get("user_id")
    recipient_id = request.form.get('recipient_id', type=int)
    
    raw_content = request.form.get('content', '').strip()
    content = sanitize_comment_html(raw_content)

    msg = Message(sender_id=user_id, recipient_id=recipient_id, content=content)
    db.session.add(msg)
    db.session.flush()
    db.session.refresh(msg)
    db.session.commit()

    # emit WebSocket notification to recipient
    socketio.emit(
        'notification',
        {
            "type": "message",
            "from": getattr(current_user, 'display_name', 'Unknown'),
            "chat_id": msg.chat_id if hasattr(msg, 'chat_id') else None,
            "message": msg.content,
            "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "unread_count": 1  # optional, you could query the actual count
        },
        namespace='/messages',
        room=recipient_id  # user joins room with ID on connect
    )

    debug_ids()

    return jsonify ({
        "success": True,
        "message": {
            "id": msg.id,
            "content": msg.content,
            "timestamp": msg.timestamp.strftime("%m-%d-%Y %H:%M"),
            "sender": {
                "id": user_id,
                "display_name": getattr(current_user, "display_name", None),
                "username": getattr(current_user, "username", "Unknown")
            }
        }
    })

@app.route("/api/delete_im/<int:message_id>", methods=["DELETE"])
@login_required
def delete_im(message_id):
    user_id = session.get("user_id")
    print(f"Attempting to delete message ID: {message_id}")
    print(f"Current user ID: {user_id}")
    msg = Message.query.get(message_id)

    if not msg:
        print("Message not found!")
        return jsonify(success=False, error="Not found"), 404
 
    if msg.sender_id != current_user.id and not current_user.is_admin:
        return jsonify(success=False, error="Unauthorized"), 403

    room_name = f"thread_{min(msg.sender_id, msg.recipient_id)}_{max(msg.sender_id, msg.recipient_id)}"

    print(f"🧨 Broadcasting delete_message to /messages room: {room_name}")
    socketio.emit(
        'delete_message',
        {'message_id': message_id},
        room=room_name,
        namespace='/messages'
    )

    db.session.delete(msg)
    db.session.commit()
    return jsonify(success=True)

@app.route("/api/unread_count")
@login_required
def unread_count():
    user_id = session["user_id"]
    count = Message.query.filter_by(recipient_id=user_id, read=False).count()
    return jsonify(count=count)

@app.route('/api/unread_notifications')
@login_required
def unread_notifications():
    messages = Message.query.filter_by(recipient_id=current_user.id, read=False).order_by(Message.timestamp.desc()).all()
    result = [
        {
            "from": m.sender.display_name or m.sender.username,
            "message": m.content,
            "timestamp": m.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for m in messages
    ]
    return jsonify(result)

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

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

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
    article.authors = request.form.get('authors') or article.authors
    article.archive_url = request.form.get('archive_url') or article.archive_url
    article.image_url = request.form.get('image_url') or article.image_url
    pub = request.form.get('published')
    if pub:
        try:
            article.published = datetime.strptime(pub, "%Y-%m-%d").date()
        except ValueError:
            flash("Invalid date format. Use YYYY-MM-DD.", "danger")
    print(f"Raw form image_url: {request.form.get('image_url')}")
    db.session.commit()
    flash("Article updated.", "success")
    return redirect(url_for("news", category=article.category, article=article.id))

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


def sanitize_comment_html(raw_html):
    allowed_tags = ['img']
    allowed_attributes = {
        'img': ['width', 'height', 'src', 'alt', 'class', 'style'],
    }
    css_sanitizer = CSSSanitizer(allowed_css_properties=['width', 'height', 'vertical-align'])

    return clean(
        raw_html,
        tags=allowed_tags,
        attributes=allowed_attributes,
        strip=True,
        css_sanitizer=css_sanitizer,
    )

@app.route('/comment/<int:article_id>', methods=['POST'])
@login_required
def add_comment(article_id):

    raw_html = request.form['comment-content']
    cleaned_html = sanitize_comment_html(raw_html)

    parent_id = request.form.get('parent_id')
    if parent_id:
        parent_id = int(parent_id)

    if cleaned_html:
        comment = NewsComment(
            content=cleaned_html,
            article_id=article_id,
            user_id=current_user.get_id(),
            parent_id=parent_id if parent_id else None,
        )

        db.session.add(comment)
        db.session.commit()
    flash("Comment posted successfully.", "success")
    article = NewsArticle.query.get(article_id)
    return redirect(url_for('news', category=article.category, article=article.id))

@app.route('/delete_comment/<int:comment_id>', methods=['POST'])
@login_required
def delete_comment(comment_id):
    comment = NewsComment.query.get_or_404(comment_id)

    if int(current_user.get_id()) != comment.user_id and not is_admin():
        abort(403)

    db.session.delete(comment)
    db.session.commit()
    flash("Comment deleted successfully.", "success")
    article = NewsArticle.query.get(comment.article_id)
    return redirect(url_for('news', category=article.category, article=article.id))

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

    if request.method == 'POST':
        user = User.query.filter_by(email=email).first_or_404()
        new_password = request.form['password']
        confirm_password = request.form['confirm_password']

        if new_password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return redirect(url_for('register'))

        # Basic password rules
        if len(new_password) < 8 or not re.search(r'[A-Za-z]', new_password) or not re.search(r'\d', new_password):
            flash('Password must be at least 8 characters long and contain both letters and numbers.', 'danger')
            return redirect(url_for('register'))
        
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
    user.set_password(new_password)
    db.session.commit()
    flash(f"Password reset for user {user.username}")
    return redirect(url_for('admin_tools'))

@app.route('/admin/update_displayname/<int:user_id>', methods=['POST'])
@login_required
def update_displayname_admin(user_id):
    if not current_user.is_admin:
        flash("Access denied.")
        return redirect(url_for('home'))
    
    user = User.query.get_or_404(user_id)
    new_displayname = request.form['new_displayname']

    user.display_name = new_displayname
    db.session.commit()

    flash(f"Display name changed to {new_displayname} for user {user.username}")
    return redirect(url_for('admin_tools'))

@app.route("/admin/toggle-lock/<int:user_id>", methods=["POST"])
@login_required
def toggle_lock(user_id):
    if not current_user.is_admin:
        flash("Access denied.")
        return redirect(url_for('home'))
    user = User.query.get_or_404(user_id)
    user.locked = not user.locked
    db.session.commit()
    flash(f"User {'locked' if user.locked else 'unlocked'}.", "info")
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

@app.route("/chat/get_messages", methods=["GET"])
@login_required
def get_messages():
    limit = int(request.args.get("limit", 10))
    before_id = request.args.get("before_id", type=int)
    prepend = request.args.get("prepend", "false") == "true"

    query = ChatMessage.query.order_by(ChatMessage.id.desc())

    if before_id:
        query = query.filter(ChatMessage.id < before_id)

    messages = query.limit(limit).all()
    if not prepend:
        messages.reverse()  # So they appear oldest → newest

    result = []
    for msg in messages:
        result.append({
            "user_id": msg.user.id,
            "id": msg.id,
            "username": msg.user.username,
            "display_name": msg.user.display_name,
            "avatar": msg.user.avatar_filename,
            "bio": msg.user.bio,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat(),
            "edited": msg.edited,
            "file_url": msg.file_url,
            "file_name": msg.file_name,
            "message_type": msg.message_type,
        })

    return jsonify(result)

@app.route("/chat/send", methods=["POST"])
@login_required
def send_chat_message():
    data = request.get_json()
    content = data.get("content", "").strip()
    file_url = data.get("file_url")
    file_name = data.get("file_name")
    message_type = data.get("message_type", "text")

    raw_content = data.get("content", "").strip()
    content = sanitize_comment_html(raw_content)

    if not content and not file_url:
        return jsonify({"error": "Empty message"}), 400

    print("Sanitized content before saving:", content)

    message = ChatMessage(
        user_id=current_user.id,
        content=content,
        file_url=file_url,
        file_name=file_name,
        message_type=message_type,
        timestamp=datetime.now(timezone.utc)
    )

    db.session.add(message)
    db.session.commit()
 
    socketio.emit("new_message", {
        "user_id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar": current_user.avatar_filename or "",
        "bio": current_user.bio or "No bio available",
        "id": message.id,
        "content": message.content,
        "timestamp": message.timestamp.isoformat(),
        "edited": message.edited,
        "file_url": message.file_url,
        "file_name": message.file_name,
        "message_type": message.message_type,
        "room_id": "chat_global",
    }, room="chat_global", namespace="/chat")
 
    return jsonify({
        "success": True,
        "message": {
            "user_id": current_user.id,
            "username": current_user.username,
            "display_name": current_user.display_name,
            "avatar": current_user.avatar_filename or "",
            "bio": current_user.bio or "No bio available",
            "id": message.id,
            "content": message.content,
            "timestamp": message.timestamp.isoformat(),
            "file_url": message.file_url,
            "file_name": message.file_name,
            "message_type": message.message_type,
        }
})

@app.route("/api/url-preview")
def url_preview():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "No URL"}), 400
    
    if "youtube.com" in url or "youtu.be" in url:
        data = try_youtube_scrape(url)
        if data:
            return jsonify(data)

    article = NewsArticle.query.filter_by(url=url).first()
    if not article:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "url": article.url,
        "title": article.title,
        "description": article.description,
        "image_url": article.image_url,
        "authors": article.authors,
        "published": article.published,
        "source": article.source,
        "category": article.category
    })

@app.route("/chat/upload_chat_image", methods=["POST"])
@login_required
def upload_chat_image():
    MAX_FILE_SIZE = 16 * 1024 * 1024
    if request.content_length is not None and request.content_length > MAX_FILE_SIZE:
        return jsonify({"success": False, "error": "File too large (max 16 MB)"}), 400

    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    if not file.mimetype.startswith("image/"):
        return jsonify({"success": False, "error": "Invalid file type"}), 400

    # Ensure unique name: chatimg0001.jpg, etc.
    ext = os.path.splitext(file.filename)[1]
    prefix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    base = f"{prefix}_chatimg"
    i = 1
    while True:
        filename = f"{base}{i:03}{ext}"
        path = get_media_path("chat", filename)
        if not os.path.exists(path):
            break
        i += 1

    file.save(path)
    file_url = url_for("media", filename=f"chat/{filename}", _external=True)

    return jsonify({"success": True, "url": file_url, "filename": filename})

@app.route("/news/upload_news_image", methods=["POST"])
@login_required
def upload_news_image():
    print("***UPLOAD ROUTE HIT***")
    MAX_FILE_SIZE = 16 * 1024 * 1024
    if request.content_length is not None and request.content_length > MAX_FILE_SIZE:
        return jsonify({"success": False, "error": "File too large (max 16 MB)"}), 400

    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    if not file.mimetype.startswith("image/"):
        return jsonify({"success": False, "error": "Invalid file type"}), 400

    # Ensure unique name: newsimg0001.jpg, etc.
    ext = os.path.splitext(file.filename)[1]
    prefix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    base = f"{prefix}_newsimg"
    i = 1
    while True:
        filename = f"{base}{i:03}{ext}"
        path = get_media_path("news", filename)
        if not os.path.exists(path):
            break
        i += 1

    file.save(path)
    file_url = url_for("media", filename=f"news/{filename}", _external=True)

    return jsonify({"success": True, "url": file_url, "filename": filename})

@app.route("/chat/delete_message/<int:message_id>", methods=["DELETE"])
@login_required
def delete_message(message_id):
    message = ChatMessage.query.get_or_404(message_id)
    if message.user_id != current_user.id and not current_user.is_admin:
        return jsonify({"error": "Unauthorized"}), 403
    
    # Delete attached images in /media/chat/ if they exist
    if message.content:  # assuming .content holds the HTML
        soup = BeautifulSoup(message.content, "html.parser")
        for img in soup.find_all("img"):
            src = img.get("src")
            if src and "/media/chat/" in src:
                filename = os.path.basename(src)
                file_path = os.path.join("mnt", "storage", "chat", filename)
                try:
                    os.remove(file_path)
                    print(f"Deleted image file: {file_path}")
                except FileNotFoundError:
                    print(f"File not found (already deleted?): {file_path}")
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}")

    db.session.delete(message)
    db.session.commit() 
    socketio.emit('delete_message', {'message_id': message.id}, to='chat_global', namespace='/chat')
    return jsonify({"success": True})


logging.basicConfig(
    level=logging.DEBUG,
    format='[%(levelname)s] %(message)s'
)

@app.errorhandler(RequestEntityTooLarge)
def handle_large_file_error(e):
    return jsonify(success=False, error="File too large (server limit exceeded)"), 413

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

@app.after_request
def add_csrf_cookie(response):
    response.set_cookie('csrf_token', generate_csrf())
    return response

@socketio.on('join', namespace='/chat')
def handle_join_chat(room_id):
    join_room(room_id)
    print(f"💬 [chat] Joined room: {room_id}")

@socketio.on('join', namespace='/messages')
def handle_join_messages(room_id):
    join_room(room_id)
    print(f"📥 [messages] Joined room: {room_id}")

@socketio.on('join', namespace='/reactions')
def handle_join_reactions(room_id):
    join_room(room_id)
    print(f"😮 [reactions] Joined room: {room_id}")

@socketio.on('new_message', namespace='/chat')
def handle_new_message_chat(data):
    print("🔥 [chat] Rebroadcasting:", data)
    emit('new_message', data, room=data['room_id'])

@socketio.on('new_message', namespace='/messages')
def handle_new_message_messages(data):
    print("🔥 [messages] Rebroadcasting:", data)
    emit('new_message', data, room=data['room_id'], include_self=False)

@socketio.on('reaction_update', namespace='/reactions')
def handle_reaction_update(data):
    print("🔥 [reactions] Rebroadcasting:", data)
    emit('reaction_update', data, room=data['room_id'])


if __name__ == '__main__':
    is_dev = os.environ.get("FLASK_ENV") == "development"
    socketio.run(app, debug=is_dev, use_reloader=is_dev)


# if __name__ == "__main__":
#     app.run(debug=False, use_reloader=False)
