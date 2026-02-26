#!/bin/bash
# ==============================================
# deploy.sh - Deploy update aplikasi di VPS
# Jalankan: bash deploy.sh
# ==============================================

set -e

APP_DIR="/var/www/abkciraya.cloud"
PM2_NAME="abkciraya-web"
BRANCH="main"

echo "=========================================="
echo "🚀 ABK Ciraya - Deploy Update"
echo "=========================================="
cd "$APP_DIR"

# 1. Pull perubahan terbaru dari GitHub
echo ""
echo "[1/5] 📥 Pull dari GitHub..."
git pull origin "$BRANCH"

# 2. Install / update dependencies
echo ""
echo "[2/5] 📦 Install dependencies..."
npm install

# 3. Sinkronisasi schema database
echo ""
echo "[3/5] 🗄️  Sinkronisasi database schema..."
npx drizzle-kit push

# 4. Build production
echo ""
echo "[4/5] 🔨 Build production..."
rm -rf .next
npm run build

# 5. Restart PM2
echo ""
echo "[5/5] ♻️  Restart aplikasi..."
pm2 restart "$PM2_NAME" --update-env
pm2 save

echo ""
echo "=========================================="
echo "✅ Deploy selesai!"
echo "=========================================="
pm2 status "$PM2_NAME"
