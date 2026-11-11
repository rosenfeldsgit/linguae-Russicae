import os
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent.parent
ROOT=BASE_DIR.parent
SECRET_KEY=os.environ.get('DJANGO_SECRET_KEY','')
if not SECRET_KEY:
    raise RuntimeError('Set DJANGO_SECRET_KEY before starting the server')
DEBUG=os.environ.get('DJANGO_DEBUG')=='1'
if not DEBUG and (len(SECRET_KEY)<50 or len(set(SECRET_KEY))<5 or SECRET_KEY.startswith('django-insecure-')):
    raise RuntimeError('Use a strong random DJANGO_SECRET_KEY of at least 50 characters')
ALLOWED_HOSTS=os.environ.get('DJANGO_ALLOWED_HOSTS','localhost,127.0.0.1,testserver').split(',')
CSRF_TRUSTED_ORIGINS=[x for x in os.environ.get('DJANGO_CSRF_ORIGINS','').split(',') if x]
INSTALLED_APPS=['django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','content']
MIDDLEWARE=['django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF='ege.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION='ege.wsgi.application'
DATA_DIR=Path(os.environ.get('EGE_DATA_DIR',str(BASE_DIR/'data')))
DATA_DIR.mkdir(parents=True,exist_ok=True)
if os.environ.get('POSTGRES_DB'):
    DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.environ['POSTGRES_DB'],'USER':os.environ['POSTGRES_USER'],'PASSWORD':os.environ['POSTGRES_PASSWORD'],'HOST':os.environ.get('POSTGRES_HOST','db'),'PORT':os.environ.get('POSTGRES_PORT','5432')}}
else:
    DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':DATA_DIR/'ege.sqlite3','OPTIONS':{'timeout':20}}}
LANGUAGE_CODE='ru-ru'
TIME_ZONE='Europe/Moscow'
USE_TZ=True
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
STATIC_URL='/static/'
STATIC_ROOT=DATA_DIR/'static'
AUTH_PASSWORD_VALIDATORS=[{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':10}},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'}]
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SECURE=not DEBUG
CSRF_COOKIE_SECURE=not DEBUG
SECURE_SSL_REDIRECT=not DEBUG
SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')
SECURE_CONTENT_TYPE_NOSNIFF=True
# The versions dialog embeds a same-origin page.
X_FRAME_OPTIONS='SAMEORIGIN'
SESSION_COOKIE_AGE=8*60*60

SECURE_REFERRER_POLICY='same-origin'
SECURE_HSTS_SECONDS=0 if DEBUG else int(os.environ.get('DJANGO_HSTS_SECONDS','3600'))
# Opt in only after verifying HTTPS on every subdomain.
SECURE_HSTS_INCLUDE_SUBDOMAINS=False
SECURE_HSTS_PRELOAD=False
DATA_UPLOAD_MAX_MEMORY_SIZE=1024*1024
FILE_UPLOAD_MAX_MEMORY_SIZE=1024*1024
DATA_UPLOAD_MAX_NUMBER_FIELDS=1000
