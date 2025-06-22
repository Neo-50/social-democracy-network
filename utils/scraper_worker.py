import sys
import os
from app import db
from models import Article  # adjust this import to match your model
from metadata_scraper import try_playwright_scrape

def update_article(article_id, url):
    domain = url.split('/')[2]
    data = try_playwright_scrape(url, domain)
    article = Article.query.get(article_id)
    if article:
        article.title = data['title']
        article.description = data['description']
        article.image_url = data['image']
        db.session.commit()

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python scraper_worker.py <article_id> <url>")
        sys.exit(1)

    article_id = int(sys.argv[1])
    url = sys.argv[2]
    update_article(article_id, url)
