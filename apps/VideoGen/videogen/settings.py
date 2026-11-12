import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent.parent / '.env')
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'videogen-local-development-only')
DEBUG = os.getenv('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
INSTALLED_APPS = ['django.contrib.contenttypes', 'django.contrib.auth', 'studio']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'videogen.urls'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'videogen.sqlite3', 'OPTIONS': {'timeout': 20, 'transaction_mode': 'IMMEDIATE'}}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'Europe/Sarajevo'
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
DATA_UPLOAD_MAX_MEMORY_SIZE = 9 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
CSRF_TRUSTED_ORIGINS = ['http://localhost:5176', 'http://127.0.0.1:5176']
VIDEOGEN_ALLOW_PAID = os.getenv('VIDEOGEN_ALLOW_PAID', '0') == '1'
VIDEOGEN_MODAL_APP = os.getenv('VIDEOGEN_MODAL_APP', 'videogen-gpu')

# Keep browser sessions independent from Klipanje on the same hostname.
CSRF_COOKIE_NAME = "videogen_csrftoken"
SESSION_COOKIE_NAME = "videogen_sessionid"
