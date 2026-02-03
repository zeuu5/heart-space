#!/usr/bin/env bash
set -o errexit

if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
  python manage.py collectstatic --noinput
else
  cd server
  pip install -r requirements.txt
  python manage.py collectstatic --noinput
fi
