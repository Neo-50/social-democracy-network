# x_guest_token_discover.py
import re, json, urllib.parse
import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

ABS_JS_RE = re.compile(r'https://abs\.twimg\.com/responsive-web/client-web/[^"]+?\.js')
BEARER_RE = re.compile(r'Bearer\s+([A-Za-z0-9%\-_.~]+)')  # percent-encoded safe
SCRIPT_SRC_RE = re.compile(r'<script[^>]+src="([^"]+\.js)"', re.IGNORECASE)

def debug(head, msg):
	print(f"[{head}] {msg}")

def percent_decode(s):
	try:
		return urllib.parse.unquote(s)
	except Exception:
		return s

def discover_bearer_from_html(html):
	# 1) Try direct abs.twimg.com matches in HTML
	candidates = ABS_JS_RE.findall(html)
	if candidates:
		debug("DISCOVER", f"Found {len(candidates)} abs JS URLs in HTML")
		return candidates
	# 2) Fallback: collect all <script src> and filter to abs.twimg.com
	srcs = SCRIPT_SRC_RE.findall(html)
	srcs = [u for u in srcs if "abs.twimg.com" in u and u.endswith(".js")]
	if srcs:
		debug("DISCOVER", f"Found {len(srcs)} <script> URLs (abs filter)")
	return srcs

def fetch(url):
	try:
		r = SESSION.get(url, timeout=15)
		debug("HTTP", f"GET {url} -> {r.status_code} len={len(r.text) if r.text else 0}")
		return r
	except Exception as e:
		debug("EXC", f"{e}")
		return None

def find_bearer_in_js(js_text):
	m = BEARER_RE.search(js_text)
	if m:
		raw = m.group(1)
		token = percent_decode(raw)
		return token
	return None

def get_current_bearer(tweet_id_for_seed="1980710680161370311"):
	seed_urls = [
		f"https://x.com/i/web/status/{tweet_id_for_seed}",
		"https://x.com/?lang=en",
		"https://mobile.twitter.com/?lang=en",
	]
	js_tried = set()
	for seed in seed_urls:
		resp = fetch(seed)
		if not resp or not resp.ok or not resp.text:
			continue
		if "JavaScript is not available." in resp.text:
			debug("INFO", "Seed returned JS-disabled shell (expected). Continuing.")
		js_urls = discover_bearer_from_html(resp.text) or []
		# Try the first few scripts (main bundles usually carry the token)
		for js_url in js_urls[:6]:
			if js_url in js_tried:
				continue
			js_tried.add(js_url)
			js = fetch(js_url)
			if not js or not js.ok or not js.text:
				continue
			token = find_bearer_in_js(js.text)
			if token:
				debug("SUCCESS", f"Discovered bearer (len={len(token)}): {token[:16]}... (redacted)")
				return token
	debug("ERROR", "Could not discover bearer token from page scripts.")
	return None

def get_guest_token(bearer):
	url = "https://api.twitter.com/1.1/guest/activate.json"
	headers = {
		"Authorization": f"Bearer {bearer}",
		"User-Agent": UA,
		"Accept": "application/json",
	}
	debug("REQ", f"POST {url}")
	debug("REQ", f"Headers.Authorization=Bearer {bearer[:16]}... (redacted)")
	try:
		resp = SESSION.post(url, headers=headers, timeout=15)
		debug("RESP", f"status={resp.status_code} text[:200]={resp.text[:200] if resp.text else ''}")
		if resp.status_code == 200:
			data = resp.json()
			gt = data.get("guest_token")
			if gt:
				debug("SUCCESS", f"guest_token={gt}")
				return gt
	except Exception as e:
		debug("EXC", f"{e}")
	return None

if __name__ == "__main__":
	debug("PHASE", "Discovering current web bearer token...")
	bearer = get_current_bearer()
	if not bearer:
		print("[FAIL] Bearer discovery failed.")
	else:
		print("[OK] Bearer discovery succeeded.")
		debug("PHASE", "Requesting guest token using discovered bearer...")
		gt = get_guest_token(bearer)
		if gt:
			print("[OK] Guest token retrieval succeeded.")
		else:
			print("[FAIL] Guest token retrieval failed (check bearer/use another seed URL).")
