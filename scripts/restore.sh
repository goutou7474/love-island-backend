#!/usr/bin/env sh
set -eu

compose_cmd="${COMPOSE_CMD:-docker compose}"
backup_dir="${1:-}"

if [ -z "$backup_dir" ]; then
  echo "Usage: CONFIRM_RESTORE=yes scripts/restore.sh backups/<timestamp>" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Restore changes the running database/media volume. Set CONFIRM_RESTORE=yes to continue." >&2
  exit 1
fi

if [ ! -f "$backup_dir/postgres.sql" ] || [ ! -f "$backup_dir/uploads.tar.gz" ]; then
  echo "Backup directory must contain postgres.sql and uploads.tar.gz." >&2
  exit 1
fi

echo "Restoring PostgreSQL dump into the running database..."
$compose_cmd exec -T postgres psql -U love_island -d love_island < "$backup_dir/postgres.sql"

api_container="$($compose_cmd ps -q api)"
if [ -z "$api_container" ]; then
  echo "API container is not running; cannot restore uploaded media." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
tar -xzf "$backup_dir/uploads.tar.gz" -C "$tmp_dir"
docker cp "$tmp_dir/." "$api_container:/app/data/uploads/"

echo "Restore complete."
