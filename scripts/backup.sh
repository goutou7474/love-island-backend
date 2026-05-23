#!/usr/bin/env sh
set -eu

compose_cmd="${COMPOSE_CMD:-docker compose}"
backup_root="${BACKUP_DIR:-backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$backup_root/$timestamp"

mkdir -p "$backup_dir"

echo "Writing PostgreSQL dump..."
$compose_cmd exec -T postgres pg_dump -U love_island love_island > "$backup_dir/postgres.sql"

api_container="$($compose_cmd ps -q api)"
if [ -z "$api_container" ]; then
  echo "API container is not running; cannot copy uploaded media." >&2
  exit 1
fi

echo "Copying uploaded media..."
mkdir -p "$backup_dir/uploads"
docker cp "$api_container:/app/data/uploads/." "$backup_dir/uploads" 2>/dev/null || true
tar -czf "$backup_dir/uploads.tar.gz" -C "$backup_dir/uploads" .
rm -rf "$backup_dir/uploads"

cat > "$backup_dir/README.txt" <<EOF
Love Island backup created at $timestamp

Contents:
- postgres.sql: PostgreSQL logical dump
- uploads.tar.gz: uploaded media files from /app/data/uploads

Restore with:
CONFIRM_RESTORE=yes scripts/restore.sh $backup_dir
EOF

echo "Backup written to $backup_dir"
