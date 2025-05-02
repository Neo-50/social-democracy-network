import requests
from bs4 import BeautifulSoup

def extract_metadata(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) Gecko/20100101 Firefox/117.0"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        def get_meta(property_name):
            tag = soup.find("meta", property=property_name)
            return tag["content"].strip() if tag and "content" in tag.attrs else None

        metadata = {
            "title": get_meta("og:title") or soup.title.string if soup.title else url,
            "description": get_meta("og:description"),
            "image_url": get_meta("og:image"),
            "authors": get_meta("article:author") or get_meta("author")
        }

        print(f"[DEBUG] Metadata extracted for {url}: {metadata}")
        return metadata

    except Exception as e:
        print(f"[ERROR] Metadata extraction failed for {url}: {e}")
        return {
            "title": None,
            "description": None,
            "image_url": None,
            "authors": None
        }
