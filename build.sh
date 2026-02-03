#!/usr/bin/env bash
set -o errexit

cd server
pip install -r requirements.txt
python manage.py collectstatic --noinput
