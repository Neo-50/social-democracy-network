import os, re, html
from flask import Blueprint, request, render_template
from yt_dlp import YoutubeDL
from utils.media_paths import get_media_path
import requests, datetime as dt

bp_archive_x = Blueprint('archive_x', __name__)
_TCO_RE = re.compile(r'https?://t\.co/\w+', re.IGNORECASE)
TWEET_JSON = "https://cdn.syndication.twimg.com/widgets/tweet"
UA = {"User-Agent": "Mozilla/5.0"}

def extract_tweet_id(url: str) -> str | None:
	m = re.search(r'/status/(\d+)', url)
	return m.group(1) if m else None

# keep your imports + bp_archive_x + extract_tweet_id as-is

@bp_archive_x.route('/archive-x', methods=['GET'])
def archive_x_page():
	root = get_media_path('x-media')
	items = []
	if os.path.isdir(root):
		groups = {}
		for entry in os.scandir(root):
			if not entry.is_file():
				continue
			name = entry.name
			if not name.lower().endswith('.mp4'):
				continue
			tweet_id = name.split('-')[0]
			rel = f'x-media/{name}'.replace('\\', '/')
			groups.setdefault(tweet_id, []).append({'rel': rel, 'mtime': entry.stat().st_mtime})

		for tid, files in groups.items():
			files.sort(key=lambda x: x['mtime'], reverse=True)

		import json
		def load_meta(tid: str) -> dict:
			path = os.path.join(root, f'{tid}.meta.json')
			if os.path.isfile(path):
				try:
					with open(path, 'r', encoding='utf-8') as f:
						return json.load(f)
				except Exception:
					return {}
			return {}

		items = sorted(
			(
				{
					'tweet_id': tid,
					'videos': [f['rel'] for f in files],
					'mtime': files[0]['mtime'],
					'meta': load_meta(tid),
				}
				for tid, files in groups.items()
			),
			key=lambda x: x['mtime'],
			reverse=True
		)
	print('[ITEMS]:', items)
	return render_template('archive_x.html', initial_items=items)



@bp_archive_x.route('/api/archive-x', methods=['POST'])
def api_archive_x():
	url = (request.form.get('url') or '').strip()
	if not url:
		return {'ok': False, 'error': 'Missing URL'}, 400

	tweet_id = extract_tweet_id(url)
	if not tweet_id:
		return {'ok': False, 'error': 'Could not detect tweet ID.'}, 400

	target_rel = 'x-media'
	target_abs = get_media_path(target_rel)
	os.makedirs(target_abs, exist_ok=True)

	outtmpl = os.path.join(target_abs, f'{tweet_id}-%(format_id)s.%(ext)s')
	opts = {
		'quiet': True,
		'noplaylist': True,
		'outtmpl': outtmpl,
		'format': 'bv*+ba/b',
		'merge_output_format': 'mp4',
		'ignoreerrors': True,
		'http_headers': {'User-Agent': 'Mozilla/5.0'},
		# optional: if you have a cookies file, add it via env or config
		# 'cookiefile': os.environ.get('YTDLP_COOKIES') or None,
	}

	# 1) Download media and capture info dict
	with YoutubeDL(opts) as ydl:
		info = ydl.extract_info(url, download=True)

	# 2) Normalize metadata from the *same* info dict (no extra network)
	meta = _normalize_info_from_ydl(info, url)

	# 3) Fallback to the tweet JSON endpoint if text/author are missing
	if not meta.get('text') or not meta.get('author_handle'):
		j = fetch_tweet_json(tweet_id)
		if j:
			fields = parse_fields(j)
			# merge (prefer yt-dlp where present; fill blanks from JSON)
			meta['text'] = meta.get('text') or _strip_tco(fields.get('text') or '')
			meta['author_name'] = meta.get('author_name') or (fields.get('author_name') or '')
			meta['author_handle'] = meta.get('author_handle') or (fields.get('author_handle') or '')
			# keep a created_at and source_url if handy
			if fields.get('created_at'):
				meta['created_at'] = fields['created_at']
			if fields.get('source_url') and not meta.get('url'):
				meta['url'] = fields['source_url']

	# 4) Find downloaded videos for this tweet
	videos = [
		f'{target_rel}/{n}'.replace('\\','/')
		for n in os.listdir(target_abs)
		if n.lower().endswith('.mp4') and n.startswith(str(tweet_id))
	]

	return {
		'ok': True,
		'tweet_id': tweet_id,
		'videos': videos,
		'meta': meta
	}

def _normalize_info_from_ydl(info: dict, url: str) -> dict:
	if isinstance(info, dict) and 'entries' in info and info['entries']:
		info = info['entries'][0]

	author_handle = (info.get('uploader_id') or '').strip()
	author_name = (info.get('uploader') or '').strip()
	tweet_text_raw = info.get('description') or info.get('fulltitle') or info.get('title') or ''
	tweet_text = _strip_tco(tweet_text_raw)

	return {
		'platform': 'x',
		'tweet_id': info.get('id') or '',
		'url': info.get('webpage_url') or url,
		'author_handle': author_handle,
		'author_profile_url': f'https://x.com/{author_handle}' if author_handle else '',
		'author_name': author_name,
		'text': tweet_text,
		'like_count': info.get('like_count'),
		'comment_count': info.get('comment_count'),
		'repost_count': info.get('repost_count') or info.get('reposts'),
		'timestamp': info.get('timestamp'),
		'thumbnails': info.get('thumbnails') or [],
	}


def fetch_tweet_json(tweet_id: str) -> dict | None:
	try:
		r = requests.get(TWEET_JSON, params={"id": tweet_id, "lang": "en"}, headers=UA, timeout=15)
		if not r.ok:
			return None
		j = r.json()
		# requires an id to be valid
		return j if j and str(j.get("id_str") or j.get("id")) == str(tweet_id) else None
	except Exception:
		return None

def parse_fields(j: dict) -> dict:
	user = j.get("user") or {}
	created_raw = j.get("created_at")
	created_iso = None
	if created_raw:
		try:
			# "Wed Mar 27 18:44:59 +0000 2024" -> ISO (UTC, naive)
			created_iso = dt.datetime.strptime(created_raw, "%a %b %d %H:%M:%S %z %Y")\
				.astimezone(dt.timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")
		except Exception:
			created_iso = None
	return {
		"text": j.get("text"),
		"author_name": user.get("name"),
		"author_handle": user.get("screen_name"),
		"created_at": created_iso,
		"photos": [p.get("url") for p in (j.get("photos") or []) if p.get("url")],
		"source_url": j.get("url") or f"https://x.com/i/web/status/{j.get('id_str') or ''}",
	}

def _strip_tco(text: str) -> str:
	"""
	Remove trailing t.co shortlinks (image/video artifacts) and unescape HTML entities.
	Also collapses repeated whitespace.
	"""
	if not text:
		return ""
	# unescape HTML entities (&amp; → &)
	text = html.unescape(text)
	# drop all t.co links (usually media crumbs). If you prefer, limit to only trailing matches.
	text = _TCO_RE.sub('', text).strip()
	# normalize whitespace
	text = re.sub(r'\s+', ' ', text)
	return text

def fetch_x_metadata(url: str) -> dict:
	"""
	Return a normalized metadata dict for an X/Twitter post without downloading the media.
	"""
	ydl_opts = {
		'skip_download': True,
		'quiet': True,
		'no_warnings': True,
		'noplaylist': True,
		'extract_flat': False,
		'socket_timeout': 20,
	}
	with YoutubeDL(ydl_opts) as ydl:
		info = ydl.extract_info(url, download=False)

	# Some extractors return a 'entries' list for playlists/threads; we want a single item.
	if isinstance(info, dict) and 'entries' in info and info['entries']:
		info = info['entries'][0]

	author_handle = (info.get('uploader_id') or '').strip()  # e.g., 'jack'
	author_name = (info.get('uploader') or '').strip()       # e.g., 'Jack Dorsey'
	tweet_text_raw = info.get('description') or info.get('fulltitle') or info.get('title') or ''
	tweet_text = _strip_tco(tweet_text_raw)

	res = {
		'platform': 'x',
		'tweet_id': info.get('id') or '',
		'url': info.get('webpage_url') or url,
		'author_handle': author_handle,        # 'jack'
		'author_profile_url': f'https://x.com/{author_handle}' if author_handle else '',
		'author_name': author_name,            # 'Jack Dorsey'
		'text': tweet_text,                    # cleaned tweet text
		# optional extras you might want to store:
		'like_count': info.get('like_count'),
		'comment_count': info.get('comment_count'),
		'repost_count': info.get('repost_count') or info.get('reposts'),  # varies by extractor
		'timestamp': info.get('timestamp'),
		'thumbnails': info.get('thumbnails') or [],
	}
	return res

