import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import logging

from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

log = logging.getLogger(__name__)

# Domain lists
STEALTH_REQUIRED_DOMAINS = {
    "cnn.com", "nytimes.com", "washingtonpost.com"
}

MANUAL_REVIEW_DOMAINS = {
    "axios.com", "apnews.com", "reuters.com", "washingtonpost.com", "cnn.com"
}


def extract_metadata(url, debug=False):
    domain = urlparse(url).netloc.replace("www.", "")

    if domain in MANUAL_REVIEW_DOMAINS:
        log.warning(f"[SCRAPER] Skipping metadata for blocked domain: {domain}")
        return blank_metadata(domain)

    try:
        if domain in STEALTH_REQUIRED_DOMAINS:
            return try_playwright_scrape(url, domain, debug)
        else:
            metadata = try_requests_scrape(url, domain)
            if metadata["title"]:
                return metadata
            return try_playwright_scrape(url, domain, debug)
    except Exception as e:
        log.error(f"[SCRAPER] Unexpected error: {e}")
        return blank_metadata(domain)


def try_requests_scrape(url, domain):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        log.warning(f"[REQUESTS] Failed to fetch {url}: {e}")
        return blank_metadata(domain)

    soup = BeautifulSoup(response.text, "html.parser")

    def get_meta(attr, value):
        tag = soup.find("meta", attrs={attr: value})
        return tag["content"].strip() if tag and tag.has_attr("content") else None

    metadata = {
        "title": soup.title.string.strip() if soup.title else None,
        "description": get_meta("name", "description"),
        "image_url": get_meta("property", "og:image"),
        "authors": get_meta("name", "author"),
        "published": get_meta("property", "article:published_time"),
        "source": domain,
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
                page.goto(url, timeout=60000, wait_until="domcontentloaded")
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

            if debug:
                print("[DEBUG] Playwright metadata:", metadata)

            browser.close()
            return metadata

    except Exception as e:
        log.error(f"[PLAYWRIGHT] scrape failed for {url}: {e}")
        return blank


def blank_metadata(domain):
    return {
        "title": None,
        "description": None,
        "image_url": None,
        "authors": None,
        "published": None,
        "source": domain,
    }
