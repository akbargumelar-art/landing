# Ringkasan Aplikasi: ABK Ciraya (Agrabudi Komunika Cirebon Raya)

Ini adalah ringkasan lengkap mengenai arsitektur, teknologi, infrastruktur, dan fitur dari aplikasi web pendaftaran program dan undian **ABK Ciraya**.

---

## 🏗️ 1. Infrastruktur & Teknologi (Tech Stack)

Aplikasi ini dibangun menggunakan tumpukan teknologi modern berpusat pada ekosistem **JavaScript/TypeScript** dengan arsitektur *Fullstack Serverless/Server-rendered*.

- **Framework Utama:** **Next.js 15.3** (menggunakan *App Router* terbaru untuk performa SSR/RSC dan optimasi SEO).
- **Library UI:** **React 19** dipadukan dengan konfigurasi **Tailwind CSS 4.0** untuk *styling*, serta ekosistem komponen **Shadcn UI** (berbasis *Radix UI* *Primitves*) dan ikon dari **Lucide React**.
- **Bahasa Pemrograman:** **TypeScript** untuk keamanan pengetikan kode (*Type-safety*).
- **Database & ORM:** Menggunakan database rasional **MySQL** dengan **Drizzle ORM** (`drizzle-orm` & `drizzle-kit`) untuk mengelola koneksi, pemetaan data, dan migrasi struktur tabel (*schemas*).
- **Autentikasi:** **Better Auth** digunakan untuk manajemen *login* (*Session/Token*), pengguna, dan batasan Hak Akses (Role: *Admin*, *Viewer*, *Input*).
- **Layanan Pihak Ketiga (Integrasi):** **WAHA (WhatsApp HTTP API)** berjalan untuk automasi pengiriman pesan ke pelanggan secara *real-time*.
- **Deployment & Server:** Dideploy (*Hosting*) pada *Virtual Private Server* (VPS) Linux Ubuntu/Debian (`abkciraya.cloud`) dengan manajemen kode menggunakan **GitHub** dan diperbarui (*Update*) menggunakan *bash script* internal `deploy.sh`.

---

## 🌐 2. Area Publik (Halaman Pelanggan / Frontend)

Antarmuka (*UI*) yang dapat diakses luas oleh pengunjung web dan mitra tanpa perlu *login*. Berada di bagian *route* `/(public)`.

- **Beranda (`/`):** Menampilkan *Hero Slider* (korsel gambar gonta-ganti), Tentang Perusahaan (*About Us*), dan 3 Program Unggulan utama bulan ini.
- **Portal Program (`/program`):** Halaman direktori yang mendaftar seluruh program aktif yang diselenggarakan oleh ABK Ciraya. Dibagi atas saringan (*Filter*): **Program Pelanggan** dan **Program Mitra Outlet**.
- **Detail Program & Pendaftaran (`/program/[slug]`):**
  - Menampilkan deksripsi program, masa berlaku, dan *banner*.
  - **Formulir Pendaftaran Dinamis:** Pengunjung dapat mendaftar program langsung dengan form yang bisa dibentuk sesuka hati oleh Admin.
  - **Daftar Peserta:** Menampilkan daftar nama peserta yang *(Collapse/Expand)* dan fitur sensor privasi (*Masking* data nama dan no HP, misal: `Ak*** Gume***`).
  - **Galeri Pemenang:** Menampilkan pemenang-pemenang undian masa lampau yang sudah diberikan hadiah (lengkap dengan Nama Hadiah).
- **Belanja (`/belanja`):** Etalase produk atau *Voucher* Telkomsel yang dapat dibeli/ditebus oleh Mitra maupun pelanggan. Lokasi Cirebon & Kuningan.

---

## 🔐 3. Area Admin Panel (Backend Control)

Panel Kontrol rahasia pengelola website. Berada di bagian *route* `/(hidden)/admin`. Fitur utamanya luar biasa komprehensif:

### A. Manajemen Konten Digital
- **Pengaturan Website:** Konfigurasi inti web, *Meta Data*, konfigurasi integrasi URL API & Token WAHA (Sistem Notifikasi WhatsApp), dan Format Pesan Otomatis (*Template* pesan pendaftaran unik dengan variabel seperti `{nama lengkap}`).
- **Kelola Beranda:** Mengatur *Slider* gambar utama dan teks profil About Us.
- **Kelola Program:** Tambah/Hapus program, atur kategori program, dan set status publikasi (*Draft / Terbit*).

### B. Form Builder & Pengumpulan Data
- **Kelola Form:** Modul eksklusif yang memampukan admin **merangkai formulir pendaftaran sendiri** (tipe *Text, Textarea, Image Upload*, dll) dan menempelkannya ke suatu Program.
- **Data Peserta:** Dasbor khusus untuk membaca seluruh masukan (*Submission*) dari masyarakat, melihat foto struk yang diunggah, dengan kapabilitas ekspor ke **Microsoft Excel** (`.xlsx`).

### C. Mesin Undian (Lottery System)
- **Undi Pemenang:** Sistem komputerisasi pengundian (*Digital Spinner*) mirip *giveaway*.
- Admin dapat memilih "Program" dan "Hadiah", lalu akan muncul nama acak yang berputar kencang, berhenti, dan menjatuhkan hujan konfeti 🎉🎉 .
- Menyimpan histori pemenang secara otomatis sehingga bisa ditampilkan kembali di halaman publik (beserta rincian hadiah).

### D. Manajemen Transaksi Belanja
- **Produk Belanja & Stok Voucher:** Kontrol penuh atas penambahan, pengubahan gambar, harga, dan sisa stok barang jualan.
- **Pesanan Masuk:** Lacak pesanan masuk, ubah status, dan kelola log aktivitas modifikasi per transaksi berdasarkan akses *Role*.

### E. Sistem Akun & Keamanan
- **Profil Admin & Role:** Memiliki perjenjangan Hak Akses seperti *Role* "Admin" yang bisa merubah segalanya, hingga "Input" yang hanya diberi akses sebatas mengurus Logika Transaksi/Pesanan, untuk audit dan penelusuran.
- **History Logs:** Seluruh rekam jejak penghapusan atau penambahan data oleh staf dicatat di dalam Log Aktivitas rahasia.

---

*Aplikasi ini terus dikembangkan (Active Development) dan memilki ketahanan performa tinggi karena memanfaatkan kemampuan "Static-Caching" dan arsitektur Next.js termutakhir.*
