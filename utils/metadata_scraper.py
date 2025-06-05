import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
try:
    from requests_html import HTMLSession
except ImportError:
    HTMLSession = None

def extract_metadata(url):
    def get_meta(soup, property_name):
        tag = soup.find("meta", property=property_name)
        return tag["content"].strip() if tag and "content" in tag.attrs else None

    def parse_metadata(html, url):
        soup = BeautifulSoup(html, 'html.parser')
        metadata = {
            "title": get_meta(soup, "og:title") or (soup.title.string if soup.title else url),
            "description": get_meta(soup, "og:description") or (
                soup.find("meta", attrs={"name": "description"}) or {}
            ).get("content"),
            "image_url": get_meta(soup, "og:image"),
            "authors": get_meta(soup, "article:author") or get_meta(soup, "author"),
            "published": get_meta(soup, "article:published_time") or get_meta(soup, "og:updated_time"),
            "source": urlparse(url).netloc.replace("www.", "")
        }

        if metadata["image_url"] and metadata["image_url"].startswith("/"):
            parsed = urlparse(url)
            metadata["image_url"] = f"{parsed.scheme}://{parsed.netloc}{metadata['image_url']}"

        print(f"[DEBUG] Metadata extracted for {url}: {metadata}")
        return metadata

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) Gecko/20100101 Firefox/117.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Referer": url,
        }

        # Step 1: Try requests unless forced to render
        force_render_domains = ["axios.com", "reuters.com", "cnn.com", "nytimes.com", "washingtonpost.com"]
        should_render = any(domain in url for domain in force_render_domains)

        if not should_render:
            try:
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                html = response.text

                if len(html) < 1000 or "<meta" not in html.lower():
                    should_render = True
            except Exception as e:
                print(f"[DEBUG] requests.get failed: {e}")
                should_render = True

        if should_render:
            print(f"[DEBUG] Using JS rendering for {url}")
            session = HTMLSession()
            r = session.get(url)
            r.html.render(timeout=30)
            html = r.html.html

        # Step 2: If it's too short or missing meta tags, fall back to JS render
        else:
            # Fallback if the fetched HTML is suspiciously short or missing metadata
            if len(html) < 1000 or "<meta" not in html.lower():
                print(f"[DEBUG] Falling back to JS rendering for {url}")
                session = HTMLSession()
                r = session.get(url)
                r.html.render(timeout=20)
                html = r.html.html

        return parse_metadata(html, url)

    except Exception as e:
        print(f"[ERROR] Metadata extraction failed for {url}: {e}")
        return {
            "title": None,
            "description": None,
            "image_url": None,
            "authors": None,
            "published": None,
            "source": None
        }
