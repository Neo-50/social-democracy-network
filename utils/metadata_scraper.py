import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import logging

from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

log = logging.getLogger(__name__)

# Domain lists

MANUAL_REVIEW_DOMAINS = {
    "axios.com", "apnews.com", "reuters.com", "washingtonpost.com", "cnn.com", "nytimes.com"
}


def extract_metadata(url, debug=False):
    domain = urlparse(url).netloc.replace("www.", "")

    if domain in MANUAL_REVIEW_DOMAINS:
        return blank_metadata(domain, url)
    rscrape = try_requests_scrape(url, domain)
    if rscrape:
        return rscrape
    else:
        pwscrape = try_playwright_scrape(url, domain, debug)
        if pwscrape:
            return pwscrape
        else:
            return blank_metadata(domain, url)

def try_requests_scrape(url, domain):
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        return blank_metadata(domain, url)

    soup = BeautifulSoup(response.text, "html.parser")

    def get_meta(attr, value):
        tag = soup.find("meta", attrs={attr: value})
        if tag and tag.has_attr("content"):
            content = tag["content"].strip()
            return content if content else None
        return None

    if not soup.title or not soup.title.string:
        return blank_metadata(domain, url)

    metadata = {
        "title": soup.title.string.strip(),
        "description": get_meta("name", "description") or get_meta("property", "og:description"),
        "image_url": get_meta("property", "og:image"),
        "authors": get_meta("name", "author"),
        "published": get_meta("property", "article:published_time"),
        "source": domain
    }

    return metadata


def try_playwright_scrape(url, domain, debug=False):
    blank = blank_metadata(domain)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            stealth_sync(page)

            try:
                page.goto(url, timeout=30000, wait_until="domcontentloaded")
            except Exception as e:
                log.error(f"[PLAYWRIGHT] page.goto() failed: {e}")
                return blank

            title = page.title()
            if "Just a moment" in title or "Access denied" in title:
                log.warning(f"[PLAYWRIGHT] Blocked by bot wall on {url}")
                return blank

            def safe_locator(selector):
                try:
                    return page.locator(selector).get_attribute("content")
                except:
                    return None

            metadata = {
                "title": title,
                "description": safe_locator("meta[name='description']"),
                "image_url": safe_locator("meta[property='og:image']"),
                "authors": safe_locator("meta[name='author']"),
                "published": safe_locator("meta[property='article:published_time']"),
                "source": domain,
            }

            browser.close()
            return metadata

    except Exception as e:
        log.error(f"[PLAYWRIGHT] scrape failed for {url}: {e}")
        return blank


def blank_metadata(domain, url):
    return {
        "title": url,
        "description": f"Preview unavailable for {domain}",
        "image_url": f"media/news/default-article-image.png",
        "source": domain,
        "authors": None,
        "published": None,
    }
