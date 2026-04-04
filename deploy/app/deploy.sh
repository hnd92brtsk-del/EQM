#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
DUMP_PATH="${1:-"$SCRIPT_DIR/../../backup/equipment_crm_deploy.sql"}"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from template. Review secrets before production use."
fi

set -a
source "$ENV_FILE"
set +a

HOST_PHOTO_DIR="${HOST_PHOTO_DIR:-$PHOTO_DIR}"
HOST_DATASHEET_DIR="${HOST_DATASHEET_DIR:-$DATASHEET_DIR}"
HOST_UPLOAD_DIR="${HOST_UPLOAD_DIR:-$UPLOAD_DIR}"
HOST_CABINET_FILES_DIR="${HOST_CABINET_FILES_DIR:-$CABINET_FILES_DIR}"
HOST_PID_STORAGE_ROOT="${HOST_PID_STORAGE_ROOT:-$PID_STORAGE_ROOT}"
HOST_POSTGRES_DATA_DIR="${HOST_POSTGRES_DATA_DIR:-$POSTGRES_DATA_DIR}"

ensure_writable_dir() {
  local target_dir="$1"
  mkdir -p "$target_dir"
  if ! touch "$target_dir/.eqm-write-test" 2>/dev/null; then
    echo "Host directory is not writable: $target_dir" >&2
    echo "Update HOST_* paths in $ENV_FILE to a writable location, for example /opt/eqm/data/..." >&2
    exit 1
  fi
  rm -f "$target_dir/.eqm-write-test"
}

sync_dir() {
  local source_dir="$1"
  local target_dir="$2"
  ensure_writable_dir "$target_dir"
  if [[ -d "$source_dir" ]]; then
    cp -a "$source_dir"/. "$target_dir"/
  fi
}

sync_dir "$BUNDLE_ROOT/../../Photo" "$HOST_PHOTO_DIR"
sync_dir "$BUNDLE_ROOT/../../Datasheets" "$HOST_DATASHEET_DIR"
sync_dir "$BUNDLE_ROOT/../../backend/uploads" "$HOST_UPLOAD_DIR"
sync_dir "$BUNDLE_ROOT/../../backend/storage/cabinet_files" "$HOST_CABINET_FILES_DIR"
sync_dir "$BUNDLE_ROOT/../../backend/app/pid_storage" "$HOST_PID_STORAGE_ROOT"
ensure_writable_dir "$HOST_POSTGRES_DATA_DIR"

"$SCRIPT_DIR/load-images.sh" "$SCRIPT_DIR/../runtime-images"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres
"$SCRIPT_DIR/restore-db.sh" "$DUMP_PATH"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend

echo
echo "EQM runtime stack is up."
echo "Configure host nginx with:"
echo "  sudo cp $SCRIPT_DIR/nginx.host.conf /etc/nginx/sites-available/eqm.conf"
echo "  sudo ln -sf /etc/nginx/sites-available/eqm.conf /etc/nginx/sites-enabled/eqm.conf"
echo "  sudo nginx -t && sudo systemctl reload nginx"
