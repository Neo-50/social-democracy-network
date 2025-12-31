# Social Democracy Network

A political discussion and news aggregation platform built with Flask and PostgreSQL.  
This site aims to amplify independent media, support activism, and provide a space for community discussion.

## Features

- 🌐 Submit and discuss news articles with metadata extraction
- 🧵 Comment threads with nested replies and moderation
- 🤣 Reaction system for comments and news articles with unicode and custom emojis
- 💬 Real-time messaging and chat via WebSockets
- ☠️ TwitterX archiving tool: https://social-democracy.net/archive-x
- 🧑 User accounts with email verification and session-based authentication
- 🛡️ Admin tools
- 🧠 Clean, responsive layout styled with custom CSS
- 🔒 Secure password hashing and session handling

## Tech Stack

- **Backend:** Python, Flask, SQLAlchemy ORM, Flask-Login, Flask-WTF (CSRF), itsdangerous, Flask-SocketIO (real-time messaging)
- **Frontend:** HTML, CSS (custom), Jinja2 templates, JavaScript
- **Database:** PostgreSQL (production), SQLite (local) managed via DBeaver
- **Other Tools:** Requests, BeautifulSoup, Poetry, Subprocess (metadata scraper), Timezone-aware datetime handling, dotenv (environment-based config), link metadata extraction and previews, server-side HTML and CSS sanitization
