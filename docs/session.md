# Session Notes

## 2026-08-03 - Integrasi Portal Mitra Outlet

### Keputusan

- Program publik lama dan program Mitra dikonvergensikan pada `/program`; program Mitra yang memiliki slug sama menjadi sumber utama dan membuka detail di `/mitra/program/[slug]`.
- Halaman `/mitra` menjadi direktori outlet publik, bukan halaman promosi portal. Pengunjung dapat mencari nama/kode/pemilik, memfilter Kabupaten/Kota dan TAP, serta membuka outlet melalui pemindaian QR.
- Pemindai QR menggunakan `jsqr` agar bekerja lintas browser dan tidak bergantung pada `BarcodeDetector`.
- Profil outlet publik tersedia di `/mitra/o/[publicToken]`. Informasi performa rinci hanya dapat dibuka setelah nomor WhatsApp terdaftar pada whitelist dan OTP berhasil diverifikasi.
- Data detail outlet mempertahankan tiga grup: Sellthru Digipos, Sellthru Nota, dan Recharge Digipos.
- Pengiriman OTP menggunakan konfigurasi WAHA dari Pengaturan Website atau fallback environment `WAHA_BASE_URL`, `WAHA_API_KEY`, dan `WAHA_SESSION`.
- Akses admin Mitra memakai role `MANAGER`, `ADMIN`, dan `LEADER`. Operasi sensitif seperti pengelolaan whitelist dan penghapusan dibatasi sesuai role dan dicatat pada audit log.

### Modul Admin

- `/admin/mitra`: ringkasan operasional, status database/WAHA, teritori, user, dan cleanup akses kedaluwarsa.
- `/admin/mitra/outlet`: CRUD outlet, profil publik, QR tunggal, dan kartu QR.
- `/admin/mitra/whitelist`: nomor WhatsApp yang diizinkan menerima OTP dengan scope global, outlet, atau teritori.
- `/admin/mitra/performance`: definisi metric dan data performa outlet.
- `/admin/mitra/program`: program, parameter penilaian, peserta, leaderboard, dan pemenang.
- `/admin/mitra/import`: preview, validasi, commit, riwayat batch, dan rollback import.
- `/admin/mitra/qr`: ekspor QR outlet terpilih atau seluruh outlet.
- `/admin/mitra/audit`: penelusuran dan ekspor jejak perubahan.

### Database dan API

- Schema menambah 19 tabel `mitra_*` untuk profil user, teritori, outlet, detail, metric, import, whitelist, OTP, session detail, program, leaderboard, pemenang, dan audit.
- Migrasi Portal Mitra berada di `drizzle/0000_brainy_slapstick.sql` dan bersifat aditif terhadap schema yang telah dilacak; tidak ada tabel lama yang dihapus pada diff schema lokal.
- API publik menyediakan daftar outlet, profil berdasarkan token, QR, permintaan/verifikasi OTP, detail terlindungi, dan program Mitra.
- API admin menyediakan pengelolaan outlet, whitelist, performa, program, import, QR, ringkasan, health check, dan audit.
- OTP memiliki masa berlaku, batas percobaan, pencatatan penggunaan whitelist, session detail berbasis hash, serta rate limit berdasarkan nomor dan IP.

### Artifak dan Verifikasi

- Komponen scanner: `src/components/mitra/qr-outlet-scanner.tsx`.
- Helper akses dan data: `src/lib/mitra-auth.ts`, `src/lib/mitra-data.ts`, `src/lib/mitra-fields.ts`, dan `src/lib/mitra-utils.ts`.
- Dependensi QR/PDF: `jsqr`, `qrcode`, `pdf-lib`, dan `@types/qrcode`.
- TypeScript, ESLint terarah, `drizzle-kit check`, dan production build lulus.
- Halaman `/mitra` dan route publik dapat dirender, tetapi pengujian OTP, detail terlindungi, import, dan CRUD database penuh menunggu MySQL lokal aktif.

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
- Perubahan aplikasi utama dipush ke `origin/main` pada commit `7622a8b` (`feat(portal): add mitra and indihome experiences`).

## 2026-08-03 - Audit efisiensi dan infrastruktur tidak beraturan

Audit dilakukan mengikuti skill di `.agents/skills/` dan konteks di sesi sebelumnya pada catatan
ini. Detail lengkap ada di `docs/audit-2026-08-03.md`. Ringkasan:

### Temuan kritis

- `npm run build` gagal kompilasi di `main` sebelum sesi ini: `src/app/(hidden)/admin/belanja/voucher/page.tsx` memakai hook React tanpa direktif `"use client"`, ditambah pelanggaran `@typescript-eslint/no-explicit-any` pada `XLSX.utils.sheet_to_json`. Bug ini sudah ada di `HEAD` sebelum sesi audit dimulai, bukan hasil perubahan sesi ini.
- Diperbaiki: direktif `"use client"` ditambahkan, generic `any` diganti `unknown[]`. `npm run build` lulus penuh (74 route) setelah perbaikan.

### Perbaikan efisiensi

- `GET /api/admin/submissions` sebelumnya menarik seluruh tabel `form_submissions` beserta semua relasi lalu memfilter `status`/`programId` di memori. Filter tersebut sekarang didorong ke SQL (query relasional Drizzle + sub-query `dynamicForms` untuk `programId`); filter teks bebas (`search`) tetap di memori karena lintas field dinamis.

### Infrastruktur dirapikan

- `docker-compose.yml` memetakan port `3000:3000` padahal `Dockerfile`/`.env.example` memakai `PORT=3011` — jalur Docker praktis tidak bisa diakses jika dipakai. Diselaraskan ke `3011:3011`.
- Folder `prisma/` (sisa sebelum migrasi penuh ke Drizzle, sudah tidak dipakai sama sekali — `@prisma/client` bukan dependency dan tidak ada importnya) dihapus atas konfirmasi pengguna.

### Ditunda, butuh keputusan lanjutan

- Skrip debug root (`test-db.ts`, `test-query.ts`, `test-query2.ts`, `tmp_dump.ts`) — tidak dipakai kode apa pun tapi ikut ter-typecheck karena `tsconfig.json` meng-include `**/*.ts`. Pengguna memilih tidak menghapus di sesi ini.
- Stub fitur outlet lama (`src/app/(hidden)/admin/outlet/page.tsx`, `src/app/api/admin/outlets/`) — sudah digantikan Portal Mitra Outlet, isinya cuma placeholder "feature removed" tapi tetap ter-build jadi route aktif. Pengguna memilih tidak menghapus di sesi ini.
- Dua jalur deployment (PM2 via `deploy.sh` vs Docker Compose) berjalan paralel tanpa dokumentasi mana yang jadi sumber kebenaran.
- Tidak ada index pada `form_submissions.form_id`/`.status` walau kedua kolom itu jadi filter utama; perlu migrasi Drizzle baru yang diuji terhadap database nyata (MySQL lokal tidak aktif saat audit).

### Artifak sesi ini

- Ikut dipush pekerjaan yang sebelumnya belum di-commit: pengelompokan sidebar admin per kategori (`src/app/(hidden)/admin/layout.tsx`), tipe import CSV "Outlet Baru" beserta endpoint template unduhan (`src/app/api/admin/mitra/imports/route.ts`, `.../imports/template/route.ts`, `src/app/(hidden)/admin/mitra/import/page.tsx`), dan penyembunyian sementara link navbar "BELANJA" (`src/components/navbar.tsx`).
- `npx tsc --noEmit`, lint terarah, dan `npm run build`: lulus.
- Perubahan dipush ke `origin/main` pada commit `ea7974f` (`fix: repair broken production build and audit app for inefficiencies`).
