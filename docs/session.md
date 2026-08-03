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

## 2026-08-04 - Eksekusi PRD Perombakan Total (Fase 0-4)

Eksekusi `prd-total-revamp.md`. Seluruh commit masih **lokal, belum di-push** atas permintaan.

### Fase 0 - Fondasi RBAC & Kelola User (`7a82891`)

- Sebelumnya **tidak ada kolom role sama sekali** di tabel `user` inti: setiap akun yang berhasil
  login otomatis punya akses penuh ke seluruh modul. Satu-satunya role yang ada
  (`mitra_user_profiles`) hanya berlaku di sebagian endpoint Portal Mitra.
- Tabel baru `admin_user_profiles`, `admin_user_territories`, `admin_audit_logs`
  (migrasi `0003`, aditif; tabel Mitra lama dibiarkan untuk sementara).
- `src/lib/admin-auth.ts` (`requireRole`, `getAdminSession`, `getUserTerritoryIds`,
  `writeAdminAuditLog`) menggantikan `src/lib/mitra-auth.ts` yang dihapus.
- `requireRole()` diterapkan ke **44 route API admin** - 15 yang sebelumnya sudah punya
  pengecekan role Mitra, plus **29 yang sebelumnya tidak punya pengecekan sama sekali**
  (cuan, forms, hero-slides, lottery, orders, products, programs, settings, submissions,
  upload, vouchers).
- Halaman Kelola User (`/admin/users`) khusus Admin Super, plus `/api/admin/me` untuk sidebar
  yang sadar role.
- Backfill memetakan role lama ke baru (`MANAGER` ke `SUPER_ADMIN`, `ADMIN` ke `ADMIN_INPUT`,
  `LEADER` ke `SUPERVISOR`); user tanpa profil Mitra default `SUPER_ADMIN` agar tidak ada yang
  mendadak kehilangan akses yang selama ini dimiliki.

### Fase 1 - Modernisasi Desain Publik (`99c06b1`)

- Menghapus `wave-divider` (SVG gelombang antar section) dan animasi mengambang
  (`animate-float`/`animate-float-delayed`) dari seluruh halaman publik; jarak antar section
  kini murni whitespace. Referensi arah: telkomsel.com.
- Tombol CTA publik dilepas dari bentuk pill penuh ke radius sedang. `btn-pill` **tetap ada**
  di `globals.css` karena masih dipakai badge/tag kecil, peran UI yang berbeda.
- `globals.css` dibersihkan dari CSS yang benar-benar tidak terpakai (`wave-divider`,
  keyframes float, `gradient-text`, `hover-lift`).
- Diverifikasi visual lewat dev server dan screenshot headless Chrome (desktop dan mobile) di
  `/`, `/program`, `/lokasi-kontak`, `/cuan`.
- **KOREKSI (2026-08-04):** catatan sebelumnya di sini menyebut ada horizontal overflow di
  tampilan mobile Beranda. **Itu keliru.** Kesimpulan itu ditarik dari screenshot headless
  Chrome, dan ternyata merupakan artefak pengukuran: `--window-size` menentukan lebar tangkapan
  gambar, bukan lebar layout viewport, sehingga halaman dirender lebih lebar lalu dipotong.
  Pengukuran ulang lewat Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` +
  `Runtime.evaluate`) menunjukkan Beranda **nol overflow** pada 320/360/390/414 px:
  `scrollWidth` sama persis dengan `clientWidth` dan tidak ada satu pun elemen yang melewati
  viewport. Pelajaran: screenshot headless tidak sahih untuk menilai overflow; ukur lewat CDP.

### Fase 2 - Refocus Mitra Outlet + Whitelist/WAHA ke Pengaturan (`0fa9fa3`)

- Halaman `/admin/mitra/whitelist` dihapus; UI-nya pindah jadi kartu di halaman Pengaturan,
  tepat di bawah section WAHA.
- Ditambahkan kemampuan yang diwajibkan PRD tapi **backend-nya belum pernah ada**: whitelist
  bulk-add dan delete; hapus outlet satuan dan massal (outlet sebelumnya hanya bisa dibuat
  dan diedit, tidak bisa dihapus). Semua tercatat di audit log.
- Konfirmasi hapus outlet menyebut eksplisit bahwa data detail/performa/keikutsertaan program
  ikut terhapus - diverifikasi dulu ke schema bahwa ke-10 FK yang menunjuk `mitra_outlets`
  memang `ON DELETE CASCADE`.
- Dashboard `/admin/mitra` dipangkas jadi Database Outlet, Upload Data, Performance, QR Bulk,
  Audit. Menu Program Mitra pindah ke grup sidebar Event & Form.
- GET whitelist dilebarkan ke `MANAGER` agar sesuai matriks akses PRD (Pengaturan = View-all
  untuk Manager); operasi tulis tetap Admin Super, dan kartunya menyembunyikan form serta
  tombol aksi untuk non-Super-Admin, bukan menampilkan tombol yang pasti gagal.

**Dua bug ditemukan dan diperbaiki sambil jalan:**

- Sidebar memakai `startsWith`, sehingga membuka `/admin/mitra/program` meng-highlight dua
  menu sekaligus. Sekarang memilih href terpanjang yang cocok.
- `sendWhatsAppNotification` memfilter `site_settings` dengan `type = "text"`, padahal tipe
  baris ditentukan dari nama key-nya. Field WAHA yang namanya mengandung "url" akan tersimpan
  sebagai "image" dan **hilang diam-diam** dari konfigurasi. Sekarang membaca semua baris.

### Fase 3a - Skema Program Terpadu + Backfill (`f3e4897`) - SQL BELUM DIUJI

- `programs` mendapat kolom `mode` (`UNDIAN`/`PERFORMANCE`) plus kolom khusus performance
  (`mechanism_md`, `period_start`, `period_end`, `ranking_mode`, `tie_breaker`, `is_public`),
  semuanya nullable. Tabel `program_winners` menyatukan `winners` dan `mitra_program_winners`.
- Dipilih kolom bertipe kuat, bukan satu kolom JSON `config` (PRD membolehkan keduanya),
  supaya `period_start`/`period_end` tetap bisa difilter dan diindeks di SQL.
- **Bahaya tabrakan slug ditangani eksplisit.** `programs.slug` UNIQUE, sementara baris undian
  lama dengan `category='mitra'` memang sengaja membayangi program Mitra ber-slug sama
  (halaman `/program` sudah menyaringnya; catatan sesi sebelumnya menyebut baris Mitra sebagai
  sumber kebenaran). Tanpa penanganan, migrasi akan gagal duplicate-key di data production.
  Backfill memberi slug kanonik ke baris Mitra dan me-rename baris legacy jadi
  `-undian-legacy` lalu mengarsipkannya; tidak ada baris yang dihapus.
- `id` dari `mitra_programs` dipertahankan agar `mitra_program_params`/`participants`/
  `scores`/`leaderboard` tetap menunjuk id valid.
- `scripts/verify-program-migration.mjs` memeriksa jumlah baris dan integritas, keluar
  non-nol bila gagal sehingga bisa jadi gerbang sebelum cutover.
- **Fase 3b (cutover kode sekitar 30 file) sengaja belum dikerjakan.** Mesin ini tidak punya
  MySQL server, Docker, maupun MariaDB; hanya klien (MySQL Workbench, HeidiSQL). Migrasi tidak
  bisa diuji sama sekali, padahal PRD mensyaratkan uji di staging/lokal dulu dan acceptance
  criteria menuntut verifikasi jumlah baris. Mengalihkan kode ke tabel yang backfill-nya
  belum terbukti berarti aplikasi rusak dengan data salah petakan.

### Fase 4 - IndiHome Lokasi dan Banner Dinamis (`d82307f`)

- Tabel `indihome_locations` dan `indihome_banners` (migrasi `0005`, aditif) sekaligus disemai
  dari konstanta lama, menutup risiko "data lokasi/banner kosong pasca migrasi" di PRD.
- **Bagian sulitnya bukan dropdown melainkan validasi server.** `isIndihomeLocation()` adalah
  gerbang di endpoint pengajuan publik; membuat lokasi dinamis tanpa mengubahnya berarti
  setiap pengajuan dari lokasi baru **ditolak diam-diam**. Tiga tempat dialihkan ke daftar
  hidup: POST lead publik, `parseIndihomeProductInput()` (sebelumnya diam-diam membuang lokasi
  tak dikenal dari cakupan paket), dan filter lead admin.
- `src/lib/indihome-data.ts` memusatkan pembacaan dengan fallback ke konstanta bila DB mati.
- Menghapus lokasi yang masih dipakai paket **diblokir** dengan pesan menyebut paket mana.
  Cakupan paket disimpan sebagai array JSON nama lokasi, jadi penghapusan akan menyisakan
  referensi yatim tanpa peringatan.
- Tab admin baru "Lokasi & Banner"; `/indihome` jadi server component dinamis.
- Diverifikasi dengan **DB sengaja dimatikan**: `/indihome` tetap 200 dan render fallback
  lengkap, katalog melaporkan `source:"fallback"`, lokasi ngawur ditolak sementara lokasi
  valid lolos gerbang, endpoint admin baru 401.

### Status dan Yang Terblokir

| Fase | Status |
|---|---|
| 0 RBAC dan Kelola User | Selesai |
| 1 Desain publik | Selesai, terverifikasi visual |
| 2 Mitra Outlet dan Whitelist | Selesai |
| 3a Skema program terpadu | Selesai, **SQL belum diuji** |
| 3b Cutover kode program | **Terblokir**, menunggu verifikasi 3a |
| 4 IndiHome | Selesai |
| 5 QA per role | **Terblokir**, butuh DB untuk akun per role |

**Prasyarat melanjutkan (butuh MySQL hidup):**

1. Restore backup production ke database uji, jalankan `npm run db:migrate`.
   Migrasi `0003`, `0004`, dan `0005` belum pernah dijalankan ke database mana pun.
2. `node scripts/verify-program-migration.mjs` harus lulus seluruhnya sebelum Fase 3b.
3. Jalankan checklist `docs/qa-role-matrix.md` untuk Fase 5.

**Peringatan deploy:** `requireRole()` bergantung pada tabel `admin_user_profiles`. Bila kode
ini dideploy tanpa menjalankan migrasi `0003` lebih dulu, seluruh panel admin akan menampilkan
"Layanan sedang gangguan" (ditangani rapi, bukan crash, tapi juga tidak berfungsi).

### Verifikasi Sesi Ini

- `npx tsc --noEmit`, `npx next lint`, `npm run build`, dan `npx drizzle-kit check`: lulus di
  setiap fase.
- Smoke test route lewat dev server di tiap fase.
- Screenshot headless Chrome untuk perubahan visual publik.
- Yang **tidak** terverifikasi: seluruh SQL migrasi (`0003`, `0004`, `0005`) beserta
  backfill-nya, karena tidak ada database yang bisa dijalankan di mesin ini.
