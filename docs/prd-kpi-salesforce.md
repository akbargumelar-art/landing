# PRD — Penilaian KPI Salesforce

**Status:** Draft untuk disetujui
**Tanggal:** 11 Agustus 2026
**Modul:** `/admin/mitra/program-salesforce` (admin) & `/mitra/program-sf/[slug]` (publik, OTP)
**Penulis:** Tim Engineering

> **Kebijakan akses terbaru:** OTP pada halaman publik hanya memberi akses baca dan tidak dapat
> dipakai untuk mengubah data apa pun. Seluruh edit outlet wajib memakai akun login dengan scope
> Salesforce/Supervisor. Kontrak lengkap dan matriks role berada di
> [`prd-akses-login-operasional-mitra.md`](./prd-akses-login-operasional-mitra.md) dan mengungguli
> bagian dokumen ini bila terdapat konflik mengenai autentikasi, otorisasi, atau mutasi data.

---

## 1. Ringkasan

Sub-menu **Program Salesforce** hari ini punya dua mekanisme: **Racing** (peserta diadu, hadiah dari peringkat) dan **Reward** (siapa pun yang lewat ambang dapat hadiah). Keduanya menjawab pertanyaan *"siapa yang menang"*.

Dokumen ini menambahkan mekanisme ketiga — **KPI** — yang menjawab pertanyaan berbeda: *"apakah setiap salesforce memenuhi kewajiban dan targetnya, dan apa konsekuensinya"*. KPI bukan kompetisi: tidak ada peringkat, tidak ada juara. Yang ada adalah target per orang, pencapaian terhadap target itu, dan konsekuensi berupa reward atau punishment.

Tiga bagian yang dibangun:

| Bagian | Isi | Hasil |
|---|---|---|
| **Compliance** | Parameter kepatuhan (visit PJP, foto outlet, laporan) dengan Target, Aktual, Achievement, GAP, Bobot *(opsional)* | Total skor Compliance |
| **Performance** | Parameter capaian bisnis (sales, revenue, akuisisi) dengan Target, Aktual, Achievement, GAP, Bobot *(wajib)* | Total skor Performance = Σ(Achievement × Bobot) |
| **Benefit** | Aturan if-then-else yang ditetapkan admin di awal | Label reward (mis. `Rp 100.000`) atau punishment (mis. `Surat Peringatan`) |

Tampilan publik tetap di balik OTP dalam mode **baca-saja**, dengan drill-down tiga tingkat:
**ringkasan per-TAP → ringkasan per-Salesforce → pencapaian per-Outlet (berfilter)**. Salesforce
dan Supervisor yang perlu mengubah data outlet wajib masuk menggunakan akun dashboard.

---

## 2. Keputusan Produk yang Sudah Ditetapkan

Empat keputusan berikut sudah disepakati dan menjadi dasar seluruh desain di dokumen ini. Dicatat eksplisit karena masing-masing menentukan bentuk skema database.

| # | Keputusan | Konsekuensi teknis |
|---|---|---|
| **K-1** | **Data aktual diunggah per outlet, lalu di-rollup ke salesforce dan TAP.** | Butuh tabel skor baru ber-dimensi outlet. Tabel `mitra_program_scores` yang ada tidak bisa dipakai (lihat §4.3). Keuntungannya: angka di tiga tingkat tabel publik mustahil saling berbeda, karena bersumber dari baris yang sama. |
| **K-2** | **Target ditetapkan per salesforce per parameter**, diunggah lewat berkas terpisah. | Butuh tabel `mitra_kpi_targets`. Target boleh berbeda antar orang (SF senior vs SF baru), dan GAP jadi bermakna per individu. |
| **K-3** | **Skor Compliance memakai rata-rata achievement bila bobot dikosongkan.** Bila sebagian parameter diberi bobot, dipakai rumus berbobot yang dinormalkan: `Σ(ach × bobot) / Σ(bobot)`. | Bobot tidak wajib diisi untuk Compliance. Tidak butuh kolom baru — bobot `0` dibaca sebagai "tanpa bobot". |
| **K-4** | **Benefit dihitung dari skor Performance, dengan Compliance sebagai gerbang wajib.** Bila skor Compliance di bawah ambang minimum yang di-setting admin, peserta langsung kena punishment dan seluruh reward performance dibatalkan berapa pun skornya. | Butuh kolom `kpi_compliance_min_score` di `mitra_programs`, dan kolom sumber skor di tabel aturan hadiah. |

---

## 3. Kondisi Saat Ini (baseline kode)

Yang sudah ada dan akan dipakai ulang, bukan dibangun dari nol:

| Berkas | Perannya untuk KPI |
|---|---|
| [`src/db/schema.ts:861`](../src/db/schema.ts#L861) `mitraPrograms` | Induk program; `mechanismType` tinggal ditambah nilai `KPI` |
| [`src/db/schema.ts:888`](../src/db/schema.ts#L888) `mitraProgramParams` | Definisi parameter (key/label/unit/weight/aggregation/isScored) — ditambah kolom kategori, cap, polaritas |
| [`src/db/schema.ts:917`](../src/db/schema.ts#L917) `mitraProgramParticipants` | Daftar SF peserta KPI; **dipakai apa adanya** |
| [`src/db/schema.ts:986`](../src/db/schema.ts#L986) `mitraProgramRewardRules` | Tabel aturan if-then-else; ditambah kolom `score_source` & `benefit_type` |
| [`src/components/admin/mitra/program-manager.tsx:441`](../src/components/admin/mitra/program-manager.tsx#L441) | Tab Racing/Reward — titik penambahan tab ketiga |
| [`src/app/api/public/mitra/programs/[slug]/route.ts:26`](../src/app/api/public/mitra/programs/%5Bslug%5D/route.ts#L26) | Gate OTP untuk seluruh program `SALESFORCE` — **berlaku otomatis untuk KPI, tanpa kode tambahan** |
| [`src/lib/mitra-programs.ts:286`](../src/lib/mitra-programs.ts#L286) `computeParticipantParamAggregates` | Pola agregasi SUM/AVG/LAST yang akan ditiru untuk rollup outlet → SF |

Yang **tidak** dipakai untuk KPI: `mitraProgramLeaderboard` dan `mitraProgramWinners` — keduanya berporos peringkat, sedangkan KPI tidak punya peringkat.

---

## 4. Model Data

### 4.1 Perubahan `mitra_programs`

```
mechanism_type            ENUM('RACING','REWARD','KPI')     -- tambah nilai KPI
kpi_compliance_min_score  DECIMAL(6,2) NULL                 -- ambang gerbang compliance (K-4), mis. 80.00
kpi_default_cap           DECIMAL(6,2) NULL                 -- default batas achievement; NULL = tanpa batas
```

`kpi_default_cap` hanya nilai awal saat parameter dibuat; batas sesungguhnya dibaca per parameter.

### 4.2 Perubahan `mitra_program_params`

```
kpi_category      ENUM('NONE','COMPLIANCE','PERFORMANCE') NOT NULL DEFAULT 'NONE'
achievement_cap   DECIMAL(6,2) NULL      -- 100 / 110 / 120; NULL = loss (tanpa batas)
polarity          ENUM('HIGHER_BETTER','LOWER_BETTER') NOT NULL DEFAULT 'HIGHER_BETTER'
```

- `kpi_category` hanya bermakna pada program `KPI`; program Racing/Reward tetap `NONE` dan tidak berubah perilakunya.
- `achievement_cap` menjawab kebutuhan *"mentok di 100%/110%/120% atau di-loss"*. `NULL` berarti **loss**: achievement dibiarkan tembus berapa pun.
- `polarity` ditambahkan karena tidak semua KPI "makin besar makin baik". Parameter seperti *jumlah komplain* atau *outlet tidak aktif* justru sebaliknya, dan tanpa kolom ini achievement-nya akan terbalik. Default `HIGHER_BETTER` supaya parameter lama tidak berubah arti.
- Kolom `weight` yang sudah ada dipakai sebagai **bobot dalam persen** (mis. `30` = 30%). Nilai `0` dibaca sebagai "tanpa bobot" (K-3).

### 4.3 Tabel baru: `mitra_kpi_outlet_scores`

Aktual mentah, satu baris per outlet per parameter per tanggal.

```
id                VARCHAR(36) PK
program_id        VARCHAR(36) NOT NULL  FK mitra_programs      ON DELETE CASCADE
salesforce_id     VARCHAR(36) NOT NULL  FK mitra_salesforces   ON DELETE CASCADE
outlet_id         VARCHAR(36) NOT NULL  FK mitra_outlets       ON DELETE CASCADE
param_id          VARCHAR(36) NOT NULL  FK mitra_program_params ON DELETE CASCADE
raw_value         DECIMAL(18,2) NOT NULL DEFAULT 0.00
achievement_date  DATE NOT NULL
batch_id          VARCHAR(36) NULL      FK mitra_import_batches ON DELETE SET NULL
updated_at        TIMESTAMP

UNIQUE (program_id, outlet_id, param_id, achievement_date)
INDEX  (program_id, salesforce_id)
INDEX  (batch_id)
```

**Kenapa tabel baru, bukan `mitra_program_scores`?** Unique index tabel itu adalah `(program_id, participant_key, param_id, achievement_date)`. Pada program KPI, `participant_key` adalah salesforce — dan satu salesforce membina banyak outlet. Seluruh baris outlet milik satu SF di hari dan parameter yang sama akan bertabrakan di index tersebut, dan `onDuplicateKeyUpdate` yang dipakai jalur import ([`scores/route.ts:245`](../src/app/api/admin/mitra/programs/%5Bid%5D/scores/route.ts#L245)) akan **menimpa** baris sebelumnya — outlet terakhir menang, sisanya hilang diam-diam. Kolom `salesforce_id` disimpan redundan (bisa diturunkan dari outlet) supaya rollup per-SF tidak perlu join, dan supaya perpindahan binaan outlet di kemudian hari tidak mengubah angka historis yang sudah tercatat.

### 4.4 Tabel baru: `mitra_kpi_targets`

Target per salesforce per parameter (K-2). Satu program = satu periode, jadi tidak ada kolom bulan.

```
id              VARCHAR(36) PK
program_id      VARCHAR(36) NOT NULL FK mitra_programs        ON DELETE CASCADE
participant_key VARCHAR(60) NOT NULL                 -- "sf:<id>", konsisten dengan tabel lain
salesforce_id   VARCHAR(36) NOT NULL FK mitra_salesforces     ON DELETE CASCADE
param_id        VARCHAR(36) NOT NULL FK mitra_program_params  ON DELETE CASCADE
target_value    DECIMAL(18,2) NOT NULL DEFAULT 0.00
updated_at      TIMESTAMP

UNIQUE (program_id, participant_key, param_id)
```

### 4.5 Tabel baru: `mitra_kpi_results`

Hasil perhitungan yang di-cache, sejajar peran `mitra_program_leaderboard` pada Racing.

```
id                 VARCHAR(36) PK
program_id         VARCHAR(36) NOT NULL FK mitra_programs     ON DELETE CASCADE
participant_key    VARCHAR(60) NOT NULL
salesforce_id      VARCHAR(36) NOT NULL FK mitra_salesforces  ON DELETE CASCADE
tap                VARCHAR(255) NOT NULL DEFAULT ''  -- disalin saat hitung, agar histori tak berubah
compliance_score   DECIMAL(8,2) NOT NULL DEFAULT 0.00
performance_score  DECIMAL(8,2) NOT NULL DEFAULT 0.00
compliance_passed  BOOLEAN NOT NULL DEFAULT TRUE     -- hasil gerbang K-4
benefit_type       ENUM('NONE','REWARD','PUNISHMENT') NOT NULL DEFAULT 'NONE'
benefit_label      VARCHAR(255) NOT NULL DEFAULT ''
benefit_rule_id    VARCHAR(36) NULL
computed_at        DATETIME NOT NULL

UNIQUE (program_id, participant_key)
INDEX  (program_id, tap)
```

### 4.6 Perubahan `mitra_program_reward_rules`

```
score_source  ENUM('TOTAL','COMPLIANCE','PERFORMANCE') NULL
benefit_type  ENUM('REWARD','PUNISHMENT','NONE') NULL
```

Kolom `comparator`, `threshold_value`, `reward_label`, dan `sort_order` yang sudah ada dipakai apa adanya. Untuk program KPI, `rank_from`/`rank_to`/`param_key` dibiarkan `NULL` — mengikuti disiplin yang sudah berlaku di [`buildRewardRuleValues`](../src/lib/mitra-programs.ts#L36), di mana kolom milik mekanisme lain sengaja dikosongkan agar tidak ada sisa data menyesatkan.

### 4.7 Migrasi

Satu berkas: `drizzle/0034_kpi_salesforce.sql`, dijalankan lewat `npm run db:generate && npm run db:migrate`. Seluruh perubahan bersifat aditif (tambah nilai enum, tambah kolom nullable, tambah tabel) sehingga **tidak ada data lama yang perlu di-backfill** dan program Racing/Reward yang sedang berjalan tidak terpengaruh.

---

## 5. Aturan Perhitungan

Seluruhnya di berkas baru `src/lib/mitra-kpi.ts`. Perhitungan dilakukan **server-side saat recompute**, bukan di browser, agar angka yang dilihat publik sama persis dengan yang dilihat admin.

### 5.1 Aktual (rollup outlet → salesforce)

```
aktual(sf, param) = agregasi( raw_value seluruh outlet binaan sf pada param itu )
```

Mode agregasi mengikuti kolom `aggregation` parameter, memakai semantik yang sudah berlaku di [`computeParticipantParamAggregates`](../src/lib/mitra-programs.ts#L286):

- `SUM` — dijumlahkan seluruh outlet dan seluruh tanggal. Untuk parameter volume (sales, akuisisi).
- `AVG` — rata-rata seluruh baris. Untuk parameter persentase (mis. % outlet terkunjungi).
- `LAST` — nilai pada tanggal terakhir saja, lalu dijumlah antar outlet. Untuk parameter posisi/stok.

Outlet tanpa satu pun baris skor dihitung sebagai **0**, bukan diabaikan — outlet yang tidak dikunjungi memang harus menurunkan angka SF-nya, bukan menghilang dari pembagi.

### 5.2 Achievement

```
HIGHER_BETTER:  ach = target > 0 ? (aktual / target) × 100 : (aktual > 0 ? 100 : 0)
LOWER_BETTER:   ach = aktual > 0 ? (target / aktual) × 100 : (target > 0 ? cap_atau_100 : 100)
```

Lalu dibatasi: `ach_final = cap ? min(ach, cap) : ach` — dengan `cap ∈ {100, 110, 120}` atau `NULL` untuk **loss**.

Achievement tidak pernah negatif; batas bawahnya 0.

### 5.3 GAP

```
HIGHER_BETTER:  gap = aktual − target
LOWER_BETTER:   gap = target − aktual
```

GAP disajikan dalam **satuan asli parameter**, bukan persen — dan tandanya selalu bermakna sama: **positif = di atas ekspektasi, negatif = kurang**. Tanpa penyesuaian polaritas, parameter "makin kecil makin baik" akan menampilkan GAP negatif untuk kinerja yang justru bagus.

### 5.4 Total skor Compliance (K-3)

```
Bila SEMUA parameter compliance berbobot 0:
    skor = rata-rata( ach_final seluruh parameter compliance )

Bila ADA yang berbobot > 0:
    skor = Σ(ach_final × bobot) / Σ(bobot)      -- hanya parameter berbobot > 0 yang ikut
```

Program tanpa satu pun parameter compliance menghasilkan skor `100` dan **selalu lolos gerbang** — supaya program KPI yang memang hanya mengukur performance tidak terblokir oleh kategori yang tidak dipakainya.

### 5.5 Total skor Performance

```
skor = Σ( ach_final × bobot ) / 100
```

Bobot dalam persen. Bila total bobot tepat 100, skor terbaca langsung sebagai persen — itulah bentuk yang diharapkan. Admin **diberi peringatan di layar** bila Σbobot ≠ 100, tetapi tidak diblokir: bobot 100 hanyalah konvensi, bukan syarat matematis, dan memblokirnya akan menghalangi program yang sengaja memakai skala lain.

### 5.6 Benefit (K-4)

Dievaluasi per salesforce, berurutan:

```
1. GERBANG COMPLIANCE
   Bila compliance_score < program.kpi_compliance_min_score:
       compliance_passed = false
       benefit  = aturan pertama yang cocok dengan score_source = 'COMPLIANCE'
                  (bila tak ada yang cocok: benefit_type = PUNISHMENT, label = "Tidak memenuhi compliance")
       BERHENTI — seluruh aturan performance dilewati, berapa pun skornya.

2. ATURAN PERFORMANCE
   Aturan dengan score_source = 'PERFORMANCE' dievaluasi menurut sort_order.
   ATURAN PERTAMA YANG COCOK MENANG; sisanya dilewati.

3. Tidak ada yang cocok  ->  benefit_type = NONE, label kosong.
```

**Catatan penting soal urutan:** berbeda dari mekanisme Reward yang mengakumulasi seluruh aturan yang cocok ([`computeProgramRewards`](../src/lib/mitra-programs.ts#L497) menambahkan setiap kecocokan ke hasil), KPI memakai **first-match-wins**. Alasannya: seseorang tidak bisa sekaligus menerima `Rp 100.000` dan `Rp 50.000`. Konsekuensinya urutan aturan menentukan hasil, maka aturan harus ditulis dari ambang tertinggi ke terendah — dan UI admin akan menampilkan pratinjau urutan evaluasi agar kesalahan urutan langsung terlihat.

Contoh konfigurasi (`kpi_compliance_min_score = 80`):

| Urut | Sumber | Pembanding | Nilai | Jenis | Label |
|---|---|---|---|---|---|
| 1 | COMPLIANCE | `<` | 80 | PUNISHMENT | Surat Peringatan — Compliance |
| 2 | PERFORMANCE | `>=` | 100 | REWARD | Rp 100.000 |
| 3 | PERFORMANCE | `>=` | 90 | REWARD | Rp 50.000 |
| 4 | PERFORMANCE | `<` | 80 | PUNISHMENT | Surat Peringatan |

Hasilnya: SF dengan compliance 75% dan performance 120% tetap menerima *Surat Peringatan — Compliance*, tidak menerima Rp 100.000.

### 5.7 Rollup per TAP

- **Skor TAP** = rata-rata sederhana skor compliance & performance seluruh SF di TAP itu (tiap orang berbobot sama).
- **Target & aktual TAP per parameter** = dijumlahkan untuk parameter `SUM`, dirata-rata untuk `AVG`/`LAST`.
- **Distribusi benefit** = cacah SF per `benefit_type` (mis. "12 reward, 3 punishment, 5 tanpa benefit").

SF yang TAP-nya kosong dikumpulkan ke `(Tanpa TAP)`, mengikuti pola [`groupValueOf`](../src/lib/mitra-programs.ts#L99) — dikelompokkan, bukan dibuang, supaya tidak ada orang yang hilang dari laporan hanya karena data wilayahnya belum lengkap.

---

## 6. Alur Admin

Lokasi: `/admin/mitra/program-salesforce` → tab ketiga **KPI**, sejajar Racing dan Reward.

### 6.1 Tab dan konfigurasi program

Menambah `KPI` ke `MECHANISM_COPY` ([`program-manager.tsx:160`](../src/components/admin/mitra/program-manager.tsx#L160)) dan ke daftar tab ([`:441`](../src/components/admin/mitra/program-manager.tsx#L441)). Ikon: `ClipboardCheck`.

Form program KPI menambah dua isian di luar isian yang sudah ada:

- **Ambang Compliance (%)** → `kpi_compliance_min_score`
- **Batas Achievement bawaan** → dropdown: `Tanpa batas (loss)` / `100%` / `110%` / `120%`

Field `groupBy` disembunyikan untuk KPI — pengelompokan KPI selalu per TAP dan tidak ada peringkat yang perlu dipisah per liga.

### 6.2 Definisi parameter

Memakai textarea baris-per-parameter seperti mekanisme lain, dengan format diperluas:

```
key, label, kategori, bobot, agregasi, cap, polaritas
```

Contoh:

```
visit_pjp,Visit Sesuai PJP,COMPLIANCE,,AVG,100,HIGHER
foto_outlet,Update Foto Outlet,COMPLIANCE,,AVG,100,HIGHER
komplain,Komplain Outlet,COMPLIANCE,,SUM,,LOWER
sales_perdana,Sales Perdana,PERFORMANCE,40,SUM,120,HIGHER
revenue,Revenue,PERFORMANCE,40,SUM,110,HIGHER
akuisisi,Akuisisi Outlet Baru,PERFORMANCE,20,SUM,,HIGHER
```

Kolom kosong = bawaan (`bobot` kosong → 0/tanpa bobot; `cap` kosong → loss; `polaritas` kosong → HIGHER). Di bawah textarea ditampilkan **ringkasan langsung**: jumlah parameter per kategori dan total bobot performance, dengan peringatan bila ≠ 100 — memakai pola perhitungan bobot langsung yang sudah dipakai halaman ini (commit `3e5a4de`).

### 6.3 Peserta

Tanpa perubahan. Picker dan penambahan massal salesforce yang ada ([`findParticipantsBulk`](../src/lib/mitra-programs.ts#L213), filter per TAP) dipakai apa adanya.

### 6.4 Unggah Target

Panel baru **Target KPI**, dengan tombol unduh template dan alur pratinjau → commit yang sama persis dengan panel skor yang sudah ada.

Template (`GET /api/admin/mitra/programs/[id]/kpi-targets`) berisi baris silang seluruh SF peserta × seluruh parameter, sudah terisi nama dan `paramKey`-nya, sehingga pengisi tinggal menimpa kolom target:

| salesforce | paramKey | targetValue |
|---|---|---|
| Aditia Nugraha | sales_perdana | 500 |
| Aditia Nugraha | revenue | 25000000 |

Validasi: nama SF harus peserta program ini; `paramKey` harus dikenal; target tidak boleh negatif; baris kembar (SF+param sama) dalam satu berkas ditolak dengan pesan barisnya — mengikuti disiplin anti-duplikat yang sudah ada di [`scores/route.ts:187`](../src/app/api/admin/mitra/programs/%5Bid%5D/scores/route.ts#L187).

### 6.5 Unggah Aktual (per outlet)

Panel **Pencapaian** yang sudah ada, dengan template dan validasi yang bercabang bila `mechanismType = KPI`:

| outletCode | paramKey | achievementDate | rawValue |
|---|---|---|---|
| 2201055482 | sales_perdana | 2026-08-01 | 12 |

Validasi tambahan di luar yang sudah berlaku (tanggal dalam periode, parameter dikenal, tidak duplikat):

- `outletCode` harus ada di master outlet **dan** `salesforce_id`-nya harus salah satu peserta program. Outlet yang salesforce-nya bukan peserta ditolak dengan pesan jelas, bukan diam-diam dibuang — kalau tidak, angka SF akan kurang tanpa ada yang tahu sebabnya.
- Ukuran berkas dan batas 5.000 baris mengikuti aturan yang sudah ada.

### 6.6 Aturan Benefit

Textarea format: `sumber, pembanding, nilai, jenis, label`

```
COMPLIANCE,<,80,PUNISHMENT,Surat Peringatan - Compliance
PERFORMANCE,>=,100,REWARD,Rp 100.000
PERFORMANCE,>=,90,REWARD,Rp 50.000
PERFORMANCE,<,80,PUNISHMENT,Surat Peringatan
```

Di bawahnya ditampilkan **pratinjau urutan evaluasi** — daftar bernomor yang menegaskan aturan mana dibaca lebih dulu — karena pada model first-match-wins urutan adalah bagian dari logikanya, bukan sekadar tampilan.

### 6.7 Recompute & pratinjau hasil

Tombol **Hitung Ulang** memanggil `PATCH /api/admin/mitra/programs` dengan `action: "recompute"`, yang bercabang ke `recomputeKpiResults(programId)` bila mekanismenya KPI. Setelah selesai, admin melihat tabel hasil: SF | TAP | Skor Compliance | Lolos Gerbang | Skor Performance | Benefit — persis seperti yang akan dilihat publik, sehingga kesalahan konfigurasi ketahuan sebelum dipublikasikan.

---

## 7. Tampilan Publik

Rute tetap `/mitra/program-sf/[slug]`. [`ProgramPublicView`](../src/components/mitra/program-public-view.tsx) bercabang: bila `mechanismType === "KPI"` merender komponen baru `KpiPublicView`, selain itu tampilan papan peringkat yang ada. **Gate OTP tidak perlu kode baru** — [`route.ts:26`](../src/app/api/public/mitra/programs/%5Bslug%5D/route.ts#L26) sudah mengunci seluruh program bertarget `SALESFORCE` tanpa memandang mekanismenya.

Urutan halaman setelah OTP terverifikasi: header program → kartu ringkasan → Tabel 1 → Tabel 2 → Tabel 3. Halaman ini tidak menyediakan konfigurasi program, import, recompute, atau mutasi outlet.

### 7.1 Kartu ringkasan (atas)

Empat angka: jumlah SF dinilai · rata-rata skor compliance · rata-rata skor performance · cacah penerima reward / punishment. Mobile-first: 2 kolom di ponsel, 4 di desktop.

### 7.2 Tabel 1 — Ringkasan per TAP (collapse/expand)

Baris tertutup:

| TAP | Jml SF | Skor Compliance | Skor Performance | Reward | Punishment |
|---|---|---|---|---|---|

Dibuka → daftar salesforce di TAP itu beserta skor dan label benefit masing-masing, sebagai jalan pintas ke Tabel 2. Seluruh TAP tertutup secara bawaan.

### 7.3 Tabel 2 — Ringkasan per Salesforce (collapse/expand)

Baris tertutup:

| Salesforce | TAP | Compliance | Performance | Benefit |
|---|---|---|---|---|

Label benefit ditampilkan sebagai badge: hijau untuk REWARD, merah untuk PUNISHMENT, abu untuk NONE.

Dibuka → rincian parameter, dipecah dua blok:

**Compliance**

| Parameter | Target | Aktual | Achievement | GAP | Bobot | Skor |
|---|---|---|---|---|---|---|

**Performance**

| Parameter | Target | Aktual | Achievement | GAP | Bobot | Skor |
|---|---|---|---|---|---|---|

Tiap blok ditutup baris **Total**. Achievement yang terkena batas diberi penanda kecil (mis. `120%*` dengan keterangan "dibatasi 120%") — supaya orang yang mencapai 150% tahu angkanya dipotong, bukan salah hitung. Kolom Bobot disembunyikan pada blok Compliance bila seluruh bobotnya 0, karena kolom berisi nol semua hanya menambah lebar tabel tanpa memberi informasi.

Bila peserta gagal gerbang compliance, di atas blok performance muncul pita penjelas: *"Skor performance tidak menghasilkan reward karena compliance di bawah 80%."* — konsekuensi harus terbaca bersama sebabnya, bukan hanya berupa label punishment tanpa penjelasan.

### 7.4 Tabel 3 — Pencapaian per Outlet (berfilter)

| Outlet | Kode | TAP | Salesforce | Parameter | Aktual |
|---|---|---|---|---|---|

Filter: **TAP** (dropdown) · **Salesforce** (dropdown, menyusut mengikuti TAP terpilih) · **Parameter** (dropdown) · **pencarian** nama/kode outlet. Semua filter tersimpan di query string agar tautan hasil filter bisa dibagikan.

Pilihan dropdown diambil dari **seluruh peserta**, bukan dari hasil yang sedang tersaring — mengikuti keputusan yang sudah berlaku di [`getPublicProgramDetail`](../src/lib/mitra-programs.ts#L676), supaya daftar filter tidak menyusut saat pengunjung sedang menyaring.

Dibatasi 100 baris per halaman dengan pagination server-side; tanpa itu satu TAP besar bisa mengirim puluhan ribu baris ke ponsel.

---

## 8. Perubahan API

| Endpoint | Metode | Perubahan |
|---|---|---|
| `/api/admin/mitra/programs` | `GET` | Ikut mengirim `kpiComplianceMinScore`, kolom KPI pada params, dan `scoreSource`/`benefitType` pada rules |
| `/api/admin/mitra/programs` | `POST`/`PUT` | Menerima kolom KPI; `normalizeMechanismType` diperluas menerima `KPI` |
| `/api/admin/mitra/programs` | `PATCH` | `action: "recompute"` bercabang ke `recomputeKpiResults()` untuk program KPI |
| `/api/admin/mitra/programs/[id]/kpi-targets` | `GET`/`POST`/`DELETE` | **Baru** — template, pratinjau+commit unggahan target, dan reset target |
| `/api/admin/mitra/programs/[id]/scores` | `GET`/`POST` | Template & validasi bercabang untuk KPI (kolom `outletCode`, tulis ke `mitra_kpi_outlet_scores`) |
| `/api/public/mitra/programs/[slug]` | `GET` | Bercabang ke `getPublicKpiDetail()`; menerima query `tap`, `sf`, `param`, `q`, `page` |

Hak mutasi konfigurasi tidak berubah: `SUPER_ADMIN` untuk membuat/menghapus dan
`SUPER_ADMIN`+`ADMIN_INPUT` untuk unggah serta recompute. Akses baca dashboard untuk
`SALESFORCE` dan `SUPERVISOR` wajib difilter server-side menurut identitas Salesforce/TAP sesuai
[`prd-akses-login-operasional-mitra.md`](./prd-akses-login-operasional-mitra.md); menyembunyikan
baris atau tombol di React saja tidak memenuhi persyaratan.

---

## 9. Tahapan Pengerjaan

| Fase | Isi | Keluaran yang bisa diperiksa |
|---|---|---|
| **F0 — Skema** | Kolom & tabel baru di `schema.ts`, migrasi `0034_kpi_salesforce.sql`, `normalizeMechanismType` menerima `KPI` | `npm run db:migrate` bersih; program Racing/Reward lama tetap normal |
| **F1 — Mesin hitung** | `src/lib/mitra-kpi.ts`: rollup, achievement+cap+polaritas, GAP, skor dua kategori, gerbang, benefit, `recomputeKpiResults()` | Uji unit rumus dengan angka contoh dari §5.6 |
| **F2 — Admin** | Tab KPI, form konfigurasi, parser parameter & aturan benefit, panel target, cabang KPI di panel skor, tabel hasil recompute | Satu program KPI bisa dibuat, diisi, dihitung, dan hasilnya benar di layar admin |
| **F3 — Publik** | `KpiPublicView` + tiga tabel + filter + pagination; cabang di `getPublicProgramDetail` | Halaman ber-OTP menampilkan drill-down TAP → SF → Outlet |
| **F4 — QA & rilis** | Uji peran, uji berkas rusak, uji beban 5.000 baris, uji tampilan ponsel | Checklist §11 lolos |

F0 dan F1 harus selesai berurutan; F2 dan F3 boleh berjalan paralel setelah F1 stabil.

---

## 10. Risiko & Keputusan Terbuka

| # | Risiko | Dampak | Penanganan |
|---|---|---|---|
| **R-1** | **Setiap nomor yang lolos whitelist OTP melihat KPI dan surat peringatan seluruh salesforce.** Sesi OTP saat ini berlaku per program, bukan per orang. | Punishment individu terbaca rekan kerja se-provinsi. Ini masalah kepegawaian, bukan sekadar teknis. | Perlu keputusan Anda. Tiga pilihan: (a) biarkan terbuka — memang dimaksudkan transparan; (b) tambah toggle program *"sembunyikan label punishment dari publik"* sehingga tabel tetap tampil tetapi kolom benefit hanya berisi reward; (c) batasi Tabel 2 hanya ke SF pemilik nomor. **Rekomendasi: (b)** — mempertahankan seluruh tabel yang Anda minta, tanpa menyiarkan sanksi. |
| **R-2** | TTL sesi OTP saat ini 10 tahun ([`mitra-utils.ts:18`](../src/lib/mitra-utils.ts#L18)). | Ponsel yang berpindah tangan tetap membuka data KPI selamanya. | Di luar cakupan dokumen ini, tetapi layak diperpendek (mis. 30 hari) bersamaan rilis KPI. Dicatat agar tidak terlewat. |
| **R-3** | Outlet berpindah binaan di tengah periode. | Aktual bisa terhitung ke SF yang salah. | `salesforce_id` disimpan pada baris skor saat unggah, bukan dijoin saat baca (§4.3), sehingga angka historis tidak berubah ketika binaan digeser. |
| **R-4** | Target belum diunggah saat aktual sudah masuk. | Achievement jadi 0 atau 100 secara sewenang-wenang. | Parameter tanpa target ditandai `—` di tabel dan **dikeluarkan dari perhitungan skor** (tidak dianggap 0), disertai peringatan di panel admin berisi jumlah target yang belum diisi. |
| **R-5** | Salah urutan aturan benefit (mis. `>=80` ditulis sebelum `>=100`). | Semua orang menerima hadiah terkecil. | Pratinjau urutan evaluasi di §6.6, plus peringatan otomatis bila aturan REWARD tidak menurun ambangnya. |
| **R-6** | Volume data: 5.000 outlet × 6 parameter × 30 hari ≈ 900.000 baris per program. | Recompute dan halaman publik melambat. | Rollup dibaca dari agregat per-SF yang sudah tersimpan di `mitra_kpi_results`; Tabel 3 dipaginasi server-side dan diagregasi per outlet+parameter (bukan per hari) sebelum dikirim. |

---

## 11. Kriteria Penerimaan

**Perhitungan**
1. Aktual salesforce = jumlah/rata-rata aktual seluruh outlet binaannya, sesuai mode agregasi parameter.
2. Achievement mengikuti polaritas parameter dan terpotong tepat pada cap 100/110/120; parameter tanpa cap boleh melewati 100%.
3. GAP bertanda positif untuk kinerja di atas target pada kedua polaritas.
4. Skor compliance = rata-rata achievement ketika seluruh bobot 0, dan = `Σ(ach×bobot)/Σ(bobot)` ketika ada bobot.
5. Skor performance = `Σ(ach × bobot)/100`.
6. Compliance di bawah ambang → punishment, dan **tidak ada** reward performance yang muncul, berapa pun skor performance-nya.
7. Aturan performance: yang cocok pertama menang; sisanya tidak muncul.
8. Parameter tanpa target ditandai `—` dan tidak mengubah skor.

**Admin**
9. Tab KPI muncul di `/admin/mitra/program-salesforce` sejajar Racing dan Reward, dan program di tab lain tidak berubah perilakunya.
10. Template target & aktual bisa diunduh dan langsung bisa diunggah balik tanpa penyuntingan struktur.
11. Berkas dengan baris rusak menampilkan nomor baris dan alasannya, dan **tidak ada** baris yang tersimpan sebagian.
12. Outlet yang salesforce-nya bukan peserta program ditolak dengan pesan jelas.

**Publik**
13. Halaman KPI publik tidak bisa dibuka tanpa OTP terverifikasi dan tetap baca-saja setelah OTP berhasil.
14. Tabel per-TAP dan per-Salesforce bisa dibuka-tutup, dan tertutup saat pertama dimuat.
15. Tabel per-outlet menyaring benar untuk TAP, salesforce, parameter, dan pencarian teks; filter tersimpan di URL.
16. Seluruh tabel terbaca di layar 360 px tanpa scroll horizontal pada halaman (scroll berada di dalam tabelnya).

---

## 12. Di Luar Cakupan

Tidak dikerjakan pada rilis ini, dicatat agar tidak tercampur saat estimasi:

- Riwayat KPI antar periode dan grafik tren bulanan (satu program = satu periode; perbandingan antar bulan berarti membaca beberapa program).
- Ekspor PDF/Excel dari halaman publik.
- Pembuatan surat peringatan otomatis sebagai dokumen — sistem hanya menghasilkan **label** punishment.
- Notifikasi WhatsApp/email hasil KPI.
- Persetujuan berjenjang (atasan menyetujui skor sebelum publik).
- Sanggahan/banding salesforce atas angka KPI-nya.
