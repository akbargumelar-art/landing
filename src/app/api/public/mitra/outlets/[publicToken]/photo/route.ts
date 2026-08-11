import { NextResponse } from "next/server";

import { KODE_WAJIB_LOGIN, PESAN_WAJIB_LOGIN } from "@/lib/mitra-outlet-edit";

export const dynamic = "force-dynamic";

/**
 * Route mutasi publik yang sudah dipensiunkan. Sesi OTP hanya membuktikan hak MELIHAT, jadi
 * jalur ini tidak lagi menerima perubahan apa pun -- perubahan outlet dilakukan dari dashboard
 * dengan akun Salesforce atau Supervisor.
 *
 * Endpoint sengaja DIPERTAHANKAN, bukan dihapus, selama masa kompatibilitas: bookmark dan
 * halaman lama yang masih tersimpan di perangkat lapangan akan menerima kode stabil
 * LOGIN_REQUIRED_FOR_WRITE dan bisa mengarahkan penggunanya ke halaman masuk, alih-alih
 * mendapat 404 yang terbaca seperti gangguan.
 *
 * Logika validasi dan penyimpanan yang dulu ada di sini tidak disisakan dalam bentuk kode mati:
 * jalur tulis yang masih utuh di balik satu pemeriksaan adalah jalur yang bisa hidup lagi tanpa
 * disengaja. Riwayatnya tetap tersimpan di git bila kelak dibutuhkan endpoint admin.
 */
export async function POST() {
    return NextResponse.json({ error: PESAN_WAJIB_LOGIN, code: KODE_WAJIB_LOGIN }, { status: 403 });
}
