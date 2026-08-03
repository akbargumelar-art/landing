# PRD - Perombakan Total Aplikasi ABK Ciraya

Disusun mengikuti skema PRD di `.agents/skills/prd/SKILL.md`, berdasarkan hasil audit
`docs/audit-2026-08-03.md`, catatan `docs/session.md`, dan diskusi discovery tanggal ini.
Dokumen ini menggantikan `prd.md` (spesifikasi landing page awal) dan `integrasi-landing-page.md`
(spesifikasi integrasi Portal Mitra Outlet) sebagai sumber kebenaran arah produk ke depan. Kedua
dokumen lama tetap disimpan sebagai riwayat, tidak dihapus.

Tanggal: 2026-08-03.

## 1. Executive Summary

**Problem Statement**: Aplikasi tumbuh secara organik dari landing page undian sederhana menjadi
lima modul besar (Beranda/Konten, E-commerce, Kalkulator Cuan, Portal Mitra Outlet, IndiHome)
tanpa pernah diberi lapisan hak akses yang konsisten. Saat ini **setiap akun yang berhasil login
ke `/admin` punya akses penuh yang identik** — tidak ada kolom role sama sekali di tabel `user`
inti. Satu-satunya sistem role yang ada (`mitra_user_profiles.role`: `MANAGER`/`ADMIN`/`LEADER`)
hanya berlaku untuk sebagian endpoint Portal Mitra, tidak punya UI pengelolaan sama sekali, dan
harus di-bootstrap lewat environment variable. Selain itu terdapat dua mesin "program/leaderboard"
yang tumbuh sendiri-sendiri (undian berbasis form submission vs skor performa outlet berbasis
import), halaman Mitra Outlet mencampur database outlet dengan pengelolaan program, whitelist OTP
dan konfigurasi WAHA tersebar di beberapa tempat, dan modul IndiHome punya data banner/lokasi yang
di-hardcode di source code alih-alih dikelola dari database.

**Proposed Solution**: Membangun lapisan Role-Based Access Control (RBAC) bertingkat 6 kategori
yang ditegakkan di server (bukan hanya disembunyikan di UI), menyatukan dua mesin program menjadi
satu modul Program di grup navigasi "Event & Form", memfokuskan ulang halaman Mitra Outlet murni
sebagai database outlet, memindahkan Whitelist OTP ke halaman Pengaturan, memastikan konfigurasi
WAHA hanya bersumber dari Pengaturan, memperluas kontrol admin IndiHome (banner, lokasi, form
langganan), dan menambahkan halaman Kelola User di Super Admin. Modul yang sudah dianggap baik
(Kelola Beranda, Pengaturan dasar, Kalkulator Cuan, E-commerce, Profil Admin) tidak dirombak
strukturnya, hanya disesuaikan agar tunduk pada RBAC baru.

**Success Criteria**:

- Setiap endpoint API admin menegakkan role dan scope wilayah di server side; diverifikasi dengan
  memanggil tiap endpoint memakai akun dari kelima role internal dan memastikan hasil sesuai
  matriks akses di dokumen ini.
- Data production yang sudah ada (outlet, performa, submission undian, pemenang, order
  e-commerce, produk, pengaturan) 100% berhasil di-backfill ke skema baru, dibuktikan dengan
  jumlah baris yang sama sebelum dan sesudah migrasi.
- Hanya ada satu tabel/mesin `programs` yang melayani baik mode undian (form submission + acak
  pemenang) maupun mode performa outlet (import skor + leaderboard); form-undian, admin
  form-builder, dan Program Mitra Outlet lama sama-sama berjalan di atas mesin yang sama.
- Halaman `/admin/mitra` (Portal Mitra Outlet) hanya berisi: database outlet (upload satuan/bulk,
  edit satuan/bulk, hapus), generate & unduh QR, dan ringkasan (summary) — tanpa sub-menu Program.
- Whitelist penerima OTP dan konfigurasi WAHA 100% dikelola dari halaman Pengaturan; halaman
  Whitelist mandiri di Portal Mitra dihapus.
- Admin IndiHome punya CRUD penuh untuk banner/hero, lokasi, dan form langganan — tidak ada lagi
  data yang hanya bisa diubah lewat source code.
- Tersedia halaman Kelola User di Super Admin: buat/edit/nonaktifkan akun, atur role, atur area
  untuk role yang scoped wilayah.
- `npx tsc --noEmit`, lint, dan `npm run build` tetap lulus di akhir setiap fase roadmap (lihat
  Bagian 5).

## 2. User Experience & Functionality

### 2.1 Role dan Definisi Akses

| Role | Deskripsi | Login dashboard? | Scope wilayah |
|---|---|---|---|
| **Admin Super** | Kontrol penuh seluruh modul, termasuk Kelola User, Pengaturan sistem, dan operasi destruktif (hapus, rollback, publish). Menggantikan peran `MANAGER` lama di Portal Mitra yang sebelumnya "full akses". | Ya | Semua wilayah |
| **Admin Input** | Bisa membuat dan mengubah data operasional (submission undian, outlet, produk, order, skor performa, konten program) tetapi tidak bisa membuka Pengaturan sistem, Kelola User, atau melakukan hapus permanen/rollback/publish. | Ya | Semua wilayah (tidak dibatasi area, karena tugasnya input data, bukan pengawasan area) |
| **Manager** | Akses lihat (read-only) ke seluruh data di semua modul dan semua wilayah, tanpa hak ubah/hapus. | Ya | Semua wilayah, view-only |
| **Supervisor** | Lihat data outlet, performa, dan program hanya untuk wilayah/area yang ditugaskan kepadanya. | Ya | Area sendiri, view-only |
| **Salesforce** | Sama seperti Supervisor — lihat data outlet, performa, dan program hanya untuk area yang ditugaskan. Dibedakan dari Supervisor secara label/jenjang organisasi, bukan mekanisme teknis. | Ya | Area sendiri, view-only |
| **Mitra Outlet** | **Tidak** mendapat akun login dashboard. Tetap memakai alur publik scan QR (`/mitra/o/[publicToken]`) + verifikasi OTP WhatsApp untuk melihat detail performa. Sesi OTP terikat ke satu `outletId`, sehingga pemilik outlet secara desain tidak bisa melihat data outlet lain — mekanisme ini sudah berjalan hari ini dan tidak berubah. | Tidak (publik + OTP) | Outlet sendiri saja |

> **Keputusan penamaan**: role `MANAGER` pada tabel `mitra_user_profiles` yang ada sekarang punya
> arti "kontrol penuh Portal Mitra" (kelola whitelist, wilayah, user, publish, rollback). Di
> taksonomi baru ini, wewenang itu berpindah makna ke **Admin Super**, sedangkan nama **Manager**
> dipakai ulang untuk peran baru yang murni *view-all*. Ini bukan penambahan role, tapi
> pendefinisian ulang. Perlu diperhatikan saat migrasi data (Bagian 3.5) agar akun `MANAGER` lama
> di-mapping ke **Admin Super**, bukan ke **Manager** baru.

> **Asumsi teknis (perlu dikonfirmasi saat kickoff implementasi)**: Supervisor dan Salesforce
> memakai mekanisme scoping wilayah yang sama persis — tabel `mitra_user_territories` (akan
> di-generalisasi, lihat 3.2) yang menghubungkan user ke satu atau lebih `mitra_territories`
> (REGION/CLUSTER/AREA). Field bebas `salesforce` yang sudah ada di `mitra_outlets` tetap menjadi
> label informasi outlet (nama salesforce yang memegang outlet tersebut), bukan mekanisme
> pencocokan akses — supaya scoping tetap konsisten dan tidak rapuh terhadap perubahan nama.

### 2.2 Matriks Akses per Modul

`Full` = create/edit/hapus semua data. `Input` = create/edit, tanpa hapus permanen/rollback/publish.
`View-all` = lihat semua wilayah, tanpa ubah. `View-area` = lihat wilayah sendiri saja, tanpa ubah.
`—` = tidak ada akses/menu disembunyikan.

| Modul | Admin Super | Admin Input | Manager | Supervisor | Salesforce |
|---|---|---|---|---|---|
| Kelola Beranda & Konten | Full | Input | View-all | — | — |
| Pengaturan (umum, WAHA, Whitelist OTP) | Full | — | View-all | — | — |
| **Kelola User** (baru) | Full | — | View-all | — | — |
| Program (unifikasi, lihat Bag. 2.4) | Full | Input | View-all | View-area | View-area |
| Form Builder & Data Peserta | Full | Input | View-all | — | — |
| E-commerce (Produk, Voucher, Pesanan) | Full | Input | View-all | — | — |
| Kalkulator Cuan (Master Produk) | Full | Input | View-all | — | — |
| Portal Mitra Outlet — Database Outlet | Full | Input | View-all | View-area | View-area |
| Portal Mitra Outlet — QR & Summary | Full | Input | View-all | View-area | View-area |
| IndiHome (Produk, Banner, Lokasi, Form Langganan) | Full | Input | View-all | — | — |
| Profil Admin (akun sendiri) | Full | Full | Full | Full | Full |
| Audit Log | Full | — | View-all | — | — |

### 2.3 Modernisasi Desain (UI/UX)

**Referensi**: telkomsel.com. Berdasarkan tinjauan desainnya, gaya yang dipakai adalah *card-grid*
modular dengan whitespace lega, tipografi sans-serif tegas (headline besar-bold, body tetap
mudah dibaca), tombol CTA merah solid persegi dengan sudut membulat sedang (bukan pill penuh),
shadow lembut untuk kedalaman tanpa kesan berat, foto produk bersih dikombinasikan dengan
gradient yang dipakai sebagai aksen di hero — bukan mendominasi seluruh halaman — serta header
sticky dengan struktur navigasi yang rapi.

Kondisi desain aplikasi saat ini (`src/app/globals.css`) masih memakai beberapa pola dekoratif
yang sudah terasa dari era desain lama: `wave-divider` (SVG gelombang antar section),
`animate-float`/`animate-float-delayed` (elemen mengambang), dan `gradient-text` yang dipakai
cukup luas. Arah baru menggantinya dengan pendekatan yang lebih bersih dan kontemporer:

| Aspek | Sekarang | Arah Baru |
|---|---|---|
| Pemisah antar section | SVG wave divider | Dihapus; jarak antar section diatur lewat whitespace/spacing, tanpa bentuk dekoratif |
| Animasi | Elemen mengambang (`animate-float`), gradient text dekoratif dipakai luas | Animasi minimal & bertujuan: micro-interaction halus saat hover/scroll, bukan animasi ambient terus-menerus |
| Kartu/Card | Bervariasi antar halaman | Satu sistem card konsisten: shadow lembut, radius sedang, padding lega, dipakai seragam di semua halaman publik |
| Warna | Merah + gradient oranye-merah dipakai cukup dominan | Merah (`#ED0226`) tetap warna brand utama, tapi dipakai strategis: CTA, aksen, highlight — latar mayoritas putih/abu terang seperti telkomsel.com |
| Tipografi | Inter, hierarki standar | Hierarki dipertegas: headline lebih besar & bold untuk judul section/hero, body tetap nyaman dibaca, jarak antar section lebih lega |
| Tombol CTA | Ada varian pill penuh (`btn-pill`) | Tombol solid merah teks putih, radius sedang (bukan pill penuh) mengikuti gaya telkomsel.com, hover state jelas |
| Navigasi | Sticky navbar sudah ada | Dipertahankan strukturnya, disempurnakan konsistensi spacing & typography agar selaras sistem desain baru |

**Cakupan**: berlaku untuk seluruh halaman publik — Beranda, Program (katalog & detail), Lokasi &
Kontak, Belanja (storefront e-commerce), IndiHome, dan profil outlet publik Mitra
(`/mitra`, `/mitra/o/[publicToken]`). Dashboard admin **tidak** diredesain total secara visual —
tetap dense dan fungsional sesuai kebutuhan kerja sehari-hari admin — tapi disesuaikan agar
memakai token warna/radius/tipografi yang sama dari `globals.css`, supaya publik dan dashboard
tidak terasa seperti dua produk berbeda.

**Prinsip desain**:

1. Minimalis & bersih — kurangi elemen dekoratif yang tidak fungsional.
2. Konsisten — satu skala spacing, satu skala radius, satu palet warna di semua halaman publik.
3. Mobile-first — prioritas tampilan smartphone, karena mayoritas trafik datang dari scan QR dan
   share link WhatsApp.
4. Merah Telkomsel tetap jadi identitas brand, dipakai sebagai aksen strategis — bukan gradient
   yang mendominasi seluruh halaman.
5. Whitespace lega antar section dan hierarki tipografi yang tegas, mengikuti pola telkomsel.com.

**Acceptance Criteria tambahan**:

- [ ] `wave-divider` dan animasi mengambang (`animate-float`, `animate-float-delayed`) dihapus
      dari seluruh halaman publik, diganti spacing bersih tanpa bentuk dekoratif.
- [ ] Seluruh tombol CTA di halaman publik memakai satu gaya konsisten (solid merah, radius
      sedang, hover state jelas) — bukan lagi campuran pill dan non-pill.
- [ ] Perbandingan langsung terhadap telkomsel.com dari sisi whitespace, hierarki tipografi,
      pemakaian warna merah sebagai aksen (bukan dominasi), dan gaya card/grid.
- [ ] Tidak ada regresi mobile-responsiveness dibanding desain sekarang — dicek lewat screenshot
      mobile & desktop sebelum rilis, sesuai kebiasaan verifikasi yang sudah tercatat di
      `docs/session.md`.

### 2.4 Unifikasi Program

Kondisi saat ini ada dua mesin yang terpisah total secara skema database:

| | Program undian (lama) | Program Mitra Outlet (lama) |
|---|---|---|
| Cara peserta masuk | Isi form publik (`dynamic_forms` / `form_submissions`) | Diimpor sebagai skor performa per outlet per periode |
| Peserta | Orang (nama, no HP, outlet tempat beli) | Outlet (`mitra_outlets`) |
| Cara menentukan pemenang | Acak manual dari peserta berstatus approved (`winners`) | Hitung total skor berbobot, ranking (`mitra_program_leaderboard`) |
| Tampilan publik | Galeri foto pemenang | Papan peringkat (leaderboard) |

**Keputusan**: kedua mekanisme ini disatukan menjadi **satu tabel/entitas `programs`**, dibedakan
lewat kolom `mode`:

- `UNDIAN` — alur form submission + acak pemenang, memakai `dynamic_forms`/`form_submissions` yang
  sudah ada sebagai mekanisme pendaftaran.
- `PERFORMANCE` — alur import skor outlet + leaderboard, memakai struktur
  `program_params`/`program_participants`/`program_scores`/`program_leaderboard` bergaya Mitra yang
  sudah ada sekarang (dipertahankan strukturnya, hanya dipindah agar merujuk ke `programs` yang
  sudah disatukan).

Field yang spesifik ke tiap mode (untuk `UNDIAN`: `content`, `terms`, `mechanics`, `gallery`,
`prizes`, `thumbnail`; untuk `PERFORMANCE`: `periodStart`, `periodEnd`, `rankingMode`,
`tieBreaker`) tidak perlu memaksakan satu tabel lebar yang penuh kolom kosong — cukup disimpan
sebagai satu kolom `config` bertipe JSON per mode, atau tabel detail 1:1 terpisah
(`program_undian_detail` / `program_performance_detail`) jika tim implementasi lebih memilih
skema ternormalisasi dan tipe-kuat. Kedua pendekatan sama-sama memenuhi kebutuhan produk ini;
pilihan akhir adalah keputusan teknis saat implementasi, bukan bagian yang mengikat dari PRD ini.

Tabel `winners` (undian) dan `mitra_program_winners` (performa) disatukan menjadi satu
`program_winners`, dengan field opsional `submissionId` (dipakai saat `mode = UNDIAN`) dan
`outletId` (dipakai saat `mode = PERFORMANCE`) — persis satu di antara keduanya wajib terisi
sesuai mode program.

**Dampak navigasi admin**: menu "Program Mitra Outlet" yang sekarang ada di halaman
`/admin/mitra/program` **dipindahkan** menjadi bagian dari grup sidebar "Event & Form" bersama
Program & Leaderboard (undian), Form Builder, Data Peserta, dan Undi Pemenang — satu pintu
masuk `/admin/program` untuk mengelola program apa pun modenya. Halaman "Portal Mitra Outlet"
(grup "Layanan & Portal") setelahnya hanya berisi database outlet.

### 2.5 Halaman Mitra Outlet (Refocus)

Halaman `/admin/mitra` dirombak agar **hanya** berisi:

1. **Database Outlet** — tabel outlet dengan pencarian/filter wilayah & status.
2. **Upload data** — import satuan (form tambah 1 outlet) dan bulk (import Excel/CSV, sudah ada
   endpoint `type=outlet` di `api/admin/mitra/imports`, tinggal dipertahankan/disempurnakan).
3. **Edit data** — edit satuan (form per outlet) dan edit bulk (re-import dengan mode update).
4. **Hapus data** — hapus satuan dan hapus massal (dengan konfirmasi, tercatat di audit log).
5. **Generate & unduh QR Code** — QR tunggal per outlet dan QR massal (PDF kartu, kapasitas yang
   sudah ada di `/admin/mitra/qr` dipertahankan).
6. **Summary** — ringkasan jumlah outlet per status/wilayah, aktivitas OTP, kesehatan WAHA
   (menggantikan dashboard ringkasan yang sekarang ada di `/admin/mitra`).

Yang **dipindahkan keluar** dari halaman ini: Program (ke grup Event & Form, lihat 2.4),
Whitelist (ke Pengaturan, lihat 2.6), Performance metric definitions (tetap ada sebagai bagian
dari data outlet/summary, karena itu memang bagian dari "database mitra outlet" sesuai permintaan
poin 6 — bukan bagian dari sistem Program).

**Cakupan data**: sesuai permintaan eksplisit, isi data yang ditampilkan/dikelola tetap memakai
struktur data yang sudah ada di database saat ini (`mitra_outlets`, `mitra_outlet_details`,
`mitra_territories`) — tidak menambah field baru di fase ini kecuali dibutuhkan oleh RBAC (kolom
scope wilayah yang memang sudah ada).

### 2.6 Whitelist OTP dan Konfigurasi WAHA di Pengaturan

- Menu mandiri "Whitelist" di Portal Mitra (`/admin/mitra/whitelist`) **dihapus**; fungsinya
  dipindahkan sebagai satu section baru di halaman Pengaturan: "Whitelist Penerima OTP" dengan
  kemampuan tambah satuan, tambah bulk (import), edit, dan hapus — struktur data
  (`mitra_whitelist_numbers` atau nama barunya) tidak berubah, hanya pindah tempat UI.
- Konfigurasi WAHA untuk OTP **memakai ulang** section "Integrasi & Notifikasi WhatsApp API" yang
  sudah ada di Pengaturan (`wa_gw_session`, `wa_gw_endpoint`, `wa_gw_token`, `wa_gw_template`).
  Tidak perlu form konfigurasi WAHA baru/terpisah untuk OTP; alur permintaan OTP wajib membaca
  dari sumber ini secara konsisten (fallback ke environment variable `WAHA_*` hanya jika field
  Pengaturan kosong, sebagaimana yang sudah berjalan hari ini).

### 2.7 IndiHome — Lebih Customizable

Kondisi sekarang: gambar hero (`/indihome/hero-family.png`) di-hardcode sebagai file statis, dan
daftar lokasi (`INDIHOME_LOCATIONS`) adalah konstanta di kode, bukan data di database. Perombakan:

- **Produk**: dipertahankan (sudah berfungsi, CRUD lewat `indihome_products`).
- **Banner/Hero**: tambah kemampuan upload & ganti gambar hero landing page IndiHome dari admin
  (mendukung minimal 1 gambar aktif; siapkan kolom/tabel agar ke depan bisa multi-banner/slider
  jika dibutuhkan, konsisten dengan pola `hero_slides` yang sudah ada untuk Beranda).
- **Manajemen lokasi**: lokasi (Kota Cirebon, Kab. Cirebon, Kab. Kuningan, dst.) dipindah dari
  konstanta kode menjadi tabel database yang bisa ditambah/diedit/dinonaktifkan lewat admin, agar
  ekspansi wilayah baru tidak perlu deploy ulang kode.
- **Manajemen form langganan**: tetap seperti sekarang (lihat, cari, filter, ubah status,
  hubungi via WhatsApp) — dipertahankan, hanya tunduk RBAC baru (Admin Input boleh ubah status,
  Manager hanya lihat).

### 2.8 Kelola User (Baru)

Halaman baru di bawah Pengaturan atau menu tersendiri "Kelola User", khusus Admin Super:

- Daftar user: nama, email, role, status aktif, wilayah (jika Supervisor/Salesforce), login
  terakhir.
- Tambah user baru: nama, email, password awal (atau tautan set-password), pilih role, pilih
  wilayah (untuk Supervisor/Salesforce).
- Edit user: ubah role, ubah wilayah, aktif/nonaktifkan (bukan hapus permanen, agar riwayat audit
  tetap konsisten), reset password.
- Field dan proteksi login yang sudah ada di `mitra_user_profiles` (`failedLoginAttempts`,
  `lockedUntil`, dst.) dipertahankan dan dipakai untuk seluruh user, bukan hanya user Mitra.

### User Stories

- Sebagai Admin Super, saya ingin membuat akun baru dengan role Supervisor dan menugaskannya ke
  wilayah Kab. Kuningan, supaya dia hanya melihat data outlet di wilayah itu.
- Sebagai Manager, saya ingin melihat seluruh data outlet, program, dan pesanan dari semua
  wilayah tanpa bisa mengubahnya, supaya saya bisa memantau tanpa risiko salah input.
- Sebagai Admin Input, saya ingin menginput hasil skor performa outlet bulanan tanpa perlu akses
  ke Pengaturan sistem, supaya tugas saya terbatas dan aman.
- Sebagai Supervisor wilayah Kota Cirebon, saya ingin membuka halaman Mitra Outlet dan hanya
  melihat outlet-outlet di Kota Cirebon, supaya saya tidak perlu menyaring data wilayah lain.
- Sebagai admin, saya ingin membuat program baru dan memilih mode "Undian" atau "Performa Outlet"
  dari satu halaman yang sama, supaya saya tidak perlu berpindah antar modul berbeda.
- Sebagai admin, saya ingin mengelola whitelist nomor OTP langsung dari halaman Pengaturan,
  supaya saya tidak perlu membuka halaman Mitra Outlet hanya untuk itu.
- Sebagai admin IndiHome, saya ingin mengganti gambar hero dan menambah lokasi baru dari
  dashboard, supaya saya tidak perlu minta bantuan developer setiap ekspansi wilayah.
- Sebagai pemilik outlet, saya tetap scan QR di outlet saya dan verifikasi OTP WhatsApp untuk
  melihat performa outlet saya sendiri — tidak ada perubahan pada alur ini.

### Acceptance Criteria

- [ ] Login dengan akun role apa pun selain Admin Super tidak bisa membuka halaman/endpoint
      Kelola User dan Pengaturan sistem inti (server-side check, dicoba langsung lewat API, bukan
      hanya disembunyikan di UI).
- [ ] Akun Supervisor/Salesforce yang ditugaskan ke satu wilayah hanya menerima data outlet,
      performa, dan program milik wilayah tersebut dari API — dicoba dengan memanggil endpoint
      list outlet/program dan memverifikasi hasil tidak memuat wilayah lain.
- [ ] Membuat program baru dengan mode "Undian" menghasilkan halaman form-builder dan alur acak
      pemenang seperti sekarang; membuat program mode "Performa Outlet" menghasilkan alur
      import skor dan leaderboard seperti sekarang — dari satu menu Program yang sama.
- [ ] Halaman `/admin/mitra` tidak lagi menampilkan sub-menu Program atau Whitelist.
- [ ] Whitelist bisa ditambah satuan, ditambah bulk, diedit, dan dihapus dari halaman Pengaturan.
- [ ] Permintaan OTP berhasil terkirim memakai konfigurasi WAHA dari Pengaturan tanpa perlu
      environment variable tambahan (environment tetap tersedia sebagai fallback).
- [ ] Admin IndiHome bisa mengganti gambar hero dan menambah/menonaktifkan lokasi tanpa deploy
      ulang kode.
- [ ] Data production existing (outlet, performa, submission, winners, order, produk, pengaturan)
      terverifikasi jumlah barisnya sama sebelum/sesudah migrasi skema.
- [ ] `npx tsc --noEmit`, lint, dan `npm run build` lulus di akhir setiap fase.

### Non-Goals

- Tidak mengganti WAHA dengan gateway WhatsApp lain.
- Tidak membangun akun login dashboard untuk pemilik Mitra Outlet — tetap QR + OTP publik.
- Tidak membangun aplikasi mobile native.
- Tidak mengubah workflow deploy (`deploy.sh` + PM2 di VPS) kecuali ada kebutuhan eksplisit baru.
- Tidak me-redesign visual modul yang sudah dianggap baik (Kelola Beranda, Pengaturan dasar,
  Kalkulator Cuan, E-commerce, Profil Admin) — perombakan fokus ke RBAC, unifikasi Program,
  Mitra Outlet, Whitelist/WAHA, IndiHome, dan Kelola User.
- Tidak mengintegrasikan API transaksi core Telkomsel.
- Tidak membangun chatbot percakapan WhatsApp; WAHA tetap dipakai untuk OTP dan notifikasi searah.

## 3. Technical Specifications

### 3.1 Architecture Overview

Tetap Next.js App Router + Drizzle ORM + MySQL + better-auth, tanpa migrasi ke stack lain (tidak
ada indikasi dari diskusi bahwa stack perlu diganti; hanya struktur data dan lapisan otorisasi
yang dirombak). Perubahan besar:

1. **Lapisan RBAC generik** menggantikan `requireMitraAccess` yang sekarang hanya berlaku untuk
   modul Mitra. Fungsi baru `requireRole(allowedRoles, { scopeToTerritory })` dipakai di seluruh
   route admin (Beranda, Pengaturan, Program, E-commerce, Cuan, Mitra Outlet, IndiHome), bukan
   hanya Portal Mitra.
2. **Satu tabel profil user** (`admin_user_profiles`, generalisasi dari `mitra_user_profiles`)
   dengan enum role baru (`SUPER_ADMIN`, `ADMIN_INPUT`, `MANAGER`, `SUPERVISOR`, `SALESFORCE`) —
   `MITRA_OUTLET` sengaja tidak masuk enum ini karena bukan role login (lihat 2.1).
3. **Scoping wilayah generik**: tabel `mitra_user_territories` digeneralisasi menjadi
   `admin_user_territories`, dipakai bersama oleh Supervisor dan Salesforce. Hierarki
   `mitra_territories` (REGION/CLUSTER/AREA) dipertahankan apa adanya.
4. **Program terpadu**: `programs` + `program_winners` disatukan (lihat 2.4); tabel pendukung
   performa (`program_params`, `program_participants`, `program_scores`, `program_leaderboard`)
   dipertahankan strukturnya, hanya FK-nya mengarah ke `programs` yang sudah disatukan.
5. **Whitelist & WAHA config**: tabel whitelist tetap sama, hanya UI-nya pindah ke Pengaturan;
   tidak ada tabel konfigurasi WAHA baru — tetap memakai baris di tabel `settings` yang sudah ada.
6. **IndiHome**: tabel baru untuk lokasi (`indihome_locations`) dan banner
   (`indihome_banners` atau tambah kolom pada `settings`/tabel baru khusus 1 baris aktif),
   menggantikan konstanta `INDIHOME_LOCATIONS` dan file gambar hardcode.

### 3.2 Data Model — Ringkasan Perubahan

| Tabel lama | Perlakuan |
|---|---|
| `mitra_user_profiles` | Diganti nama/digeneralisasi jadi `admin_user_profiles`, enum role diperluas ke 5 role baru, `MANAGER` lama di-mapping ke `SUPER_ADMIN` saat backfill. |
| `mitra_user_territories` | Diganti nama jadi `admin_user_territories`, dipakai lintas role (bukan cuma Leader lama). |
| `programs` (undian) + `mitra_programs` (performa) | Disatukan jadi satu `programs` dengan kolom `mode` (`UNDIAN`/`PERFORMANCE`) + `config` JSON atau tabel detail 1:1 (keputusan teknis implementasi). |
| `winners` (undian) + `mitra_program_winners` (performa) | Disatukan jadi `program_winners` dengan `submissionId`/`outletId` opsional sesuai mode. |
| `dynamic_forms`, `form_fields`, `form_submissions`, `submission_values` | Dipertahankan struktur, FK `programId` mengarah ke `programs` yang sudah disatukan. |
| `mitra_program_params/participants/scores/leaderboard` | Dipertahankan struktur, FK `programId` mengarah ke `programs` yang sudah disatukan. |
| `mitra_whitelist_numbers` (dan tabel OTP terkait) | Tidak berubah struktur, hanya pindah lokasi UI. |
| `INDIHOME_LOCATIONS` (konstanta kode) | Jadi tabel `indihome_locations` (id, name, isActive, sortOrder). |
| Hero IndiHome (file statis) | Jadi tabel/kolom `indihome_banners` atau baris `settings` khusus (imageUrl, headline opsional, isActive). |

### 3.3 Integration Points

| Integrasi | Kebutuhan |
|---|---|
| WAHA NOWEB | Tidak berubah dari implementasi sekarang; satu-satunya sumber konfigurasi adalah section Pengaturan, fallback environment variable dipertahankan untuk kondisi darurat. |
| Better Auth | Tetap dipakai untuk sesi login; ditambah lapisan role di luar better-auth core (via `admin_user_profiles`), sama seperti pola `mitra_user_profiles` sekarang. |
| Drizzle/MySQL | Tetap; migrasi dijalankan lewat `drizzle-kit generate` + `npm run db:migrate` sesuai konvensi `deploy.sh` yang sudah ada. |
| Upload file | Tidak berubah (dipakai lagi untuk banner IndiHome). |

### 3.4 Security & Privacy

- Semua pemeriksaan role dan scope wilayah wajib di server (route handler / middleware), tidak
  boleh hanya menyembunyikan menu di UI.
- Query data yang scoped wilayah (Supervisor/Salesforce) wajib memfilter di level SQL
  (`WHERE territory_id IN (...)`), bukan mengambil semua data lalu memfilter di client/browser.
- Endpoint yang dipindah (Whitelist ke Pengaturan) tetap mempertahankan proteksi keamanan yang
  sudah ada: OTP tetap hash+salt, rate limit per nomor/IP, response generik untuk nomor yang
  tidak terdaftar.
- Audit log (`mitra_audit_logs`, digeneralisasi jadi `admin_audit_logs`) mencatat seluruh aksi
  tulis dari kelima role login, tidak hanya dari Portal Mitra.

### 3.5 Rencana Migrasi Data

Karena data production yang sudah ada wajib dibawa (bukan direset), migrasi dilakukan bertahap
dan reversibel:

1. Backup database production sebelum migrasi apa pun (mengikuti kebiasaan `deploy.sh` yang
   sudah ada).
2. Migrasi skema aditif dulu (tabel/kolom baru ditambahkan berdampingan dengan yang lama).
3. Jalankan script backfill: salin data dari `mitra_user_profiles` ke `admin_user_profiles` dengan
   mapping role lama→baru (`MANAGER`→`SUPER_ADMIN`, `ADMIN`→`ADMIN_INPUT`, `LEADER`→`SUPERVISOR`
   sebagai default awal, bisa disesuaikan manual lewat Kelola User setelahnya); salin
   `mitra_programs`+`programs` ke `programs` baru dengan `mode` yang sesuai; salin `winners` +
   `mitra_program_winners` ke `program_winners`.
4. Verifikasi jumlah baris cocok sebelum dan sesudah.
5. Alihkan kode aplikasi untuk membaca dari tabel baru.
6. Setelah stabil di production untuk satu periode observasi, tabel lama yang sudah sepenuhnya
   digantikan baru dihapus (tidak dihapus di hari yang sama dengan cutover, untuk keamanan
   rollback).

## 4. Cakupan yang Tidak Dirombak (Dipertahankan Apa Adanya)

Sesuai arahan, modul berikut sudah dianggap baik dan hanya perlu tunduk pada RBAC baru tanpa
perombakan struktural:

- Kelola Beranda (hero slides, konten homepage).
- Pengaturan dasar (identitas perusahaan, kontak, sosial media) — hanya ditambah section Kelola
  User dan Whitelist OTP.
- Kalkulator Cuan (kategori, brand, produk).
- E-commerce (Produk, Voucher, Pesanan, Checkout, payment gateway DOKU/Midtrans/Mayar/LynkID).
- Profil Admin.

## 5. Risks & Roadmap

### Fase 0 — Fondasi RBAC & Kelola User (prasyarat semua fase lain)

- Tabel `admin_user_profiles` + `admin_user_territories` (generalisasi dari tabel Mitra).
- Fungsi `requireRole()` generik + terapkan ke seluruh route admin yang sudah ada (bukan hanya
  Mitra) sebagai pengganti pemeriksaan implisit "asal ada sesi berarti boleh akses semua".
- Halaman Kelola User (CRUD user, assign role & wilayah).
- Migrasi/backfill akun Mitra existing ke role baru.

### Fase 1 — Modernisasi Desain UI Publik

- Terapkan sistem desain baru di `globals.css` (hapus `wave-divider`, `animate-float`/
  `animate-float-delayed`, rapikan `gradient-text`/`btn-pill`) sesuai arah di Bagian 2.3.
- Terapkan ke halaman publik: Beranda, Program (katalog & detail), Lokasi & Kontak, Belanja,
  profil outlet publik Mitra.
- Tidak bergantung pada migrasi data/RBAC — dapat dikerjakan paralel dengan Fase 0, asal tidak
  menyentuh logika akses.

### Fase 2 — Refocus Mitra Outlet + Whitelist/WAHA ke Pengaturan

- Halaman `/admin/mitra` dipangkas jadi database outlet + QR + summary saja.
- Whitelist pindah ke Pengaturan (section baru).
- Verifikasi konfigurasi WAHA hanya bersumber dari Pengaturan.

### Fase 3 — Unifikasi Program (paling berisiko, karena migrasi data dua sistem)

Fase ini sengaja dipecah dua langkah karena melibatkan data production yang wajib dibawa
(lihat 3.5). Langkah 3a tidak mengubah perilaku aplikasi sama sekali; langkah 3b baru
mengalihkan kode, dan **hanya boleh dikerjakan setelah 3a diverifikasi terhadap database
sungguhan**.

**Fase 3a — Skema + backfill (SELESAI, tetapi belum diverifikasi terhadap database)**

- Skema terpadu: kolom `mode` (`UNDIAN`/`PERFORMANCE`) plus kolom khusus performance
  (`mechanism_md`, `period_start`, `period_end`, `ranking_mode`, `tie_breaker`, `is_public`)
  ditambahkan ke `programs` sebagai kolom nullable, dan tabel `program_winners` dibuat.
  Dipilih kolom bertipe kuat, bukan satu kolom JSON `config`, supaya `period_start`/`period_end`
  tetap bisa difilter dan diindeks di level SQL.
- Migrasi `drizzle/0004_unified_program_schema.sql` bersifat **aditif murni**: tidak ada
  `DROP`, dan `mitra_programs`, `winners`, serta `mitra_program_winners` tetap utuh sehingga
  langkah ini reversibel. Seluruh statement backfill dibuat aman dijalankan berulang.
- Tabrakan slug ditangani eksplisit. `programs.slug` bersifat UNIQUE, sementara baris undian
  lama dengan `category='mitra'` memang sengaja membayangi program Mitra ber-slug sama
  (halaman `/program` sudah menyaringnya). Pada backfill, baris Mitra memperoleh slug
  kanonik dan baris legacy yang membayangi di-rename (`-undian-legacy`) lalu diarsipkan —
  tidak ada baris yang dihapus.
- `id` dari `mitra_programs` dipertahankan saat disalin ke `programs`, sehingga
  `mitra_program_params`/`participants`/`scores`/`leaderboard` tetap menunjuk id yang valid.
  Pemindahan constraint FK anak ke `programs` menyusul di 3b.
- `scripts/verify-program-migration.mjs` memverifikasi jumlah baris dan integritas
  (acceptance criteria "diverifikasi jumlah baris"), keluar dengan status non-nol bila ada
  yang gagal sehingga bisa dipakai sebagai gerbang sebelum cutover.

**Fase 3b — Cutover kode (BELUM dikerjakan, menunggu verifikasi 3a)**

Prasyarat: `npm run db:migrate` dijalankan pada salinan backup, lalu
`node scripts/verify-program-migration.mjs` lulus seluruhnya.

- Alihkan ±30 file yang membaca/menulis `programs`, `mitra_programs`, `winners`, dan
  `mitra_program_winners` agar memakai tabel terpadu.
- Pindahkan constraint FK `mitra_program_*` ke `programs`.
- Satu halaman admin Program di grup Event & Form untuk kedua mode.
- Uji ulang alur publik: `/program`, `/program/[slug]`, `/form-undian`, `/mitra/program`.
- Tabel lama baru dihapus di Fase 5 setelah periode observasi (lihat 3.5 poin 6).

### Fase 4 — IndiHome Enhancement

- Tabel `indihome_locations` + admin CRUD, ganti pemakaian `INDIHOME_LOCATIONS` konstanta.
- Tabel/kolom banner + admin upload, ganti hero file statis.
- Sesuaikan halaman publik `/indihome` membaca lokasi & banner dari database, memakai sistem
  desain baru dari Fase 1.

### Fase 5 — QA Menyeluruh per Role & Dokumentasi

- Uji manual seluruh matriks akses (Bagian 2.2) dengan akun percobaan per role.
- Perbarui `docs/session.md` dan dokumentasi terkait.
- Hapus tabel lama yang sudah sepenuhnya digantikan (lihat 3.5 poin 6).

### Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Migrasi dua sistem Program jadi satu | Risiko kehilangan/salah mapping data undian atau performa | Migrasi aditif, verifikasi jumlah baris, jalankan di staging/lokal dulu sebelum production |
| RBAC salah terap di satu endpoint | Kebocoran data lintas wilayah atau lintas role | Checklist acceptance criteria per role wajib dicoba manual sebelum rilis fase 0 dianggap selesai |
| Reassignment makna role `MANAGER` lama | Akun existing yang seharusnya jadi Admin Super malah ke-mapping jadi Manager (view-only) | Mapping eksplisit `MANAGER` lama → `SUPER_ADMIN` baru saat backfill, bukan otomatis 1:1 nama |
| Downtime saat migrasi skema besar (Fase 3) | Program/leaderboard tidak bisa diakses sementara | Migrasi di jam non-sibuk, backup wajib, punya rencana rollback ke skema lama bila gagal |
| Data lokasi/banner IndiHome kosong pasca migrasi | Halaman publik IndiHome tampil kosong | Seed data awal dari konstanta lama (`INDIHOME_LOCATIONS`, `hero-family.png`) sebagai baris pertama di tabel baru |
| Desain baru dikerjakan terpisah dari Fase 4 (IndiHome) | Halaman IndiHome baru tampil tidak konsisten dengan sistem desain publik lain | Terapkan token desain dari Fase 1 saat membangun halaman IndiHome baru di Fase 4, bukan memakai gaya lama |

### Final Acceptance Checklist

- [ ] Kelima role internal (Admin Super, Admin Input, Manager, Supervisor, Salesforce) sudah bisa
      dibuat lewat Kelola User dan terverifikasi hak aksesnya sesuai Bagian 2.2.
- [ ] Seluruh halaman publik memakai sistem desain baru (tanpa wave divider/floating blob,
      konsisten dengan arah telkomsel.com di Bagian 2.3), lulus pengecekan mobile & desktop.
- [ ] Alur Mitra Outlet publik (QR + OTP) tidak berubah perilakunya untuk pemilik outlet.
- [ ] Program mode Undian dan mode Performa Outlet berjalan dari satu modul yang sama.
- [ ] Halaman Mitra Outlet hanya berisi database outlet, QR, dan summary.
- [ ] Whitelist dan konfigurasi WAHA terpusat di Pengaturan.
- [ ] IndiHome banner dan lokasi dikelola dari admin, tidak ada lagi hardcode.
- [ ] Data production ter-backfill penuh, diverifikasi jumlah baris.
- [ ] `npx tsc --noEmit`, lint, `npm run build` lulus di akhir tiap fase.
