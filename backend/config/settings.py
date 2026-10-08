import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
from dotenv import dotenv_values, load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR.parent / '.env'
LOCAL_ENV = dotenv_values(ENV_FILE)
load_dotenv(ENV_FILE, override=True)
DEBUG = os.getenv('DJANGO_DEBUG', 'true').lower() == 'true'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    raise ImproperlyConfigured('Pokreni node scripts/init-env.mjs za pripremu lokalnih postavki.')
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', 'http://127.0.0.1:5175,http://localhost:5175').split(',')
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'studio',
]
MIDDLEWARE = [
    'studio.diagnostics.RequestDiagnosticsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'studio.local_access.FirstLoginPasswordMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
AUTH_PASSWORD_VALIDATORS = [{'NAME': 'django.contrib.auth.password_validation.' + name} for name in [
    'UserAttributeSimilarityValidator', 'MinimumLengthValidator', 'CommonPasswordValidator', 'NumericPasswordValidator',
]]
LANGUAGE_CODE = 'bs'
TIME_ZONE = 'Europe/Sarajevo'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/private-media/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
APPEND_SLASH = False
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_NAME = 'klipanje_sessionid'
CSRF_COOKIE_NAME = 'klipanje_csrftoken'
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
CSRF_FAILURE_VIEW = 'studio.accounts.csrf_failure'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'EXCEPTION_HANDLER': 'studio.errors.api_exception_handler',
}

# Provider keys come only from this project's root .env, never inherited process credentials.
OPENAI_API_KEY = LOCAL_ENV.get('OPENAI_API_KEY', '') or ''
OPENAI_MODEL = LOCAL_ENV.get('OPENAI_MODEL', 'gpt-4.1-mini')
ELEVENLABS_API_KEY = LOCAL_ENV.get('ELEVENLABS_API_KEY', '') or ''

# Storage and the database are deliberately local. Cloud adapters are not configured.
STORAGE_BACKEND = 'local'
LOCAL_APP = True
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(2 * 1024**3)))
MAX_PROJECT_UPLOAD_BYTES = int(os.getenv('MAX_PROJECT_UPLOAD_BYTES', str(10 * 1024**3)))
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024**2
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024**2
ACCESS_APPROVAL_REQUIRED = False
ACCESS_APPROVAL_EMAIL = ''
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'Klipanje <noreply@localhost>'
ACCOUNT_EMAIL_ORIGIN = 'http://127.0.0.1:5175'
