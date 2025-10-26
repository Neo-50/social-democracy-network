# x_media_extractor.py
import re, json, urllib.parse, time
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

ABS_JS_RE = re.compile(r'https://abs\.twimg\.com/responsive-web/client-web/[^"]+?\.js')
SCRIPT_SRC_RE = re.compile(r'<script[^>]+src="([^"]+\.js)"', re.IGNORECASE)
BEARER_RE = re.compile(r'Bearer\s+([A-Za-z0-9%\-_.~]+)')
GRAPHQL_PATH_RE = re.compile(r'/graphql/([A-Za-z0-9_-]+)/([A-Za-z_]+)')
MAP_RE_VARIANTS = [
	re.compile(r'{"queryId":"([A-Za-z0-9_-]{10,})","operationName":"(Tweet[A-Za-z0-9_]+)"}'),
	re.compile(r'operationName:"(Tweet[A-Za-z0-9_]+)".{0,80}?queryId:"([A-Za-z0-9_-]{10,})"'),
	re.compile(r'queryId:"([A-Za-z0-9_-]{10,})".{0,80}?operationName:"(Tweet[A-Za-z0-9_]+)"'),
]
TWEET_ID_RE = re.compile(r'(?:status|statuses)/(\d+)')
_MISSING_RE = re.compile(r"The following features cannot be null:\s*([^}]+?)(?:\"|$)")

# simple in-process cache to avoid repeated discovery on one run
_CACHE = {"bearer": None, "ops": None, "ops_ts": 0}

def debug(*args):
	print("[X]", *args)

def _uenc(d: dict) -> str:
	return urllib.parse.urlencode(d)

def _unquote(s: str) -> str:
	try: return urllib.parse.unquote(s)
	except: return s

def _fetch(url: str):
	r = SESSION.get(url, timeout=15)
	debug("GET", url, "->", r.status_code, "len", len(r.text) if r.text else 0)
	return r

def _discover_bearer() -> str | None:
	if _CACHE["bearer"]:
		return _CACHE["bearer"]
	seed = "https://x.com/?lang=en"
	r = _fetch(seed)
	if not (r.ok and r.text): return None
	js_urls = ABS_JS_RE.findall(r.text) or [u for u in SCRIPT_SRC_RE.findall(r.text) if "abs.twimg.com" in u]
	for jsu in js_urls[:8]:
		js = _fetch(jsu)
		if not (js.ok and js.text): continue
		m = BEARER_RE.search(js.text)
		if m:
			token = _unquote(m.group(1))
			_CACHE["bearer"] = token
			debug("bearer discovered len", len(token))
			return token
	debug("bearer not found")
	return None

def _guest_token(bearer: str) -> str | None:
	h = {"Authorization": f"Bearer {bearer}", "Accept": "application/json", "User-Agent": UA}
	r = SESSION.post("https://api.twitter.com/1.1/guest/activate.json", headers=h, timeout=15)
	debug("POST guest/activate ->", r.status_code, r.text[:120])
	if r.status_code == 200:
		return r.json().get("guest_token")
	return None

def _harvest_js_urls(tweet_id: str) -> list[str]:
	urls = set()
	for u in [f"https://x.com/i/web/status/{tweet_id}", "https://x.com/?lang=en"]:
		r = _fetch(u)
		if not (r.ok and r.text): continue
		for m in ABS_JS_RE.findall(r.text) or []: urls.add(m)
		for m in SCRIPT_SRC_RE.findall(r.text) or []:
			if "abs.twimg.com" in m and m.endswith(".js"): urls.add(m)
	return list(urls)

def _discover_ops(tweet_id: str) -> list[tuple[str,str]]:
	# cache ops for a short period per run
	now = time.time()
	if _CACHE["ops"] and now - _CACHE["ops_ts"] < 300:
		return _CACHE["ops"]
	js_urls = _harvest_js_urls(tweet_id)[:20]
	ops, seen = [], set()
	for u in js_urls:
		r = _fetch(u)
		if not (r.ok and r.text): continue
		# literal /graphql/<hash>/<op>
		for m in GRAPHQL_PATH_RE.finditer(r.text):
			h, op = m.group(1), m.group(2)
			if "Tweet" in op and (h, op) not in seen:
				seen.add((h, op)); ops.append((h, op))
		# queryId <-> operationName maps
		for rx in MAP_RE_VARIANTS:
			for m in rx.finditer(r.text):
				g = m.groups()
				if "Tweet" in g[0]: op, h = g[0], g[1]
				else: h, op = g[0], g[1]
				if "Tweet" in op and (h, op) not in seen:
					seen.add((h, op)); ops.append((h, op))
	_CACHE["ops"], _CACHE["ops_ts"] = ops, now
	debug("ops discovered", len(ops))
	return ops

def _vars_for_op(op: str, tweet_id: str) -> dict:
	if op == "TweetDetail":
		return {
			"focalTweetId": tweet_id,
			"with_rux_injections": False,
			"includePromotedContent": False,
			"withCommunity": False,
			"withQuickPromoteEligibilityTweetFields": False,
			"withBirdwatchNotes": False,
			"withVoice": True,
			"withV2Timeline": True
		}
	return {
		"tweetId": tweet_id,
		"withCommunity": False,
		"includePromotedContent": False,
		"withVoice": True,
		"withV2Timeline": True,
		"withQuickPromoteEligibilityTweetFields": False,
		"withBirdwatchNotes": False
	}

def _default_features() -> dict:
	return {
		"blue_business_profile_image_shape_enabled": True,
		"creator_subscriptions_quote_tweet_preview_enabled": True,
		"freedom_of_speech_not_reach_fetch_enabled": False,
		"graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
		"longform_notetweets_consumption_enabled": True,
		"note_auto_translation_is_enabled": True,
		"premium_content_api_read_enabled": True,
		"profile_label_improvements_pcf_label_in_post_enabled": True,
		"responsive_web_edit_tweet_api_enabled": True,
		"responsive_web_enhance_cards_enabled": False,
		"responsive_web_graphql_exclude_directive_enabled": True,
		"responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
		"responsive_web_graphql_timeline_navigation_enabled": True,
		"responsive_web_graphql_tweet_results_is_identity_enabled": True,
		"responsive_web_grok_image_annotation_enabled": True,
		"responsive_web_grok_share_attachment_enabled": True,
		"responsive_web_jetfuel_frame": False,
		"responsive_web_media_download_video_enabled": True,
		"responsive_web_profile_redirect_enabled": True,
		"responsive_web_text_conversations_enabled": False,
		"responsive_web_twitter_article_tweet_consumption_enabled": False,
		"rweb_tipjar_consumption_enabled": False,
		"spaces_2022_h2_clipping": False,
		"standardized_nudges_misinfo": False,
		"subscriptions_verification_info_reason_enabled": True,
		"subscriptions_verification_info_verified_since_enabled": True,
		"tweet_awards_web_tipping_enabled": False,
		"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
		"tweetypie_unmention_optimization_enabled": False,
		"verified_phone_label_enabled": False,
		"view_counts_everywhere_api_enabled": True,
		"view_counts_public_visibility_enabled": True,
		"creator_subscriptions_tweet_preview_api_enabled": True,
		"longform_notetweets_rich_text_read_enabled": True,
		"responsive_web_grok_community_note_auto_translation_is_enabled": True,
		"responsive_web_grok_analyze_post_followups_enabled": True,
		"payments_enabled": True,
		"responsive_web_grok_analysis_button_from_backend": True,
		"communities_web_enable_tweet_community_results_fetch": True,
		"responsive_web_grok_imagine_annotation_enabled": True,
		"responsive_web_grok_show_grok_translated_post": True,
		"longform_notetweets_inline_media_enabled": True,
		"articles_preview_enabled": True,
		"responsive_web_grok_analyze_button_fetch_trends_enabled": True,
		"c9s_tweet_anatomy_moderator_badge_enabled": True,
	}

def _parse_missing_features(error_text: str) -> list[str]:
	try:
		msg = (json.loads(error_text).get("errors", [{}])[0].get("message", "")) or error_text
	except Exception:
		msg = error_text or ""
	m = _MISSING_RE.search(msg)
	if not m and "cannot be null" in msg:
		frag = msg.split("cannot be null:")[-1]
		return [x.strip(" ,") for x in frag.split(",") if x.strip()]
	if not m:
		return []
	frag = m.group(1)
	return [x.strip(" ,") for x in frag.split(",") if x.strip()]

def _ensure_features(features: dict, required: list[str]) -> list[str]:
	added = []
	for k in required:
		if k not in features:
			features[k] = False
			added.append(k)
	return added

def _call_once(bearer: str, guest: str, hsh: str, op: str, tweet_id: str, features: dict):
	base = f"https://api.twitter.com/graphql/{hsh}/{op}"
	params = {
		"variables": json.dumps(_vars_for_op(op, tweet_id), separators=(",",":")),
		"features": json.dumps(features, separators=(",",":")),
	}
	url = f"{base}?{_uenc(params)}"
	h = {
		"Authorization": f"Bearer {bearer}",
		"x-guest-token": guest,
		"User-Agent": UA,
		"Accept": "application/json",
		"Referer": f"https://x.com/i/web/status/{tweet_id}",
	}
	# debug("GraphQL", op, hsh)
	r = SESSION.get(url, headers=h, timeout=25)
	# debug("Resp", r.status_code, "len", len(r.text) if r.text else 0)
	return r

def _call_with_backfill(bearer: str, guest: str, hsh: str, op: str, tweet_id: str):
	features = _default_features().copy()
	for attempt in range(1, 4):
		debug("Attempt", attempt, "op", op)
		r = _call_once(bearer, guest, hsh, op, tweet_id, features)
		if r.status_code == 200:
			try: return r.json()
			except Exception:
				debug("json decode fail", r.text[:300]); return None
		if r.status_code == 400 and r.text:
			missing = _parse_missing_features(r.text)
			if missing:
				added = _ensure_features(features, missing)
				debug("Backfill", len(added), "flags", added)
				continue
		debug("ErrBody", r.text[:300] if r.text else "")
		break
	return None

def _extract_id(s: str) -> str:
	m = TWEET_ID_RE.search(s)
	return m.group(1) if m else s.strip()

# def _walk_media_urls(obj, found):
# 	if isinstance(obj, dict):
# 		# media items (photos/videos)
# 		for k, v in obj.items():
# 			if k in ("media_url_https", "media_url") and isinstance(v, str):
# 				if "pbs.twimg.com" in v or "video.twimg.com" in v:
# 					found.add(v)
# 		for v in obj.values(): _walk_media_urls(v, found)
# 	elif isinstance(obj, list):
# 		for it in obj: _walk_media_urls(it, found)

def _collect_video_variants(obj, out: list):
	"""
	Append dicts like {"url": "...", "bitrate": 832000, "content_type": "video/mp4"} to 'out'.
	Traverses legacy.extended_entities.media[].video_info.variants and card bindings.
	"""
	if isinstance(obj, dict):
		# classic path
		if "video_info" in obj and isinstance(obj["video_info"], dict):
			for it in obj["video_info"].get("variants") or []:
				url = it.get("url")
				if not isinstance(url, str):
					continue
				ct = it.get("content_type") or ""
				br = it.get("bitrate")  # may be absent on HLS
				out.append({"url": url, "bitrate": br, "content_type": ct})

		# cards sometimes hold HLS/player URLs in binding_values
		if "binding_values" in obj and isinstance(obj["binding_values"], list):
			for it in obj["binding_values"]:
				val = (it.get("value") or {}).get("string_value") or (it.get("value") or {}).get("s")
				if isinstance(val, str) and (val.endswith(".m3u8") or "video.twimg.com" in val):
					out.append({"url": val, "bitrate": None, "content_type": "application/x-mpegURL"})

		for v in obj.values():
			_collect_video_variants(v, out)

	elif isinstance(obj, list):
		for it in obj:
			_collect_video_variants(it, out)

def _choose_primary_video(variants: list[dict]) -> dict | None:
	"""
	Prefer highest-bitrate MP4. If none, fall back to HLS (.m3u8).
	"""
	if not variants:
		return None

	mp4s = [v for v in variants if (v.get("content_type") or "").startswith("video/mp4")]
	mp4s = [v for v in mp4s if isinstance(v.get("bitrate"), int)]
	if mp4s:
		return sorted(mp4s, key=lambda v: v["bitrate"], reverse=True)[0]

	# Fallback to any HLS playlist
	for v in variants:
		u = v.get("url") or ""
		ct = v.get("content_type") or ""
		if u.endswith(".m3u8") or "mpegURL" in ct:
			return v

	# Last resort: first variant
	return variants[0]


def _walk_media_urls(obj, found):
    if isinstance(obj, dict):
        # direct images
        u = obj.get("media_url_https") or obj.get("media_url")
        if isinstance(u, str) and ("pbs.twimg.com" in u or "video.twimg.com" in u):
            found.add(u)

        # video variants (mp4+m3u8)
        if "video_info" in obj and isinstance(obj["video_info"], dict):
            vars_ = obj["video_info"].get("variants") or []
            for it in vars_:
                vu = it.get("url")
                if isinstance(vu, str) and ("video.twimg.com" in vu or vu.endswith(".m3u8")):
                    found.add(vu)

        # cards sometimes hold player URLs in binding_values
        if "binding_values" in obj and isinstance(obj["binding_values"], list):
            for it in obj["binding_values"]:
                val = (it.get("value") or {}).get("string_value") or (it.get("value") or {}).get("s")
                if isinstance(val, str) and ("video.twimg.com" in val or val.endswith(".m3u8")):
                    found.add(val)

        # keep traversing
        for v in obj.values():
            _walk_media_urls(v, found)

    elif isinstance(obj, list):
        for it in obj:
            _walk_media_urls(it, found)

def _dig(d, *keys):
	for k in keys:
		if not isinstance(d, dict):
			return None
		d = d.get(k)
	return d

def extract_author(res: dict) -> tuple[str | None, str | None]:
	"""
	Return (author_name, author_handle) from varied X GraphQL shapes.
	Looks in both ...legacy and ...core for name/screen_name.
	"""
	# Fast-path: common places
	paths = [
		# user under core.user_results.result.*
		('core','user_results','result','legacy'),
		('core','user_results','result','core'),
		('core','user_results','result','result','legacy'),
		('core','user_results','result','result','core'),

		# sometimes directly under core.user / author / user
		('core','user','legacy'),
		('core','user','core'),
		('author','legacy'),
		('author','core'),
		('user','legacy'),
		('user','core'),
	]

	for p in paths:
		block = _dig(res, *p)
		if isinstance(block, dict):
			# skip explicit unavailable wrappers if present
			if block.get('__typename') == 'UserUnavailable':
				continue
			name   = block.get('name')
			handle = block.get('screen_name')
			if name or handle:
				return name, handle

	# Fallback: scan any dict that has a child named 'legacy' or 'core'
	def _walk(obj):
		if isinstance(obj, dict):
			yield obj
			for v in obj.values():
				yield from _walk(v)
		elif isinstance(obj, list):
			for v in obj:
				yield from _walk(v)

	for d in _walk(res):
		for key in ('legacy', 'core'):
			block = d.get(key)
			if isinstance(block, dict):
				if block.get('__typename') == 'UserUnavailable':
					continue
				name   = block.get('name')
				handle = block.get('screen_name')
				if name or handle:
					return name, handle

	return None, None
	
def _extract_metadata(data):
	"""
	Returns (text, author_name, author_handle, created_at, counts_dict, alt_desc)
	Works for both TweetResultByRestId and TweetDetail shapes.
	"""
	print('>>>>>>>>> extract_metadata')

	text = author_name = author_handle = created_at = alt_desc = None
	counts = {
		"likes": None,
		"retweets": None,
		"replies": None,
		"quotes": None,
		"bookmarks": None,
		"views": None,
	}

	try:
		# Typical happy path:
		res = data["data"]["tweetResult"]["result"]
	except Exception:
		# Some ops nest it differently; try a couple fallbacks
		try:
			timeline = data["data"]["threaded_conversation_with_injections_v2"]["instructions"]
			# Find the first Tweet item
			for instr in timeline:
				for entry in instr.get("entries", []):
					item = (((entry.get("content") or {}).get("itemContent") or {})
					        .get("tweet_results") or {}).get("result")
					if item and item.get("__typename") == "Tweet":
						res = item
						raise StopIteration
		except StopIteration:
			pass
		except Exception:
			res = None

	if not res:
		print('>>>>>>>>>>>>_extract_metadata failed, returning')
		return (text, author_name, author_handle, created_at, counts, alt_desc)

	legacy = res.get("legacy", {}) if isinstance(res, dict) else {}
	text = legacy.get("full_text") or legacy.get("text")
	created_at = legacy.get("created_at")
	alt_desc = res.get("post_image_description")  # present for many org accounts

	print('_extract_metadata: legacy, text, created_at, alt_desc:', legacy, text, created_at, alt_desc)

	# counts live mostly under legacy
	counts["likes"] = legacy.get("favorite_count")
	counts["retweets"] = legacy.get("retweet_count")
	counts["replies"] = legacy.get("reply_count")
	counts["quotes"] = legacy.get("quote_count")
	# sometimes present
	counts["bookmarks"] = legacy.get("bookmark_count") or res.get("bookmarks_count")
	# views: occasionally at res["views"]["count"]
	try:
		counts["views"] = int((res.get("views") or {}).get("count"))
	except Exception:
		pass

	author_name, author_handle = extract_author(res)
	if not author_name and not author_handle:
		debug("AUTHOR DEBUG:", json.dumps(res.get("core", {}), indent=2)[:800])

	print('>>>>>> _extract_metadata end: ', author_name, author_handle, counts)

	return (text, author_name, author_handle, created_at, counts, alt_desc)


def fetch_tweet_media(url_or_id: str) -> dict:
	tid = _extract_id(url_or_id)
	debug("TweetID", tid)

	bearer = _discover_bearer()
	if not bearer: return {"images": [], "text": None, "author": None}

	guest = _guest_token(bearer)
	if not guest: return {"images": [], "text": None, "author": None}

	ops = _discover_ops(tid)
	if not ops: return {"images": [], "text": None, "author": None}

	# prefer TweetResultByRestId then TweetDetail
	cands = [x for x in ops if x[1] == "TweetResultByRestId"] + [x for x in ops if x[1] == "TweetDetail"]
	for hsh, op in cands or ops:
		data = _call_with_backfill(bearer, guest, hsh, op, tid)
		if not data: continue
		found = set()
		_walk_media_urls(data, found)

		if not any("video.twimg.com" in u for u in found):
			# Try the other op (swap between TweetResultByRestId and TweetDetail)
			alt = ("TweetDetail" if op == "TweetResultByRestId" else "TweetResultByRestId")
			alt_ops = [(hh, oo) for (hh, oo) in ops if oo == alt]
			for hh, oo in alt_ops:
				data_alt = _call_with_backfill(bearer, guest, hh, oo, tid)
				if data_alt:
					_walk_media_urls(data_alt, found)
					if any("video.twimg.com" in u for u in found):
						data = data_alt
						break
		
		vid_variants = []
		_collect_video_variants(data, vid_variants)

		# choose primary video (if any)
		primary_vid = _choose_primary_video(vid_variants)
		primary_url = (primary_vid or {}).get("url")

		# text, author _ extract_text_author(data)
		text, author_name, author_handle, created_at, counts, alt_desc = _extract_metadata(data)
		print('>>>>>>>fetch_tweet_media:', text, author_name, author_handle, created_at, counts, alt_desc)

		result = {
			"primary_video": primary_url,
			"images": [],
			"text": text or alt_desc,
			"author": author_name,
			"author_handle": author_handle,
			"created_at": created_at,
			"counts": counts,
			"alt_description": alt_desc,
		}

		if found:
			# normalize image quality param to name=orig where applicable
			def _norm(u: str) -> str:
				if 'pbs.twimg.com' in u:
					parts = list(urllib.parse.urlparse(u))
					q = urllib.parse.parse_qs(parts[4], keep_blank_values=True)
					q['name'] = ['orig']
					parts[4] = urllib.parse.urlencode({k:v[-1] for k,v in q.items()})
					return urllib.parse.urlunparse(parts)
				return u

			result["images"] = [_norm(u) for u in found if 'pbs.twimg.com' in u]

		# --- ALWAYS return the result, even when no media were found
		return result
