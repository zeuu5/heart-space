#!/usr/bin/env bash
set -o errexit

pip install -r server/requirements.txt
python server/manage.py collectstatic --noinput
