import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import app
from app import db
from models import NewsArticle
from metadata_scraper import try_playwright_scrape

def update_article(article_id, url):
    try:
        domain = url.split('/')[2]
        data = try_playwright_scrape(url, domain)
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

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python scraper_worker.py <article_id> <url>")
        sys.exit(1)

    article_id = int(sys.argv[1])
    url = sys.argv[2]
    with app.app_context():
        update_article(article_id, url)
