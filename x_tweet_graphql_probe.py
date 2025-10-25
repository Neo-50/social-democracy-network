# x_tweet_graphql_probe2.py
import sys, re, json, urllib.parse
import requests

# --------- config / globals ---------
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

ABS_JS_RE = re.compile(r'https://abs\.twimg\.com/responsive-web/client-web/[^"]+?\.js')
SCRIPT_SRC_RE = re.compile(r'<script[^>]+src="([^"]+\.js)"', re.IGNORECASE)
BEARER_RE = re.compile(r'Bearer\s+([A-Za-z0-9%\-_.~]+)')

# /graphql/<hash>/<OpName> form (sometimes appears literally)
GRAPHQL_PATH_RE = re.compile(r'/graphql/([A-Za-z0-9_-]+)/([A-Za-z_]+)')

# operationName + queryId mapping forms (these show up in big JS bundles)
# We try a few shapes seen in the wild:
MAP_RE_VARIANTS = [
	# {"queryId":"<hash>","operationName":"TweetResultByRestId"}
	re.compile(r'{"queryId":"([A-Za-z0-9_-]{10,})","operationName":"(Tweet[A-Za-z0-9_]+)"'),
	# operationName:"TweetDetail",queryId:"<hash>"
	re.compile(r'operationName:"(Tweet[A-Za-z0-9_]+)".{0,80}?queryId:"([A-Za-z0-9_-]{10,})"'),
	# queryId:"<hash>",operationName:"TweetDetail"
	re.compile(r'queryId:"([A-Za-z0-9_-]{10,})".{0,80}?operationName:"(Tweet[A-Za-z0-9_]+)"'),
]

TWEET_ID_RE = re.compile(r'(?:status|statuses)/(\d+)')
PREFERRED_OPS = ["TweetResultByRestId", "TweetDetail", "TweetByRestId"]

# --------- tiny utils ---------
def debug(head, msg):
	print(f"[{head}] {msg}")

def uenc(d: dict) -> str:
	return urllib.parse.urlencode(d)

def unquote(s: str) -> str:
	try:
		return urllib.parse.unquote(s)
	except Exception:
		return s

def fetch(url: str):
	try:
		r = SESSION.get(url, timeout=15)
		debug("HTTP", f"GET {url} -> {r.status_code} len={len(r.text) if r.text else 0}")
		return r
	except Exception as e:
		debug("EXC", f"{e}")
		return None

# --------- bearer + guest ---------
def discover_bearer() -> str | None:
	seed_pages = ["https://x.com/?lang=en"]
	for seed in seed_pages:
		r = fetch(seed)
		if not (r and r.ok and r.text):
			continue
		js_urls = ABS_JS_RE.findall(r.text)
		if not js_urls:
			srcs = SCRIPT_SRC_RE.findall(r.text)
			js_urls = [u for u in srcs if "abs.twimg.com" in u and u.endswith(".js")]
		debug("DISCOVER", f"seed js candidates={len(js_urls)}")
		for jsu in js_urls[:8]:
			jsr = fetch(jsu)
			if not (jsr and jsr.ok and jsr.text):
				continue
			m = BEARER_RE.search(jsr.text)
			if m:
				token = unquote(m.group(1))
				debug("SUCCESS", f"discovered bearer len={len(token)} :: {token[:20]}... (redacted)")
				return token
	debug("ERROR", "bearer not found")
	return None

def get_guest(bearer: str) -> str | None:
	url = "https://api.twitter.com/1.1/guest/activate.json"
	h = {"Authorization": f"Bearer {bearer}", "Accept": "application/json", "User-Agent": UA}
	debug("REQ", f"POST {url}")
	r = SESSION.post(url, headers=h, timeout=15)
	debug("RESP", f"status={r.status_code} text[:160]={r.text[:160] if r.text else ''}")
	if r.status_code == 200:
		gt = r.json().get("guest_token")
		if gt:
			debug("SUCCESS", f"guest_token={gt}")
			return gt
	return None

# --------- discover graphql ops from JS ---------
def harvest_js_urls(tweet_id: str) -> list[str]:
	urls = set()
	# tweet page (often lazy-loads tweet-detail bundles)
	for u in [
		f"https://x.com/i/web/status/{tweet_id}",
		f"https://x.com/{tweet_id}",
		"https://x.com/?lang=en",
	]:
		r = fetch(u)
		if not (r and r.ok and r.text):
			continue
		for m in ABS_JS_RE.findall(r.text) or []:
			urls.add(m)
		for m in SCRIPT_SRC_RE.findall(r.text) or []:
			if "abs.twimg.com" in m and m.endswith(".js"):
				urls.add(m)
	debug("HARVEST", f"collected {len(urls)} JS URLs from pages (pre-scan)")
	return list(urls)

def discover_ops_from_js(js_text: str) -> list[tuple[str,str]]:
	ops = []
	seen = set()
	# 1) literal /graphql/<hash>/<op> occurrences
	for m in GRAPHQL_PATH_RE.finditer(js_text):
		hsh, op = m.group(1), m.group(2)
		if "Tweet" in op:
			key = (hsh, op)
			if key not in seen:
				seen.add(key); ops.append(key)
	# 2) operationName ↔ queryId mappings
	for rx in MAP_RE_VARIANTS:
		for m in rx.finditer(js_text):
			# normalize capture order across variants
			g = m.groups()
			if "Tweet" in g[0]:
				op, hsh = g[0], g[1]
			else:
				hsh, op = g[0], g[1]
			key = (hsh, op)
			if key not in seen and "Tweet" in op:
				seen.add(key); ops.append(key)
	return ops

def discover_graphql_ops(tweet_id: str) -> list[tuple[str,str]]:
	js_urls = harvest_js_urls(tweet_id)
	all_ops = []
	seen = set()
	for i, u in enumerate(js_urls[:20], 1):
		r = fetch(u)
		if not (r and r.ok and r.text):
			continue
		ops = discover_ops_from_js(r.text)
		if ops:
			debug("OPS", f"{len(ops)} ops in {u.split('/')[-1]} (showing up to 5): {ops[:5]}")
		for op in ops:
			if op not in seen:
				seen.add(op); all_ops.append(op)
	debug("OPS", f"total unique ops found: {len(all_ops)}")
	return all_ops

def pick_op(ops: list[tuple[str,str]]) -> tuple[str,str] | None:
	# try preferred names first
	for pref in PREFERRED_OPS:
		for h, op in ops:
			if op == pref:
				debug("PICK", f"selected {op} :: {h}")
				return (h, op)
	# else, pick any op containing 'Tweet'
	for h, op in ops:
		if "Tweet" in op:
			debug("PICK", f"fallback choose {op} :: {h}")
			return (h, op)
	return None

# --------- building variables & features ---------
def vars_for_op(op: str, tweet_id: str) -> dict:
	if op == "TweetDetail":
		# TweetDetail expects focalTweetId + extra flags
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
	# default for TweetResultByRestId & friends
	return {
		"tweetId": tweet_id,
		"withCommunity": False,
		"includePromotedContent": False,
		"withVoice": True,
		"withV2Timeline": True,
		"withQuickPromoteEligibilityTweetFields": False,
		"withBirdwatchNotes": False
	}

def default_features() -> dict:
	return {
		# core toggles commonly required
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
		"responsive_web_media_download_video_enabled": False,
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
	}

# --------- call graphql + extract media ---------
def call_graphql(bearer: str, guest: str, hsh: str, op: str, tweet_id: str):
	base = f"https://api.twitter.com/graphql/{hsh}/{op}"
	vars_json = json.dumps(vars_for_op(op, tweet_id), separators=(",",":"))
	feat_json = json.dumps(default_features(), separators=(",",":"))
	params = {"variables": vars_json, "features": feat_json}
	url = f"{base}?{uenc(params)}"
	headers = {
		"Authorization": f"Bearer {bearer}",
		"x-guest-token": guest,
		"User-Agent": UA,
		"Accept": "application/json",
		"Referer": f"https://x.com/i/web/status/{tweet_id}",
	}
	debug("REQ", f"GET {base} (op={op})")
	r = SESSION.get(url, headers=headers, timeout=20)
	debug("RESP", f"status={r.status_code} len={len(r.text) if r.text else 0}")
	if r.status_code != 200:
		debug("BODY", r.text[:400] if r.text else "")
		return None
	try:
		return r.json()
	except Exception as e:
		debug("EXC", f"json decode failed: {e}")
		debug("BODY", r.text[:400])
		return None

def walk_media_urls(obj, found):
	if isinstance(obj, dict):
		for k, v in obj.items():
			if k in ("media_url_https", "media_url") and isinstance(v, str):
				if "pbs.twimg.com" in v or "video.twimg.com" in v:
					found.add(v)
			if k == "variants" and isinstance(v, list):
				for itm in v:
					if isinstance(itm, dict):
						u = itm.get("url")
						if isinstance(u, str) and ("video.twimg.com" in u or "pbs.twimg.com" in u):
							found.add(u)
			walk_media_urls(v, found)
	elif isinstance(obj, list):
		for it in obj:
			walk_media_urls(it, found)
			
_MISSING_RE = re.compile(r"The following features cannot be null:\s*([^}]+?)(?:\"|$)")

def parse_missing_features(error_text: str) -> list[str]:
	# error text often looks like:  {"errors":[{"message":"The following features cannot be null: a_b, c_d, e_f", ...}]}
	try:
		j = json.loads(error_text)
		msg = j.get("errors", [{}])[0].get("message", "")
	except Exception:
		msg = error_text or ""
	m = _MISSING_RE.search(msg)
	if not m:
		# fallback: split by commas if present
		if "cannot be null" in msg:
			frag = msg.split("cannot be null:")[-1]
			return [x.strip(" ,") for x in frag.split(",") if x.strip()]
		return []
	frag = m.group(1)
	return [x.strip(" ,") for x in frag.split(",") if x.strip()]

def ensure_features(features: dict, required: list[str]):
	added = []
	for k in required:
		if k not in features:
			features[k] = False  # safe default; backend mostly checks presence
			added.append(k)
	return added

# --- wrappers to call GraphQL with auto backfill + optional op fallback ---
def call_graphql_once(bearer: str, guest: str, hsh: str, op: str, tweet_id: str, features: dict):
	base = f"https://api.twitter.com/graphql/{hsh}/{op}"
	vars_json = json.dumps(vars_for_op(op, tweet_id), separators=(",",":"))
	feat_json = json.dumps(features, separators=(",",":"))
	params = {"variables": vars_json, "features": feat_json}
	url = f"{base}?{uenc(params)}"
	headers = {
		"Authorization": f"Bearer {bearer}",
		"x-guest-token": guest,
		"User-Agent": UA,
		"Accept": "application/json",
		"Referer": f"https://x.com/i/web/status/{tweet_id}",
	}
	debug("REQ", f"GET {base} (op={op})")
	r = SESSION.get(url, headers=headers, timeout=25)
	debug("RESP", f"status={r.status_code} len={len(r.text) if r.text else 0}")
	return r

def call_graphql_with_backfill(bearer: str, guest: str, picked_hash: str, picked_op: str, tweet_id: str):
	features = default_features().copy()
	# up to 3 adaptive retries
	for attempt in range(1, 4):
		debug("PHASE", f"GraphQL attempt {attempt} using op={picked_op}")
		resp = call_graphql_once(bearer, guest, picked_hash, picked_op, tweet_id, features)
		if resp.status_code == 200:
			try:
				return resp.json()
			except Exception as e:
				debug("EXC", f"json decode failed: {e}")
				debug("BODY", resp.text[:400])
				return None
		if resp.status_code == 400 and resp.text:
			missing = parse_missing_features(resp.text)
			if missing:
				added = ensure_features(features, missing)
				debug("BACKFILL", f"Added {len(added)} missing feature flags: {added}")
				continue
		# other errors: break early and report
		debug("BODY", resp.text[:400] if resp.text else "")
		break
	return None

def try_both_ops(bearer: str, guest: str, ops: list[tuple[str,str]], tweet_id: str):
	# prefer TweetResultByRestId, then TweetDetail
	candidates = []
	for name in ("TweetResultByRestId", "TweetDetail"):
		candidates.extend([x for x in ops if x[1] == name])
	if not candidates:
		candidates = ops  # last resort: anything with "Tweet"
	for hsh, op in candidates:
		debug("PICK", f"trying op={op} :: {hsh}")
		data = call_graphql_with_backfill(bearer, guest, hsh, op, tweet_id)
		if data:
			return data, (hsh, op)
	return None, None

# --------- entrypoint ---------
def extract_tweet_id(s: str) -> str:
	m = TWEET_ID_RE.search(s)
	return m.group(1) if m else s.strip()

def main():
	if len(sys.argv) < 2:
		print("Usage: python x_tweet_graphql_probe2.py <tweet_url_or_id>")
		sys.exit(1)
	tweet_id = extract_tweet_id(sys.argv[1])
	debug("PHASE", f"Tweet ID = {tweet_id}")

	debug("PHASE", "Discover bearer...")
	bearer = discover_bearer()
	if not bearer:
		print("[FAIL] bearer discovery failed"); return

	debug("PHASE", "Guest activate...")
	guest = get_guest(bearer)
	if not guest:
		print("[FAIL] guest token retrieval failed"); return

	debug("PHASE", "Discover GraphQL ops (expanded)…")
	ops = discover_graphql_ops(tweet_id)
	if not ops:
		print("[FAIL] no graphql ops found in JS"); return

	picked = pick_op(ops)
	if not picked:
		print("[FAIL] no suitable tweet op found"); return
	hsh, op = picked

	debug("PHASE", f"Call GraphQL ({op})")
	data, used = try_both_ops(bearer, guest, ops, tweet_id)
	if not data:
		print("[FAIL] GraphQL returned no JSON (even after backfill/fallback). See logs above.")
		return
	debug("INFO", f"Using op={used[1]} hash={used[0]}")

	debug("JSON", "top-level keys: " + ", ".join(list(data.keys())[:12]))
	peek = json.dumps(data, ensure_ascii=False)[:800]
	debug("JSON", f"peek: {peek}...")

	found = set()
	walk_media_urls(data, found)
	if found:
		print("\n[MEDIA] extracted URLs:")
		for u in sorted(found):
			print(u)
	else:
		print("\n[MEDIA] no media found; different op/hash or variable set may be needed.")

if __name__ == "__main__":
	main()
