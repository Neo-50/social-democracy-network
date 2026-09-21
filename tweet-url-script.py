import sqlite3

DB_PATH = "site.db"

OLD_DOMAINS = [
    "https://xcancel.com",
    "https://nitter.net",
    "https://nitter.space",
    "https://x.com",
    "https://fixupx.com",
    "https://fxtwitter.com"
]

NEW_DOMAIN = "https://shitter.thepixora.com"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

for old_domain in OLD_DOMAINS:
    cursor.execute(
        """
        UPDATE tweet_archive
        SET source_url = REPLACE(source_url, ?, ?)
        WHERE source_url LIKE ?
        """,
        (old_domain, NEW_DOMAIN, old_domain + "/%"),
    )

    print(f"{old_domain}: {cursor.rowcount} URLs changed")

conn.commit()
conn.close()

print("Done.")