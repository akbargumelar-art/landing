# PRD — Akses Login Operasional Mitra dan OTP Baca-Saja

**Status:** Draft untuk review implementasi

**Tanggal:** 11 Agustus 2026

**Modul:** Portal Mitra, Database Outlet, Monitoring Foto, dan Program Salesforce

**Dokumen terkait:** [`prd-kpi-salesforce.md`](./prd-kpi-salesforce.md), [`qa-role-matrix.md`](./qa-role-matrix.md)

> Dalam dokumen ini, "data yang dilindungi OTP" berarti seluruh data yang saat ini baru
> ditampilkan setelah OTP berhasil diverifikasi. Istilah tersebut tidak berarti password,
> token sesi, secret, atau kredensial login; nilai rahasia autentikasi tidak boleh pernah
> ditampilkan melalui OTP maupun dashboard.

---

## 1. Executive Summary

### Problem Statement

Salesforce perlu memperbarui foto dan data operasional outlet setiap minggu. Alur edit yang
meminta OTP berulang menimbulkan spam WhatsApp, menambah friksi, dan mengandalkan nomor whitelist
sebagai identitas pengubah data. Pada saat yang sama, Supervisor dan Salesforce membutuhkan akses
program yang sesuai dengan tanggung jawab masing-masing tanpa membuka data lintas wilayah atau
lintas petugas.

### Proposed Solution

OTP dipertahankan hanya sebagai kunci **baca-saja** untuk seluruh data terlindungi yang saat ini
memerlukannya. Semua perubahan outlet wajib dilakukan dari dashboard dengan akun Better Auth yang
aktif. Salesforce hanya dapat melihat dan mengubah outlet yang ditugaskan kepada dirinya;
Supervisor dapat melihat dan mengubah outlet dalam TAP yang ditugaskan. Perubahan langsung
tersimpan tanpa alur persetujuan, tetapi seluruh mutasi divalidasi di server dan dicatat dalam
audit log.

### Success Criteria

1. Seratus persen endpoint mutasi publik menolak perubahan meskipun cookie OTP valid.
2. Seratus persen perubahan outlet berhasil hanya bila ada sesi login aktif, role yang diizinkan,
   dan outlet berada dalam scope pengguna.
3. Seluruh skenario akses silang Salesforce, lintas TAP Supervisor, akun nonaktif, dan akun tanpa
   assignment lulus dengan hasil ditolak pada pengujian API.
4. Seratus persen perubahan outlet melalui dashboard mempunyai `actorUserId`, waktu, aksi,
   nilai sebelum, dan nilai sesudah pada audit log.
5. Salesforce dapat menyelesaikan unggah empat kategori foto outlet binaannya tanpa meminta OTP;
   target penerimaan operasional minimal 90% pembaruan mingguan dilakukan lewat akun dalam empat
   minggu pertama setelah rollout. Diukur dari `mitra_outlet_edit_logs` dengan membandingkan jumlah
   baris `actorType = ADMIN` terhadap total baris pada rentang minggu tersebut — sumber ini sudah
   tersedia sejak MVP, jadi kriteria ini tidak menunggu telemetri v2.0.

---

## 2. User Experience & Functionality

### User Personas

| Persona | Kebutuhan | Batas utama |
|---|---|---|
| Pemegang nomor OTP | Melihat data outlet atau program yang dilindungi OTP | Baca-saja; tidak dapat mengubah data apa pun |
| Salesforce | Memelihara outlet binaan dan melihat pencapaian program sendiri | Hanya outlet dengan `salesforce_id` miliknya dan berada dalam TAP yang ditugaskan |
| Supervisor | Memelihara outlet dan memonitor program di wilayah tanggung jawab | Hanya outlet/Salesforce dalam TAP yang ditugaskan |
| Manager | Melihat data operasional dan program lintas TAP | Baca-saja kecuali mendapat role lain melalui perubahan kebijakan terpisah |
| Admin Input | Mengelola data operasional, import, dan aktivitas program | Seluruh data, sesuai permission endpoint yang sudah ada |
| Super Admin | Mengelola seluruh data, akun, role, assignment, dan konfigurasi | Seluruh sistem |

### Matriks Hak Akses

| Kapabilitas | OTP | Salesforce | Supervisor | Manager | Admin Input | Super Admin |
|---|---:|---:|---:|---:|---:|---:|
| Lihat data terlindungi OTP | Ya | Sesuai scope | Sesuai TAP | Semua | Semua | Semua |
| Lihat daftar/detail outlet dashboard | Tidak | Outlet binaan sendiri | TAP ditugaskan | Semua | Semua | Semua |
| Edit profil operasional outlet | Tidak | Outlet binaan sendiri | TAP ditugaskan | Tidak | Semua | Semua |
| Edit lokasi, branding, dan foto | Tidak | Outlet binaan sendiri | TAP ditugaskan | Tidak | Semua | Semua |
| Ubah Sellthru Digipos/Nota/Recharge dari form outlet | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Import Sellthru Digipos/Nota/Recharge | Tidak | Tidak | Tidak | Tidak | Ya | Ya |
| Ubah field master/assignment | Tidak | Tidak | Tidak | Tidak | Sesuai endpoint saat ini | Ya |
| Lihat program Salesforce | Baca-saja setelah OTP | Hasil sendiri | Data TAP ditugaskan | Semua | Semua | Semua |
| Konfigurasi/import/recompute program | Tidak | Tidak | Tidak | Tidak | Sesuai endpoint saat ini | Ya |
| Kelola akun dan assignment | Tidak | Tidak | Tidak | Tidak | Tidak | Ya |

### Definisi Scope

- **Salesforce:** outlet harus memenuhi kedua kondisi berikut:
  `outlet.salesforce_id = session.adminProfile.salesforce_id` dan `outlet.tap` termasuk TAP akun.
- **Supervisor:** `outlet.tap` harus termasuk salah satu TAP akun.
- **Manager, Admin Input, Super Admin:** tidak dibatasi TAP, tetapi kemampuan edit tetap mengikuti
  matriks role.
- Akun `SALESFORCE` tanpa `salesforce_id`, akun scoped tanpa TAP, akun nonaktif, atau assignment
  yang tidak konsisten mendapatkan daftar kosong untuk koleksi dan penolakan untuk detail/mutasi.
- Pemeriksaan scope wajib dilakukan sebelum agregasi, filter, pagination, ekspor, atau pembentukan
  respons agar jumlah ringkasan tidak membocorkan data di luar scope.

### Field yang Boleh Diedit Salesforce dan Supervisor

| Kelompok | Field |
|---|---|
| Profil operasional | `name`, `ownerName`, `ownerPhone`, `kabupaten`, `kecamatan`, `category`, `pjpDay`, `pjpType` |
| Lokasi | `latitude`, `longitude`, `locationUrl` |
| Branding | `branding` |
| Foto | `photoUrl`, `photoEtalaseUrl`, `photoPopTelkomselUrl`, `photoPopKompetitorUrl` beserta waktu pembaruannya |

Field berikut **tidak boleh** diubah oleh Salesforce atau Supervisor: `id`, `outletCode`,
`publicToken`, `rsNumber`, `tap`, `salesforceId`, `status`, data performance, target KPI, skor KPI,
konfigurasi program, peserta program, aturan benefit, dan data audit.

Tiga grup performance `sellthruDigiposJson`, `sellthruNotaJson`, dan `rechargeDigiposJson` selalu
baca-saja pada form Database Outlet untuk **semua role**, termasuk Admin Input dan Super Admin.
Data tersebut hanya diperbarui melalui jalur **Upload Data/import** khusus yang dibatasi untuk
Admin Input dan Super Admin. Endpoint edit satu outlet tidak boleh menerima ketiga grup tersebut.

### User Stories dan Acceptance Criteria

#### US-1 — Melihat data dengan OTP tanpa kemampuan edit

Sebagai pemegang nomor yang valid, saya ingin membuka data terlindungi dengan OTP agar dapat
melihat informasi yang dibutuhkan tanpa dapat mengubah sumber data.

Acceptance criteria:

- Setelah OTP valid, data yang sebelumnya dilindungi OTP tetap dapat dibaca sesuai kontrak saat ini.
- UI publik tidak menampilkan tombol edit profil, lokasi, branding, atau unggah/hapus foto.
- Respons detail publik tidak mengirim `bolehEdit: true`; field dihapus atau selalu `false` selama
  masa kompatibilitas.
- Permintaan `POST`, `PUT`, `PATCH`, atau `DELETE` dengan hanya sesi OTP selalu ditolak di server.
- Penolakan tidak berubah menjadi berhasil walaupun nomor whitelist berisi keterangan Salesforce,
  Supervisor, Manager, atau status lama lain yang sebelumnya mengizinkan edit.

#### US-2 — Salesforce masuk dan mengelola outlet binaan

Sebagai Salesforce, saya ingin login sekali dan memperbarui data operasional outlet binaan agar
pekerjaan mingguan tidak memicu OTP berulang.

Acceptance criteria:

- Akun login ditautkan ke tepat satu record master Salesforce.
- Daftar, pencarian, ringkasan foto, ekspor yang diizinkan, dan detail hanya menggunakan outlet
  binaan Salesforce tersebut dalam TAP akun.
- Salesforce dapat menyimpan field operasional yang diizinkan tanpa OTP.
- Akses melalui ID outlet milik Salesforce lain menghasilkan `404` agar keberadaan record tidak
  dapat ditebak.
- Perubahan pada field master yang dilarang menghasilkan `403` atau validasi `400` dan tidak
  mengubah sebagian data.

#### US-3 — Supervisor mengelola outlet dalam TAP

Sebagai Supervisor, saya ingin melihat dan memperbarui outlet dalam TAP tanggung jawab agar dapat
menjaga kualitas data lapangan.

Acceptance criteria:

- Supervisor dapat mempunyai satu atau lebih TAP.
- List, detail, ringkasan, monitoring foto, dan ekspor hanya menghitung data dari TAP tersebut.
- Supervisor dapat menyimpan field operasional yang diizinkan dan hasilnya langsung berlaku tanpa
  approval.
- Akses detail/mutasi outlet di luar TAP menghasilkan `404`.

#### US-4 — Melihat data program sesuai tanggung jawab

Sebagai Salesforce atau Supervisor, saya ingin melihat data program yang relevan agar dapat
menindaklanjuti pencapaian tanpa melihat data yang bukan tanggung jawab saya.

Acceptance criteria:

- Salesforce melihat program yang aktif/relevan dan hanya hasil, parameter, benefit, serta outlet
  pencapaian miliknya sendiri.
- Supervisor melihat agregat TAP, Salesforce, benefit, dan outlet pencapaian hanya pada TAP yang
  ditugaskan.
- Endpoint detail program tidak mengirim peserta, pemenang, hasil KPI, atau skor di luar scope.
- Dashboard untuk kedua role bersifat read-only: tombol konfigurasi, import, reset, recompute,
  publish winner, dan edit benefit tidak dirender dan tetap ditolak di API bila dipanggil manual.
- Manager dapat melihat seluruh data program tetapi tetap tidak memperoleh hak mutasi baru.

#### US-5 — Super Admin mengelola akun dan assignment

Sebagai Super Admin, saya ingin membuat akun dan menetapkan identitas Salesforce/TAP agar scope
akses dapat dikelola tanpa perubahan kode.

Acceptance criteria:

- Form user menampilkan pemilih master Salesforce saat role `SALESFORCE` dipilih.
- Role `SALESFORCE` tidak dapat disimpan tanpa tepat satu `salesforce_id` dan minimal satu TAP.
- Role `SUPERVISOR` tidak dapat disimpan tanpa minimal satu TAP dan tidak memakai `salesforce_id`.
- Satu master Salesforce hanya dapat ditautkan ke tepat satu akun (lihat §Model Data); penggantian
  pemegang dilakukan dengan memindahkan tautan pada akun tersebut, bukan menambah akun baru.
- Percobaan menautkan master yang sudah terpakai ditolak dengan pesan yang menyebut akun pemilik
  tautan saat ini, agar Super Admin tahu akun mana yang harus disunting.
- Perubahan role, Salesforce, TAP, status aktif, dan reset password tercatat di audit log.

### Alur Pengguna

#### Alur OTP baca-saja

1. Pengguna membuka profil outlet atau program publik.
2. Pengguna meminta dan memverifikasi OTP melalui mekanisme yang ada.
3. Server membuat sesi detail yang terikat pada outlet/program.
4. Halaman menampilkan data terlindungi tanpa kontrol edit.
5. Setiap percobaan mutasi diarahkan ke pesan: **“Untuk mengubah data, silakan masuk menggunakan
   akun Salesforce atau Supervisor.”**

#### Alur login Salesforce/Supervisor

1. Pengguna masuk melalui `/portal-admin` menggunakan email dan password.
2. Server memvalidasi sesi Better Auth, profil aktif, role, `salesforce_id` bila diperlukan, dan TAP.
3. Pengguna diarahkan ke dashboard Mitra dengan menu yang sesuai role.
4. Query koleksi dibatasi scope di server; UI hanya menampilkan data hasil scope tersebut.
5. Saat menyimpan, server mengulang pemeriksaan role, scope, dan allowlist field.
6. Perubahan dilakukan atomik dan ditulis ke log perubahan serta audit admin.

### Non-Goals

- Memberikan akses SQL/MySQL langsung kepada Salesforce atau Supervisor.
- Mengizinkan pemilik outlet mengubah data melalui OTP.
- Menambahkan workflow persetujuan Supervisor pada MVP.
- Mengubah rumus KPI, target, benefit, atau mekanisme Racing/Reward.
- Menyediakan edit manual Sellthru Digipos, Sellthru Nota, atau Recharge Digipos pada form outlet.
- Memberikan hak konfigurasi/import program kepada Salesforce, Supervisor, atau Manager.
- Membangun aplikasi mobile native, SSO perusahaan, atau login menggunakan OTP.
- Menampilkan password, hash, secret, token sesi, kode OTP, atau kredensial sistem lainnya.

---

## 3. AI System Requirements (If Applicable)

Tidak berlaku. Fitur ini tidak menggunakan model AI, prompt, agent, retrieval, atau keputusan
otomatis berbasis AI. Seluruh otorisasi harus deterministik berdasarkan sesi, role, assignment,
dan relasi database; AI tidak boleh menentukan hak akses.

---

## 4. Technical Specifications

### Architecture Overview

```text
OTP/WhatsApp -> sesi detail outlet/program -> endpoint GET publik -> tampilan baca-saja

Email+password -> Better Auth session -> admin profile + TAP + salesforce_id
               -> server-side scope resolver
               -> endpoint GET/PUT admin tersegmentasi
               -> transaction database + audit log
```

Prinsip utama:

- OTP membuktikan hak **melihat**, bukan identitas aktor yang boleh mengubah data.
- Sesi login aktif dan profil admin adalah satu-satunya dasar mutasi.
- Pembatasan dilakukan di query/API, bukan hanya dengan menyembunyikan menu atau tombol.
- Endpoint edit memakai ID internal outlet setelah sesi login; `publicToken` tidak menjadi
  credential mutasi.

### Integration Points

| Sistem/komponen | Peran dalam fitur |
|---|---|
| Better Auth | Login email/password, cookie sesi, perubahan/reset password |
| `admin_user_profiles` dan `admin_user_taps` | Role, status akun, identitas Salesforce, dan assignment TAP |
| `mitra_salesforces` dan `mitra_outlets` | Relasi petugas dengan outlet binaan serta sumber pembatasan scope |
| OTP/WAHA dan `mitra_detail_sessions` | Membuka data outlet/program publik dalam mode baca-saja |
| API admin Mitra | Seluruh list, detail, edit operasional, program, monitoring, dan ekspor scoped |
| `mitra_outlet_edit_logs` dan `admin_audit_logs` | Jejak aktor login, aksi, dan perubahan data |
| Penyimpanan/proses upload yang ada | Validasi dan penyimpanan empat kategori foto outlet |

### Model Data

Tambahkan relasi nullable berikut pada `admin_user_profiles`:

```text
salesforce_id VARCHAR(36) NULL
  FK -> mitra_salesforces.id ON DELETE SET NULL
  UNIQUE
  INDEX
```

Aturan aplikasi:

- `role = SALESFORCE` mensyaratkan `salesforce_id` tidak null dan minimal satu row
  `admin_user_taps`.
- Role selain `SALESFORCE` menyimpan `salesforce_id = NULL`.
- `role = SUPERVISOR` mensyaratkan minimal satu row `admin_user_taps`.
- **Satu master Salesforce tertaut ke tepat satu akun, bukan "satu akun aktif".** UNIQUE pada
  kolom ini ditegakkan database, sehingga berlaku untuk seluruh baris — termasuk akun yang sudah
  dinonaktifkan. MySQL tidak mengenal partial/filtered unique index, jadi aturan "satu aktif" tidak
  bisa diwakili constraint ini. Konsekuensi operasionalnya disengaja: mengganti pemegang akun
  dilakukan dengan **memindahkan tautan pada akun yang sudah ada** (ubah email/nama/password, atau
  lepas `salesforce_id` lebih dulu), bukan membuat akun kedua untuk master yang sama. Membuat akun
  baru tanpa melepas tautan lama akan ditolak database, dan itu memang perilaku yang diinginkan —
  penolakan keras lebih aman daripada dua akun hidup atas satu identitas petugas.
- Penghapusan/nonaktif master Salesforce menyebabkan akun terkait gagal memperoleh scope sampai
  Super Admin memperbaiki assignment.
- Migrasi bersifat aditif; data user lama tidak dihubungkan otomatis. Super Admin harus melakukan
  assignment eksplisit sebelum akun Salesforce diaktifkan.

### Authorization Service

Sediakan helper terpusat, misalnya:

```ts
getAdminActorScope(): {
  userId: string;
  role: AdminRole;
  taps: string[];
  salesforceId: string | null;
}

canAccessOutlet(scope, outlet): boolean
requireOutletMutationAccess(scope, outlet, action): void
```

Semua endpoint outlet, monitoring foto, ekspor, dan program memakai helper yang sama. Implementasi
tidak boleh menduplikasi pemeriksaan role dalam bentuk yang mudah berbeda antar-route.

### API Contract

#### Endpoint publik

| Endpoint | Kebijakan baru |
|---|---|
| `GET /api/public/mitra/outlets/[publicToken]/detail` | Tetap memakai sesi OTP dan hanya membaca data |
| `GET /api/public/mitra/outlets/[publicToken]/odp` | Tetap OTP-bound dan baca-saja |
| `GET /api/public/mitra/programs/[slug]` | Tetap OTP-bound dan baca-saja |
| `POST /api/public/mitra/outlets/[publicToken]/profile` | Dinonaktifkan; tidak menerima OTP sebagai izin edit |
| `POST /api/public/mitra/outlets/[publicToken]/photo` | Dinonaktifkan; tidak menerima OTP sebagai izin edit |
| `POST /api/public/mitra/outlets/[publicToken]/location` | Dinonaktifkan; tidak menerima OTP sebagai izin edit |
| `POST /api/public/mitra/outlets/[publicToken]/branding` | Dinonaktifkan; tidak menerima OTP sebagai izin edit |

Keempat baris `POST` di atas adalah **inventaris lengkap** method mutasi publik per 11 Agustus 2026
(seluruhnya `POST`; tidak ada `PUT`/`PATCH`/`DELETE` publik). Mitigasi risiko "route edit OTP lama
terlupa" bergantung pada kelengkapan daftar ini, jadi daftar wajib diverifikasi ulang dengan
menelusuri seluruh `export async function POST|PUT|PATCH|DELETE` di bawah `src/app/api/public/`
sebelum release gate dinyatakan lulus.

Bersamaan dengan penonaktifan route, evaluator izin edit berbasis OTP ikut dipensiunkan:
`bolehEditOutlet()`, pembacaan `mitra_whitelist_numbers.keterangan` sebagai penentu hak tulis, serta
field respons `bolehEdit` dan `peranPengakses`. Membiarkan fungsi penilai "boleh edit" tetap hidup
adalah justru cara jalur lama kembali diam-diam saat ada route baru yang memanggilnya.

Selama masa kompatibilitas, route mutasi lama boleh mengembalikan `403` dengan kode stabil
`LOGIN_REQUIRED_FOR_WRITE`. Setelah seluruh UI lama tidak memanggilnya, route dapat dihapus dan
menghasilkan `405 Method Not Allowed`. Tidak boleh ada fase ketika cookie OTP masih dapat menulis.

#### Endpoint admin

Gunakan endpoint mutasi tersegmentasi agar role lapangan tidak memperoleh kemampuan `PUT` master
outlet secara penuh:

| Endpoint | Method | Role dan scope |
|---|---|---|
| `/api/admin/mitra/outlets` | `GET` | Semua role admin; hasil mengikuti scope |
| `/api/admin/mitra/outlets/[id]` | `GET` | Semua role admin; detail mengikuti scope |
| `/api/admin/mitra/outlets/[id]/profile` | `PATCH` | Salesforce sendiri, Supervisor TAP, Admin Input, Super Admin |
| `/api/admin/mitra/outlets/[id]/location` | `PATCH` | Salesforce sendiri, Supervisor TAP, Admin Input, Super Admin |
| `/api/admin/mitra/outlets/[id]/branding` | `PATCH` | Salesforce sendiri, Supervisor TAP, Admin Input, Super Admin |
| `/api/admin/mitra/outlets/[id]/photos` | `POST`/`DELETE` | Salesforce sendiri, Supervisor TAP, Admin Input, Super Admin |
| `/api/admin/mitra/outlets/[id]` | `PUT` | Tetap untuk pengelola master; tidak menerima grup Sellthru/Recharge |
| `/api/admin/mitra/imports` | `POST` | Satu-satunya jalur tulis grup Sellthru/Recharge; Admin Input dan Super Admin |
| `/api/admin/mitra/programs/[id]` | `GET` | Data difilter menurut role/scope sebelum respons dibentuk |

Endpoint harus menolak field tak dikenal dan menggunakan allowlist eksplisit per aksi. Validasi
scope dilakukan lagi pada setiap mutasi, bukan mengandalkan hasil list sebelumnya.

### Program Data Scoping

- Query program membatasi peserta dan hasil sebelum serialisasi.
- Untuk Salesforce, `participant.salesforce_id`, hasil KPI, target yang boleh dilihat, benefit,
  serta outlet score harus sama dengan `scope.salesforceId`.
- Untuk Supervisor, Salesforce dan outlet harus mempunyai `tap` yang termasuk `scope.taps`.
- Ringkasan TAP dihitung ulang hanya dari subset yang boleh dilihat pengguna.
- Data `participants`, `winners`, `kpiResults`, detail outlet, dan angka total tidak boleh diambil
  penuh lalu sekadar disembunyikan di React.
- **Pembagian kewenangan dokumen, agar tidak saling menunjuk:** apa yang boleh dilihat di
  **halaman publik ber-OTP** diatur `prd-kpi-salesforce.md` (termasuk saklar `kpi_hide_punishment`);
  apa yang boleh dilihat dan diubah di **dashboard setelah login** diatur PRD ini. Banner pada
  dokumen KPI yang menyatakan PRD ini mengungguli dirinya berlaku khusus untuk autentikasi,
  otorisasi, dan mutasi data — bukan untuk ruang lingkup tampilan publik.
- Public OTP view mempertahankan kontrak baca yang ada; satu-satunya perubahan publik dalam PRD ini
  adalah hilangnya seluruh kontrol edit dan pemberlakuan TTL sesi OTP.

### UI Requirements

- Sidebar hanya menampilkan Database Outlet, Monitoring Foto, dan Program Salesforce kepada role
  yang relevan; menu konfigurasi lain tidak boleh muncul hanya karena pengguna sudah login.
- Halaman Database Outlet menggunakan mode field-level edit sesuai matriks, dengan label
  **“Outlet binaan saya”** untuk Salesforce dan **“Outlet TAP saya”** untuk Supervisor.
- Halaman Program Salesforce mempunyai mode read-only untuk Salesforce, Supervisor, dan Manager.
- Tombol simpan menampilkan status berhasil/gagal yang tidak hilang sebelum dibaca pengguna.
- UI publik setelah OTP tidak merender form, tombol edit, kontrol unggah, atau handler mutasi.
- Respons `403 LOGIN_REQUIRED_FOR_WRITE` dari bookmark/build lama menampilkan tautan ke
  `/portal-admin`, bukan meminta OTP ulang.

### Security & Privacy

- Better Auth session cookie wajib `HttpOnly`, `Secure` pada production, dan `SameSite=Lax` atau
  lebih ketat sesuai alur aplikasi.
- Akun nonaktif dan akun terkunci ditolak sebelum pemeriksaan scope. **Penguncian belum berjalan
  hari ini:** kolom `failed_login_attempts`, `last_failed_login_at`, dan `locked_until` sudah ada di
  `admin_user_profiles`, tetapi tidak pernah dibaca kode mana pun — `requireRole()` hanya memeriksa
  `isActive`. Penegakan lockout karena itu adalah pekerjaan baru pada MVP, bukan perilaku yang
  tinggal dipakai.
- **Eskalasi bootstrap wajib ditutup.** `getAdminSession()` saat ini memberi `SUPER_ADMIN` kepada
  pengguna login yang **tidak punya baris** `admin_user_profiles` selama emailnya cocok dengan email
  bootstrap — yang jatuh ke nilai bawaan terdokumentasi `admin@abkciraya.com`. Selama jalur ini
  terbuka, seluruh matriks role di dokumen ini bisa dilewati tanpa assignment apa pun. MVP wajib:
  (a) menonaktifkan eskalasi begitu ada minimal satu profil `SUPER_ADMIN` di database, (b) menolak
  login tanpa profil setelah kondisi itu terpenuhi, dan (c) menulis audit log setiap kali jalur
  bootstrap dipakai.
- **Sesi OTP wajib punya masa berlaku.** Nilai berjalan `MITRA_DETAIL_SESSION_TTL_MINUTES` setara
  sepuluh tahun, sehingga kunci baca praktis tidak pernah kedaluwarsa dan ikut berpindah bersama
  nomor yang berganti tangan. Menjadikan OTP baca-saja tidak menghilangkan risiko ini — data yang
  dibaca tetap data pribadi outlet. Tetapkan TTL wajar (usulan 30 hari) dan sediakan pencabutan
  sesi per nomor oleh Super Admin.
- Password awal minimal delapan karakter mengikuti baseline, tetapi implementasi harus menyediakan
  perubahan password pertama, reset oleh Super Admin, rate limit login, dan penegakan lockout
  sebagaimana dijelaskan di butir pertama.
- API mengembalikan `404` untuk ID outlet/program di luar scope guna mengurangi enumerasi.
- Upload foto mempertahankan validasi MIME, ukuran, nama file aman, dan pemrosesan gambar yang ada.
- Audit log tidak boleh menyimpan password, OTP, cookie, token, secret, atau isi file mentah.
- Nomor telepon pada log publik tetap disamarkan; dashboard audit penuh hanya untuk Super Admin.
- Pencabutan role, penonaktifan akun, atau perubahan assignment berlaku pada request berikutnya;
  tidak menunggu pengguna logout.

### Audit Contract

Setiap mutasi outlet wajib menghasilkan:

| Field | Isi |
|---|---|
| `actorType` | `ADMIN` |
| `actorUserId` | ID user Better Auth |
| `outletId` | ID outlet target |
| `action` | `PROFILE`, `LOCATION`, `BRANDING`, atau `PHOTO` |
| `beforeJson` / `afterJson` | Hanya field yang berubah; data rahasia diredaksi |
| `ip` / `createdAt` | Metadata request dan waktu server |

Riwayat lama dengan `actorType = MITRA` tetap dipertahankan untuk audit historis, tetapi tidak ada
mutasi baru yang boleh menghasilkan aktor OTP/MITRA.

### Testing Requirements

#### Unit dan integration test minimum

- Matriks `canAccessOutlet` untuk seluruh role, assignment, akun tanpa TAP, dan akun tanpa
  `salesforce_id`.
- Salesforce A tidak dapat membaca atau mengubah outlet Salesforce B dalam TAP yang sama.
- Supervisor TAP A tidak dapat membaca, mengubah, menghitung ringkasan, atau mengekspor TAP B.
- Sesi OTP valid dapat `GET` detail tetapi gagal pada setiap method mutasi.
- Sesi login tanpa OTP dapat mengubah field yang diizinkan dalam scope.
- Payload gabungan field diizinkan dan field master ditolak atomik tanpa partial write.
- Payload `PUT` outlet yang menyertakan grup Sellthru/Recharge ditolak `400` dan tidak mengubah
  `mitra_outlet_details`; pembaruan hanya berhasil melalui import admin khusus.
- Program detail tidak mengandung participant/result/winner lintas scope.
- Audit log tercipta untuk sukses dan tidak tercipta sebagai perubahan sukses untuk request gagal.

#### Runtime smoke test minimum

1. Buat dua akun Salesforce dalam TAP yang sama dan masing-masing minimal satu outlet.
2. Buat satu Supervisor TAP terkait dan satu Supervisor dari TAP berbeda.
3. Verifikasi list, direct URL, edit profil, edit lokasi, branding, empat slot foto, program, dan
   ekspor untuk setiap akun.
4. Verifikasi OTP outlet dan program masih bisa membaca data tetapi seluruh kontrol/API edit gagal.
5. Nonaktifkan akun saat sesinya masih ada dan pastikan request berikutnya ditolak.
6. Periksa audit log dan pastikan tidak ada OTP/password/token dalam payload.

Pengujian runtime belum dapat dianggap lulus hanya dari TypeScript, ESLint, atau build; MySQL dan
session login nyata harus aktif.

---

## 5. Risks & Roadmap

### Phased Rollout

| Fase | Ruang lingkup | Exit criteria |
|---|---|---|
| MVP — Fondasi keamanan | Migrasi `salesforce_id`, assignment akun, scope helper, penegakan lockout, penutupan eskalasi bootstrap, TTL sesi OTP, OTP read-only, nonaktifkan mutasi publik | Seluruh test negatif lintas scope dan mutasi OTP lulus **dan** setiap Salesforce/Supervisor aktif sudah punya akun yang terbukti bisa login |
| v1.1 — Edit dashboard | UI outlet scoped, endpoint profile/location/branding/photos, audit lengkap, menu role-aware | Salesforce dan Supervisor menyelesaikan smoke test end-to-end |
| v1.2 — Program scoped | Mode read-only program dan filtering peserta/hasil/agregat di server | Tidak ada data lintas SF/TAP pada API maupun ekspor |
| v2.0 — Operasional lanjutan | Telemetri adopsi, notifikasi foto jatuh tempo, opsi approval bila kelak diperlukan | Evaluasi setelah empat minggu penggunaan |

Urutan deployment wajib: backup database → review migrasi → migrate staging → seed/assignment akun
uji → test matriks role → deploy aplikasi → assignment akun production → monitoring audit. Tidak
boleh menjalankan seed yang membangun ulang data contoh pada production.

#### Urutan aman penonaktifan tulis-OTP

Dokumen ini melarang adanya fase ketika cookie OTP masih dapat menulis, sehingga tidak ada periode
transisi yang bisa dipakai sebagai penyangga. Konsekuensinya penyangga harus dipindah ke **sebelum**
rilis, bukan sesudahnya:

1. Migrasi `salesforce_id` dan pembuatan seluruh akun Salesforce/Supervisor dinaikkan lebih dulu,
   selagi jalur OTP lama **masih berfungsi**. Tahap ini tidak mengubah perilaku apa pun bagi
   pengguna lapangan.
2. Setiap akun diverifikasi benar-benar dapat login dan melihat outlet yang benar. Daftar
   verifikasi ini adalah exit criteria MVP, bukan formalitas.
3. Penonaktifan mutasi publik baru dinaikkan setelah langkah 2 tuntas untuk **seluruh** petugas
   aktif — bukan sebagian.

#### Rollback

| Pemicu | Tindakan |
|---|---|
| Ada petugas aktif yang tidak bisa login pada hari rilis | Kembalikan build ke versi sebelum penonaktifan mutasi publik; migrasi dan akun **tidak** perlu di-rollback karena bersifat aditif |
| Scope salah sehingga outlet orang lain terlihat | Nonaktifkan akun terdampak lewat `isActive`, jangan menunggu deploy perbaikan |
| Migrasi gagal di production | Pulihkan dari backup pra-migrasi; seluruh perubahan skema aditif sehingga build lama tetap jalan di atas skema baru |

Karena migrasi hanya menambah kolom dan tabel, rollback aplikasi tidak menuntut rollback database —
itu properti yang perlu dijaga saat implementasi, dan menjadi alasan mengapa tidak ada kolom lama
yang boleh diubah tipe atau dihapus pada MVP.

### Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Menambah role ke endpoint `PUT` outlet lama | Salesforce/Supervisor dapat mengubah master dan assignment | Gunakan endpoint aksi tersegmentasi dengan allowlist field |
| Pembatasan hanya di UI | API tetap dapat dipanggil manual untuk data lintas scope | Terapkan scope di query server dan test direct-ID |
| Akun Salesforce hanya dibatasi TAP | Satu petugas dapat mengedit outlet petugas lain | Wajibkan relasi unik `admin_user_profiles.salesforce_id` |
| Program difilter setelah respons dibentuk | Nama, benefit, atau agregat lintas TAP bocor | Filter di query sebelum agregasi dan serialisasi |
| Route edit OTP lama terlupa | OTP tetap dapat mengubah sebagian data | Inventarisasi seluruh method mutasi publik dan test kontrak otomatis |
| Assignment TAP/Salesforce berubah | Hak akses lama bertahan dalam sesi | Baca profil/assignment server-side pada setiap request sensitif |
| MySQL/migrasi belum diuji | Login dan scope tampak lulus statik tetapi gagal runtime | Wajib migrate dan smoke test pada database hidup sebelum production |
| Eskalasi bootstrap masih terbuka | Pengguna tanpa profil admin memperoleh `SUPER_ADMIN` dan melewati seluruh matriks role | Matikan jalur bootstrap begitu ada profil `SUPER_ADMIN`, tolak login tanpa profil, dan audit setiap pemakaiannya |
| Sesi OTP tanpa masa berlaku | Nomor yang berganti tangan tetap membaca data outlet bertahun-tahun | Tetapkan TTL sesi detail dan sediakan pencabutan sesi per nomor |
| Akun belum siap saat tulis-OTP dimatikan | Pembaruan foto mingguan berhenti total tanpa jalur cadangan | Naikkan migrasi dan akun lebih dulu, verifikasi login seluruh petugas, baru matikan mutasi publik |

### Release Gate

Fitur tidak boleh dirilis bila salah satu kondisi berikut masih terjadi:

- Ada endpoint publik yang menerima mutasi dengan sesi OTP.
- Akun Salesforce aktif tanpa mapping master Salesforce dan TAP.
- Jalur eskalasi bootstrap masih dapat memberi `SUPER_ADMIN` kepada pengguna tanpa profil admin.
- Sesi OTP masih dibuat tanpa masa berlaku yang wajar.
- Masih ada petugas lapangan aktif yang belum terbukti dapat login ke dashboard.
- Detail program mengembalikan peserta atau hasil lintas scope.
- Tombol disembunyikan tetapi API belum menerapkan permission yang sama.
- Migrasi belum diuji pada salinan database atau backup belum tersedia.
- Audit log tidak dapat mengidentifikasi user login yang melakukan perubahan.
