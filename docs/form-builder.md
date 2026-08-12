Tolong rombak total fitur "Kelola Form Peserta" menjadi sebuah Advanced Visual Form Builder (seperti Google Forms/Typeform) yang interaktif dan dinamis, bukan sekadar form input biasa. 

Saya ingin admin memiliki kanvas drag-and-drop untuk merancang layout halaman form dengan fitur-fitur berikut:

1. Kanvas Builder & Layout Halaman:
- Sediakan area kanvas drag-and-drop di sebelah kanan dan panel elemen/komponen di sebelah kiri.
- Layout Halaman: Admin bisa menambahkan "Section" atau "Divider" (garis pemisah) untuk membagi form menjadi beberapa bagian yang rapi.
- Dukungan Multi-kolom: Admin bisa mengatur apakah input field berjejer ke bawah (1 kolom) atau bersebelahan (2 kolom grid) untuk menghemat ruang layar.

2. Komponen Statis (Visual & Teks):
- Sediakan elemen "Image/Banner" agar admin bisa menyisipkan gambar promo/poster program tepat di bagian atas form atau di sela-sela pertanyaan.
- Sediakan elemen "Heading" dan "Paragraph" agar admin bisa menyisipkan teks instruksi, penjelasan tambahan, atau syarat & ketentuan di dalam layout form.

3. Pilihan Field Input yang Lengkap (Dynamic Fields):
- Admin bisa menarik (drag) berbagai tipe field berikut ke dalam kanvas:
  a. Short Text (untuk Nama, Asal Outlet).
  b. Long Text / Textarea (untuk Alamat atau Feedback).
  c. Number Input (khusus angka).
  d. Phone Number (dengan validasi otomatis untuk format nomor HP).
  e. Dropdown Select.
  f. Radio Buttons (pilih satu dari beberapa opsi).
  g. Checkboxes (pilih lebih dari satu opsi).
  h. Date Picker (untuk memilih tanggal).
  i. File/Image Upload (untuk upload bukti struk/pembelian).

4. Konfigurasi Field (Properties Panel):
- Saat admin mengklik salah satu field di kanvas, muncul panel pengaturan (Properties) di sebelah kanan untuk mengatur:
  - Label Field (Pertanyaan).
  - Placeholder text.
  - Helper Text / Hint (Teks bantuan kecil di bawah input).
  - Toggle "Required" (Wajib diisi) atau "Optional".
  - Khusus untuk Dropdown/Radio/Checkbox: Admin bisa menambah, mengedit, atau menghapus opsi pilihan secara dinamis.

5. Mode Preview & Simpan:
- Sediakan tombol "Preview Form" agar admin bisa melihat tampilan akhir form dari kacamata pelanggan sebelum di-publish.
- Simpan seluruh rancangan layout form ini ke dalam database menggunakan satu kolom bertipe JSON (misalnya kolom `form_schema` di tabel `programs` atau `forms`) agar sistem bisa me-render ulang form tersebut di frontend secara akurat.

Tolong buatkan UI komponen Form Builder ini beserta logic state management-nya (misalnya menggunakan React dnd / state array of objects) dan update skema database-nya untuk mendukung penyimpanan JSON schema.