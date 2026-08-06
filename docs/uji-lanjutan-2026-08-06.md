# Uji Runtime Lanjutan dan Rekomendasi Proses - 2026-08-06

Lanjutan dari `docs/uji-runtime-2026-08-06.md` dan `docs/perbaikan-pembayaran-2026-08-06.md`.
Menutup sisa checklist `docs/qa-role-matrix.md` yang bisa diotomatiskan, menguji empat migrasi
yang belum pernah dijalankan, dan membuktikan temuan Tinggi/Sedang dari audit.

Semua terhadap MySQL 8.0.46 di WSL dan server dev yang berjalan.

---

## RINGKASAN: satu temuan yang menghentikan deploy

**Migrasi `0003` — kedua statement backfill-nya GAGAL, dan deploy tidak bisa diulang.**

Ini migrasi RBAC yang oleh `docs/session.md` sudah ditandai sebagai prasyarat deploy paling
keras. Ternyata masalahnya bukan "jangan lupa jalankan" — **menjalankannya pun tidak berhasil.**

```
GAGAL #13: ER_NON_UNIQ_ERROR — Column 'user_id' in field list is ambiguous
GAGAL #14: ER_NON_UNIQ_ERROR — Column 'user_id' in field list is ambiguous

  user di database            : 4
  baris admin_user_profiles   : 0   <-- backfill tidak jalan
  baris admin_user_territories: 0
```

Penyebabnya klausa `ON DUPLICATE KEY UPDATE \`user_id\` = \`user_id\`` yang tidak menyebut nama
tabel. Kolom `user_id` ada di tabel tujuan **dan** di tabel yang di-join (`mitra_user_profiles`,
`mitra_user_territories`), jadi MySQL 8 menolak seluruh statement.

**Akibat berantai:**

1. Tabel RBAC terbentuk tetapi **kosong**. `getAdminSession()` mengembalikan `null` untuk setiap
   user yang tidak punya baris `admin_user_profiles`, kecuali akun bootstrap. Artinya
   **seluruh admin selain satu akun terkunci dari panel** — kebalikan persis dari yang dijanjikan
   komentar migrasinya sendiri ("agar tidak ada yang mendadak kehilangan akses").
2. **Mengulang deploy tidak menyelamatkan.** Diuji: pada percobaan kedua, **14 dari 14 statement
   gagal** — mulai `ER_TABLE_EXISTS_ERROR` di statement pertama. Database tertinggal separuh
   termigrasi dan `deploy.sh` akan macet di titik yang sama setiap kali.

**Sudah diperbaiki** dengan menyebut nama tabel secara lengkap. Diverifikasi dua arah di database
bersih:

| | Apa adanya | Setelah diperbaiki |
|---|---|---|
| statement gagal | 2 | **0** |
| profil ter-backfill | 0 dari 4 user | **4 dari 4** |
| pemetaan role | — | MANAGER→SUPER_ADMIN, ADMIN→ADMIN_INPUT, LEADER→SUPERVISOR, tanpa profil→SUPER_ADMIN |
| wilayah terbawa | 0 | 1 |

Aman diperbaiki karena `docs/session.md` mencatat migrasi `0003`-`0008` **belum pernah dijalankan
ke database mana pun**.

---

## Migrasi 0003, 0005, 0006, 0008

Diuji terisolasi di database khusus dengan tabel prasyarat dibangun menyerupai production.

| Migrasi | Hasil | Catatan |
|---|---|---|
| `0003` RBAC | **0 gagal** (setelah perbaikan di atas) | Backfill role dan wilayah benar |
| `0005` IndiHome lokasi/banner | **0 gagal** | 3 lokasi dan 1 banner ter-seed dari konstanta |
| `0006` index submissions | **0 gagal** | 3 index terbentuk: `form_idx`, `status_idx`, `submitted_idx` |
| `0008` template WA program | **0 gagal** | `wa_template` (text) dan `wa_notify_enabled` (tinyint) |

Catatan `0008`: pada percobaan pertama gagal `Unknown column 'p.mode'`. Itu **bukan bug** — kolom
`mode` ditambahkan `0004`, yang secara urutan berjalan lebih dulu. Fixture uji sayalah yang
melewati `0004`. Setelah fixture disesuaikan, `0008` lulus bersih.

Dengan ini, **seluruh migrasi `0003`–`0009` sudah pernah diuji terhadap MySQL sungguhan**
(`0004` dan `0007` di dokumen sebelumnya).

---

## QA Fase 5: bagian C, D, F, G, H

### Bagian C — batas tulis Admin Input: LULUS

Semua sesuai matriks: Admin Input boleh membuat, tidak boleh menghapus.

| Uji | Hasil |
|---|---|
| C1 POST outlets | 201 |
| C2 DELETE outlets/{id} | 403 |
| C3 DELETE outlets massal | 403 |
| C4 POST indihome/products | 201 |
| C5 DELETE indihome/products/{id} | 403 |
| C6 DELETE programs/{id} | 403 |
| C7 DELETE submissions/{id} | 403 |
| C8 PUT mitra/programs/{id} | 403 |

### Bagian D — Manager read-only: LULUS kecuali D3

`POST` ke `/api/admin/products`, `/api/admin/vouchers`, `/api/admin/mitra/outlets` sebagai
Manager: **403** semua. D4 (POST whitelist) 403.

**D3 mengembalikan 403** sementara checklist mengharapkan 200 — sama seperti A2/A5. **Ini bukan
bug dan bukan kontradiksi:** commit `6e2a1f1` sengaja memperketat `settings GET`, `users GET`, dan
`whitelist GET` ke `SUPER_ADMIN`, dan menyatakan hal itu **menggantikan** baris "Pengaturan =
View-all for Manager" di `prd-total-revamp.md` 2.2. Kodenya benar; **checklist QA dan PRD yang
belum diperbarui.**

### Bagian F — hapus outlet dan cascade: LULUS

Hapus satuan 200; baris `mitra_outlet_details` ikut hilang (cascade terbukti); hapus massal 200
dan kedua outlet benar-benar terhapus.

### Bagian G — IndiHome: LULUS 9/9

**G2 adalah inti Fase 4 dan terbukti bekerja:** lokasi yang baru ditambahkan admin langsung
diterima endpoint pengajuan publik, tanpa deploy. Lokasi ngawur tetap ditolak 400.

Juga terverifikasi: lokasi baru benar-benar tersimpan di cakupan paket (tidak dibuang diam-diam);
menghapus lokasi yang masih dipakai paket ditolak dengan pesan yang **menyebut nama paketnya**;
menonaktifkan lokasi menghilangkannya dari publik sementara lead lama tetap utuh.

### Bagian H — audit log: LULUS

Aksi `CREATE` dan `DELETE_BULK` tercatat dengan `user_id` pelakunya. **Tidak ada** `diff_json`
yang memuat `password`, `otp`, `token`, `wa_gw_token`, atau `code_hash`. `GET /api/admin/mitra?
resource=audit` sebagai Admin Input maupun Manager: **403**.

---

## Temuan baru dari pengujian ini

### BARU — halaman IndiHome bisa menampilkan paket yang tidak bisa dipesan

Ketika tabel `indihome_products` kosong (atau query-nya gagal), `/api/public/indihome/products`
menyajikan katalog **fallback statis** dengan id seperti `internet-75`. Tetapi `POST` lead
memvalidasi `packageId` terhadap **tabel**, bukan terhadap katalog yang ditampilkan.

Dibuktikan dengan meniru pengunjung memilih paket pertama dari katalog yang sedang tampil:

```
Katalog publik : source=fallback, 4 paket
Pilih          : "Internet Rumah 75" (id=internet-75) di "Kota Cirebon"
Hasil          : HTTP 400 {"error":"Paket tidak tersedia untuk lokasi yang dipilih."}
```

Pengunjung mengisi seluruh form lalu ditolak di langkah terakhir, dengan pesan yang **menyesatkan**
— lokasinya tersedia; paketnyalah yang tidak ada di database.

Ini pola bug yang **persis sama** dengan yang diperbaiki Fase 4 untuk lokasi ("dropdown
menampilkan, server menolak"), hanya belum ditutup untuk paket. Dan justru muncul pada kondisi
yang menjadi alasan fallback itu dibuat: database belum siap atau migrasi belum jalan.

Perparah: `catch {}` di route itu **kosong sepenuhnya**, jadi penyebab aslinya tidak pernah
tercatat di log.

### KOREKSI temuan audit sebelumnya — S2b tidak terbukti

`docs/audit-2026-08-06.md` menyebut gerbang `if (file.type && !allowedTypes.includes(file.type))`
bisa dilewati dengan `file.type` kosong. **Diuji, dan tidak bisa.** Klien HTTP normal selalu
mengisi content-type bagian berkas (default `application/octet-stream`), yang tidak ada di
allowlist sehingga ditolak **400**. Klaim itu benar secara pembacaan kode tetapi tidak bisa
dicapai lewat HTTP biasa.

---

## Temuan audit yang TERBUKTI di runtime

### Tinggi — submit form Undian tanpa rem sama sekali

20 submission dikirim **bersamaan dari satu sumber**:

```
  selesai dalam 3816 ms
  HTTP 2xx      : 20
  HTTP 429      : 0
  baris masuk DB: 20 dari 20
```

Pembanding yang sah (dengan paket nyata di tabel supaya validasi lolos sampai ke rate limit),
endpoint lead IndiHome:

```
  #1..#5: HTTP 201
  #6, #7, #8: HTTP 429 "Pengajuan terlalu sering."
```

Jadi mekanismenya **sudah ada dan terbukti bekerja** di satu endpoint, hanya tidak pernah dibawa
ke endpoint Undian yang volumenya lebih besar dan yang menulis file ke disk serta mengirim WhatsApp.

### Sedang — dua route penyaji upload sudah menyimpang

Berkas `.ico` yang **identik**, disajikan lewat dua route:

| Route | Content-Type |
|---|---|
| `/api/public/uploads/qa-favicon.ico` | `image/x-icon` |
| `/api/public/uploads/qa-subfolder/qa-favicon.ico` | `application/octet-stream` |

Versi catch-all tidak memetakan `.ico`, jadi berkas di subfolder tidak akan dirender browser.

### Sedang — SVG berisi skrip disajikan same-origin

SVG dengan `<script>` di dalamnya berhasil diunggah dan disajikan:

```
  Content-Type        : image/svg+xml
  skrip utuh di badan : true
  CSP                 : (tidak ada)
  Content-Disposition : (tidak ada)
```

Tanpa CSP dan tanpa `Content-Disposition`, berkas ini berjalan sebagai dokumen di origin yang sama
dengan panel admin. Butuh akses admin untuk mengunggah, jadi bukan kritis — tetapi berarti admin
berperan rendah bisa mencuri sesi Admin Super.

Terkait: ekstensi diambil dari nama berkas kiriman, bukan diturunkan dari MIME tervalidasi. Berkas
ber-MIME `image/png` tersimpan sebagai `.html`. Dampaknya terbatas karena `.html` tidak ada di peta
content-type sehingga disajikan `application/octet-stream` (diunduh, bukan dirender).

---

## Perubahan kode di sesi lanjutan ini

| Berkas | Perubahan |
|---|---|
| `drizzle/0003_admin_rbac_foundation.sql` | Kedua `ON DUPLICATE KEY UPDATE` diqualify dengan nama tabel |

Verifikasi: `npx drizzle-kit check` "Everything's fine", `npx tsc --noEmit` lulus.

---

# REKOMENDASI PROSES LANJUTAN

## Tahap 1 — sebelum menyentuh production (wajib, berurutan)

1. **Restore backup production ke database uji, lalu jalankan `npm run db:migrate`.**
   Ini satu-satunya langkah yang belum pernah dilakukan. Seluruh pengujian migrasi sejauh ini
   memakai data sintetis. Perbaikan `0003` menghilangkan blocker yang sudah pasti, tapi hanya
   data nyata yang bisa menunjukkan kejutan seperti nilai enum tak terduga atau referensi yatim.
2. **`node scripts/verify-program-migration.mjs`** terhadap database uji itu. Harus 11/11 dan
   exit 0. Ini gerbang Fase 3b.
3. **Isi `mayar_webhook_token`** di Pengaturan. Tanpa itu pembayaran Mayar tidak tercatat
   (konsekuensi fail-closed yang disengaja).
4. **Turunkan role satu per satu di `/admin/users`.** Backfill `0003` memberi `SUPER_ADMIN` ke
   setiap user tanpa profil Mitra. Sampai langkah ini dilakukan, RBAC belum berefek sama sekali.

## Tahap 2 — perbaikan yang masih terbuka, urut dampak

| Prioritas | Item | Alasan |
|---|---|---|
| 1 | Rate limit + honeypot di `/api/forms/[formId]/submit` | Terbukti 20/20 tembus; menulis file dan mengirim WhatsApp. Pakai ulang pola IndiHome, jangan tulis mekanisme ketiga |
| 2 | Validasi paket IndiHome saat katalog fallback | Pengunjung nyata ditolak di langkah terakhir dengan pesan menyesatkan |
| 3 | Perbarui `qa-role-matrix.md` dan `prd-total-revamp.md` untuk A2/A5/D3 | Manager = 403 sudah diputuskan di commit `6e2a1f1`; hanya dokumennya yang tertinggal |
| 4 | Migrasi baseline 19 tabel inti | Tanpa itu tidak ada cara reprodusibel membangun staging; ini akar semua blokade sebelumnya |
| 5 | Satukan dua route penyaji upload | Pertahankan `[...filename]`, salin peta content-type lengkap, hapus `[filename]` |
| 6 | CSP + `Content-Disposition` untuk unggahan | Tutup stored XSS via SVG; turunkan ekstensi dari MIME tervalidasi |
| 7 | `PUT /api/admin/settings` balas 400, bukan 500 | Menyamarkan kesalahan klien sebagai kerusakan server |
| 8 | Hapus tombstone `doku`/`lynkid` + `src/lib/doku.ts` | Kerapian; rantai deprecation-nya menunjuk ke endpoint yang juga mati |
| 9 | Isi `catch {}` kosong di route katalog IndiHome | Menelan penyebab asli kegagalan |

## Tahap 3 — mencegah kelas bug ini terulang

Semua temuan terberat sesi ini punya satu pola: **kode yang tidak pernah dijalankan terhadap
database.** Migrasi yang tidak pernah diterapkan, verifikasi yang dibungkus `if` sehingga tidak
pernah dievaluasi, cabang error yang selalu melempar, race yang hanya muncul saat bersamaan.

1. **Jadikan MySQL WSL bagian dari alur kerja normal.** Sudah terpasang. Prosedurnya ada di
   `docs/uji-runtime-2026-08-06.md` bagian 1, termasuk tiga jebakannya.
2. **Setiap migrasi baru wajib dijalankan ke database uji sebelum di-commit** — bukan hanya
   `drizzle-kit check`, yang tidak menangkap satu pun dari tiga blocker yang ditemukan.
   Uji juga **menjalankannya dua kali** (idempotensi) dan **dari kondisi mirip production**,
   bukan hanya dari database kosong.
3. **Jangan pernah percaya `drizzle-kit generate` untuk migrasi yang menyentuh constraint.**
   Terbukti dua kali menghasilkan SQL yang menggagalkan deploy: `DROP FOREIGN KEY` untuk
   constraint yang tidak pernah bisa ada (0009), dan nama constraint melebihi 64 karakter.
4. **Aturan fail-closed untuk semua verifikasi.** Pola `if (config && signature) { verifikasi }`
   berarti prasyarat yang hilang = lolos. Sisir apakah ada pola serupa yang tersisa.
5. **Uji jalur kegagalan, bukan hanya jalur sukses.** Dua bug (`voucher_id = 'NO-STOCK'` dan
   backfill `0003`) berada di kode yang hanya berjalan saat ada masalah — jadi tidak pernah
   berjalan saat pengujian normal.
6. **Untuk apa pun yang memakai stok terbatas, uji secara bersamaan.** Race voucher tidak
   terlihat sama sekali pada pengujian berurutan.
7. **Selaraskan PRD, checklist QA, dan kode.** `docs/session.md` mengklaim satu perubahan
   (whitelist GET untuk Manager) yang tidak ada di kode. Kalau dokumen bisa menyimpang tanpa
   ketahuan, checklist QA berhenti bisa dipercaya sebagai gerbang.

## Yang tetap belum diuji

- **Bagian E** checklist (alur OTP dan WAHA nyata) — butuh gateway WhatsApp aktif.
- **Bagian E2/I6–I12** — interaksi UI: form admin outlet, import Excel, unduh template,
  pratinjau tautan Maps, profil publik outlet.
- **G6 dan G7** — unggah banner dari UI, dan perilaku `/indihome` saat MySQL sengaja dimatikan.
- **Restore backup production** — seluruh pengujian migrasi masih memakai data sintetis.
