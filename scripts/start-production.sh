#!/bin/sh
# Titik masuk kontainer produksi: migrasi dulu, baru aplikasi dijalankan.
#
# Sengaja GAGAL CEPAT bila migrasi gagal. Menjalankan aplikasi di atas schema lama
# menghasilkan galat 500 yang senyap di halaman-halaman yang menyentuh kolom baru;
# kontainer yang berhenti dengan status galat jauh lebih mudah terlihat daripada itu.
set -e

echo "[start] Menjalankan migrasi database..."
npx drizzle-kit migrate
echo "[start] Migrasi selesai."

echo "[start] Menjalankan aplikasi..."
exec npm start
