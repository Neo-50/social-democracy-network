from newspaper import Article

def extract_metadata(url):
    try:
        article = Article(url)
        article.download()
        article.parse()
        article.nlp()  # optional, for keywords etc.

        return {
            "title": article.title,
            "description": article.summary,
            "image_url": article.top_image,
            "authors": ", ".join(article.authors)
        }
    except Exception as e:
        print(f"[ERROR] Failed to extract metadata from {url}: {e}")
        return {
            "title": None,
            "description": None,
            "image_url": None,
            "authors": None
        }
