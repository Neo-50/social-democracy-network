import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# Domain lists

MANUAL_REVIEW_DOMAINS = {
    "axios.com", "apnews.com", "reuters.com", "washingtonpost.com", "cnn.com", "nytimes.com"
}

YOUTUBE_DOMAINS = {"youtube.com", "youtu.be"}

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

def extract_metadata(url, debug=False):
    domain = urlparse(url).netloc.replace("www.", "")

    if domain in YOUTUBE_DOMAINS:
        yt = try_youtube_scrape(url)
        if yt:
            return yt
    
    if domain in MANUAL_REVIEW_DOMAINS:
        return blank_metadata (url, domain)

    # Normal flow for all other domains
    rscrape = try_requests_scrape(url, domain)
    if rscrape:
        return rscrape
    else:
        return blank_metadata(url, domain)

def try_youtube_scrape(url):
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return None

    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"

    try:
        resp = requests.get(oembed_url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return {
            "title": data.get("title"),
            "description": f"Video by {data.get('author_name')}",
            "image_url": data.get("thumbnail_url"),
            "source": "youtube.com",
            "authors": data.get("author_name"),
            "published": None,  # oEmbed does not provide this
            "embed_html": f'''
            <div class='responsive-youtube'>
                <iframe
                    src='https://www.youtube.com/embed/{video_id}?enablejsapi=1'
                    frameborder='0'
                    loading='lazy'
                    allowfullscreen
                ></iframe>
            </div>
            '''                     
        }
    except Exception as e:
        return None

def extract_youtube_video_id(url):
    parsed = urlparse(url)
    if "youtu.be" in parsed.netloc:
        return parsed.path.lstrip("/")
    if "youtube.com" in parsed.netloc:
        qs = dict(part.split('=') for part in parsed.query.split('&') if '=' in part)
        return qs.get("v")
    return None

def try_requests_scrape(url, domain):
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        return blank_metadata(url, domain)

    soup = BeautifulSoup(response.text, "html.parser")

    def get_meta(attr, value):
        tag = soup.find("meta", attrs={attr: value})
        if tag and tag.has_attr("content"):
            content = tag["content"].strip()
            return content if content else None
        return None

    if not soup.title or not soup.title.string:
        return blank_metadata(url, domain)

    metadata = {
        "title": soup.title.string.strip(),
        "description": get_meta("name", "description") or get_meta("property", "og:description"),
        "image_url": get_meta("property", "og:image"),
        "authors": get_meta("name", "author"),
        "published": get_meta("property", "article:published_time"),
        "source": domain
    }

    return metadata
