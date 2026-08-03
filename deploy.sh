#!/bin/bash
# ==============================================
# deploy.sh - Deploy update aplikasi di VPS
# Jalankan: bash deploy.sh
# ==============================================

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/abkciraya.cloud}"
PM2_NAME="${PM2_NAME:-abkciraya-web}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/abkciraya-db}"
BACKUP_FILE=""

print_header() {
    echo "=========================================="
    echo "ABK Ciraya - Deploy Update"
    echo "=========================================="
}

print_step() {
    echo ""
    echo "[$1/$2] $3"
}

fail() {
    echo ""
    echo "Deploy gagal: $1" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Command '$1' tidak ditemukan"
}

read_env_value() {
    local key="$1"

    if [ ! -f .env ]; then
        return 0
    fi

    grep -E "^${key}=" .env | head -n 1 | cut -d '=' -f 2-
}

resolve_port() {
    if [ -n "$APP_PORT" ]; then
        return
    fi

    if [ -n "${PORT:-}" ]; then
        APP_PORT="$PORT"
        return
    fi

    local env_port
    env_port="$(read_env_value PORT || true)"
    if [ -n "$env_port" ]; then
        APP_PORT="$env_port"
        return
    fi

    APP_PORT="3011"
}

stop_pm2_app() {
    if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        pm2 stop "$PM2_NAME" >/dev/null
    fi
}

kill_port_if_busy() {
    if ss -ltn "( sport = :$APP_PORT )" | grep -q ":$APP_PORT"; then
        echo "Port $APP_PORT masih dipakai. Membersihkan proses lama..."
        if command -v fuser >/dev/null 2>&1; then
            fuser -k "${APP_PORT}/tcp" || true
        fi
        sleep 1
    fi
}

start_pm2_app() {
    if ! pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        fail "App PM2 '$PM2_NAME' tidak ditemukan. Jalankan start manual atau set PM2_NAME yang benar."
    fi

    pm2 restart "$PM2_NAME" --update-env
}

verify_port() {
    sleep 2
    if ! ss -ltn "( sport = :$APP_PORT )" | grep -q ":$APP_PORT"; then
        pm2 logs "$PM2_NAME" --lines 30 --nostream || true
        fail "App tidak listen di port $APP_PORT setelah restart"
    fi
}

backup_database() {
    local db_url
    db_url="$(read_env_value DATABASE_URL || true)"
    if [ -z "$db_url" ]; then
        db_url="${DATABASE_URL:-}"
    fi

    if [ -z "$db_url" ]; then
        fail "DATABASE_URL tidak ditemukan; backup wajib sebelum migrasi"
    fi

    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).sql"

    # Parse mysql://user:pass@host:port/dbname tanpa mencetak kredensial ke layar.
    local creds hostport userpass
    creds="${db_url#mysql://}"
    userpass="${creds%%@*}"
    hostport="${creds#*@}"

    local db_user db_pass db_host db_port db_name
    db_user="${userpass%%:*}"
    db_pass="${userpass#*:}"
    [ "$db_pass" = "$userpass" ] && db_pass=""
    db_name="${hostport#*/}"
    db_name="${db_name%%\?*}"
    hostport="${hostport%%/*}"
    db_host="${hostport%%:*}"
    db_port="${hostport#*:}"
    [ "$db_port" = "$hostport" ] && db_port="3306"

    echo "Membuat backup ke ${BACKUP_FILE} ..."
    if ! MYSQL_PWD="$db_pass" mysqldump \
        --host="$db_host" --port="$db_port" --user="$db_user" \
        --single-transaction --quick --routines --triggers --events \
        "$db_name" > "$BACKUP_FILE" 2>/tmp/mysqldump-err.log; then
        echo "--- mysqldump error ---" >&2
        tail -n 20 /tmp/mysqldump-err.log >&2 || true
        rm -f "$BACKUP_FILE"
        fail "Backup database gagal; migrasi dibatalkan"
    fi

    if [ ! -s "$BACKUP_FILE" ]; then
        rm -f "$BACKUP_FILE"
        fail "Backup database kosong; migrasi dibatalkan"
    fi

    gzip -f "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    echo "Backup selesai: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

    # Sisakan 10 backup terbaru saja agar disk VPS tidak penuh.
    ls -1t "${BACKUP_DIR}"/backup-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
}

verify_http() {
    local health_url="http://127.0.0.1:${APP_PORT}"
    local http_code

    http_code="$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || true)"
    case "$http_code" in
        200|301|302|307|308)
            ;;
        *)
            pm2 logs "$PM2_NAME" --lines 30 --nostream || true
            fail "Health check gagal untuk $health_url (HTTP $http_code)"
            ;;
    esac
}

print_header

require_command git
require_command npm
require_command npx
require_command pm2
require_command curl
require_command ss
require_command mysqldump
require_command gzip

cd "$APP_DIR"
resolve_port

print_step 1 8 "Pull dari GitHub..."
git pull origin "$BRANCH"

print_step 2 8 "Install dependencies..."
npm install --legacy-peer-deps

print_step 3 8 "Validasi environment..."
npm run env:check

print_step 4 8 "Build production..."
rm -rf .next
npm run build

print_step 5 8 "Backup database sebelum migrasi..."
backup_database

print_step 6 8 "Terapkan migrasi database terversi..."
if ! npm run db:migrate; then
    echo ""
    echo "Migrasi GAGAL. Database mungkin dalam kondisi setengah termigrasi."
    echo "Restore dengan:"
    echo "  gunzip -c ${BACKUP_FILE} | mysql -u <user> -p <nama_database>"
    fail "Migrasi database gagal"
fi

print_step 7 8 "Restart aplikasi..."
stop_pm2_app
kill_port_if_busy
start_pm2_app
pm2 save >/dev/null

print_step 8 8 "Verifikasi aplikasi..."
verify_port
verify_http

echo ""
echo "=========================================="
echo "Deploy selesai"
echo "=========================================="
echo "PM2 app : $PM2_NAME"
echo "Port    : $APP_PORT"
echo "Backup  : $BACKUP_FILE"
pm2 status "$PM2_NAME"
