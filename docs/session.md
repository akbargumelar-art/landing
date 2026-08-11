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

## 2026-08-04 - Pembersihan Keamanan, Kesiapan Deploy, dan Push ke GitHub

Lanjutan dari entri di atas. Seluruh pekerjaan Fase 0-4 beserta perbaikan di bawah sudah
**di-push ke `origin/main`**; `main` sinkron dengan remote pada `e51f487`.

### Dua endpoint debug tanpa autentikasi (`70bdc64`)

Ditemukan saat audit kelengkapan backend sebelum push. Keduanya berada di luar `/api/admin`,
sehingga matcher middleware (`/admin`, `/api/admin`, `/portal-admin`) tidak pernah mencakupnya,
dan keduanya juga tidak punya pengecekan sendiri. Dibuktikan bisa diakses **tanpa cookie apa
pun** lewat dev server:

- `GET /api/debug` - membuang 5 submission terbaru beserta seluruh nilai field: nama peserta,
  nomor HP, dan apa pun yang dikumpulkan form. Di mesin ini hanya membalas 500 karena MySQL
  mati; terhadap database hidup ia menjawab 200 berisi data tersebut kepada siapa pun yang
  tahu alamatnya.
- `GET /api/test-waha` - membalas **200** dan mengirim WhatsApp lewat gateway perusahaan ke
  nomor apa pun dari query string, dengan satu nomor pribadi ter-hardcode sebagai default.
  Praktisnya open relay: pesan keluar gratis, ditagihkan ke dan dikirim atas nama nomor
  perusahaan.

Keduanya sisa development tanpa kegunaan produksi, jadi **dihapus**, bukan sekadar dipagari.
Ikut dihapus `/api/public/outlets`, stub mati yang mengembalikan `[]` untuk fitur outlet lama
yang sisi adminnya sudah dibuang lebih dulu.

Tombstone `/api/auth/{me,login,logout}` **dipertahankan**: ketiganya sengaja mengembalikan 410
sambil menunjuk pengganti better-auth.

### Perapian repo

- `/tmp/` di-gitignore (isinya hanya log build/lint/dev lokal).
- `.agents/skills/` dan `integrasi-landing-page.md` mulai dilacak. Keduanya diperiksa terhadap
  kredensial sebelum di-stage: hanya ada penyebutan katanya dalam prosa, tidak ada nilai
  rahasia. Dipastikan pula tidak ada `.env`, `.pem`, atau `.key` yang ikut terdorong.
- Audit route: tidak ada endpoint yang dipanggil frontend tetapi tidak ada implementasinya,
  dan tidak ada TODO/FIXME tersisa di `src`.

### Kesiapan deploy (`e51f487`)

**Backup otomatis sebelum migrasi.** Ini celah paling berbahaya sebelumnya: `deploy.sh`
menerapkan migrasi secara otomatis di tengah alur deploy, tetapi **tidak melakukan backup sama
sekali**. Artinya menjalankan `bash deploy.sh` akan mengeksekusi backfill Fase 3a yang belum
teruji ke data production tanpa pengawasan dan tanpa titik pemulihan. Sekarang:

- `mysqldump` dijalankan sebelum `db:migrate`; deploy dibatalkan bila dump gagal atau kosong,
  jadi migrasi tidak pernah berjalan tanpa titik pemulihan.
- Bila migrasi gagal, perintah restore (`gunzip -c ... | mysql ...`) untuk backup yang baru
  dibuat langsung dicetak.
- Backup di-gzip ke `/var/backups/abkciraya-db` (bisa diganti lewat `BACKUP_DIR`) dan disisakan
  10 terbaru agar disk VPS tidak penuh.
- Password dikirim lewat `MYSQL_PWD`, bukan argumen CLI, supaya tidak muncul di daftar proses;
  URL diurai tanpa dicetak ke layar.
- Parser `DATABASE_URL` diuji untuk bentuk `user:pass@host:port/db` dan bentuk tanpa password
  `root:@localhost:3306/db`, plus `bash -n`.
- `mysqldump` dan `gzip` ditambahkan ke preflight `require_command`.
- Penomoran langkah deploy menjadi 8 langkah.

### KOREKSI: overflow mobile Beranda tidak pernah ada

Entri Fase 1 di atas sempat mencatat adanya horizontal overflow di tampilan mobile Beranda.
**Itu keliru dan sudah dikoreksi di tempatnya.** Kesimpulan lama ditarik dari screenshot
headless Chrome; ternyata artefak pengukuran, karena `--window-size` menentukan lebar
tangkapan gambar dan bukan lebar layout viewport, sehingga halaman dirender lebih lebar lalu
dipotong.

Pengukuran ulang memakai Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` +
`Runtime.evaluate`, membandingkan `scrollWidth` dengan `clientWidth` dan mendaftar elemen yang
melewati viewport) menunjukkan Beranda **nol overflow** pada 320/360/390/414 px.

Yang benar-benar overflow justru `/program`: 6 px pada 390 px, karena tiga tombol filter
kategori berada dalam flex row tanpa wrap. Diperbaiki dengan `flex-wrap`, lalu diukur ulang -
`scrollWidth` sama dengan `clientWidth` di 320/360/390 px. Halaman `/indihome`, `/lokasi-kontak`,
dan `/cuan` diukur bersih.

**Pelajaran metode: screenshot headless tidak sahih untuk menilai overflow horizontal; ukur
lewat CDP.**

### Performa dan konfigurasi

- Index ditambahkan pada `form_submissions.form_id`, `.status`, dan `.submitted_at`
  (migrasi `0006`). Audit sebelumnya sudah mendorong filter tersebut ke SQL tetapi tidak
  pernah menambahkan index-nya, sehingga MySQL tetap melakukan full scan.
- `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAIL` dan `NEXT_PUBLIC_BASE_URL` didokumentasikan di
  `.env.example`. Keduanya dibaca kode tetapi belum tercatat; keduanya punya fallback sehingga
  tidak wajib diisi.

### Yang WAJIB dilakukan saat deploy

1. **Uji migrasi ke salinan backup lebih dulu.** Empat migrasi (`0003`, `0004`, `0005`, `0006`)
   belum pernah dijalankan ke database mana pun. Backup otomatis kini melindungi bila gagal,
   tetapi lebih baik ketahuan di database uji daripada saat deploy.
2. **Setelah migrasi, atur role di `/admin/users`.** Backfill `0003` memberi `SUPER_ADMIN`
   kepada setiap user yang belum punya profil Mitra - disengaja agar tidak ada yang mendadak
   terkunci. Konsekuensinya, **sampai role diturunkan satu per satu, semua orang masih Admin
   Super dan seluruh RBAC belum berefek.** Langkah ini manual karena hanya pemilik aplikasi
   yang tahu siapa seharusnya berperan apa.
3. Jalankan `node scripts/verify-program-migration.mjs` sebelum mempertimbangkan Fase 3b.
4. Jalankan `docs/qa-role-matrix.md` untuk QA Fase 5.

### Status akhir sesi

| Fase | Status |
|---|---|
| 0 RBAC dan Kelola User | Selesai, sudah dipush |
| 1 Desain publik | Selesai, terverifikasi via CDP |
| 2 Mitra Outlet dan Whitelist | Selesai, sudah dipush |
| 3a Skema program terpadu | Selesai, **SQL belum diuji** |
| 3b Cutover kode program | **Ditunda**, skema terpadu menganggur sehingga menundanya tidak merusak apa pun |
| 4 IndiHome | Selesai, sudah dipush |
| 5 QA per role | Dokumentasi selesai, **QA terblokir** butuh DB |

Yang tetap **tidak** terverifikasi di sesi ini: seluruh SQL migrasi (`0003`-`0006`) beserta
backfill-nya, karena mesin ini tidak punya MySQL server, Docker, maupun MariaDB - hanya klien
(MySQL Workbench, HeidiSQL).

## 2026-08-04 - Master Outlet: pilihan tetap dan tautan lokasi otomatis

Permintaan: mengubah database outlet agar sesuai daftar field tertentu, beserta tiga grup
data detail ber-OTP. Dikerjakan dengan skill `context-map` dari `.agents` - memetakan dulu
sebelum mengubah, dan pemetaan itu langsung mengubah gambaran pekerjaannya.

### Temuan pemetaan: sebagian besar sudah ada

- Ke-17 field master yang diminta **sudah ada seluruhnya** di `mitra_outlets`.
- Field detail ber-OTP **sudah persis cocok**. Label digenerate ulang dari kode lalu dihitung:
  Sellthru Digipos 48, Sellthru Nota 48, Recharge Digipos 45 - penamaan dan urutan sama,
  termasuk SO / SellOut yang memang hanya punya qty tanpa rev. Tidak ada perubahan di sana.
- Yang benar-benar kurang hanya dua: empat field masih teks bebas, dan tautan lokasi diketik
  manual.

### Perubahan

- `src/lib/mitra-outlet-options.ts` (baru) memuat daftar nilai sah untuk Kategori Outlet,
  Hari PJP, Tipe PJP, dan Branding, plus helper URL Maps. Schema, validasi API, form admin,
  dan importer membaca dari satu sumber ini supaya tidak saling menyimpang.
- Keempat kolom menjadi enum MySQL (migrasi `0007`).
- `location_url` diturunkan dari `latitude`/`longitude`, tidak lagi diketik. Kolomnya tetap
  ada supaya tautan manual pada baris tanpa koordinat tidak hilang; `resolveOutletMapsUrl`
  memberi prioritas ke koordinat. Form admin mengganti input teks dengan pratinjau tautan
  yang mengikuti koordinat yang sedang diketik.

### Bagian paling berisiko dari migrasi 0007

Data **dinormalisasi sebelum** `ALTER`, bukan sesudah. Alasannya konkret: `branding` selama
ini berdefault string kosong, dan `''` **bukan** anggota enum baru. Bila tipe diubah lebih
dulu, MySQL strict mode menolak baris-baris itu, dan pada mode longgar diam-diam
mengosongkannya. Nilai tak dikenal dipetakan ke anggota yang masuk akal, bukan dibuang,
sehingga tidak ada baris yang hilang. Koordinat yang sudah ada di-backfill ke `location_url`.

Migrasi ini yang paling perlu diuji ke restore backup lebih dulu, karena **mengubah tipe
kolom pada tabel berisi data** - berbeda dari migrasi sebelumnya yang hanya menambah kolom.

### Empat bug ditemukan sambil jalan

- Dropdown Kategori di form edit menawarkan **FISIK / DIGITAL / HYBRID**, nilai yang tidak
  cocok dengan default schema maupun kebutuhan. Diperbaiki ke FISIK / Non FISIK.
- Importer outlet **mengabaikan** TAP, Salesforce, Kategori, Hari PJP, Tipe PJP, dan Branding
  sepenuhnya, serta mengirim key `address` yang tidak punya kolom sama sekali. Sekarang
  semuanya terbawa, dengan sel tak dikenal jatuh ke default agar satu sel keliru tidak
  menggagalkan seluruh baris.
- Template import kekurangan kolom-kolom tersebut. Dilengkapi, plus sheet "Pilihan" berisi
  daftar nilai yang sah.
- `normalizeOutletBranding` mengirim merek tak dikenal ke "Non Branding", **tidak sepakat**
  dengan migrasi SQL yang memetakannya ke "Lainnya". Ketahuan dari uji edge case, bukan dari
  membaca kode. Disamakan ke "Lainnya": merek tak dikenal tetap outlet ber-branding, hanya
  nilai kosong yang berarti tanpa branding.

### Verifikasi

- Normalizer dan pembangun URL diuji terhadap kasus pinggir: kosong, spasi, beda kapitalisasi,
  koordinat di luar rentang, nilai tak dikenal, dan koordinat mengalahkan URL tersimpan.
  Seluruhnya lulus.
- Disisir juga apakah ada daftar pilihan hardcoded lain yang kini tidak sinkron (pola bug yang
  sama seperti DIGITAL/HYBRID): tidak ada. Filter di halaman publik `/mitra` hanya Kabupaten
  dan TAP.
- Nilai outlet di `src/db/seed.ts` diperiksa dan seluruhnya sah terhadap enum baru;
  `locationUrl`-nya disamakan ke format turunan. Dipastikan pula alias `@/` ter-resolve saat
  seed dijalankan lewat `tsx` (gagal di koneksi DB, bukan di resolusi modul).
- `npx tsc --noEmit`, `npx drizzle-kit check`, lint, dan `npm run build`: lulus.
- Tetap **tidak** terverifikasi: SQL migrasi `0007` itu sendiri, karena mesin ini masih tanpa
  database. **(Sudah tidak berlaku sejak 2026-08-06 — migrasi `0007` akhirnya diuji terhadap
  MySQL nyata dan lulus 16/16; lihat entri di bawah.)**

## 2026-08-06 - Audit lanjutan dan uji runtime dengan MySQL nyata

Dua pekerjaan dalam satu sesi: audit statis pada modul yang belum pernah disentuh, lalu membuka
blokade "tidak ada database" yang menggantung sejak 2026-08-04.

### Audit statis - `docs/audit-2026-08-06.md`

Ruang lingkup dipilih agar tidak tumpang tindih: `audit-2026-08-03.md` menutup dirinya dengan
catatan bahwa **Belanja/E-commerce, Undian, dan Form Builder "tidak diaudit mendalam"**, jadi
audit ini masuk ke sana. Temuan utama: tiga jalur bypass pembayaran, endpoint submit form publik
tanpa rate limit/honeypot (padahal endpoint IndiHome sudah punya ketiganya), dan rantai
deprecation gateway pembayaran yang menunjuk ke endpoint yang juga sudah mati.

### Uji runtime - `docs/uji-runtime-2026-08-06.md`

**Catatan sesi sebelumnya keliru sebagian.** "Mesin ini tidak punya MySQL server, Docker, maupun
MariaDB" benar untuk sisi Windows, tetapi **melewatkan WSL**: Ubuntu 24.04 WSL2 sudah terpasang
dengan systemd aktif, dan `mysql-server` 8.0 tersedia langsung dari repo Ubuntu — engine dan versi
mayor yang sama dengan produksi. MySQL 8.0.46 dipasang di sana; `.env` lokal tidak perlu diubah.

Hasil terpenting:

- **Ketiga temuan kritis audit TERBUKTI** dapat dieksploitasi tanpa cookie/token apa pun terhadap
  server dan database hidup. K3 mengonfirmasi bahwa cukup **menghilangkan field `signature_key`**
  dari body untuk melewati verifikasi signature Midtrans sepenuhnya.
- **Bug baru yang tidak terlihat dari pembacaan statis:** race condition di `auto-redeem.ts`
  membagikan **kode voucher yang sama ke tiga pelanggan sekaligus** (pemilihan voucher tanpa
  penguncian baris, penandaan `is_used` baru terjadi ~5 detik kemudian). Stok hanya berkurang 1
  walau tiga pelanggan dilayani, jadi selisihnya tidak akan ketahuan dari laporan stok.
- **Database tidak bisa dibangun dari nol.** Tiga blocker berturut-turut: BOM UTF-8 di migrasi
  `0000` (ditolak `ER_PARSE_ERROR`), dua nama constraint FK sepanjang 66 dan 69 karakter yang
  melewati batas 64 MySQL (`ER_TOO_LONG_IDENT`), dan **19 dari 46 tabel di `schema.ts` tidak
  pernah dibuat oleh migrasi mana pun** — termasuk `user`, `programs`, `products`, `orders`,
  `site_settings`. Skema dasar lahir dari `drizzle-kit push`, migrasi hanya menumpuk di atasnya.
  Bukan blocker deploy production, tapi **inilah akar penyebab setiap sesi sebelumnya terblokir**.
- **Migrasi `0007` lulus 16/16** terhadap data sengaja berantakan; `sql_mode` server memang memuat
  `STRICT_TRANS_TABLES`, jadi premis "normalisasi sebelum ALTER" terbukti benar.
- **Migrasi `0004` lulus** termasuk skenario tabrakan slug, dan
  `node scripts/verify-program-migration.mjs` **11/11 OK, exit code 0** — gerbang Fase 3b hijau.
- **QA Fase 5 bagian A/B/D: 30 dari 33 lulus.** Scoping wilayah (B1/B2, inti keamanan Fase 0)
  lulus seluruhnya terhadap database sungguhan. Tiga yang gagal semuanya karena implementasi
  **lebih ketat** daripada matriks PRD: Manager ditolak 403 di `GET /api/admin/users`,
  `GET /api/admin/settings`, dan `GET /api/admin/mitra/whitelist`.

**KOREKSI: ini bukan kontradiksi, melainkan keputusan yang sudah diambil.** Commit `6e2a1f1`
sengaja memperketat `hero-slides` (semua verb), `settings GET`, `users GET`, dan `whitelist GET`
ke `SUPER_ADMIN` mengikuti pembatasan grup sidebar "Sistem & Konten", dan pesan commit-nya
menyatakan hal itu **menggantikan** baris "Pengaturan = View-all for Manager" di
`prd-total-revamp.md` 2.2. Catatan Fase 2 di atas merujuk keadaan sebelum keputusan itu.
Jadi kodenya benar; yang tertinggal adalah `docs/qa-role-matrix.md` (baris A2, A5, D3) dan
matriks PRD 2.2 — keduanya perlu diubah menjadi 403 untuk Manager.

### Perubahan kode

- `drizzle/0000_brainy_slapstick.sql`: BOM UTF-8 dibuang.
- `src/db/schema.ts`: dua FK diberi nama eksplisit (`mitra_whitelist_source_batch_fk`,
  `mitra_whitelist_usage_whitelist_fk`) plus import `foreignKey`.
- Verifikasi: `npx tsc --noEmit` lulus, `npx drizzle-kit check` "Everything's fine".

### Perbaikan menyusul di sesi yang sama - `docs/perbaikan-pembayaran-2026-08-06.md`

Seluruh temuan Kritis ditutup dan diverifikasi ulang terhadap MySQL dan server yang berjalan:

- **K1** endpoint `simulate` **dihapus** (nol pemanggil) — kini 404.
- **K2** webhook Mayar memverifikasi setting baru `mayar_webhook_token` dengan perbandingan
  waktu tetap, **fail-closed**. Tanpa token → 503, token salah → 403, token benar → 200.
- **K3** webhook Midtrans jadi fail-closed; `verifyMidtransSignature` menolak komponen kosong dan
  memakai `timingSafeEqual`. Tanpa signature → 503, palsu → 403, benar → 200.
- **Race voucher ditutup** lewat klaim compare-and-swap: tiga webhook bersamaan kini menghasilkan
  **3 kode berbeda** (sebelumnya 1 kode untuk 3 pelanggan), stok turun tepat 3.
- **Idempotensi** ditambahkan — webhook yang dikirim ulang tidak menghabiskan voucher kedua.
- **Bug ketiga di auto-redeem:** `redemption_logs.voucher_id` NOT NULL + FK sementara kode
  mengisi `'NO-STOCK'`, sehingga kegagalan stok habis **tidak pernah tercatat**
  (`ER_NO_REFERENCED_ROW_2`). Migrasi `0009` membuat kolomnya nullable; kini tercatat.

**Peringatan migrasi `0009`:** hasil `drizzle-kit generate` **tidak bisa dipakai apa adanya** —
ia men-`DROP FOREIGN KEY` dua constraint yang tidak pernah bisa ada (nama 66 dan 69 karakter),
yang akan menggagalkan deploy. Ditulis ulang jadi berkondisi lewat `information_schema` +
prepared statement, satu statement per breakpoint. Diuji terhadap kondisi mirip production:
0 gagal, idempoten, tidak ada baris hilang.

**WAJIB saat deploy:** isi `mayar_webhook_token` di Pengaturan. Selama kosong, pembayaran Mayar
tidak tercatat otomatis — konsekuensi yang disengaja dari fail-closed.

`npx tsc --noEmit`, lint terarah, dan `npm run build`: lulus.

### Uji lanjutan - `docs/uji-lanjutan-2026-08-06.md`

**Temuan paling serius sesi ini: migrasi `0003` tidak bisa dijalankan sama sekali.** Kedua
statement backfill-nya gagal `ER_NON_UNIQ_ERROR` ("Column 'user_id' in field list is ambiguous")
karena `ON DUPLICATE KEY UPDATE user_id = user_id` tidak menyebut nama tabel, sementara kolom itu
ada juga di tabel yang di-join. Akibatnya tabel RBAC terbentuk tapi **kosong**, sehingga seluruh
admin selain akun bootstrap terkunci — kebalikan dari yang dijanjikan komentar migrasinya.
Lebih buruk: **mengulang deploy tidak menolong**, percobaan kedua gagal di 14 dari 14 statement
mulai `ER_TABLE_EXISTS_ERROR`. **Sudah diperbaiki** dengan menyebut nama tabel; diverifikasi
0 gagal dan 4 dari 4 user ter-backfill dengan pemetaan role yang benar.

Migrasi lain yang belum pernah dijalankan kini sudah diuji: `0005`, `0006`, `0008` semuanya
**0 statement gagal**. Dengan ini seluruh migrasi `0003`-`0009` sudah pernah diuji terhadap
MySQL sungguhan.

QA Fase 5 selebihnya: **bagian C, F, G, H lulus penuh** (G 9/9 — termasuk G2, inti Fase 4:
lokasi baru dari admin langsung diterima endpoint publik tanpa deploy; audit log tidak membocorkan
rahasia). Bagian D lulus kecuali **D3 yang mengembalikan 403** — dan itu **benar**, sesuai
keputusan commit `6e2a1f1`; checklist QA dan PRD yang perlu diperbarui, bukan kodenya.

**Temuan baru:** halaman IndiHome bisa menampilkan paket yang tidak bisa dipesan. Saat tabel
produk kosong, katalog publik jatuh ke fallback statis (`internet-75` dsb.) tetapi POST lead
memvalidasi `packageId` terhadap tabel — pengunjung mengisi form lengkap lalu ditolak 400 dengan
pesan menyesatkan ("Paket tidak tersedia untuk lokasi yang dipilih", padahal lokasinya ada).
Pola yang persis sama dengan yang diperbaiki Fase 4 untuk lokasi, belum ditutup untuk paket.

**Temuan audit yang terbukti:** `/api/forms/[formId]/submit` menerima **20 dari 20** submission
bersamaan tanpa satu pun 429 (endpoint IndiHome, sebagai pembanding sah, menolak mulai yang
ke-6). Dua route penyaji upload menyimpang — berkas `.ico` identik disajikan `image/x-icon` vs
`application/octet-stream`. SVG berisi `<script>` disajikan `image/svg+xml` tanpa CSP maupun
`Content-Disposition`.

**Koreksi:** klaim audit bahwa gerbang unggahan bisa dilewati dengan `file.type` kosong **tidak
terbukti** — klien HTTP normal selalu mengisi content-type, dan hasilnya ditolak 400.

### Uji live lokal (Chrome headless + CDP)

Aplikasi dijalankan sungguhan terhadap MySQL WSL dan dikendalikan lewat Chrome headless
(`--remote-debugging-port=9222`) dengan driver CDP kecil di `tmp/cdp-driver.mjs` — Node 22 sudah
punya `WebSocket` bawaan, jadi tidak perlu menambah Playwright sebagai dependensi.

Lima halaman publik (`/`, `/indihome`, `/program`, `/mitra`, `/cuan`) render penuh, **nol error
konsol**, dan `scrollWidth == clientWidth` di 1440px. Panel admin: login lewat form sungguhan,
`/api/admin/me` mengembalikan `role: SUPER_ADMIN`, dashboard menampilkan 3 hero slide dari
database, `/admin/mitra/outlet` menampilkan 2 outlet. Field **"Webhook Token"** Mayar yang
ditambahkan sesi ini terbukti ter-render lengkap dengan teks peringatannya.

Sekaligus memverifikasi **I6** checklist QA yang sebelumnya ditandai belum diuji: Kategori Outlet,
Hari PJP, Tipe PJP, dan Branding memang tampil sebagai **dropdown**, bukan input teks — hasil
migrasi `0007`.

**BUG DITEMUKAN: kredensial admin hasil `npm run db:seed` tidak pernah bisa login.**
`src/db/seed.ts` mem-hash sandi dengan scrypt `r=8` tanpa normalisasi NFKC, sedangkan better-auth
memverifikasi dengan `r=16` + NFKC (`node_modules/better-auth/dist/crypto/password.mjs`).
Formatnya kebetulan sama (`salt:hex`) sehingga tidak ada error apa pun — kunci turunannya saja
yang tidak pernah cocok, dan login selalu ditolak "Invalid email or password". Dibuktikan dengan
menghitung ulang hash tersimpan: cocok dengan parameter seed, tidak cocok dengan parameter
better-auth. **Sudah diperbaiki** di `src/db/seed.ts`; login terbukti berhasil setelahnya.

Konsekuensi sebelum perbaikan: siapa pun yang menyiapkan proyek dari nol terkunci total sejak
langkah pertama, tanpa petunjuk penyebabnya.

**Pelajaran metode:** percobaan pertama memotret Beranda saat hero masih bertuliskan "Loading...",
padahal HTTP 200, tidak ada error konsol, dan `readyState` sudah `complete`. Menunggu
`document.readyState` tidak cukup untuk konten yang di-fetch dari klien — tunggu penanda
pemuatannya hilang, dan **lihat screenshot-nya**, jangan percaya angka saja.

### Pembersihan menjelang deploy

Kode mati yang sudah lama dicatat di audit akhirnya dihapus setelah dipastikan ulang nol
referensi: `src/lib/db.ts` (re-export satu baris, 79 berkas mengimpor langsung dari `@/db`),
`src/lib/doku.ts`, serta tombstone `/api/public/webhook/doku` dan `/api/public/webhook/lynkid`.
Rantai deprecation-nya memang sudah menyesatkan — `lynkid` menunjuk ke `doku`, yang juga sudah
mati. Yang tersisa kini hanya `mayar` dan `midtrans`.

Dua route penyaji upload disatukan menjadi satu route catch-all, sekaligus menutup dua temuan
audit: berkas `.ico` yang sama tidak lagi disajikan `image/x-icon` di root tetapi
`application/octet-stream` di subfolder, dan SVG kini disajikan dengan
`Content-Security-Policy: default-src 'none'; sandbox` sehingga skrip di dalamnya tidak berjalan
walau dibuka langsung. Penjagaan directory traversal juga diganti: bukan lagi membuang pola
`../` dengan regex, melainkan menyelesaikan path lalu memastikan hasilnya masih di dalam folder
unggahan — diuji dengan tiga bentuk serangan termasuk yang tersandi persen, ketiganya 404.

`.dockerignore` diperluas: sebelumnya hanya lima baris dan masih meloloskan `tmp/`, `docs/`,
`.agents/`, `*.tsbuildinfo`, serta `.env.*` selain `.env` ke dalam image.

Build produksi bersih dari nol: `tsc`, `next lint`, `drizzle-kit check`, `npm run env:check`,
dan `npm run build` (67 halaman) semuanya lulus. Diverifikasi ulang setelah pembersihan bahwa
navigasi responsif dan peta outlet masih berfungsi.

### Catatan alat untuk sesi berikutnya

- Sandbox memblokir WSL **secara diam-diam** (exit code 0, output kosong) dan juga koneksi TCP ke
  MySQL. Jalankan perintah WSL dengan sandbox dimatikan.
- WSL mematikan distro saat tidak ada proses yang menahannya, sehingga `localhost:3306` dari
  Windows menjawab `ECONNREFUSED` walau MySQL aktif di dalam. Jalankan proses penahan
  (`wsl -d Ubuntu -u root -e sleep 86400`) di latar belakang.
- `bash -lc` tidak menghasilkan output di WSL ini; pakai `bash -c`, atau tulis file `.sh` lalu
  jalankan lewat path `/mnt/...`.

## 2026-08-08 - Portal Mitra: profil outlet, OTP, Street View, market share, master salesforce, dan halaman program

Sebelas commit dalam satu sesi, seluruhnya di modul Mitra Outlet (`35bf544` sampai `a00d2cf`).
Migrasi `0010`, `0011`, dan `0012` belum dijalankan pada database mana pun ketika catatan ini
ditulis.

### Profil outlet publik

Territory dihapus dari profil dan diganti TAP serta nama salesforce. Alasannya: nama cabang dan
petugas yang benar-benar mengunjungi outlet lebih berarti bagi mitra daripada kode wilayah
internal yang tidak pernah mereka pakai.

Tombol "Download QR SVG" dulu membuka berkas SVG mentah, dan halaman itu **tidak punya jalan
kembali** ke profil. Diperbaiki dengan atribut `download` + `?dl=1`; tanpa parameter itu
perilakunya tetap `inline` supaya pratinjau QR di admin (dibuka di tab baru) tidak berubah.

### Batas waktu OTP dipindahkan ke tempat yang benar

Sesi detail sebelumnya hangus 15 menit setelah verifikasi. Sekarang yang dibatasi hanya kode
OTP-nya (5 menit); sesi detail praktis tidak kedaluwarsa. Kolom `expires_at` tetap `NOT NULL` dan
masih dipakai job pembersih, jadi diisi jauh ke depan lewat `MITRA_DETAIL_SESSION_TTL_MINUTES`
alih-alih dibuat nullable. Badge hitung mundur di halaman detail ikut dihapus.

**Perubahan sikap yang perlu diingat:** permintaan OTP tidak lagi menjawab generik "jika nomor
terdaftar...". Sekarang pengunjung langsung diberi tahu apakah nomornya berhak, lewat dialog.
Konsekuensinya endpoint ini bisa dipakai menebak nomor mana yang masuk whitelist; rate limit yang
sudah ada (1/menit, 5/jam, 10/hari per nomor, 15/jam per IP) adalah satu-satunya pengaman. Ini
diminta eksplisit oleh pemilik setelah trade-off-nya disampaikan.

### Data detail: kartu menjadi tabel

Tiap parameter selalu punya tiga angka (M-1, M, MoM), jadi 141 kartu diganti 47 baris tabel
`Parameter | M-1 | M | MoM`. `mitra-fields.ts` dibalik arahnya: **baris parameter kini sumber
kebenaran**, dan daftar `fields` untuk editor admin diturunkan darinya, supaya tabel publik dan
form admin tidak bisa berbeda. Diverifikasi dengan skrip pembanding terhadap logika lama:
48/48/45 field, seluruh key dan label identik, sehingga data JSON yang sudah tersimpan aman.

### Street View di direktori outlet

Memakai **Maps Embed API, bukan Maps JavaScript API** — mode embed tidak ditagih per pemuatan,
jadi peta sebaran tetap Leaflet/OpenStreetMap dan Google hanya dipakai untuk panoramanya.
Konsekuensinya isi iframe tidak bisa dikendalikan dari halaman; hanya titik awal panorama yang
bisa diatur lewat URL.

Tanpa `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` seluruh jejaknya tidak dirender, jadi aman di-deploy
sebelum key-nya siap. `npm run env:check` mengingatkan lewat warning, bukan error. Langkah membuat
dan membatasi key ada di `docs/google-street-view.md`.

### Market share per kecamatan - migrasi 0011

Tabel `mitra_market_shares` dikunci pada pasangan **kabupaten + kecamatan**, bukan kecamatan saja:
nama kecamatan berulang antar kabupaten, jadi kecamatan saja akan menempelkan angka wilayah lain
ke outlet. Pencocokan ke outlet memakai teks persis — lebih baik tidak menampilkan angka daripada
menampilkan angka yang salah — karena itu form admin memakai datalist berisi wilayah yang benar-
benar dipakai outlet. Total tidak dipaksa 100% karena data survei biasa menyisakan kategori di
luar enam operator.

Satu baris per wilayah tanpa kolom periode; input baru menimpa yang lama. Kalau perlu riwayat
bulanan, tambahkan `period_ym` ke tabel dan ke unique index-nya.

### Master salesforce - migrasi 0012

Nama dan foto salesforce dipindahkan dari kolom teks di tiap outlet ke tabel `mitra_salesforces`,
ditaut lewat `mitra_outlets.salesforce_id`. Ganti nama atau foto sekarang cukup sekali.

**Migrasi hasil generate drizzle-kit berbahaya dan tidak boleh dipakai apa adanya:** ia langsung
`DROP COLUMN salesforce` tanpa memindahkan apa pun, yang akan menghapus nama salesforce seluruh
outlet. Versi yang dipakai menyalin nama dan foto ke master, mengisi `salesforce_id` lewat
pencocokan nama, baru membuang kolom lama — dengan penjagaan `information_schema` mengikuti pola
migrasi `0009`, agar aman untuk database yang dibangun `drizzle-kit push`.

Bentuk file import tidak berubah: kolom `salesforce` tetap berisi nama, lalu diterjemahkan ke id
master saat commit dan **dibuatkan otomatis bila belum ada**. Auto-create dipilih supaya baris
import yang datanya sah tidak gagal hanya karena salesforce-nya baru; efek sampingnya salah ketik
memunculkan master baru yang harus dirapikan lewat menu Salesforce.

### Halaman program dibangun ulang

Diminta menyerupai `digistar.youthcrm.id/salesforce-champion`, **tampilannya saja** — peserta tetap
outlet, hanya parameternya berbeda. Sempat dimulai sebagai generalisasi engine (kolom `outlet_id`
menjadi `subject_id` polimorfik) lalu dibatalkan seluruhnya setelah klarifikasi; `schema.ts`
dikembalikan ke HEAD.

Tiga hal yang sebelumnya tidak mungkin, kini bisa tanpa perubahan database:

- **Pemenang sementara.** Podium terisi tiga teratas peringkat berjalan selama admin belum
  mempublikasikan pemenang resmi, dan berganti sendiri begitu dipublikasikan.
- **Peserta tanpa skor.** Sebelumnya hilang total dari halaman karena papan peringkat dibangun
  dari tabel skor — dari sisi peserta terlihat seperti tidak terdaftar padahal terdaftar. Kini
  ikut tampil dengan nilai nol dan penanda "belum ada data".
- **Pencapaian per parameter.** Skornya sudah lama tersimpan per bulan tetapi tidak pernah dikirim
  ke halaman publik. Agregasinya dihitung di JavaScript, bukan `SUM()` di SQL, karena tiap
  parameter punya modenya sendiri (SUM/AVG/LAST) dan **LAST berarti "ambil periode terbaru", yang
  tidak bisa diwakili satu fungsi agregat SQL**.

Pencarian juga diubah: dulu menyaring tabel peringkat sehingga peserta hanya melihat satu baris
tanpa pembanding. Sekarang mengisi panel di atas tabel, lengkap dengan rincian per parameter —
penting karena tabelnya dibatasi 100 teratas, dan peserta di peringkat 350 justru butuh pencarian
untuk menemukan dirinya. `prevRank` yang sudah lama disimpan akhirnya dipakai sebagai indikator
naik/turun.

### Belum dikerjakan / menunggu

- **Migrasi `0010`, `0011`, `0012` belum dijalankan.** Backup dulu: `0012` menghapus kolom setelah
  memindahkan isinya. Setelah jalan, `SELECT COUNT(*) FROM mitra_salesforces` harus sama dengan
  jumlah nama salesforce unik yang lama.
- `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` belum diisi, jadi panel Street View belum pernah tampil.
- Belum diuji runtime: backfill migrasi `0012` pada data asli, panel Street View, alur simpan/
  tampil market share, dan halaman program dengan data program yang benar-benar terisi.
- Dua warning ESLint `<img>` di `src/app/(hidden)/admin/pengaturan/page.tsx` sudah ada sebelum
  sesi ini dan sengaja dibiarkan.
- Dua liga terpisah (Regional & Branch) dan peserta berupa salesforce ber-SF Code tetap tidak
  didukung; itu butuh generalisasi engine yang dibatalkan di atas.

### Verifikasi

`tsc`, `eslint src scripts`, `npm run build`, dan `npm run env:check` lulus di setiap commit.
Tidak ada pengujian runtime pada sesi ini.

## Pembaruan rate limit OTP per outlet - 10 Agustus 2026

Rate limit per nomor pada endpoint permintaan OTP sekarang memakai pasangan **nomor WhatsApp +
outlet**. Batas 1 permintaan/menit, 5/jam, dan 10/24 jam tidak lagi terbawa ketika nomor yang
sama membuka outlet berbeda. Batas global 15 permintaan/jam per IP tetap dipertahankan sebagai
pengaman spam lintas outlet. Perubahan hanya menambahkan filter `outlet_id` pada query hitung;
tidak ada perubahan skema database maupun kontrak API.

Verifikasi: `npx tsc --noEmit`, ESLint khusus route OTP, dan `npm run build` lulus. Build tetap
menampilkan dua warning `<img>` lama di halaman pengaturan yang tidak terkait perubahan ini.

## Privasi sebaran ODP publik - 10 Agustus 2026

Peta sebaran ODP di `/mitra` sekarang hanya menampilkan titik lokasi dengan satu warna netral.
Legenda Green/Yellow/Orange/Black, nama ODP, wilayah, kapasitas port, dan occupancy tidak lagi
tersedia pada tampilan publik. Popup titik tetap menyediakan Google Maps dan Street View hanya
dari koordinatnya, tanpa membuka rincian ODP. Endpoint
`/api/public/indihome/odp` juga diperkecil agar hanya mengembalikan ID serta koordinat, sehingga
detail tidak dapat diambil dengan membaca respons jaringan halaman publik.

Rincian ODP sekitar outlet dipindahkan sepenuhnya ke `/mitra/o/[publicToken]/detail`. Komponen
tersebut membaca endpoint baru `/api/public/mitra/outlets/[publicToken]/odp`, yang memvalidasi
cookie sesi detail hasil OTP dan memastikan sesi terikat pada outlet yang sama. Pusat radius
diambil dari koordinat outlet di server agar sesi outlet lain tidak dapat dipakai memindai lokasi
sembarang. Kartu ODP di profil outlet sebelum OTP sudah dihapus. Tidak ada perubahan database.

Verifikasi: `npx tsc --noEmit`, ESLint terarah, dan `npm run build` lulus. Build mengenali route
ODP terlindungi baru; hanya dua warning `<img>` lama di halaman pengaturan yang tetap muncul.
Smoke test production server pada endpoint rincian tanpa cookie OTP menghasilkan HTTP 401 dengan
pesan verifikasi OTP, lalu server pengujian dihentikan.

## Monitoring foto outlet - 10 Agustus 2026

Modul baru `/admin/mitra/foto` ditambahkan dari kartu **Monitoring Foto** di halaman Database
Mitra Outlet. Laporan memakai bentuk satu baris untuk satu pasangan outlet dan kategori foto,
sehingga outlet yang kehilangan beberapa kategori muncul terpisah dan tanggal pembaruannya tidak
tercampur. Empat kategorinya tetap bersumber dari `MITRA_PHOTO_SLOTS`: Tampak Depan, Etalase,
POP Material Telkomsel, dan POP Kompetitor.

Filter laporan meliputi pencarian outlet, kategori foto, kondisi foto, kategori outlet, TAP, dan
Salesforce. Kondisi yang tersedia adalah belum ada, belum ada atau kedaluwarsa, kedaluwarsa,
terbaru, dan semua. Batas kedaluwarsa memakai aturan bersama `BATAS_SEGAR_HARI` (7 hari), bukan
angka baru khusus laporan. Empat kartu ringkasan menampilkan jumlah belum ada, kedaluwarsa, dan
terbaru per kategori foto; kartu dapat diklik untuk langsung membuka daftar foto kosong.

Endpoint `/api/admin/mitra/photo-monitoring` melayani JSON berhalaman dan ekspor Excel dengan
filter yang sama. Akses diberikan kepada SUPER_ADMIN, ADMIN_INPUT, MANAGER, SUPERVISOR, dan
SALESFORCE. Untuk SUPERVISOR/SALESFORCE, outlet dibatasi pada territory yang ditetapkan sebelum
ringkasan, filter, pagination, atau Excel dibentuk; akun tanpa territory memperoleh data kosong.
Ekspor dibatasi 20.000 baris dan menyertakan identitas outlet, kategori outlet/foto, status,
tanggal pembaruan WIB, umur foto, wilayah, TAP, Salesforce, serta URL foto. Tidak ada migrasi
database.

Verifikasi: `npx tsc --noEmit`, ESLint terarah, dan `npm run build` lulus. Output build memuat
halaman `/admin/mitra/foto` serta endpoint `/api/admin/mitra/photo-monitoring`. Smoke test
production server tanpa sesi menghasilkan HTTP 401 pada endpoint laporan, lalu server uji
dihentikan. Isi laporan, filter territory, dan berkas Excel belum diuji terhadap sesi admin dan
database hidup pada sesi ini.

## Perilaku tutup popup foto - 10 Agustus 2026

Lightbox pada `OutletPhotoCard` sekarang dapat ditutup dengan mengklik area mana pun di luar
gambar, selain tetap mendukung tombol X dan tombol Escape. Sebelumnya pembungkus gambar berukuran
`w-full` dan `80vh` menghentikan propagasi klik, sehingga area letterbox yang terlihat gelap tetap
dianggap bagian gambar. Hitbox sekarang mengikuti dimensi alami gambar; hanya klik tepat pada
gambar yang tidak menutup popup. Perubahan berlaku sekaligus pada profil outlet publik dan
halaman detail outlet setelah OTP karena keduanya memakai komponen yang sama.

Verifikasi: `npx tsc --noEmit`, ESLint khusus `outlet-photo-card.tsx`, dan `npm run build` lulus.
Build hanya menampilkan dua warning `<img>` lama di halaman pengaturan yang tidak terkait.

## Galeri foto di dashboard Mitra - 10 Agustus 2026

Dashboard `/admin/mitra` sekarang menampilkan galeri **Foto Outlet Terbaru** berisi maksimal 12
foto yang benar-benar tersedia, diurutkan dari waktu pembaruan paling baru. Setiap thumbnail
menampilkan kategori foto, nama/ID outlet, TAP, dan tanggal pembaruan; klik thumbnail membuka
foto penuh di tab baru, sedangkan tombol Monitoring Foto membuka laporan lengkap.

Galeri memakai endpoint monitoring yang sama dengan tambahan kondisi `AVAILABLE` dan urutan
`latest`, sehingga RBAC dan pembatasan territory untuk SUPERVISOR/SALESFORCE tetap berlaku sebelum
foto dipilih. Filter “Sudah ada foto” juga ditambahkan pada halaman `/admin/mitra/foto`. Tidak ada
perubahan database.

Verifikasi: `npx tsc --noEmit`, ESLint terarah, dan `npm run build` lulus. Build hanya menampilkan
dua warning `<img>` lama di halaman pengaturan yang tidak terkait. Isi galeri dengan sesi admin
dan database hidup belum diuji pada sesi ini.

## Efek foto Salesforce keluar dari lingkaran - 10 Agustus 2026

Foto Salesforce pada profil outlet publik tetap memakai bingkai lingkaran, tetapi bagian tengah
atas foto kini dapat menonjol melewati batas bingkai. Efek dibuat dengan dua lapisan gambar yang
memakai posisi identik: lapisan dasar dipotong penuh oleh lingkaran, sedangkan lapisan di atasnya
hanya membuka irisan bagian atas. Sisi kiri, kanan, dan bawah tetap terpotong; foto pengganti
berupa inisial tidak berubah. Tidak ada perubahan API, data, atau format unggahan.

Verifikasi: `npx tsc --noEmit`, ESLint khusus halaman profil outlet, dan `npm run build` lulus.
Build hanya menampilkan dua warning `<img>` lama di halaman pengaturan yang tidak terkait.

## Audit OWASP Agentic dan dependency - 10 Agustus 2026

Audit memakai skill lokal `agent-owasp-compliance`, tetapi repo ini tidak memiliki runtime
AI/LLM/agent: tidak ada model, prompt execution, tool registry, MCP, memori agent, maupun
komunikasi antar-agent. Karena itu OWASP Top 10 for Agentic Applications 2026 dinilai **tidak
berlaku (N/A)**, bukan gagal 0/10. Audit juga menemukan bahwa nama dan pemetaan ASI-01 sampai
ASI-10 di skill lokal tidak sesuai taksonomi resmi OWASP 2026; skill perlu diperbarui sebelum
dipakai untuk skor kepatuhan.

Sebagai pemeriksaan pendamping, `npm audit --omit=dev --json` menemukan 12 dependency produksi:
1 kritis, 9 tinggi, dan 2 sedang. Dependency langsung yang ditandai adalah `better-auth` 1.5.0,
`drizzle-orm` 0.39.3, `next` 15.5.12, `sharp` 0.34.5, `uuid` 11.1.0, dan `xlsx` 0.18.5. Audit
penuh termasuk tooling menemukan 21 dependency: 2 kritis, 13 tinggi, dan 6 sedang.

Exploitability dipilah berdasarkan pemakaian: `sharp` memproses buffer unggahan pengguna dan
`xlsx` membaca workbook impor; `uuid` hanya dipakai sebagai v4 tanpa buffer; Better Auth hanya
mengaktifkan email/password sehingga plugin OAuth/OIDC/MCP/magic-link yang disebut mayoritas
advisory tidak terlihat aktif. Tidak ditemukan dynamic shell/code execution, identifier SQL
dinamis, atau kandidat rahasia umum pada pemindaian ringan.

Laporan lengkap disimpan di `docs/audit-agentic-dependency-2026-08-10.md`. Tidak ada source,
dependency, migrasi, atau konfigurasi izin lokal `.claude/settings.local.json` yang diubah.
Working tree sudah berisi perubahan lain sebelum audit dan sengaja tidak disentuh. Verifikasi
audit terbatas pada scan source dan advisory npm terbaru; build/runtime test tidak dijalankan
karena audit ini hanya mengubah dokumentasi.

## Penyatuan tabel admin, market share, dan detail outlet - 10 Agustus 2026

Seluruh tabel operasional utama sekarang memakai kontrol pengurutan yang sama dari
`src/components/ui/sortable-head.tsx` dan logika generik `src/lib/use-sort.ts`. Perubahan berlaku
pada lead IndiHome, ODP, peserta, audit Mitra, impor, outlet, performance, perubahan outlet,
program, referensi metric, Salesforce, whitelist OTP, monitoring foto, dan market share. Klik
judul kolom mengurutkan baris yang sedang dimuat dan klik kedua membalik arah; pada tabel yang
dipaginasi server-side, pengurutan hanya berlaku pada halaman aktif.

Monitoring foto kini memasukkan seluruh outlet dalam scope, termasuk outlet yang belum pernah
memiliki foto. Empat kartu kategori menampilkan persentase outlet yang sudah berfoto beserta
jumlah sudah ada, total, belum ada, dan kedaluwarsa. Filter Hari PJP ditambahkan ke UI dan
endpoint `/api/admin/mitra/photo-monitoring`; filter ini juga ikut diterapkan pada ringkasan,
pagination, dan ekspor karena seluruh keluaran memakai kumpulan outlet tersaring yang sama.

Market share tidak lagi menyimpan Axis sebagai operator terpisah. Schema Drizzle, daftar field,
dan snapshot diperbarui lewat migrasi `drizzle/0025_drop_market_share_axis.sql`, yang menjalankan
`DROP COLUMN axis`. Halaman admin mendapat filter kecamatan yang mengikuti kabupaten dan grafik
rata-rata horizontal dengan dua tampilan: sebelum merger serta setelah merger (XL + Smartfren
menjadi XL Smart, Indosat + Tri menjadi IOH). Grafik yang sama ditampilkan pada detail outlet
setelah OTP. Migrasi `0025` belum dijalankan pada database mana pun dalam sesi ini; backup dan
review data Axis wajib dilakukan sebelum `npm run db:migrate` karena penghapusan kolom tidak
dapat dibatalkan tanpa backup.

Form edit profil outlet setelah OTP mengganti input bebas kabupaten/kecamatan menjadi dropdown
yang saling terhubung dan bersumber dari pasangan wilayah yang sudah dipakai outlet. Tiga grup
tabel performance detail sekarang tertutup secara default dan dapat dibuka satu per satu. Efek
foto Salesforce yang sebelumnya menonjol keluar dari lingkaran dibatalkan; foto kembali dipotong
penuh di dalam avatar lingkaran.

Konfigurasi izin personal `.claude/settings.local.json` ditambahkan ke `.gitignore` agar wildcard
command lokal tidak ikut ter-publish ke GitHub. Berkas lokalnya tidak dihapus dan tidak masuk
commit.

### Verifikasi

- `npx tsc --noEmit` lulus.
- `npx eslint src scripts` lulus tanpa error; tetap ada dua warning `<img>` lama pada
  `src/app/(hidden)/admin/pengaturan/page.tsx`.
- `npx drizzle-kit check` lulus (`Everything's fine`).
- `npm run env:check` lulus; tetap memperingatkan `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` kosong.
- `npm run build` lulus pada Next.js 15.5.12 dan menghasilkan 74 halaman statis.
- Belum ada runtime test dengan MySQL hidup, uji browser untuk sorting/dropdown/grafik, atau
  eksekusi migrasi `0025` pada data nyata.

## Input mandiri market share pasca-merger - 10 Agustus 2026

Perhitungan pasca-merger dari sesi sebelumnya dibatalkan setelah klarifikasi: **XL Smart dan IOH
bukan hasil penjumlahan data sebelum merger**. Data pasca-merger kini mempunyai tiga input dan
kolom database mandiri: `telkomsel_after`, `xlsmart`, dan `ioh`. Telkomsel juga diberi kolom
pasca-merger sendiri sehingga seluruh grafik setelah merger berasal dari satu set data baru,
bukan memakai ulang nilai lama.

Migrasi additive `drizzle/0026_add_post_merger_market_share.sql` menambahkan ketiga kolom sebagai
`decimal(5,2) NOT NULL DEFAULT 0.00`. Tidak ada backfill dari `telkomsel`, `xl`, `smartfren`,
`indosat`, atau `tri`; angka nol pada baris lama sengaja menandakan data pasca-merger belum pernah
diinput. Data sebelum merger tetap dipertahankan untuk pembanding historis.

Form `/admin/mitra/market-share` sekarang memisahkan dua kelompok input dan dua total. Tabel dan
grafik rata-rata juga membedakan kolom sebelum merger dengan data input langsung setelah merger.
Ringkasan Telkomsel tertinggi/terendah memakai `telkomsel_after`. Halaman detail outlet setelah
OTP membaca ketiga kolom baru secara langsung.

Template import berisi kolom:

`kabupaten`, `kecamatan`, `telkomsel`, `xl`, `smartfren`, `indosat`, `tri`,
`telkomsel_setelah_merger`, `xlsmart`, dan `ioh`.

Parser tetap menerima label/alias seperti `XL Smart`, tetapi menyimpan nilainya langsung ke
`xlsmart`; tidak ada jalur kode yang menjumlahkan XL dengan Smartfren atau Indosat dengan Tri.

### Verifikasi

- `npx tsc --noEmit` lulus.
- ESLint terarah pada schema, API, form, detail outlet, komponen grafik, dan library lulus tanpa
  warning atau error.
- `npx drizzle-kit check` lulus (`Everything's fine`).
- `npm run env:check` lulus; warning Street View key kosong tetap ada dan tidak terkait.
- `npm run build` lulus pada Next.js 15.5.12 dan menghasilkan 74 halaman statis; hanya dua
  warning `<img>` lama pada halaman pengaturan.
- Smoke script kontrak menghasilkan header template yang benar dan membuktikan grafik pasca-
  merger membaca `41/27/22` dari `telkomselAfter/xlsmart/ioh` walau kolom lama berisi angka lain.
- Migrasi `0025` dan `0026` belum dijalankan pada database nyata; runtime input/upload dengan
  sesi admin dan MySQL hidup belum diuji.

## Implementasi PRD Penilaian KPI Salesforce - 11 Agustus 2026

PRD `docs/prd-kpi-salesforce.md` diimplementasikan sebagai mekanisme ketiga pada Program
Salesforce. KPI tidak memakai leaderboard atau pemenang: aktual diunggah per outlet, target
ditetapkan per Salesforce/parameter, kemudian hasil di-rollup ke Salesforce dan TAP.

### Keputusan dan model data

- `mitra_programs.mechanism_type` menerima `KPI`, dengan ambang compliance, cap bawaan, serta
  toggle privasi untuk menyembunyikan label punishment di tampilan publik.
- Parameter program mendapat kategori `COMPLIANCE`/`PERFORMANCE`, cap achievement, dan polaritas
  higher/lower-better. Kolom `reward_label` lama tetap dipertahankan agar Racing/Reward tidak
  mengalami regresi.
- Migrasi aditif `drizzle/0034_kpi_salesforce.sql` menambah `mitra_kpi_targets`,
  `mitra_kpi_outlet_scores`, dan `mitra_kpi_results`; snapshot dan journal Drizzle ikut dibuat.
- Mesin hitung baru berada di `src/lib/mitra-kpi.ts`. Data harian dipadatkan oleh SQL menjadi
  satu agregat per outlet/parameter sebelum diproses Next.js, sehingga recompute dan halaman
  publik tidak menarik seluruh baris harian mentah.
- Parameter tanpa target ditandai kosong dan dikeluarkan dari skor. Compliance menjadi gerbang;
  jika gagal, aturan performance dilewati. Aturan benefit KPI memakai first-match-wins.

### Admin dan publik

- `/admin/mitra/program-salesforce` memiliki tab KPI, konfigurasi ambang/cap/privasi, format
  parameter KPI, pratinjau bobot, urutan aturan benefit, upload target, upload aktual per outlet,
  recompute, dan tabel pratinjau hasil.
- Endpoint baru `/api/admin/mitra/programs/[id]/kpi-targets` menyediakan template, preview,
  commit atomik, validasi nomor baris/duplikat/target, dan reset. Endpoint skor yang sama dengan
  mekanisme lama bercabang ke tabel aktual KPI dan menolak outlet yang Salesforce-nya bukan
  peserta program.
- `/mitra/program-sf/[slug]` tetap memakai gate OTP program yang sudah ada. Setelah verifikasi,
  KPI menampilkan kartu ringkasan, tabel TAP dan Salesforce yang tertutup secara bawaan, rincian
  Compliance/Performance, serta tabel outlet dengan filter URL dan pagination 100 baris.
- Label punishment dapat disamarkan menjadi `Disembunyikan`; skor dan jumlah punishment tetap
  terlihat agar laporan agregat tidak berubah diam-diam.

### Verifikasi dan batasan

- `npx tsc --noEmit`: lulus.
- ESLint terarah pada seluruh schema/library/API/komponen KPI dan file program terkait: lulus
  tanpa warning atau error.
- `npx tsx --test src/lib/mitra-kpi.test.ts`: 5/5 unit test lulus (cap/polaritas/GAP,
  AVG+LAST, compliance berbobot, compliance gate+first match, dan target kosong).
- `npx drizzle-kit check`: lulus.
- `npm run build`: lulus pada Next.js 15.5.12; route baru `kpi-targets` masuk output. Dua warning
  `<img>` lama di halaman Pengaturan tetap ada dan tidak terkait perubahan ini.
- `npm run db:migrate` dicoba terhadap `localhost:3306/abk_ciraya`, tetapi gagal
  `ECONNREFUSED`. Karena itu migrasi SQL, upload Excel terhadap MySQL nyata, OTP, serta QA visual
  360 px belum diverifikasi end-to-end pada sesi ini. Jangan deploy kode sebelum migrasi `0034`
  berhasil diterapkan dan alur tersebut diuji pada database staging/lokal yang hidup.

## Header kolom dan collapse/expand ringkasan KPI - 11 Agustus 2026

- Ringkasan per TAP dan per Salesforce pada `KpiPublicView` kini memakai tabel semantik dengan
  judul kolom yang eksplisit, bukan susunan grid tanpa header.
- Setiap baris mempunyai tombol chevron untuk membuka atau menutup detail; seluruh baris tetap
  tertutup saat halaman pertama kali dimuat. Tombol membawa `aria-expanded` dan label aksesibel.
- Detail TAP mempunyai header Salesforce, Skor Compliance, Skor Performance, dan Benefit.
  Detail Salesforce tetap menampilkan tabel parameter Compliance dan Performance.
- Tabel memakai `overflow-x-auto` pada kontainernya supaya layar ponsel menggulir di dalam tabel,
  bukan membuat seluruh halaman melebar.

## PRD akses login operasional dan OTP baca-saja - 11 Agustus 2026

PRD baru `docs/prd-akses-login-operasional-mitra.md` menetapkan bahwa OTP hanya membuka seluruh
data outlet/program yang saat ini dilindungi OTP dalam mode baca-saja. UI publik tidak boleh
menampilkan kontrol edit, dan seluruh endpoint mutasi publik wajib menolak sesi OTP meskipun nomor
whitelist sebelumnya mempunyai peran yang boleh mengedit. Semua perubahan outlet selanjutnya
wajib menggunakan sesi login Better Auth yang aktif.

Salesforce hanya dapat melihat dan mengubah outlet yang `salesforce_id`-nya sama dengan akun serta
berada dalam TAP yang ditugaskan. Supervisor dapat melihat dan mengubah outlet dalam seluruh TAP
yang ditugaskan. Keduanya dapat mengubah profil operasional, lokasi, branding, dan empat slot foto
tanpa approval; field master seperti kode outlet, public token, RS number, TAP, assignment
Salesforce, status, serta data/config program tetap dilarang. Program Salesforce bersifat
read-only untuk role lapangan: Salesforce hanya melihat hasil sendiri dan Supervisor hanya data
TAP-nya.

PRD mensyaratkan relasi unik `admin_user_profiles.salesforce_id`, helper scope terpusat, endpoint
admin tersegmentasi per kelompok field, menu role-aware, dan audit dengan `actorUserId` serta diff.
`docs/prd-kpi-salesforce.md` telah diberi referensi kebijakan baru dan menegaskan bahwa tampilan
KPI publik setelah OTP tetap baca-saja. Sesi ini hanya mengubah dokumentasi; belum ada schema,
migrasi, API, UI, test, build, atau runtime database yang dijalankan.

## Test runner KPI dan evaluasi ganda pada recompute - 11 Agustus 2026

Audit terhadap implementasi KPI yang sudah ada menemukan dua hal yang belum selesai.

`src/lib/mitra-kpi.test.ts` memakai `node:test`, tetapi tidak ada skrip untuk menjalankannya dan
percobaan lewat vitest gagal seluruhnya (`Cannot find package '@/db'` karena alias `@/` tidak
terkonfigurasi di sana). Ditambahkan skrip `test` pada `package.json` yang menjalankan
`tsx --test` terhadap seluruh `src/**/*.test.ts`; `tsx` menghormati path alias `tsconfig`,
sehingga test berjalan tanpa konfigurasi tambahan dan tanpa koneksi database (pool `mysql2`
dibuat lazy).

`recomputeKpiResults()` memanggil `evaluateRuntimeParticipant()` dua kali untuk setiap peserta:
sekali untuk baris hasil, sekali lagi hanya untuk menjumlah `missingTargetCount`. Pada program
berisi ratusan salesforce ini menggandakan biaya operasi terberat di modul tersebut. Evaluasi kini
dilakukan sekali lalu dipakai untuk kedua keperluan.

### Verifikasi

- `npm test`: 5/5 lulus saat perubahan ini dibuat, kemudian 15/15 setelah test scope ditambahkan.
- `npx tsc --noEmit`, ESLint terarah, dan `npm run build`: lulus.

## Keterangan kebaruan data market share - 11 Agustus 2026

Kartu Market Share Kecamatan pada halaman detail outlet kini menampilkan
"Data diperbarui <tanggal>" di bawah nama wilayah. Nilainya berasal dari kolom `updated_at` tabel
`mitra_market_shares` yang selama ini sudah ikut terkirim oleh API — `getOutletDetailBySession()`
memakai `db.select()` tanpa memilih kolom, sehingga seluruh baris terbawa. Yang kurang hanya
deklarasi tipe di halaman dan tampilannya. Format tanggal memakai `formatWaktu()` yang sudah
dipakai kartu Data Detail Outlet pada halaman yang sama.

Catatan arti: `updated_at` memakai `onUpdateNow()`, sehingga angkanya berarti "kapan baris ini
terakhir disunting admin", bukan "periode survei market share". Bila yang dibutuhkan periode
survei sebenarnya, tabel perlu kolom periode tersendiri.

## Review dan penajaman PRD akses login operasional - 11 Agustus 2026

Seluruh klaim `docs/prd-akses-login-operasional-mitra.md` diperiksa terhadap kode. Fondasinya
cocok: kontrak audit sesuai tabel `mitra_outlet_edit_logs` yang sudah ada, dan inventaris route
mutasi publik benar (empat route, seluruhnya POST). Enam hal diperbaiki.

- Klaim "lockout yang sudah didukung profil admin" tidak benar. Kolom `failed_login_attempts`,
  `last_failed_login_at`, dan `locked_until` ada di `admin_user_profiles` tetapi tidak pernah
  dibaca kode mana pun; `requireRole()` hanya memeriksa `isActive`. Ditulis ulang sebagai
  pekerjaan baru pada MVP.
- Ditambahkan lubang yang sebelumnya tidak disebut sama sekali: `getAdminSession()` memberi
  `SUPER_ADMIN` kepada pengguna login tanpa baris `admin_user_profiles` selama emailnya cocok
  dengan email bootstrap, yang jatuh ke nilai terdokumentasi `admin@abkciraya.com`.
- Ditambahkan syarat TTL sesi OTP; nilai berjalan setara sepuluh tahun.
- Kontradiksi `salesforce_id` UNIQUE versus "satu akun aktif" diselesaikan. MySQL tidak mengenal
  partial unique index, jadi aturannya diubah menjadi "tepat satu akun" dan penggantian pemegang
  dilakukan dengan memindahkan tautan pada akun yang ada.
- Ditambahkan sub-bagian urutan aman penonaktifan tulis-OTP beserta tabel rollback, karena PRD
  melarang fase transisi sehingga penyangga harus berada sebelum rilis, bukan sesudahnya.
- Deferensi melingkar dengan `prd-kpi-salesforce.md` dipatahkan: tampilan publik ber-OTP diatur
  PRD KPI, tampilan dashboard diatur PRD akses login.

Empat route mutasi publik kini disebut satu per satu di dokumen agar inventarisnya bisa diaudit,
dan pensiun `bolehEditOutlet()` beserta `keterangan` sebagai penentu hak tulis masuk cakupan MVP.
Success criteria adopsi diberi sumber ukuran (`mitra_outlet_edit_logs.actorType`) sehingga tidak
menunggu telemetri v2.0. Salinan versi asli sebelum penyuntingan disimpan di scratchpad sesi.

## Implementasi akses login operasional Mitra: MVP, v1.1, v1.2 - 11 Agustus 2026

Tiga fase implementasi PRD dikerjakan berurutan. Fase v2.0 (telemetri adopsi, notifikasi foto
jatuh tempo, opsi approval) memang di luar cakupan dan tidak disentuh.

### MVP - fondasi keamanan

- Migrasi `drizzle/0035_admin_salesforce_assignment.sql` menambah
  `admin_user_profiles.salesforce_id` (nullable, UNIQUE, FK ke `mitra_salesforces`
  ON DELETE SET NULL). Aditif murni.
- `src/lib/admin-scope.ts` menjadi satu-satunya sumber aturan wewenang: `getAdminActorScope()`,
  `canAccessOutlet()`, `canMutateOutlet()`, `outletScopeCondition()`, `findOutletInScope()`, dan
  `canAccessParticipant()`. Scope dibaca dari database pada setiap pemanggilan, bukan dari cookie,
  sehingga pencabutan role atau perubahan TAP berlaku pada request berikutnya.
- `getAdminSession()` menutup jalur bootstrap begitu ada satu SUPER_ADMIN aktif, menolak login
  tanpa profil setelah kondisi itu terpenuhi, dan menulis audit `BOOTSTRAP_ACCESS` setiap kali
  jalur itu terpakai. Akun dengan `locked_until` di masa depan diperlakukan sama dengan akun
  nonaktif dan ditolak sebelum peran maupun scope diperiksa.
- `MITRA_DETAIL_SESSION_TTL_MINUTES` diubah dari sepuluh tahun menjadi 30 hari. Endpoint baru
  `/api/admin/mitra/sessions` (GET/DELETE) mendaftar sesi aktif dengan nomor tersamar dan mencabut
  seluruh sesi satu nomor.
- Tulis-OTP ditutup di satu gerbang. `pastikanBolehEdit()` selalu menolak dengan 403 dan kode
  stabil `LOGIN_REQUIRED_FOR_WRITE`. Keempat route mutasi publik (`profile`, `photo`, `location`,
  `branding`) diringkas menjadi penolak murni; logika mutasinya dihapus, bukan disisakan di balik
  satu pemeriksaan, karena jalur tulis yang masih utuh adalah jalur yang bisa hidup lagi tanpa
  disengaja. Riwayatnya tetap ada di git commit `a7fd13a` dan dipakai ulang saat membangun
  endpoint admin di v1.1.
- `bolehEditOutlet()` dan `PERAN_BOLEH_EDIT` dihapus; `SARAN_KETERANGAN` dipertahankan sebagai
  saran isian form. Respons detail publik mengirim `bolehEdit: false` selama masa kompatibilitas
  dan tidak lagi mengirim daftar wilayah.
- Halaman detail publik dicabut seluruh state draft, handler mutasi, dan kontrol editnya. Lencana
  peran menjadi "hanya lihat" dan pemberitahuan mengarahkan ke `/portal-admin`.
- `src/lib/admin-assignment.ts` memvalidasi assignment sebelum akun dibuat atau disunting. Master
  yang sudah tertaut menghasilkan 409 yang menyebut akun pemiliknya, bukan galat unique constraint
  mentah. Form akun menampilkan pemilih master Salesforce, dan akun SALESFORCE tanpa tautan
  ditandai merah pada daftar.

### v1.1 - edit dashboard

- `GET /api/admin/mitra/outlets` dan `/outlets/[id]` sebelumnya hanya membatasi lewat TAP,
  sehingga seorang Salesforce ikut melihat dan membaca performance seluruh outlet binaan rekan
  setimnya. Kondisi salesforce kini ikut masuk query. Pembatasan yang sama diterapkan pada
  `performance`, `photo-gallery`, dan `photo-monitoring`.
- Empat endpoint tersegmentasi baru: PATCH `/outlets/[id]/profile`, `/location`, `/branding`, dan
  POST/DELETE `/outlets/[id]/photos`. Semuanya melewati `gerbangMutasiOutlet()` yang memeriksa
  ulang sesi, role, dan wewenang atas outlet — tidak mengandalkan hasil daftar yang tadi dibuka.
  Outlet di luar wewenang dijawab 404 agar keberadaannya tidak bisa dipetakan; MANAGER dijawab 403
  karena outletnya memang boleh dilihat.
- `src/lib/mitra-outlet-mutations.ts` menyimpan allowlist field per aksi, bukan daftar larangan,
  sehingga kolom baru pada tabel outlet otomatis tertutup sampai sengaja dibuka. Payload yang
  memuat field asing ditolak seluruhnya dengan 400. Setiap perubahan menulis ke
  `mitra_outlet_edit_logs` dan `admin_audit_logs`, keduanya ber-`actorUserId`.
- Kunci notifikasi kunjungan diganti. Satu kunjungan dulu ditandai satu sesi OTP; sesi login
  berumur panjang tidak lagi menandai batas kunjungan, jadi dipakai hash petugas + outlet +
  tanggal yang dipotong 36 karakter mengikuti lebar kolom `session_id`.
- Sidebar menyembunyikan seluruh menu kantor dari role lapangan lewat konstanta `ROLE_KANTOR`, dan
  tautan terbatas tidak lagi tampil sekilas selama role belum diketahui.
- Halaman Database Outlet menamai cakupannya ("Outlet Binaan Saya" / "Outlet TAP Saya"),
  memperingatkan assignment yang belum lengkap, menyembunyikan unggah massal, tambah outlet,
  hapus, dan cetak QR dari role lapangan, serta mengunci kolom master di panel edit. Penyimpanan
  role lapangan diarahkan ke endpoint tersegmentasi, dan status simpan menempel di panel alih-alih
  memakai `alert()` yang hilang begitu ditutup.

### v1.2 - program scoped

- Seluruh endpoint mutasi program sudah menolak role lapangan sejak awal, sehingga tidak ada
  perubahan izin yang diperlukan di sana.
- `GET /api/admin/mitra/programs/[id]` sebelumnya mengirim peserta, pemenang, dan hasil KPI secara
  penuh. Ketiganya kini disaring sebelum respons dibentuk. Parameter program dan aturan
  hadiah/benefit tetap dikirim penuh karena isinya aturan main yang memang perlu diketahui peserta.
- `ProgramParticipantInfo` membawa `salesforceId` (id pembina untuk peserta outlet, id dirinya
  sendiri untuk peserta salesforce) sehingga `canAccessParticipant()` dapat mendelegasikan ke
  `canAccessOutlet()`. Wewenang atas seseorang dan atas outletnya sengaja punya satu definisi agar
  tidak bisa berselisih.
- `ProgramManager` menyembunyikan seluruh kontrol pengelolaan dari role selain SUPER_ADMIN dan
  ADMIN_INPUT, menandai panel dengan "hanya lihat", dan tetap menampilkan Pratinjau Hasil KPI yang
  isinya sudah tersaring server.

### Verifikasi

- `npm test`: 15/15 lulus. Test baru mencakup matriks scope (salesforce versus rekan setim di TAP
  yang sama, supervisor lintas TAP, assignment setengah jadi, manager baca-saja) dan allowlist
  field mutasi.
- `npx tsc --noEmit`: lulus.
- `npm run lint`: bersih; hanya tersisa warning `<img>` lama yang tidak terkait.
- `npm run build`: lulus, empat route outlet tersegmentasi masuk output.

### Belum dikerjakan

- Migrasi `0035` belum dijalankan ke database mana pun.
- Belum ada pengujian runtime. Test yang ditulis hanya menguji logika murni (predikat scope dan
  allowlist), bukan perilaku endpoint terhadap MySQL dan sesi login nyata. Sesuai
  Testing Requirements pada PRD, kelulusan tidak boleh disimpulkan dari TypeScript, ESLint, atau
  build.
- Urutan naik wajib diikuti: migrasi, pembuatan akun, dan verifikasi login seluruh petugas
  dilakukan lebih dulu selagi jalur lama masih hidup, baru build ini dinaikkan. Menaikkan
  sekaligus akan menghentikan pembaruan foto lapangan pada hari yang sama.
