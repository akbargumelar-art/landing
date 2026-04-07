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

load_env_file() {
    if [ -f .env ]; then
        set -a
        # shellcheck disable=SC1091
        . ./.env
        set +a
    fi
}

resolve_port() {
    if [ -n "$APP_PORT" ]; then
        return
    fi

    if [ -n "${PORT:-}" ]; then
        APP_PORT="$PORT"
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

cd "$APP_DIR"
load_env_file
resolve_port

print_step 1 7 "Pull dari GitHub..."
git pull origin "$BRANCH"

print_step 2 7 "Install dependencies..."
npm install --legacy-peer-deps

print_step 3 7 "Validasi environment..."
npm run env:check

print_step 4 7 "Sinkronisasi database schema..."
npx drizzle-kit push

print_step 5 7 "Build production..."
rm -rf .next
npm run build

print_step 6 7 "Restart aplikasi..."
stop_pm2_app
kill_port_if_busy
start_pm2_app
pm2 save >/dev/null

print_step 7 7 "Verifikasi aplikasi..."
verify_port
verify_http

echo ""
echo "=========================================="
echo "Deploy selesai"
echo "=========================================="
echo "PM2 app : $PM2_NAME"
echo "Port    : $APP_PORT"
pm2 status "$PM2_NAME"
