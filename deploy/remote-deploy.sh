#!/usr/bin/env bash
# Idempotent remote deploy for Forge. Safe beside other /opt/* stacks.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/forge-dashboard}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-forge-dashboard}"
HOST_PORT="${HOST_PORT:-3200}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example (fill API keys later if needed)."
  else
    touch .env
  fi
fi

# Build + recreate only this project's containers.
docker compose -p "$COMPOSE_PROJECT" build --pull
docker compose -p "$COMPOSE_PROJECT" up -d --remove-orphans

echo "Waiting for health on :${HOST_PORT} ..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/" >/dev/null 2>&1; then
    echo "Forge is up: http://$(hostname -I | awk '{print $1}'):${HOST_PORT}/"
    docker compose -p "$COMPOSE_PROJECT" ps
    exit 0
  fi
  sleep 2
done

echo "Deploy finished but health check did not pass yet." >&2
docker compose -p "$COMPOSE_PROJECT" ps
docker compose -p "$COMPOSE_PROJECT" logs --tail=80 forge || true
exit 1
