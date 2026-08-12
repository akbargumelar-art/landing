# Catatan Rilis — KPI Salesforce, Akses Login Operasional, dan OTP Baca-Saja

**Branch:** `fix/payment-webhooks-and-migration-blockers` → `main`
**Tanggal:** 11 Agustus 2026
**Status:** menunggu review dan migrasi database

> Dokumen ini sekaligus menjadi isi Pull Request. Salin apa adanya bila membuat PR lewat
> antarmuka GitHub: https://github.com/akbargumelar-art/landing/compare/main...fix/payment-webhooks-and-migration-blockers?expand=1

---

## Ringkasan

Menggabungkan 46 commit pekerjaan Portal Mitra yang belum masuk `main`. Tiga kelompok besar:

1. **Penilaian KPI Salesforce** — mekanisme program ketiga di samping Racing dan Reward, dengan
   Compliance, Performance, dan Benefit (reward/punishment) beserta tampilan publik ber-OTP yang
   menyediakan drill-down TAP → Salesforce → Outlet.
2. **Akses login operasional & OTP baca-saja** — OTP tidak lagi dapat mengubah data apa pun;
   seluruh perubahan outlet berpindah ke akun login dengan wewenang per petugas dan per TAP.
3. **Pekerjaan Mitra terdahulu** — monitoring foto, galeri, laporan perubahan outlet, market share
   pasca-merger, notifikasi kunjungan WhatsApp, dan tabel admin yang bisa diurutkan.

## Perubahan keamanan yang perlu diperhatikan reviewer

Tiga celah wewenang ditutup pada rangkaian commit terakhir:

- **Eskalasi bootstrap.** `getAdminSession()` memberi `SUPER_ADMIN` kepada pengguna login yang
  tidak punya baris `admin_user_profiles`, selama emailnya cocok dengan email bootstrap — yang
  jatuh ke nilai terdokumentasi publik `admin@abkciraya.com`. Jalur itu kini menutup sendiri
  begitu ada satu `SUPER_ADMIN` aktif, dan setiap pemakaiannya masuk audit log.
- **Salesforce membaca data rekan setimnya.** Query outlet, performance, photo-gallery, dan
  photo-monitoring sebelumnya hanya membatasi lewat TAP. Satu TAP berisi banyak petugas, jadi
  seorang salesforce ikut melihat dan membaca performance seluruh outlet binaan rekannya.
  Pembatasan kini memakai TAP **dan** identitas petugas, diterapkan di kondisi query.
- **Lockout yang tidak pernah berlaku.** Kolom `locked_until` sudah lama ada tetapi tidak pernah
  dibaca kode mana pun. Akun terkunci kini ditolak sebelum peran maupun scope diperiksa.

Selain itu, sesi OTP yang semula berlaku sepuluh tahun dipersingkat menjadi 30 hari, dan
disediakan pencabutan sesi per nomor.

## Wewenang peran lapangan

Salesforce dan Supervisor hanya dapat **mengubah data outlet dan mengunggah fotonya**; selebihnya
hanya melihat.

| Kemampuan | Salesforce | Supervisor |
|---|---|---|
| Profil operasional, branding, foto outlet | Outlet binaan sendiri | Seluruh TAP yang ditugaskan |
| Titik lokasi outlet | GPS perangkat saja, tidak bisa diketik | GPS perangkat saja |
| Kode outlet, Nomor RS, TAP, Salesforce, status | Tidak bisa diubah | Tidak bisa diubah |
| Monitoring foto, galeri, laporan perubahan | Lihat | Lihat |
| Program Salesforce | Lihat hasil sendiri | Lihat data TAP-nya |
| Menu kantor lainnya | Tertutup | Tertutup |

Halaman yang tidak boleh dibuka peran tersebut ditutup di layout, bukan sekadar disembunyikan
menunya — alamatnya tetap bisa diketik, dan yang muncul sebelumnya adalah layar penuh kontrol yang
setiap aksinya ditolak API.

## Yang WAJIB dilakukan sebelum merge dan deploy

- [ ] **Jalankan migrasi `0035`** pada salinan database lebih dulu. Migrasi bersifat aditif
      (tambah kolom dan tabel), sehingga rollback aplikasi tidak menuntut rollback database.
- [ ] **Uji runtime dengan MySQL hidup dan sesi login nyata.** Unit test pada rilis ini hanya
      menguji logika murni (predikat scope dan allowlist field), bukan perilaku endpoint terhadap
      database. Kelulusan tidak boleh disimpulkan dari TypeScript, ESLint, atau build.
- [ ] **Uji tombol lokasi pada perangkat sungguhan lewat HTTPS.** `navigator.geolocation` tidak
      berjalan di origin non-secure, sehingga alur GPS tidak dapat diverifikasi dari localhost biasa.
- [ ] **Ikuti urutan naik ini** — rilis ini memuat commit yang mematikan jalur tulis-OTP, sementara
      jalur penggantinya menuntut akun yang sudah siap:
      1. Naikkan migrasi dan buat seluruh akun Salesforce/Supervisor, **selagi jalur lama masih
         hidup**. Tahap ini tidak mengubah apa pun bagi pengguna lapangan.
      2. Verifikasi setiap akun benar-benar bisa login dan melihat outlet yang benar.
      3. Baru naikkan build ini.

      Menaikkan sekaligus akan menghentikan pembaruan foto lapangan pada hari yang sama, karena OTP
      tidak lagi bisa menulis sementara akunnya belum tentu siap.

## Rencana pengujian

| Skenario | Harapan |
|---|---|
| Sesi OTP valid membuka detail outlet | Data tampil, tidak ada kontrol edit |
| Sesi OTP mengirim POST ke profile/photo/location/branding | 403 `LOGIN_REQUIRED_FOR_WRITE` |
| Salesforce A membuka outlet Salesforce B (TAP sama) via URL langsung | 404 |
| Supervisor TAP A membuka outlet TAP B | 404 |
| Salesforce menyimpan profil/branding/foto outlet binaannya | Tersimpan, audit ber-`actorUserId` |
| Salesforce menekan Update Lokasi di depan outlet | Tersimpan beserta ketelitiannya |
| Pembacaan GPS dengan ketelitian di atas 200 m | 422, koordinat lama tidak berubah |
| Payload edit menitipkan `tap` atau `status` | 400, tidak ada yang tersimpan sebagian |
| Manager mencoba mengubah outlet | 403 |
| Peran lapangan membuka `/admin/pengaturan` lewat URL | Halaman tertutup, bukan layar konfigurasi |
| Akun dinonaktifkan saat sesinya masih hidup | Request berikutnya ditolak |
| Detail program dibuka Salesforce | Hanya hasil sendiri; peserta lain tidak ada di payload |

## Verifikasi yang sudah dijalankan

- `npm test` — 20/20 lulus (matriks scope, allowlist field mutasi, dan permukaan tulis API)
- `npx tsc --noEmit` — bersih
- `npm run lint` — bersih, hanya tersisa warning `<img>` lama yang tidak terkait
- `npm run build` — lulus, seluruh route baru masuk output

Seluruhnya statis. Belum ada satu pun pengujian terhadap database hidup atau sesi login nyata.

## Dokumen terkait

- [`prd-akses-login-operasional-mitra.md`](./prd-akses-login-operasional-mitra.md)
- [`prd-kpi-salesforce.md`](./prd-kpi-salesforce.md)
- [`session.md`](./session.md) — catatan keputusan dan hal yang belum dikerjakan
