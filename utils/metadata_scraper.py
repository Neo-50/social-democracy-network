from newspaper import Article
import requests

def extract_metadata(url):
    try:
        article = Article(url)
        # Set custom headers to spoof a browser
        article.download_state = 0
        article.session = requests.Session()
        article.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0'
        })

        article.download()
        article.parse()
        article.nlp()

        result = {
            "title": article.title,
            "description": article.summary,
            "image_url": article.top_image,
            "authors": ", ".join(article.authors)
        }

        print(f"[DEBUG] Metadata extracted for {url}: {result}")
        return result

    except Exception as e:
        print(f"[ERROR] Failed to extract metadata from {url}: {e}")
        return {
            "title": None,
            "description": None,
            "image_url": None,
            "authors": None
        }
