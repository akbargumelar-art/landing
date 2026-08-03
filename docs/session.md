# Session Notes

## 2026-08-03 - Landing page dan admin IndiHome

### Keputusan

- Landing page publik tersedia di `/indihome` dan ditautkan dari navbar serta footer.
- Alur publik bersifat location-first untuk Kota Cirebon, Kabupaten Cirebon, dan Kabupaten Kuningan.
- Harga ditulis sebagai harga mulai dari; cakupan jaringan dan harga akhir harus dikonfirmasi setelah pengecekan alamat.
- Produk aktif dibaca dari tabel `indihome_products`. Data statis di `src/lib/indihome-products.ts` hanya menjadi fallback selama database atau migrasi belum siap.
- Form pengajuan menyimpan nama, WhatsApp, email opsional, lokasi, kecamatan, alamat, paket, persetujuan, sumber, IP, user agent, dan status tindak lanjut ke `indihome_leads`.
- Endpoint publik memakai validasi server, honeypot, normalisasi nomor Indonesia, dan rate limit berdasarkan IP serta nomor WhatsApp.
- Menu `/admin/indihome` ditambahkan ke sidebar portal admin. Modul ini memiliki tab Produk & Lokasi serta Form Langganan.
- Produk dapat ditambah, diedit, dinonaktifkan, diurutkan, diberi cakupan lokasi, dan dihapus. Pengajuan dapat dicari, difilter, dilihat detailnya, dihubungi melalui WhatsApp, dan diubah statusnya.
- API admin IndiHome dibatasi untuk sesi portal dengan role Manager/Admin; penghapusan produk hanya untuk Manager.

### Artifak

- Hero image: `public/indihome/hero-family.png`.
- Migrasi lead: `drizzle/0001_outgoing_matthew_murdock.sql`.
- Migrasi katalog dan empat paket awal: `drizzle/0002_quick_ultragirl.sql`.
- Halaman publik: `src/app/(public)/indihome/page.tsx`.
- Halaman admin: `src/app/(hidden)/admin/indihome/page.tsx`.

### Verifikasi

- `npx tsc --noEmit`: lulus.
- ESLint terarah untuk seluruh file IndiHome, schema, dan admin layout: lulus.
- `npm run build`: lulus; route `/indihome`, `/admin/indihome`, dan API terkait masuk output build. Next.js masih melaporkan warning cache ESLint `EPERM` setelah build selesai.
- Smoke test `http://localhost:3001/indihome`: HTTP 200.
- Screenshot Chrome headless desktop, mobile, dan full-page diperiksa: navbar responsif, hero, kartu paket, form, serta footer tampil tanpa overlap atau overflow.
- Endpoint katalog publik: HTTP 200 dan mengembalikan empat produk fallback karena MySQL lokal tidak aktif.
- Validasi form kosong/tidak valid: HTTP 400 dengan pesan validasi nama.
- Akses `/admin/indihome` tanpa sesi: HTTP 307 ke `/portal-admin`.
- Penyimpanan pengajuan valid dan CRUD admin belum dapat diuji terhadap database karena MySQL lokal tidak berjalan. Terapkan migrasi `0001` dan `0002` sebelum pengujian data penuh.

### Deployment

- `deploy.sh` menjalankan build sebelum perubahan database dan memakai `npm run db:migrate`, bukan `drizzle-kit push` langsung.
- Backup database produksi tetap wajib dilakukan sebelum menjalankan deploy.
- Jangan menjalankan `npm run db:seed` pada database produksi karena seed aplikasi memuat data contoh dan membangun ulang hero slide.
