#!/bin/bash
# ==============================================
# push.sh - Commit & Push perubahan ke GitHub
# ==============================================

set -e

APP_DIR="/var/www/abkciraya.cloud"

cd "$APP_DIR"

# Tampilkan status
echo "📋 Status perubahan:"
git status --short
echo ""

# Cek apakah ada perubahan
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Tidak ada perubahan untuk di-push."
    exit 0
fi

# Input pesan commit
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    read -p "📝 Pesan commit: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="update: $(date '+%Y-%m-%d %H:%M')"
    fi
fi

# Add, commit, push
echo "📦 Menambahkan perubahan..."
git add -A

echo "💾 Commit: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

echo "🚀 Push ke GitHub..."
git push origin main

echo ""
echo "✅ Push selesai!"
