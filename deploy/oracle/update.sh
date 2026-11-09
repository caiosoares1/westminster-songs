#!/usr/bin/env bash
# Updates the API to the latest code on GitHub:  sudo /opt/westminster-songs/deploy/oracle/update.sh
set -euo pipefail

APP_DIR="/opt/westminster-songs"
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo" >&2; exit 1; }

git -C "$APP_DIR" pull --ff-only
cd "$APP_DIR/deploy/oracle"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
