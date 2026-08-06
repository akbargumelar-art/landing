# Perbaikan Alur Pembayaran dan Auto-Redeem - 2026-08-06

Menutup temuan Kritis di `docs/audit-2026-08-06.md` yang sudah **terbukti dapat dieksploitasi**
pada `docs/uji-runtime-2026-08-06.md`, plus tiga bug di `auto-redeem.ts` yang ikut ketahuan.

Setiap perbaikan diverifikasi ulang terhadap MySQL 8.0.46 dan server dev yang benar-benar
berjalan — bukan hanya dibaca.

---

## 1. K1 - endpoint simulate dihapus

`src/app/api/public/orders/[id]/simulate/route.ts` **dihapus**, bukan dipagari. Komentarnya
sendiri menyebut dirinya endpoint sementara untuk pengujian, tidak ada satu pun pemanggil di
`src/`, dan penggantinya sudah ada (webhook gateway yang sah).

**Verifikasi:** `POST` ke jalur itu kini **404**, status order tetap `pending`.

## 2. K2 - webhook Mayar kini diverifikasi

Sebelumnya endpoint ini tidak memeriksa apa pun: siapa pun yang tahu nomor invoice bisa
menandai order lunas dengan mengirim JSON biasa.

- Setting baru **`mayar_webhook_token`**, diisi dari Pengaturan Website → Payment Gateway Mayar.id.
- `verifyMayarWebhook()` di `src/lib/mayar.ts` mencocokkan token terhadap beberapa nama header
  yang lazim dipakai Mayar (`x-callback-token`, `x-mayar-token`, `x-webhook-token`, dan
  `Authorization: Bearer`), memakai perbandingan waktu tetap (`crypto.timingSafeEqual`).
- **Fail-closed:** tanpa token tersimpan, webhook ditolak `503` dengan pesan log yang menyebut
  persis apa yang harus diisi. Token salah ditolak `403`.
- Pemeriksaan dilakukan **sebelum** menyentuh database.

**Verifikasi:** tanpa token → `503`; token salah → `403`; token benar → `200` dan order jadi
`success`. Ketiganya dengan status order diperiksa langsung di database.

> **WAJIB saat deploy:** isi `mayar_webhook_token` di Pengaturan **sebelum** atau segera setelah
> deploy. Selama kosong, pembayaran Mayar tidak akan tercatat otomatis. Ini konsekuensi yang
> disengaja — menerima webhook tak terverifikasi berarti membiarkan celah yang sudah terbukti.

## 3. K3 - webhook Midtrans dibuat fail-closed

Blok verifikasi sebelumnya dibungkus `if (config && signature_key)`, sehingga **tidak adanya
prasyarat berarti LOLOS**. Terbukti: cukup menghilangkan field `signature_key` dari body.

- Tanpa `midtrans_server_key` di Pengaturan → `503`, tidak lagi diteruskan.
- Body tanpa `signature_key` → `403`.
- Signature tidak cocok → `403` (seperti sebelumnya).
- `verifyMidtransSignature()` kini menolak bila salah satu komponen kosong, dan
  membandingkan dengan `crypto.timingSafeEqual` alih-alih `===`.

**Verifikasi:** tanpa signature → `503`; signature palsu → `403`; signature SHA512 yang benar →
`200` dan order jadi `success`.

---

## 4. Race condition voucher - ditutup

Bug yang hanya muncul di uji runtime: tiga redeem yang tumpang tindih memilih voucher yang sama,
sehingga **tiga pelanggan menerima kode yang identik** sementara stok hanya berkurang satu.

Sebabnya `SELECT ... WHERE is_used = false LIMIT 1` tanpa penguncian, dan penandaan `is_used`
baru terjadi ~5 detik kemudian setelah proses redeem selesai.

Sekarang `klaimVoucher()` memakai **compare-and-swap**: baris ditandai terpakai lebih dulu dengan
`is_used = false` ikut sebagai syarat `WHERE`, lalu `affectedRows` diperiksa. Hanya satu pemanggil
yang bisa memenangkan baris yang sama; yang kalah mengambil kandidat berikutnya (maksimal 5
percobaan). Bila redeem kemudian gagal, `lepasVoucher()` mengembalikannya ke stok supaya kodenya
tidak hangus percuma.

**Verifikasi (uji terisolasi, tiga webhook sah ditembak bersamaan):**

| | Sebelum | Sesudah |
|---|---|---|
| redemption sukses | 3 | 3 |
| voucher unik dibagikan | **1** | **3** |
| voucher tertandai terpakai | 1 | 3 |
| stok turun | 1 | 3 |

## 5. Idempotensi redeem - ditambahkan

Gateway pembayaran lazim mengirim ulang webhook. Tanpa penjagaan, setiap pengiriman ulang
menghabiskan satu voucher lagi untuk order yang sama. `triggerAutoRedeem()` kini berhenti lebih
awal bila order tersebut sudah punya `redemption_logs` berstatus `sukses`.

**Verifikasi:** webhook sah dikirim dua kali untuk order yang sama — jumlah voucher terpakai
tidak berubah pada pengiriman kedua.

## 6. Kegagalan "stok voucher habis" kini tercatat

`redemption_logs.voucher_id` adalah `NOT NULL` dengan foreign key ke `vouchers.id`, sementara
kode mengisinya dengan string `'NO-STOCK'`. Insert itu selalu ditolak
`ER_NO_REFERENCED_ROW_2`, melempar, tertangkap `catch` terluar, dan **kegagalan stok habis tidak
pernah punya jejak sama sekali**.

- Migrasi `0009` membuat kolomnya nullable.
- Kode mengisi `null`, bukan string palsu.
- Stok ikut diselaraskan pada jalur kegagalan.

**Verifikasi:** order untuk produk virtual tanpa voucher kini menghasilkan satu baris
`redemption_logs` berstatus `gagal` dengan `voucher_id = NULL` dan pesan yang jelas.

---

## 7. Migrasi `0009` - dibuat aman untuk production

Migrasi hasil `drizzle-kit generate` **tidak bisa dipakai apa adanya**. Ia menyertakan
`DROP FOREIGN KEY` untuk dua constraint yang namanya 66 dan 69 karakter — justru constraint yang
**tidak pernah bisa ada** di database mana pun karena melewati batas 64 karakter MySQL. `DROP`
polos terhadap constraint yang tidak ada gagal `ER_CANT_DROP_FIELD_OR_KEY` dan akan menggagalkan
seluruh deploy.

MySQL 8.0 tidak punya `DROP FOREIGN KEY IF EXISTS`, jadi migrasi ditulis ulang: setiap langkah
dijaga pemeriksaan ke `information_schema` lalu dijalankan sebagai prepared statement, satu
statement per `--> statement-breakpoint` (drizzle mengeksekusi satu query per statement, jadi
blok multi-statement akan ditolak). Referensi yatim dibersihkan lebih dulu supaya
`ADD CONSTRAINT` tidak ditolak oleh data lama.

**Verifikasi:** dijalankan terhadap database yang meniru kondisi production (kedua FK tidak ada,
`voucher_id` masih NOT NULL, ada referensi yatim di kedua tabel):

- Jalan pertama: **0 statement gagal**, kolom jadi nullable, kedua FK terpasang dengan nama baru,
  yatim dibersihkan, **tidak ada baris hilang**.
- Jalan kedua di atas hasilnya: **0 statement gagal** — idempoten.

---

## 8. Berkas yang berubah

| Berkas | Perubahan |
|---|---|
| `src/app/api/public/orders/[id]/simulate/route.ts` | **Dihapus** |
| `src/app/api/public/webhook/mayar/route.ts` | Verifikasi token webhook, fail-closed, sebelum akses DB |
| `src/app/api/public/webhook/midtrans/route.ts` | Verifikasi signature jadi fail-closed |
| `src/lib/mayar.ts` | `getMayarWebhookToken()`, `verifyMayarWebhook()`, perbandingan waktu tetap |
| `src/lib/midtrans.ts` | Tolak komponen kosong, `timingSafeEqual` menggantikan `===` |
| `src/lib/auto-redeem.ts` | Klaim voucher atomik, pelepasan saat gagal, idempotensi, logging stok habis |
| `src/db/schema.ts` | `redemptionLogs.voucherId` jadi nullable |
| `src/app/(hidden)/admin/pengaturan/page.tsx` | Field "Webhook Token" untuk Mayar |
| `drizzle/0009_redemption_log_nullable_voucher.sql` | Migrasi baru, berkondisi dan idempoten |

Verifikasi menyeluruh: `npx tsc --noEmit` lulus, lint terarah bersih (hanya dua peringatan
`<img>` lama yang tidak terkait), `npm run build` lulus penuh.

## 9. Yang belum dikerjakan

Masih terbuka dari `docs/audit-2026-08-06.md` dan `docs/uji-runtime-2026-08-06.md`:

1. **Endpoint submit form publik tanpa rate limit/honeypot** (`/api/forms/[formId]/submit`) —
   temuan Tinggi, belum disentuh.
2. **Kontradiksi role Manager** (A2/A5/D3) — kode, PRD, dan checklist QA saling bertentangan;
   butuh keputusan Anda, bukan perbaikan mekanis.
3. **Migrasi baseline untuk 19 tabel inti** supaya database bisa dibangun dari nol.
4. **`PUT /api/admin/settings` membalas 500** untuk input salah bentuk, semestinya 400.
5. **Dua route penyaji upload yang menyimpang** dan **SVG yang bisa jadi stored XSS**.
6. **`auto-redeem` masih simulasi** (`Math.random()`, `setTimeout` 5 detik) — sengaja tidak
   diubah karena tidak ada integrasi Telkomsel nyata untuk menggantikannya. Race dan
   idempotensinya sudah aman, tapi keputusan soal modul Belanja secara keseluruhan masih perlu
   diambil.
7. **Rantai deprecation gateway** (`doku`, `lynkid`) masih ada sebagai tombstone.
