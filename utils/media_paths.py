import os
from flask import current_app

def get_media_path(*parts):
    return os.path.join(current_app.root_path, 'mnt', 'storage', *parts)