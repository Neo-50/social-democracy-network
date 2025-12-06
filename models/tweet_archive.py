from datetime import datetime
from app import db
import json

class TweetArchive(db.Model):
	__tablename__ = 'tweet_archive'
	tweet_id = db.Column(db.String, primary_key=True)
	source_url = db.Column(db.String)
	media_url = db.Column(db.String)
	author_handle = db.Column(db.String)
	author_name = db.Column(db.String)
	text = db.Column(db.Text)
	created_at_utc = db.Column(db.Integer)
	likes = db.Column(db.Integer)
	retweets = db.Column(db.Integer)
	comments = db.Column(db.Integer)
	quotes = db.Column(db.Integer)
	bookmarks = db.Column(db.Integer)
	views = db.Column(db.Integer)
	media_json = db.Column(db.Text, nullable=False, default='[]')
	downloaded_at_utc = db.Column(db.Integer, nullable=False, default=lambda: int(datetime.utcnow().timestamp()))

	def media(self):
		try:
			return json.loads(self.media_json or '[]')
		except Exception:
			return []
