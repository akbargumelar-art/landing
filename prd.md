# Product Requirements Document (PRD): Frontend Website & Portal Promo PT Agrabudi Komunika

## 1. Ringkasan Proyek
* **Nama Proyek:** Website Profil & Portal Promo PT Agrabudi Komunika
* **Objektif:** Membangun *landing page* profesional, modern, dan minimalis sebagai representasi digital Telkomsel Authorized Partner. Website ini akan menjadi pusat informasi perusahaan, portal promo, dan menyediakan sistem tersembunyi untuk pengumpulan data undian pelanggan beserta panel admin pengelolanya.
* **Wilayah Operasional:** Kab. Cirebon, Kota Cirebon, Kab. Kuningan.
* **Target Audiens:** Pelanggan ritel Telkomsel dan Mitra Outlet.
* **Referensi Visual:** telkomsel.com, abkciraya.cloud.

## 2. Spesifikasi Teknis & Infrastruktur
* **Pendekatan Development:** Vibe Coding
* **AI Model:** Opus 4.6
* **Framework/Tools:** Antigravity
* **Domain:** abkciraya.cloud
* **Deployment (VPS Hostinger):**
  * **OS:** Ubuntu 25.04
  * **IP Address:** 31.97.106.147
  * **Spesifikasi:** 4 CPU Cores, 16GB RAM, 200GB Disk Space
  * **Lokasi Server:** Indonesia
  * **Workflow:** Git push (local) -> Git pull (VPS)

## 3. Panduan Desain (UI/UX)
* **Tema Visual:** Profesional, modern, bersih (minimalis).
* **Palet Warna:** * Primary: Merah Telkomsel (tombol aksi, highlight).
  * Secondary: Putih & Abu-abu terang (background).
  * Text: Hitam/Abu-abu gelap pekat.
* **Tipografi:** Sans-serif modern (Inter/Roboto).
* **Responsivitas:** Wajib *Mobile-first approach* (dioptimalkan untuk layar *smartphone*).

## 4. Arsitektur Halaman Publik (Tampil di Navigasi)

### 4.1. Global Components
* **Navbar:** Logo perusahaan (kiri), Link Menu: Beranda, Program, Lokasi & Kontak (kanan). Efek *sticky header* saat di-scroll.
* **Footer:** Logo, deskripsi singkat, *badge* Telkomsel Authorized Partner, Tautan cepat, Copyright.

### 4.2. Beranda (Home)
* **Hero Section:** Slider/Korsel promo unggulan dengan navigasi panah.
* **Tentang Kami:** Profil singkat perusahaan dan area operasional.
* **Program Mitra Outlet:** Section khusus yang mempromosikan program mitra dengan tombol CTA mengarah ke eksternal: `poin.abkciraya.cloud`.

### 4.3. Program
* **Katalog Program:** Tampilan *grid card* berisi promo yang sedang berjalan (Thumbnail, Judul, Periode, Tombol "Detail").
* **Sub-halaman (Contoh: Undian Mingguan):** * Penjelasan syarat, ketentuan, dan mekanisme program.
  * **Galeri Pemenang:** Tampilan *grid* rapi untuk foto dokumentasi pemenang minggu sebelumnya.

### 4.4. Lokasi & Kontak
* **Kantor Pusat Cirebon:** Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132. (Sertakan CTA "Lihat di Google Maps").
* **Kantor Kuningan:** Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512. (Sertakan CTA "Lihat di Google Maps").
* **Kontak & Sosial Media:** * WhatsApp: +62 851-6882-2280
  * Instagram: https://www.instagram.com/agrabudikomunika
  * Facebook: https://tsel.id/fbciraya

## 5. Halaman Tersembunyi (Hidden Routes - Tanpa Navbar/Footer Publik)

### 5.1. Formulir Undian (`/form-undian`)
* **Fungsi:** Halaman khusus pelanggan untuk input data partisipasi.
* **UI/Layout:** Minimalis, hanya menampilkan logo di atas dan kotak form di tengah.
* **Input Fields:**
  * Nama Lengkap (Text)
  * Nomor Telkomsel (Number, validasi 08)
  * Nama Mitra Outlet (Text/Dropdown)
  * Bukti Pembelian (File Upload, mendukung drag-and-drop foto).
* **Interaksi:** Tombol *Submit* dengan animasi *loading*, dilanjutkan dengan UI pesan sukses/terima kasih.

### 5.2. Login Admin (`/admin-login`)
* **Fungsi:** Gerbang masuk administrator.
* **UI/Layout:** Background *full-screen*, *center card* login.
* **Input:** Username, Password, Tombol "Masuk".

### 5.3. Dashboard Admin (Setelah Login)
* **Layout:** Sidebar menu (kiri, bisa di-*collapse*) dan Main Content Area (kanan). Topbar berisi profil/logout.
* **Menu Kelola Konten & Program:** Tabel daftar konten, tombol "Tambah Baru" memunculkan modal form input konten.
* **Menu Data Undian:**
  * Tabel data pendaftar (Nama, No HP, Outlet, Waktu).
  * Kolom *Preview* Bukti Pembelian (klik untuk perbesar/ *lightbox*).
  * Status Validasi: Tombol/Toggle (Approve/Reject).
* **Fitur Acak Pemenang:** Panel khusus dengan tombol "Acak Pemenang" yang akan memilih satu nama secara acak (dengan animasi *rolling*) dari daftar peserta yang berstatus *Approved*.