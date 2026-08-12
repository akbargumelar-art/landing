/**
 * Saran isian kolom `keterangan` pada nomor whitelist, dipakai form admin.
 *
 * Keterangan ini MURNI KETERANGAN dan tidak lagi menentukan hak apa pun. Sebelumnya
 * nilainya dipakai server untuk memutuskan siapa yang boleh menyunting outlet lewat sesi
 * OTP -- padahal isinya teks bebas pada sebuah nomor telepon, bukan identitas terautentikasi,
 * dan dicocokkan dengan "mengandung kata" sehingga "Manager Area" maupun catatan panjang
 * yang kebetulan memuat kata itu sama-sama lolos. Hak ubah kini sepenuhnya berasal dari akun
 * login beserta role dan assignment-nya.
 */
export const SARAN_KETERANGAN = [
    "Outlet Owner",
    "Salesforce",
    "Merchandiser",
    "Supervisor",
    "Manager",
    "Organik Telkomsel",
];
