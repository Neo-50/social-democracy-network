from newspaper import Article
import requests
import nltk
import os

# Setup: make sure punkt is available
def setup_nltk():
    try:
        nltk_data_path = os.path.join(os.path.dirname(__file__), '..', 'nltk_data')
        os.makedirs(nltk_data_path, exist_ok=True)

        print(f"[SETUP] Downloading punkt to {nltk_data_path}")
        nltk.download('punkt', download_dir=nltk_data_path)
        nltk.data.path.append(nltk_data_path)

    except Exception as e:
        print(f"[ERROR] Failed to setup NLTK: {e}")

setup_nltk()

# Main metadata extraction function
def extract_metadata(url):
    try:
        article = Article(url)

        # Spoof user-agent to avoid blocks
        article.session = requests.Session()
        article.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0'
        })

        article.download()
        article.parse()

        # Try NLP (summary), but catch nltk errors separately
        try:
            article.nlp()
            description = article.summary
        except Exception as e:
            print(f"[WARN] NLP failed: {e}")
            description = None

        result = {
            "title": article.title,
            "description": description,
            "image_url": article.top_image,
            "authors": ", ".join(article.authors)
        }

        print(f"[DEBUG] Metadata extracted: {result}")
        return result

    except Exception as e:
        print(f"[ERROR] Failed to extract metadata from {url}: {e}")
        return {
            "title": None,
            "description": None,
            "image_url": None,
            "authors": None
        }
