from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer
from flask import current_app, url_for

# Create and return a unique token for a given email address
def generate_verification_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='email-confirm')

# Confirm the token and extract the email (or return None if expired/invalid)
def confirm_verification_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt='email-confirm', max_age=expiration)
    except Exception:
        return None
    return email

# Send a verification email with clickable link to the user
def send_verification_email(user, mail):
    token = generate_verification_token(user.email)
    verify_url = url_for('verify_email', token=token, _external=True)

    subject = "Verify your email for Social Democracy Network"
    body = f"""
    Hello, {user.username}!

    Thanks for registering at Social Democracy Network.

    Please verify your email by clicking the link below:
    {verify_url}

    This link will expire in 1 hour.

    If you did not create this account, you can ignore this email.
    """

    msg = Message(subject, recipients=[user.email], body=body)
    mail.send(msg)
