# Social Democracy Network

A political discussion and news aggregation platform built with Flask and PostgreSQL.  
This site aims to amplify independent media, support activism, and provide a space for community discussion.

## Features

- 🌐 Submit and discuss news articles with metadata extraction
- 💬 Comment threads with nested replies and moderation
- 🔼 Reaction system for comments and news articles with unicode and custom emojis
- 🔼 TwitterX archiving tool: https://social-democracy.net/archive-x
- 🧑 User registration/login system with admin tools
- 🧠 Clean, responsive layout styled with custom CSS
- 🔒 Secure password hashing and session handling

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy
- **Frontend:** HTML, CSS (custom), Jinja2 templates
- **Database:** PostgreSQL (production), SQLite (local)
- **Other Tools:** Requests, BeautifulSoup, Poetry

## Setup Instructions

```bash
# Install dependencies
poetry install

# Activate the environment
poetry env activate

# Set environment variable (if local)
$Env:FLASK_APP = "app.py"  # Windows PowerShell
export FLASK_APP=app.py    # macOS/Linux

# Run migrations
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Run the app
flask run
