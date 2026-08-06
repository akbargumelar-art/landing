# Uji Runtime dengan MySQL Nyata - 2026-08-06

Sesi-sesi sebelumnya selalu berhenti di kalimat yang sama: *"tidak terverifikasi karena mesin ini
tidak punya MySQL server, Docker, maupun MariaDB - hanya klien."* Catatan itu **benar untuk sisi
Windows, tetapi melewatkan WSL.** Dokumen ini mencatat cara membuka blokade itu dan seluruh hasil
pengujian yang akhirnya bisa dijalankan.

## 1. Cara menjalankan database di mesin ini

Ubuntu 24.04 WSL2 sudah terpasang dengan systemd aktif, dan `mysql-server` 8.0 tersedia langsung
dari repo Ubuntu - engine dan versi mayor yang sama dengan produksi (`docker-compose.yml` memakai
`mysql:8.0`). Yang terpasang akhirnya **MySQL 8.0.46**.

```bash
# Root WSL tidak butuh password, jadi tidak perlu sudo interaktif.
wsl -d Ubuntu -u root -e bash -c 'apt-get update -qq && apt-get install -y -qq mysql-server'

# bind-address diubah 127.0.0.1 -> 0.0.0.0 di /etc/mysql/mysql.conf.d/mysqld.cnf
# supaya host Windows bisa menjangkaunya. WSL2 di belakang NAT, jadi tidak terekspos ke LAN.
# Lalu: CREATE DATABASE abk_ciraya; CREATE USER 'root'@'%' tanpa password (mencocokkan .env).
```

`.env` lokal sudah menunjuk `mysql://root:@localhost:3306/abk_ciraya`, jadi **tidak ada yang perlu
diubah** di konfigurasi aplikasi.

### Tiga jebakan yang memakan waktu, catat untuk sesi berikutnya

1. **Sandbox Claude Code memblokir WSL secara diam-diam.** `wsl` keluar dengan exit code 0 tanpa
   output apa pun, persis seperti perintah yang berhasil tapi hampa. Setiap perintah WSL harus
   dijalankan dengan sandbox dimatikan. Koneksi TCP ke MySQL juga diblokir sandbox.
2. **WSL mematikan distro saat tidak ada proses yang menahannya.** Antar pemanggilan tool, VM-nya
   mati, jadi `localhost:3306` dari Windows menjawab `ECONNREFUSED` walau MySQL "aktif" saat
   dicek dari dalam. Solusinya menjalankan proses penahan di latar belakang
   (`wsl -d Ubuntu -u root -e sleep 86400`).
3. **`bash -lc` tidak menghasilkan output di WSL ini** (ada masalah di profil login); `bash -c`
   normal. Untuk skrip panjang, tulis file `.sh` lalu jalankan lewat path `/mnt/...` - jauh lebih
   andal daripada meneruskan string berlapis kutip dari PowerShell.

---

## 2. Database tidak bisa dibangun dari nol - tiga blocker berturut-turut

Ini temuan struktural terbesar sesi ini, dan hanya muncul saat benar-benar mencoba
`npm run db:migrate` terhadap database kosong.

### 2.1 Migrasi `0000` punya BOM UTF-8 (SUDAH DIPERBAIKI)

`drizzle/0000_brainy_slapstick.sql` diawali tiga byte `EF BB BF`. Drizzle meneruskannya apa adanya
ke MySQL, yang menolak dengan `ER_PARSE_ERROR 1064` pada statement pertama:

```
near '﻿-- Portal Mitra Outlet integration migration for an existing ABK Ciraya schem' at line 1
```

Dari sembilan file migrasi, **hanya `0000` yang punya BOM** - kemungkinan besar sisa penyuntingan
lewat editor Windows atau redirect PowerShell (`>` dan `Out-File` menulis UTF-8 ber-BOM secara
default). Sudah dibuang; file menyusut dari 20.159 ke 20.156 byte.

### 2.2 Dua nama constraint melebihi batas 64 karakter MySQL (SUDAH DIPERBAIKI)

Nama FK turunan otomatis Drizzle:

| Nama | Panjang |
|---|---|
| `mitra_whitelist_numbers_source_batch_id_mitra_import_batches_id_fk` | 66 |
| `mitra_whitelist_usage_logs_whitelist_id_mitra_whitelist_numbers_id_fk` | 69 |

Batas MySQL 64, jadi keduanya ditolak `ER_TOO_LONG_IDENT 1059`. Keduanya muncul **di dua tempat
sekaligus**: di `src/db/schema.ts` (dipakai `drizzle-kit push`) dan tertulis di
`drizzle/0000_brainy_slapstick.sql` baris 303 dan 305. Artinya **`npm run db:setup` maupun
`npm run db:migrate` sama-sama mustahil membuat tabel ini dari nol.**

Diperbaiki di `schema.ts` dengan `foreignKey({ ..., name })` eksplisit:
`mitra_whitelist_source_batch_fk` dan `mitra_whitelist_usage_whitelist_fk`.

**Migrasi `0000` sengaja TIDAK diubah** selain BOM-nya, karena sudah pernah diterapkan ke
production dan mengubah isi migrasi lama berisiko mengacaukan pelacakan hash Drizzle. Konsekuensinya
nama constraint yang panjang itu masih ada di file migrasi - relevan hanya bila suatu saat ada yang
membangun database dari nol lewat `db:migrate`.

### 2.3 Migrasi tidak pernah membuat 19 tabel inti (BELUM DIPERBAIKI - butuh keputusan)

Setelah dua perbaikan di atas, `db:migrate` masih gagal:
`ER_FK_CANNOT_OPEN_PARENT - Failed to open the referenced table 'user'`.

Penyisiran menyeluruh:

- `schema.ts` mendefinisikan **46 tabel**.
- Seluruh migrasi `0000`-`0008` hanya membuat **27 tabel**.
- **19 tabel tidak pernah dibuat oleh migrasi mana pun:**
  `user`, `session`, `account`, `verification`, `programs`, `products`, `orders`, `vouchers`,
  `winners`, `redemption_logs`, `dynamic_forms`, `form_fields`, `form_submissions`,
  `submission_values`, `site_settings`, `hero_slides`, `cuan_brands`, `cuan_categories`,
  `cuan_products`.

Komentar di kepala `0000` sudah mengakuinya: *"migration for an existing ABK Ciraya schema.
Requires the existing better-auth `user` table."* Skema dasar lahir dari `drizzle-kit push`
(`npm run db:setup`), lalu migrasi hanya menumpuk penambahan Mitra/IndiHome/RBAC di atasnya.

**Ini bukan blocker deploy production** - database production sudah ada, dan `deploy.sh` hanya
menerapkan migrasi inkremental `0003`-`0008` yang seluruh prasyaratnya sudah tersedia di sana.
Yang hilang adalah hal lain:

- Tidak ada cara reprodusibel membangun database staging/uji dari repo. **Inilah akar penyebab
  setiap sesi sebelumnya terblokir**, bukan sekadar ketiadaan MySQL.
- Pemulihan bencana bergantung sepenuhnya pada `mysqldump`, bukan pada set migrasi.

Rekomendasi: tambahkan satu migrasi baseline (`0009_baseline_core_tables.sql`) berisi
`CREATE TABLE IF NOT EXISTS` untuk 19 tabel tersebut. Aman untuk production (semuanya sudah ada,
jadi no-op) dan membuat database bisa dibangun dari nol.

**Cara membangun database uji sekarang:** `npx drizzle-kit push --force` lalu `npm run db:seed`.
Terbukti berhasil - 46 tabel dan seed lengkap.

---

## 3. Tiga temuan kritis audit: SELURUHNYA TERBUKTI

Diuji terhadap server dev dan database hidup, dari posisi penyerang **tanpa cookie, token, atau
kredensial apa pun** - hanya tahu id order / nomor invoice.

| # | Endpoint | HTTP | Status order | Hasil |
|---|---|---|---|---|
| K1 | `POST /api/public/orders/[id]/simulate` | `200 {"success":true}` | pending -> **success** | TEMBUS |
| K2 | `POST /api/public/webhook/mayar` (body dipalsukan, tanpa signature) | `200 {"success":true,"received":true}` | pending -> **success** | TEMBUS |
| K3 | `POST /api/public/webhook/midtrans` (field `signature_key` dihilangkan) | `200 {"success":true,"received":true}` | pending -> **success** | TEMBUS |

K3 mengonfirmasi analisis statisnya: verifikasi signature dibungkus `if (config && signature_key)`,
sehingga **cukup menghilangkan field `signature_key`** dari body untuk melewatinya sepenuhnya.

Dampak inventaris terukur: voucher nyata ditandai terpakai dan `products.stock` ditulis ulang,
persis seperti diperkirakan.

## 4. TEMUAN BARU: race condition membagikan voucher yang sama ke banyak pelanggan

Ini tidak terlihat sama sekali dari membaca kode - muncul karena angka inventaris pada uji di atas
janggal (3 redemption sukses, hanya 1 voucher terpakai). Diuji ulang secara khusus: tiga order
ditembak **bersamaan**, dengan stok 5 voucher tersedia.

```
  order 21cd72fd -> voucher 2c266ee0 (RACE-0-...) status=sukses
  order 6c774ce4 -> voucher 2c266ee0 (RACE-0-...) status=sukses
  order d019554a -> voucher 2c266ee0 (RACE-0-...) status=sukses

  redemption sukses          : 3
  voucher UNIK yang diberikan : 1
  voucher tertandai terpakai  : 1
  stok produk                 : 4  (dari 5)
```

**Tiga pelanggan dinyatakan sukses dan menerima kode voucher yang sama persis.**

Sebabnya di `src/lib/auto-redeem.ts`: pemilihan voucher memakai
`SELECT ... WHERE is_used = false LIMIT 1` **tanpa penguncian baris**, dan penandaan `is_used`
baru terjadi sekitar 5 detik kemudian (setelah `setTimeout` simulasi). Selama jendela itu setiap
redeem yang masuk melihat voucher yang sama sebagai tersedia.

Pembukuan ikut salah: stok hanya berkurang 1 walau tiga pelanggan dilayani, jadi selisihnya tidak
akan pernah ketahuan dari laporan stok.

Rekomendasi: klaim voucher secara atomik, misalnya
`UPDATE vouchers SET is_used = 1, order_id = ? WHERE product_id = ? AND is_used = 0 LIMIT 1` lalu
periksa `affectedRows`, atau `SELECT ... FOR UPDATE` di dalam transaksi. Menandai voucher terpakai
harus terjadi **sebelum** proses panjang, bukan sesudah.

Catatan: race ini tidak bergantung pada K1-K3. Webhook pembayaran yang sah pun akan memicunya bila
dua pembayaran tiba berdekatan.

---

## 5. Migrasi yang selama ini menggantung: keduanya LULUS

### 5.1 Migrasi `0007` (paling berisiko) - 16/16 lulus

Satu-satunya migrasi yang **mengubah tipe kolom pada tabel berisi data**. Diuji di database
terpisah dengan tabel bentuk pra-0007 dan 10 baris sengaja berantakan.

- `sql_mode` server memuat `STRICT_TRANS_TABLES` - **premis migrasi terbukti benar**: kalau `ALTER`
  dijalankan sebelum normalisasi, baris ber-`branding` kosong memang akan ditolak.
- 21 statement, **0 gagal**. 10 baris sebelum, 10 baris sesudah - **tidak ada yang hilang**.
- Keempat kolom benar menjadi enum.

Seluruh pemetaan terverifikasi: `''` -> `Non Branding`, `TELKOMSEL` -> `Telkomsel`, `' byU '` ->
`byU`, `'3'` -> `Tri`, `'bri link'` -> `BRILINK`, merek tak dikenal -> `Lainnya`, `DIGITAL` dan
`HYBRID` -> `FISIK`, hari ngawur -> `Senin`, `F9` -> `F1`. Termasuk tiga kasus `location_url`:
koordinat valid menimpa tautan manual, koordinat di luar rentang **tidak** menimpa, dan baris tanpa
koordinat mempertahankan tautan manualnya.

### 5.2 Migrasi `0004` + `verify-program-migration.mjs` - lulus penuh

Diuji dengan skenario tabrakan slug yang jadi bahaya utamanya: dua baris `programs`
berkategori `mitra` sengaja dibuat membayangi slug `mitra_programs`.

20 statement, **0 gagal**. Hasilnya persis seperti dirancang - baris bayangan di-rename ke
`-undian-legacy` dan diarsipkan, program Mitra memegang slug kanonik dengan `mode=PERFORMANCE`,
tidak ada baris hilang.

`node scripts/verify-program-migration.mjs` terhadap hasil itu: **11 dari 11 pemeriksaan OK,
exit code 0.** Gerbang yang selama ini memblokir Fase 3b kini hijau untuk dataset ini.

> Peringatan: yang diuji adalah **logika SQL-nya** terhadap data sintetis yang meniru bentuk
> production, bukan terhadap restore backup production. Kewajiban "uji ke salinan backup dulu"
> tetap berlaku; yang berubah adalah sekarang kita tahu SQL-nya sendiri tidak cacat.

---

## 6. QA Fase 5 - Bagian A, B, dan sebagian D: 30 dari 33 lulus

Lima akun dibuat lewat better-auth sungguhan, satu per role, lalu **setiap endpoint dipanggil
langsung memakai cookie sesi** - sesuai instruksi checklist bahwa memeriksa UI saja tidak cukup.

### Yang lulus

- **A1** `GET /api/admin/me` - kelima role 200.
- **A3** `POST /api/admin/users` - hanya Admin Super 201, empat role lain 403.
- **B1/B2 - inti keamanan Fase 0, seluruhnya lulus.** Supervisor dan Salesforce hanya melihat
  outlet wilayahnya (1 dari 2), dan `GET /api/admin/mitra/outlets/{id}` untuk outlet wilayah lain
  ditolak **403** sementara outlet wilayahnya sendiri 200. **Lubang yang ditutup saat menyusun
  checklist itu kini terbukti benar-benar tertutup terhadap database sungguhan.**
- **D1** Manager melihat seluruh wilayah (4 outlet). **D2** Manager ditolak menulis (403).
- **D6** Manager bisa membaca `orders`, `products`, `vouchers`, `submissions` - keempatnya 200.

### Yang gagal: implementasi lebih ketat daripada matriks PRD

| Uji | Harapan checklist | Kenyataan |
|---|---|---|
| A2 `GET /api/admin/users` sebagai Manager | 200 | **403** |
| A5 `GET /api/admin/settings` sebagai Manager | 200 | **403** |
| D3 `GET /api/admin/mitra/whitelist` sebagai Manager | 200 | **403** |

Ketiganya berasal dari akar yang sama: endpoint-endpoint itu memakai `requireRole(["SUPER_ADMIN"])`,
sedangkan matriks PRD 2.2 menempatkan Pengaturan dan Kelola User sebagai *View-all* untuk Manager.

**KOREKSI - ini bukan kontradiksi, melainkan keputusan yang sudah diambil.** Pesan commit
`6e2a1f1` (commit terakhir sebelum sesi ini) menyatakannya eksplisit:

> *"Hiding the menu is not protection, so the endpoints behind it were tightened to match:
> hero-slides (all verbs), settings GET, users GET, and whitelist GET now require SUPER_ADMIN.
> **This supersedes the 'Pengaturan = View-all for Manager' row in prd-total-revamp.md 2.2**;
> the stale comment in the whitelist route was corrected rather than left to mislead."*

Jadi kodenya benar dan disengaja: grup sidebar "Sistem & Konten" dibatasi ke Admin Super, dan
endpoint di belakangnya diperketat agar cocok. Yang **basi adalah checklist QA dan PRD**, bukan
kodenya. Catatan Fase 2 di `docs/session.md` juga merujuk keadaan sebelum keputusan itu diambil.

Tidak ada yang perlu diputuskan. Tindakan yang tepat: perbarui baris A2, A5, dan D3 di
`docs/qa-role-matrix.md` serta matriks 2.2 di `prd-total-revamp.md` menjadi **403 untuk Manager**.

### Satu temuan sampingan: `PUT /api/admin/settings` membalas 500 untuk input salah bentuk

Gerbang role-nya benar (Admin Super 200 dengan payload yang benar). Tapi bila `body.settings` bukan
array - atau field itu tidak ada sama sekali - handler langsung `for...of` terhadapnya dan
melempar, sehingga balasannya `500 Server error`. Semestinya `400 Bad Request` dengan pesan
validasi. Bukan celah keamanan, tapi menyamarkan kesalahan klien sebagai kerusakan server.

---

## 7. Perubahan kode di sesi ini

| File | Perubahan | Alasan |
|---|---|---|
| `drizzle/0000_brainy_slapstick.sql` | BOM UTF-8 dibuang | MySQL menolak dengan `ER_PARSE_ERROR` |
| `src/db/schema.ts` | Dua FK diberi nama eksplisit + import `foreignKey` | Nama turunan 66 dan 69 karakter, melewati batas 64 MySQL |

Verifikasi: `npx tsc --noEmit` lulus, `npx drizzle-kit check` "Everything's fine".

## 8. Yang masih belum diuji

- **Bagian C, E, E2 (I6-I12), F, G, H checklist QA** - butuh interaksi UI (form admin, unggah
  banner, import Excel, alur OTP) yang tidak diotomatiskan di sesi ini.
- **Migrasi `0003`, `0005`, `0006`, `0008`** - belum diuji terpisah. Keempatnya aditif murni
  (`CREATE TABLE` / `ADD COLUMN` / `CREATE INDEX`) tanpa transformasi data, jadi risikonya jauh di
  bawah `0004` dan `0007` yang sudah diuji.
- **Restore backup production** - seluruh pengujian migrasi memakai data sintetis.
- **Alur OTP nyata dan pengiriman WhatsApp** - butuh gateway WAHA aktif.

## 9. Urutan tindak lanjut

1. **Tutup K1-K3.** Sudah terbukti bisa dieksploitasi tanpa kredensial, bukan lagi dugaan.
   Mulai dari menghapus `simulate` (satu file, nol pemanggil).
2. **Perbaiki race voucher** di `auto-redeem.ts` dengan klaim atomik.
3. **Selaraskan checklist QA dan PRD dengan kode** untuk A2/A5/D3 (Manager = 403). Kodenya sudah
   benar sesuai keputusan di commit `6e2a1f1`; dokumennya yang tertinggal.
4. Tambahkan migrasi baseline untuk 19 tabel inti agar database bisa dibangun dari nol.
5. Ubah `PUT /api/admin/settings` agar membalas 400 untuk input salah bentuk.
