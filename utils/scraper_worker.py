import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app
from app import db
import asyncio
import logging
import requests
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
from models import NewsArticle

log = logging.getLogger(__name__)


def blank_metadata(url, domain):
    return {
        "title": url,
        "description": f"Blocked by {domain}",
        "image_url": f"media/news/default-article-image.png",
        "source": domain,
        "authors": None,
        "published": None,
        "needs_scrape": True,
    }


def try_playwright_scrape(url, domain, debug=False):
    print(f"[PLAYWRIGHT] Starting scrape for {url}")
    blank = blank_metadata(url, domain)
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=[
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--single-process",
            "--no-zygote",
            "--disable-software-rasterizer",
            ])
            context = browser.new_context()
            page = context.new_page()
            stealth_sync(page)

            try:
                page.goto(url, timeout=8000, wait_until="domcontentloaded")
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
                "needs_scrape": False,
                "source": domain,
            }
            print(f"[PLAYWRIGHT] Completed scrape for {url} with data:")
            print(metadata)

            browser.close()
            if all(value is None for key, value in metadata.items() if key != "source"):
                log.warning(f"[PLAYWRIGHT] No useful metadata found on {url}")

            return metadata

    except Exception as e:
        log.error(f"[PLAYWRIGHT] scrape failed for {url}: {e}")
        return blank

async def update_article(article_id, url):
    try:
        domain = urlparse(url).netloc.replace("www.", "")
        loop = asyncio.get_running_loop()
        try:
            data = await asyncio.wait_for(
                loop.run_in_executor(None, try_playwright_scrape, url, domain),
                timeout=120
            )
        except asyncio.TimeoutError:
            print(f"[SCRAPER WORKER] Timeout exceeded for article {article_id}")
            article = NewsArticle.query.get(article_id)
            if article:
                article.needs_scrape = False
                db.session.commit()
            return

        article = NewsArticle.query.get(article_id)
        if article:
            article.title = data['title'] or f"[URL] {url}"
            article.description = data['description']  or "Blocked by " + domain
            article.image_url = data['image_url'] or None
            article.source = data['source']  or domain
            article.authors = data['authors']  or None
            article.published = data['published'] or None
            article.needs_scrape = False
            print(f"[SCRAPER WORKER] Saving article {article_id} with new metadata")
            db.session.commit()
            print(f"[SCRAPER WORKER] Article {article_id} committed successfully")

    except Exception as e:
        print(f"[SCRAPER WORKER] Failed to update article {article_id}: {e}")
        article = NewsArticle.query.get(article_id)
        if article:
            article.needs_scrape = False
            db.session.commit()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python scraper_worker.py <article_id> <url>")
        sys.exit(1)

    article_id = int(sys.argv[1])
    url = sys.argv[2]

    with app.app_context():
        asyncio.run(update_article(article_id, url))
