# Street View di Halaman Mitra Outlet

Panel Street View di `/mitra` dan di profil outlet `/mitra/o/[publicToken]` memakai
**Google Maps Embed API**. Peta sebarannya sendiri tetap OpenStreetMap/Leaflet dan tidak
memerlukan Google sama sekali.

Alasan memilih Embed API, bukan Maps JavaScript API:

| | Maps Embed API (dipakai) | Maps JavaScript API |
|---|---|---|
| Biaya | Tidak ditagih per pemuatan | Ditagih tiap peta/panorama dimuat |
| Bentuk | `<iframe>` | Skrip yang dikendalikan dari halaman |
| Kustomisasi | Hanya titik awal panorama lewat URL | Penuh |

Karena isi iframe tidak bisa dikendalikan dari halaman, yang bisa diatur hanya titik awal
panorama tiap outlet. Itu sudah cukup untuk kebutuhan "lihat depan outlet sekilas".

## Langkah membuat API key

1. Buka <https://console.cloud.google.com/> dan login dengan akun Google milik perusahaan
   (jangan akun pribadi — key ini mengikat ke akun yang membuatnya).
2. Buat project baru, misalnya `abk-ciraya-maps`, lewat pemilih project di kiri atas.
3. **Aktifkan billing** pada project itu (menu *Billing*). Google mewajibkan kartu terdaftar
   walaupun Embed API tidak ditagih. Tanpa billing, key akan menolak permintaan.
4. Masuk ke *APIs & Services → Library*, cari **Maps Embed API**, klik **Enable**.
   Hanya API ini yang perlu diaktifkan. Jangan aktifkan Maps JavaScript API kalau tidak
   dipakai — makin sedikit API aktif, makin kecil risiko tagihan tak terduga.
5. Masuk ke *APIs & Services → Credentials → Create credentials → API key*. Salin key-nya.

## Membatasi key (wajib, jangan dilewati)

Key ini ikut terkirim ke browser pengunjung (`NEXT_PUBLIC_`), jadi siapa pun bisa
membacanya dari source halaman. Pembatasan berikut yang membuatnya tidak bisa dipakai
orang lain:

1. Pada key yang baru dibuat, klik **Edit**.
2. *Application restrictions* → pilih **Websites**, lalu tambahkan:
   - `https://abkciraya.cloud/*`
   - `https://*.abkciraya.cloud/*`
   - `http://localhost:3000/*` (hapus setelah selesai mengembangkan)
3. *API restrictions* → pilih **Restrict key**, centang **Maps Embed API** saja.
4. Simpan. Perubahan pembatasan kadang butuh beberapa menit sampai berlaku.

Pembatasan referrer inilah alasan iframe di `street-view-panel.tsx` memakai
`referrerPolicy="no-referrer-when-downgrade"` — Google mencocokkan daftar di atas dengan
header referrer permintaan. Jika referrer tidak terkirim, key yang dibatasi domain ditolak.

## Memasang key

Isi di `.env` (lokal) dan di environment server produksi:

```
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=AIza...
```

Variabel `NEXT_PUBLIC_*` **ditanam saat build**, bukan dibaca saat runtime. Jadi setelah
mengisinya di server, jalankan build ulang (`npm run build`) — restart saja tidak cukup.

Kalau variabel ini kosong, tombol "Lihat Street View" dan panelnya tidak dirender sama
sekali, dan halaman `/mitra` tampil persis seperti sebelum fitur ini ada.
`npm run env:check` akan mengingatkan lewat warning, bukan error.

## Cara memakainya di halaman

Di direktori `/mitra`:

- Klik kartu outlet mana pun yang punya koordinat → peta memfokuskan penandanya **dan**
  panel Street View terbuka di sebelahnya.
- Atau klik penanda di peta, lalu tekan **Lihat Street View** di dalam popup-nya.
- Tombol **Tutup** mengembalikan peta ke lebar penuh.

Di profil outlet `/mitra/o/[publicToken]`, pada kartu **Sekitar Outlet**:

- Tombol **Street View** di kanan header membuka panorama outlet yang sedang dibuka.
- Penanda outlet tetangga maupun titik ODP di peta itu juga punya **Lihat Street View**
  di dalam popup-nya, jadi sekitar outlet bisa ditelusuri tanpa pindah halaman.
- Semua ini tampil sebelum OTP, sama seperti petanya: yang dikirim ke Google hanya
  koordinat, bukan nama ODP atau kapasitas portnya.

## Batasan yang perlu diketahui

- Panorama diambil dari titik jalan terdekat dengan koordinat outlet. Untuk outlet di gang
  kecil atau daerah yang belum dilalui mobil Street View, Google menampilkan panorama
  terdekat yang ada — bisa jadi beberapa puluh meter meleset, atau kotak kosong.
- Akurasinya bergantung pada koordinat outlet di admin. Koordinat yang asal isi akan
  memperlihatkan lokasi yang salah, bukan error.
- Umur foto panorama mengikuti Google (bisa beberapa tahun lalu), jadi jangan dipakai
  sebagai bukti kondisi outlet terkini.
