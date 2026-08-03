# Checklist QA Matriks Akses per Role (Fase 5)

Checklist ini menguji Bagian 2.2 `prd-total-revamp.md` — matriks akses lima role internal.
Belum pernah dijalankan: butuh MySQL hidup untuk membuat akun per role.

**Prasyarat**

1. MySQL berjalan dan `DATABASE_URL` benar.
2. `npm run db:migrate` sudah dijalankan (migrasi `0003`, `0004`, `0005`).
3. Ada satu akun Admin Super untuk membuat akun lainnya. Bila belum ada, set
   `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAIL` ke email akun yang sudah ada, atau isi manual satu baris
   di `admin_user_profiles` dengan `role='SUPER_ADMIN'`.
4. Buat lima akun uji lewat `/admin/users` — satu per role. Untuk Supervisor dan Salesforce,
   tetapkan **hanya satu wilayah** supaya pembatasan area benar-benar teruji.
5. Pastikan ada minimal dua outlet di wilayah berbeda, agar kebocoran lintas wilayah terlihat.

**Cara menguji**

Pengecekan UI saja tidak cukup — menu yang disembunyikan bukan berarti endpoint-nya terlindungi.
Setiap baris "API" di bawah wajib dipanggil langsung (browser devtools, `curl`, atau REST client)
memakai cookie sesi akun uji, bukan hanya diklik dari antarmuka.

Kode status yang diharapkan: `200` boleh, `403` ditolak karena role, `401` belum login.

---

## A. Gerbang role dasar

| # | Uji | Admin Super | Admin Input | Manager | Supervisor | Salesforce |
|---|---|---|---|---|---|---|
| A1 | `GET /api/admin/me` mengembalikan role yang benar | 200 | 200 | 200 | 200 | 200 |
| A2 | `GET /api/admin/users` | 200 | 403 | 200 | 403 | 403 |
| A3 | `POST /api/admin/users` (buat akun) | 201 | 403 | 403 | 403 | 403 |
| A4 | `PUT /api/admin/users/{id}` (ubah role) | 200 | 403 | 403 | 403 | 403 |
| A5 | `GET /api/admin/settings` | 200 | 403 | 200 | 403 | 403 |
| A6 | `PUT /api/admin/settings` | 200 | 403 | 403 | 403 | 403 |
| A7 | Menu "Kelola User" tampil di sidebar | ya | tidak | tidak | tidak | tidak |

- [ ] A1  - [ ] A2  - [ ] A3  - [ ] A4  - [ ] A5  - [ ] A6  - [ ] A7

**Catatan khusus:** A4 — coba juga menurunkan role akun sendiri. Harus ditolak 400
("Tidak bisa menurunkan role akun sendiri"), supaya Super Admin terakhir tidak mengunci diri.

---

## B. Scoping wilayah (inti keamanan Fase 0)

Login sebagai **Supervisor** yang hanya ditugaskan ke Wilayah A.

| # | Uji | Harapan |
|---|---|---|
| B1 | `GET /api/admin/mitra/outlets` | 200, dan **hanya** outlet Wilayah A |
| B2 | `GET /api/admin/mitra/outlets/{id}` untuk outlet Wilayah B | 403 |
| B3 | `GET /api/admin/mitra/performance` | hanya baris outlet Wilayah A |
| B4 | Supervisor tanpa wilayah sama sekali | daftar kosong, bukan seluruh data |
| B5 | Ulangi B1–B4 sebagai **Salesforce** | perilaku identik dengan Supervisor |

- [ ] B1  - [ ] B2  - [ ] B3  - [ ] B4  - [ ] B5

### Dua celah scoping yang masih perlu keputusan (bukan bug jelas)

Penyisiran seluruh endpoint yang mengizinkan Supervisor/Salesforce menemukan dua tempat yang
**belum** memfilter wilayah. Keduanya sengaja tidak diubah karena butuh keputusan produk, bukan
sekadar perbaikan mekanis — tentukan saat menjalankan QA ini:

- `GET /api/admin/mitra/programs/[id]` mengembalikan **seluruh** peserta dan pemenang program
  (kode outlet, nama outlet, peringkat) lintas wilayah. Matriks PRD menyebut Program sebagai
  *View-area* untuk Supervisor/Salesforce, jadi idealnya daftar ini disaring ke wilayah mereka.
  Tidak diubah karena halaman admin Program memakai daftar lengkap ini untuk mengelola peserta;
  menyaringnya diam-diam bisa merusak alur Admin Super. Sensitivitasnya juga lebih rendah
  daripada detail performa (tidak memuat angka penjualan).
- `GET /api/admin/mitra` (ringkasan) mengembalikan jumlah agregat seluruh wilayah kepada kelima
  role. Berupa angka total, bukan data per outlet.

Putuskan: saring per wilayah, atau terima sebagai data non-sensitif dan catat keputusannya.

**Catatan B2 — lubang yang ditemukan saat menyusun checklist ini dan sudah ditutup.**
`GET /api/admin/mitra/outlets/[id]` semula mengizinkan kelima role tanpa memeriksa wilayah
outlet yang diminta, padahal endpoint daftar (B1) sudah memfilter. Artinya Supervisor atau
Salesforce yang tahu id outlet wilayah lain bisa membaca detail performanya — data yang bagi
pengunjung publik saja dilindungi OTP. Pemeriksaan `isTerritoryScopedRole` +
`getUserTerritoryIds` sudah ditambahkan pada handler tersebut. **Uji B2 tetap wajib dijalankan**
untuk mengonfirmasi perbaikan ini bekerja terhadap database sungguhan.

---

## C. Batas tulis Admin Input

Admin Input boleh membuat dan mengubah, tetapi tidak boleh menghapus permanen, rollback,
atau publish.

| # | Uji | Harapan |
|---|---|---|
| C1 | `POST /api/admin/mitra/outlets` | 201 |
| C2 | `DELETE /api/admin/mitra/outlets/{id}` | 403 |
| C3 | `DELETE /api/admin/mitra/outlets` (massal) | 403 |
| C4 | `POST /api/admin/indihome/products` | 201 |
| C5 | `DELETE /api/admin/indihome/products/{id}` | 403 |
| C6 | `DELETE /api/admin/programs/{id}` | 403 |
| C7 | `DELETE /api/admin/submissions/{id}` | 403 |
| C8 | `PUT /api/admin/mitra/programs/{id}` (publish pemenang) | 403 |

- [ ] C1  - [ ] C2  - [ ] C3  - [ ] C4  - [ ] C5  - [ ] C6  - [ ] C7  - [ ] C8

---

## D. Manager benar-benar read-only

| # | Uji | Harapan |
|---|---|---|
| D1 | `GET /api/admin/mitra/outlets` | 200, seluruh wilayah |
| D2 | `POST /api/admin/mitra/outlets` | 403 |
| D3 | `GET /api/admin/mitra/whitelist` | 200 |
| D4 | `POST /api/admin/mitra/whitelist` | 403 |
| D5 | Kartu Whitelist di Pengaturan menyembunyikan form tambah dan tombol aksi | ya |
| D6 | `GET /api/admin/orders`, `/products`, `/vouchers`, `/submissions` | 200 |
| D7 | `POST`/`PUT`/`DELETE` pada endpoint D6 | 403 |

- [ ] D1  - [ ] D2  - [ ] D3  - [ ] D4  - [ ] D5  - [ ] D6  - [ ] D7

---

## E. Whitelist OTP dan WAHA (Fase 2)

| # | Uji | Harapan |
|---|---|---|
| E1 | Tambah nomor satuan dari Pengaturan | tersimpan dan muncul di tabel |
| E2 | Tambah bulk (beberapa nomor, satu per baris) | laporan "N ditambahkan, M sudah terdaftar" |
| E3 | Bulk dengan nomor tidak valid disisipkan | nomor valid tetap masuk, yang invalid dilaporkan |
| E4 | Hapus nomor | hilang dari tabel, tercatat di `admin_audit_logs` |
| E5 | `/admin/mitra/whitelist` | 404 (halaman lama sudah dihapus) |
| E6 | Minta OTP dari nomor yang di-whitelist | OTP terkirim memakai konfigurasi WAHA dari Pengaturan |
| E7 | Minta OTP dari nomor yang tidak terdaftar | pesan generik yang sama, tidak membocorkan status |

- [ ] E1  - [ ] E2  - [ ] E3  - [ ] E4  - [ ] E5  - [ ] E6  - [ ] E7

---

## F. Hapus outlet (Fase 2)

| # | Uji | Harapan |
|---|---|---|
| F1 | Hapus satu outlet sebagai Admin Super | terhapus, tercatat di audit log |
| F2 | Detail/performa/peserta program outlet tersebut | ikut terhapus (cascade), tidak menyisakan baris yatim |
| F3 | Pilih beberapa outlet lalu "Hapus terpilih" | seluruhnya terhapus, audit log mencatat `DELETE_BULK` |
| F4 | Batalkan dialog konfirmasi | tidak ada yang terhapus |

- [ ] F1  - [ ] F2  - [ ] F3  - [ ] F4

---

## G. IndiHome lokasi dan banner (Fase 4)

| # | Uji | Harapan |
|---|---|---|
| G1 | Tambah lokasi baru dari tab "Lokasi & Banner" | muncul di dropdown halaman publik `/indihome` |
| G2 | Kirim pengajuan publik memakai lokasi baru itu | **diterima** (bukan "Pilih lokasi pemasangan yang tersedia") |
| G3 | Tetapkan lokasi baru ke sebuah paket | tersimpan, tidak dibuang diam-diam |
| G4 | Nonaktifkan lokasi | hilang dari dropdown publik, pengajuan lama tetap utuh |
| G5 | Hapus lokasi yang masih dipakai paket | ditolak dengan pesan menyebut nama paket |
| G6 | Unggah banner baru lalu aktifkan | hero `/indihome` berubah tanpa deploy |
| G7 | Matikan MySQL lalu buka `/indihome` | tetap 200 dengan hero dan lokasi fallback |

- [ ] G1  - [ ] G2  - [ ] G3  - [ ] G4  - [ ] G5  - [ ] G6  - [ ] G7

G2 adalah inti Fase 4: sebelum perbaikan, lokasi baru akan lolos di dropdown tetapi ditolak
oleh validasi server.

---

## H. Audit log

| # | Uji | Harapan |
|---|---|---|
| H1 | Setiap aksi tulis di atas tercatat di `admin_audit_logs` | ada barisnya |
| H2 | Isi `diff_json` | tidak memuat password, OTP, token, atau `wa_gw_token` |
| H3 | `GET /api/admin/mitra?resource=audit` sebagai non-Super-Admin | 403 |

- [ ] H1  - [ ] H2  - [ ] H3

---

## Hasil

Tanggal dijalankan: ______  Oleh: ______

Temuan yang harus ditindaklanjuti:

1. 
2. 
3. 
