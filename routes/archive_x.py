import os, re, html, urllib.parse, requests
from models.tweet_archive import TweetArchive
from datetime import datetime
import json as _json
from app import db
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

@bp_archive_x.route('/archive-x', methods=['GET'])
def archive_x_page():
	rows = (
		db.session.query(TweetArchive)
		.order_by(TweetArchive.downloaded_at_utc.desc())
		.all()
	)
	items = []
	for r in rows:
		items.append({
			'tweet_id': r.tweet_id,
			'meta': {
				'url': r.source_url,
				'author_handle': r.author_handle,
				'author_name': r.author_name,
				'text': r.text,
				'like_count': r.like_count,
				'repost_count': r.repost_count,
				'comment_count': r.comment_count,
				'timestamp': r.created_at_utc,
			},
			'media': r.media(),   # [{kind, rel_path}, ...]
			'mtime': r.downloaded_at_utc,
		})
	print('[ITEMS]:', [(i['tweet_id'], len(i['media'])) for i in items])
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

	# A) Always get info first WITHOUT downloading (works for text-only posts)
	meta_info = None
	with YoutubeDL({
		'quiet': True,
		'noplaylist': True,
		'skip_download': True,
		'ignoreerrors': True,
		'http_headers': {'User-Agent': 'Mozilla/5.0'},
	}) as ydl:
		try:
			meta_info = ydl.extract_info(url, download=False)
			print('**yt-dlp scraped metadata:** ')
		except Exception:
			meta_info = None

	# B) Try to download media (if any); info may be None for text-only
	try:
		with YoutubeDL({
			'quiet': True,
			'noplaylist': True,
			'outtmpl': outtmpl,
			'format': 'bv*+ba/b',
			'merge_output_format': 'mp4',
			'ignoreerrors': True,
			'http_headers': {'User-Agent': 'Mozilla/5.0'},
		}) as ydl:
			dl_info = ydl.extract_info(url, download=True)
			# Prefer download info if it exists; otherwise keep metadata-only
			if dl_info:
				meta_info = dl_info
				print('***yt-dlp detected video and scraped metadata***')
	except Exception:
		# no downloadable media is fine
		print('***Exception: no video found***')
		pass

	# C) Normalize metadata (null-safe now) and fill gaps from syndication
	# meta = _normalize_info_from_ydl(meta_info, url, tweet_id)

	meta = _normalize_info_from_ydl(meta_info, url)
	print('***Data normalizer ran: ', meta)

	if not meta.get('tweet_id'):
		meta['tweet_id'] = tweet_id  # fallback if info dict was empty
		print('***Fallback to tweet id**')

	j = None
	if not meta.get('text') or not meta.get('author_handle'):
		print('***Falling back to syndicated JSON***')
		j = fetch_tweet_json(tweet_id)
		if j:
			fields = parse_fields(j)
			meta['text'] = meta.get('text') or _strip_tco(fields.get('text') or '')
			meta['author_name'] = meta.get('author_name') or (fields.get('author_name') or '')
			meta['author_handle'] = meta.get('author_handle') or (fields.get('author_handle') or '')
			if fields.get('created_at'):
				meta['created_at'] = fields['created_at']
			if fields.get('source_url') and not meta.get('url'):
				meta['url'] = fields['source_url']
			print('***Fallback data: ', meta)
	
	# If we still don't have text/author, try oEmbed as a last resort
	if not meta.get('text') or not meta.get('author_handle'):
		url = meta.get('url') or f'https://x.com/i/web/status/{tweet_id}'
		# Normalize FX/VX/whatever → x.com
		url = (url
			.replace('fxtwitter.com', 'x.com')
			.replace('vxtwitter.com', 'x.com')
			.replace('twitter.com', 'x.com'))
		oe = fetch_tweet_oembed(url)

		if oe:
			oe_fields = _oembed_to_fields(oe)
			# only fill blanks
			if not meta.get('text') and oe_fields.get('text'):
				meta['text'] = oe_fields['text']
			if not meta.get('author_handle') and oe_fields.get('author_handle'):
				meta['author_handle'] = oe_fields['author_handle']
			if not meta.get('author_name') and oe_fields.get('author_name'):
				meta['author_name'] = oe_fields['author_name']
			if not meta.get('url') and oe_fields.get('source_url'):
				meta['url'] = oe_fields['source_url']

	# D) Collect whatever was downloaded (could be empty for text-only)
	videos = [
		f'{target_rel}/{n}'.replace('\\','/')
		for n in os.listdir(target_abs)
		if n.lower().endswith('.mp4') and n.startswith(str(tweet_id))
	]

	# E) Image discovery + download (safe if meta_info is None)
	img_urls = set()
	img_urls.update(extract_image_urls_from_ytinfo(meta_info))
	if j is None:
		j = fetch_tweet_json(tweet_id)
	if j:
		img_urls.update(extract_image_urls_from_syndication(j))

	images = download_images(sorted(img_urls), tweet_id, target_abs, target_rel)

	# F) Persist to DB — media list may be empty [], which is valid
	upsert_tweet(meta, videos, images)

	return {'ok': True, 'tweet_id': tweet_id, 'videos': videos, 'images': images, 'meta': meta}

def _normalize_info_from_ydl(info: dict, url: str) -> dict:
	info = info or {}
	# Some extractors return 'entries' for threads/playlists
	if isinstance(info, dict) and info.get('entries'):
		entries = info['entries'] or []
		if entries:
			info = entries[0] or {}

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


def fetch_tweet_json(tweet_id):
	url = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}"
	try:
		resp = requests.get(url, timeout=15, headers={
			'User-Agent': 'Mozilla/5.0',
			'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8',
		})
		print(f"[SYNDICATE] {url} -> {resp.status_code} len={len(resp.text)}")
		if not resp.ok:
			return None
		try:
			return resp.json()
		except Exception:
			print("⚠️ JSON parse error, first 300 chars:", resp.text[:300])
			return None
	except Exception as e:
		print(f"[SYNDICATE ERROR] {e}")
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

_PBS_RE = re.compile(r'https?://pbs\.twimg\.com/(media|tweet_video)/(?:[^\s"\'\)]+)', re.I)

def _force_orig(url: str) -> str:
	"""
	Ensure pbs.twimg.com URLs request original size.
	Examples:
	  ...?format=jpg&name=small  -> name=orig
	  ...?name=large             -> name=orig
	"""
	try:
		u = urllib.parse.urlsplit(url)
		q = urllib.parse.parse_qs(u.query, keep_blank_values=True)
		q['name'] = ['orig']
		new_q = urllib.parse.urlencode({k:v[-1] for k,v in q.items()}, doseq=True)
		return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, new_q, u.fragment))
	except Exception:
		return url

def extract_image_urls_from_ytinfo(info: dict) -> list[str]:
	"""
	Collect candidate image URLs from yt-dlp info dict.
	"""
	out = []
	thumbs = (info or {}).get('thumbnails') or []
	for t in thumbs:
		u = t.get('url') or ''
		if _PBS_RE.match(u):
			out.append(_force_orig(u))
	# Sometimes description contains pbs links; grab them too.
	desc = (info or {}).get('description') or ''
	for m in _PBS_RE.finditer(desc):
		out.append(_force_orig(m.group(0)))
	# de-dupe, preserve order
	seen, uniq = set(), []
	for u in out:
		if u not in seen:
			seen.add(u); uniq.append(u)
	return uniq

def extract_image_urls_from_syndication(j: dict) -> list[str]:
	"""
	Your existing fetch_tweet_json(parse_fields) can expose photos.
	If not, this fallback scans the JSON text for pbs links.
	"""
	if not j:
		return []
	txt = _json.dumps(j, ensure_ascii=False)
	urls = []
	for m in _PBS_RE.finditer(txt):
		urls.append(_force_orig(m.group(0)))
	# de-dupe
	seen, uniq = set(), []
	for u in urls:
		if u not in seen:
			seen.add(u); uniq.append(u)
	return uniq

def download_images(urls: list[str], tweet_id: str, target_abs: str, target_rel: str) -> list[str]:
	"""
	Download each image URL -> x-media/<tweet_id>-img<N>.<ext>
	Returns a list of relative paths suitable for your template.
	"""
	os.makedirs(target_abs, exist_ok=True)
	out_paths = []
	n = 0
	for u in urls:
		try:
			r = requests.get(u, timeout=25, headers={'User-Agent':'Mozilla/5.0'})
			if r.status_code != 200 or not r.content:
				continue
			ct = r.headers.get('Content-Type','').lower()
			ext = '.jpg'
			if 'png' in ct: ext = '.png'
			elif 'webp' in ct: ext = '.webp'
			elif 'gif' in ct: ext = '.gif'  # very rare for originals
			n += 1
			name = f'{tweet_id}-img{n}{ext}'
			with open(os.path.join(target_abs, name), 'wb') as f:
				f.write(r.content)
			out_paths.append(f'{target_rel}/{name}'.replace('\\','/'))
		except Exception:
			continue
	return out_paths

def upsert_tweet(meta: dict, videos: list[str], images: list[str]) -> None:
	media = (
		[{ 'kind':'video', 'rel_path': rel } for rel in videos] +
		[{ 'kind':'image', 'rel_path': rel } for rel in images]
	)

	row = TweetArchive.query.get(meta['tweet_id'])
	if not row:
		row = TweetArchive(tweet_id=meta['tweet_id'])
		db.session.add(row)

	row.source_url = meta.get('url')
	row.author_handle = meta.get('author_handle')
	row.author_name = meta.get('author_name')
	row.text = meta.get('text')
	row.created_at_utc = meta.get('timestamp') or meta.get('created_at')
	row.like_count = meta.get('like_count')
	row.repost_count = meta.get('repost_count')
	row.comment_count = meta.get('comment_count')
	row.media_json = _json.dumps(media, ensure_ascii=False)
	row.downloaded_at_utc = int(datetime.utcnow().timestamp())

	db.session.commit()

_BR_RE = re.compile(r'(<br\s*/?>|\n)+', re.I)

def fetch_tweet_oembed(tweet_url: str) -> dict | None:
	try:
		r = requests.get(
			'https://publish.twitter.com/oembed',
			params={'url': tweet_url, 'omit_script': '1', 'hide_thread': '1'},
			timeout=15,
			headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'}
		)
		print(f"[OEMBED] {r.url} -> {r.status_code} len={len(r.text)}")
		return r.json() if r.ok else None
	except Exception as e:
		print(f"[OEMBED ERROR] {e}")
		return None

def _oembed_to_fields(oe: dict) -> dict:
	"""
	Extract plain text + author from oEmbed HTML.
	Returns {text, author_handle, author_name, source_url}
	"""
	out = {'text':'', 'author_handle':'', 'author_name':'', 'source_url':''}
	if not oe: return out

	out['author_name'] = oe.get('author_name') or ''
	author_url = oe.get('author_url') or ''
	out['source_url'] = oe.get('url') or ''  # sometimes present
	# handle from author_url
	if author_url.startswith('https://twitter.com/') or author_url.startswith('https://x.com/'):
		out['author_handle'] = author_url.rstrip('/').split('/')[-1]

	# strip the embed HTML to plain text
	html_snip = oe.get('html') or ''
	if html_snip:
		# crude textization: remove tags, keep <br> as newlines
		txt = _BR_RE.sub('\n', html_snip)
		txt = re.sub(r'<[^>]+>', '', txt)
		out['text'] = html.unescape(txt).strip()

	return out
