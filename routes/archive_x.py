import os, re
from flask import Blueprint, request, render_template, redirect, url_for, flash
from yt_dlp import YoutubeDL
from utils.media_paths import get_media_path
import requests, datetime as dt

bp_archive_x = Blueprint('archive_x', __name__)

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
			tweet_id = name.split('-')[0]  # e.g. 1980...-hls... -> 1980...
			rel = f'x-media/{name}'.replace('\\', '/')
			groups.setdefault(tweet_id, []).append({'rel': rel, 'mtime': entry.stat().st_mtime})

		# sort videos in each group (newest first)
		for tid, files in groups.items():
			files.sort(key=lambda x: x['mtime'], reverse=True)

		# sort groups by newest file time
		items = sorted(
			(
				{'tweet_id': tid, 'videos': [f['rel'] for f in files], 'mtime': files[0]['mtime']}
				for tid, files in groups.items()
			),
			key=lambda x: x['mtime'],
			reverse=True
		)

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
	}
	with YoutubeDL(opts) as ydl:
		ydl.extract_info(url, download=True)

	videos = [
		f'{target_rel}/{n}'.replace('\\','/')
		for n in os.listdir(target_abs)
		if n.lower().endswith('.mp4') and n.startswith(str(tweet_id))
	]
	return {'ok': True, 'tweet_id': tweet_id, 'videos': videos}

TWEET_JSON = "https://cdn.syndication.twimg.com/widgets/tweet"
UA = {"User-Agent": "Mozilla/5.0"}

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

