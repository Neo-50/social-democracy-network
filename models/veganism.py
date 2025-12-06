from db_init import db
from datetime import datetime, timezone
import html
import re

_TAG_RE = re.compile(r'</?\w+[^>]*>')

class Veganism(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=True)  # text or emoji
    timestamp = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    file_url = db.Column(db.String(500), nullable=True)  # for uploaded files
    file_name = db.Column(db.String(255), nullable=True) # original filename
    message_type = db.Column(db.String(50), nullable=False, default="text")
    edited = db.Column(db.Boolean, default=False)

    def formatted_content(self) -> str:
        if not self.content:
            return ''
        if _TAG_RE.search(self.content):
            # Already HTML: keep tags, but make \n render as line breaks
            return self.content.replace('\n', '<br />')
        # Plain text: escape + <br />
        safe = html.escape(self.content)
        return safe.replace('\n', '<br />')
    
    user = db.relationship('User', backref=db.backref('veganism', passive_deletes=True, lazy=True))
