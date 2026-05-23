#!/usr/bin/env sh
set -eu

compose_cmd="${COMPOSE_CMD:-docker compose}"

if [ ! -f ".env" ]; then
  echo "Missing .env. Copy .env.example to .env and fill private account values first." >&2
  exit 1
fi

$compose_cmd up -d --build
$compose_cmd exec -T api node dist/scripts/bootstrap-private-couple.js
$compose_cmd ps

echo "Deployment complete. API health: curl http://127.0.0.1:\${API_PORT:-3000}/health"
