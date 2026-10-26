"""
Django settings for G-Doc (sistema de gestión documental).
Desarrollo: SQLite por defecto. Producción: PostgreSQL vía variables de entorno.
"""
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Cargar .env si existe (python-dotenv)
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    env_path = BASE_DIR / '.env'
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-cambiar-en-produccion-gdoc-mvp'
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]

# --------------------------------------------------
# APPLICATIONS
# --------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'corsheaders',

    # Local
    'documental',
    'accounts',
    'simple_history',
]

# --------------------------------------------------
# MIDDLEWARE
# --------------------------------------------------

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Sirve los estáticos (admin de Django) también con DEBUG=False
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',

    'corsheaders.middleware.CorsMiddleware',

    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',

    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'simple_history.middleware.HistoryRequestMiddleware',
]

ROOT_URLCONF = 'config.urls'

# --------------------------------------------------
# TEMPLATES
# --------------------------------------------------

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --------------------------------------------------
# DATABASE
# --------------------------------------------------

db_engine = os.environ.get('GDOC_DB_ENGINE', 'sqlite').strip().lower()
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()

if DATABASE_URL:
    # Render, Railway, Neon y Supabase entregan una única URL de conexión.
    import dj_database_url

    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
elif db_engine in ('postgresql', 'postgres'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('GDOC_DB_NAME', 'gdoc'),
            'USER': os.environ.get('GDOC_DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('GDOC_DB_PASSWORD', ''),
            'HOST': os.environ.get('GDOC_DB_HOST', 'localhost'),
            'PORT': os.environ.get('GDOC_DB_PORT', '5432'),
            'CONN_MAX_AGE': 600,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# --------------------------------------------------
# PASSWORD VALIDATORS
# --------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --------------------------------------------------
# INTERNATIONALIZATION
# --------------------------------------------------

LANGUAGE_CODE = 'es'

TIME_ZONE = 'America/Bogota'

USE_I18N = True
USE_TZ = True

# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise comprime y sirve los estáticos sin depender de nginx.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# --------------------------------------------------
# MEDIA FILES
# --------------------------------------------------

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Carga documental mediante el flujo existente. Alias para instalaciones previas.
POWER_AUTOMATE_UPLOAD_URL = os.environ.get('POWER_AUTOMATE_UPLOAD_URL') or os.environ.get('POWER_AUTOMATE_URL', '')
POWER_AUTOMATE_UPLOAD_TIMEOUT = float(os.environ.get('POWER_AUTOMATE_UPLOAD_TIMEOUT', '30'))
POWER_AUTOMATE_BEARER_TOKEN = os.environ.get('POWER_AUTOMATE_BEARER_TOKEN', '')
POWER_AUTOMATE_IDENTITY_UPLOAD_URL = os.environ.get('POWER_AUTOMATE_IDENTITY_UPLOAD_URL', '')
POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS = frozenset(
    int(value.strip())
    for value in os.environ.get('POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS', '').split(',')
    if value.strip()
)
POWER_AUTOMATE_IDENTITY_TIMEOUT = float(os.environ.get('POWER_AUTOMATE_IDENTITY_TIMEOUT', '90'))
DOCUMENT_UPLOAD_MAX_BYTES = int(os.environ.get('DOCUMENT_UPLOAD_MAX_BYTES', str(10 * 1024 * 1024)))
if POWER_AUTOMATE_UPLOAD_TIMEOUT <= 0 or POWER_AUTOMATE_IDENTITY_TIMEOUT <= 0 or DOCUMENT_UPLOAD_MAX_BYTES <= 0:
    raise ValueError('El timeout y el tamaño máximo de carga deben ser positivos.')
if any(value <= 0 for value in POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS):
    raise ValueError('Los ID de requisitos de identidad deben ser positivos.')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --------------------------------------------------
# DJANGO REST FRAMEWORK
# --------------------------------------------------

REST_FRAMEWORK = {

    # AUTENTICACIÓN JWT
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),

    # PERMISOS
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],

    # PAGINACIÓN
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# --------------------------------------------------
# SIMPLE JWT
# --------------------------------------------------

from datetime import timedelta

SIMPLE_JWT = {

    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),

    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),

    "AUTH_HEADER_TYPES": ("Bearer",),

    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# --------------------------------------------------
# CORS
# --------------------------------------------------

# En producción define, por ejemplo:
# CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,'
        'http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080',
    ).split(',')
    if origin.strip()
]

# Permite los dominios de preview de Vercel (*.vercel.app) si se activa.
if os.environ.get('CORS_ALLOW_VERCEL_PREVIEWS', 'false').lower() in ('true', '1', 'yes'):
    CORS_ALLOWED_ORIGIN_REGEXES = [r'^https://[\w-]+\.vercel\.app$']

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Dominios de confianza para el admin de Django y formularios con CSRF.
# En producción incluye el dominio del backend, p. ej. https://mi-api.onrender.com
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]

# Para desarrollo
if DEBUG and os.environ.get('CORS_ALLOW_ALL', 'false').lower() in ('true', '1'):
    CORS_ALLOW_ALL_ORIGINS = True

# Detrás del proxy HTTPS de Render/Railway.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# --------------------------------------------------
# Correo (recuperación de contraseña). En desarrollo: consola.
# Producción: EMAIL_BACKEND=smtp y variables SMTP en .env
# --------------------------------------------------

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend',
)
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'SIGEA <noreply@localhost>')

# --------------------------------------------------
# OCR (FASE 3)
# --------------------------------------------------

TESSERACT_CMD = os.environ.get('TESSERACT_CMD', '')
