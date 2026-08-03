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
  database.
