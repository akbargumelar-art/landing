import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { adminUserProfiles, adminUserTaps, mitraOutlets, type AdminRole } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

/**
 * Batas wewenang satu aktor admin, dipakai SELURUH endpoint outlet, monitoring foto, ekspor,
 * dan program. Dikumpulkan di satu tempat supaya tidak ada route yang menyusun aturannya
 * sendiri -- duplikasi pemeriksaan role adalah cara paling umum sebuah celah muncul di satu
 * endpoint sementara endpoint tetangganya aman.
 */
export interface AdminActorScope {
    userId: string;
    role: AdminRole;
    /** TAP yang ditugaskan; kosong untuk role yang tidak dibatasi wilayah. */
    taps: string[];
    /** Master salesforce yang ditautkan ke akun; hanya terisi untuk role SALESFORCE. */
    salesforceId: string | null;
}

/** Role yang wewenangnya dipersempit oleh TAP dan/atau identitas salesforce. */
const ROLE_TERBATAS: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

/** Role yang boleh mengubah data operasional outlet. MANAGER sengaja tidak termasuk: baca saja. */
const ROLE_BOLEH_UBAH_OUTLET: AdminRole[] = ["SUPER_ADMIN", "ADMIN_INPUT", "SUPERVISOR", "SALESFORCE"];

export function isScopedRole(role: AdminRole): boolean {
    return ROLE_TERBATAS.includes(role);
}

/**
 * Membaca peran dan assignment aktor dari database pada SETIAP pemanggilan, bukan dari
 * cookie sesi. Dengan begitu pencabutan role, penonaktifan akun, atau perubahan TAP berlaku
 * pada request berikutnya -- tidak menunggu pengguna logout.
 */
export async function getAdminActorScope(): Promise<AdminActorScope | null> {
    const session = await getAdminSession();
    if (!session || !session.isActive) return null;

    const [profile] = await db
        .select({ salesforceId: adminUserProfiles.salesforceId })
        .from(adminUserProfiles)
        .where(eq(adminUserProfiles.userId, session.userId))
        .limit(1);

    const taps = await db
        .select({ tap: adminUserTaps.tap })
        .from(adminUserTaps)
        .where(eq(adminUserTaps.userId, session.userId));

    return {
        userId: session.userId,
        role: session.role,
        taps: taps.map((row) => row.tap).filter(Boolean),
        salesforceId: profile?.salesforceId ?? null,
    };
}

/** Identitas outlet seminimal mungkin yang dibutuhkan untuk memutuskan akses. */
export interface OutletScopeInfo {
    tap: string | null;
    salesforceId: string | null;
}

/**
 * Apakah aktor boleh menyentuh outlet ini.
 *
 * SALESFORCE menuntut DUA syarat sekaligus -- outlet miliknya sendiri DAN berada di TAP
 * akunnya. Membatasi lewat TAP saja tidak cukup karena satu TAP berisi banyak petugas;
 * membatasi lewat salesforceId saja membuat pemindahan outlet antar-wilayah luput dari
 * pembatasan wilayah yang sudah ditetapkan Super Admin.
 *
 * Akun yang assignment-nya belum lengkap (SALESFORCE tanpa salesforceId, role terbatas tanpa
 * TAP) tidak pernah cocok dengan outlet mana pun. Itu disengaja: assignment setengah jadi
 * harus berarti "belum boleh apa-apa", bukan "boleh semuanya".
 */
export function canAccessOutlet(scope: AdminActorScope, outlet: OutletScopeInfo): boolean {
    if (!isScopedRole(scope.role)) return true;
    if (scope.taps.length === 0) return false;
    if (!outlet.tap || !scope.taps.includes(outlet.tap)) return false;

    if (scope.role === "SALESFORCE") {
        if (!scope.salesforceId) return false;
        return outlet.salesforceId === scope.salesforceId;
    }

    return true;
}

export function canMutateOutlet(scope: AdminActorScope, outlet: OutletScopeInfo): boolean {
    if (!ROLE_BOLEH_UBAH_OUTLET.includes(scope.role)) return false;
    return canAccessOutlet(scope, outlet);
}

/**
 * Kondisi TAP untuk query koleksi, supaya pembatasan terjadi di SQL -- bukan dengan menyaring
 * hasil setelah baris terlanjur terbaca. Penting bukan hanya demi kecepatan: jumlah, ringkasan,
 * dan pagination dihitung dari query yang sama, jadi menyaring belakangan akan membocorkan
 * cacah data di luar wewenang lewat angka totalnya.
 *
 * Mengembalikan `null` bila aktor tidak dibatasi, dan kondisi mustahil bila assignment-nya
 * belum lengkap sehingga hasilnya kosong, bukan terbuka.
 */
export function outletScopeCondition(scope: AdminActorScope) {
    if (!isScopedRole(scope.role)) return null;
    if (scope.taps.length === 0) return eq(mitraOutlets.id, "");

    const kondisiTap = inArray(mitraOutlets.tap, scope.taps);
    if (scope.role !== "SALESFORCE") return kondisiTap;

    if (!scope.salesforceId) return eq(mitraOutlets.id, "");
    return and(kondisiTap, eq(mitraOutlets.salesforceId, scope.salesforceId));
}

/**
 * Apakah aktor boleh melihat data seorang peserta program.
 *
 * Sengaja memakai aturan yang PERSIS sama dengan `canAccessOutlet` -- wewenang atas seseorang
 * dan atas outletnya tidak boleh punya dua definisi yang bisa berselisih. Peserta salesforce
 * membawa id dirinya sendiri pada `salesforceId`, sehingga satu predikat melayani program
 * bertarget outlet maupun salesforce.
 */
export function canAccessParticipant(
    scope: AdminActorScope,
    peserta: { tap: string; salesforceId: string | null }
): boolean {
    return canAccessOutlet(scope, { tap: peserta.tap, salesforceId: peserta.salesforceId });
}

export type ScopeGuardFailure = { error: NextResponse; scope: null };
export type ScopeGuardSuccess = { error: null; scope: AdminActorScope };

/**
 * Gerbang untuk endpoint admin: memastikan ada sesi, role-nya diizinkan, dan mengembalikan
 * scope yang sudah siap dipakai membatasi query.
 */
export async function requireAdminScope(roles: AdminRole[]): Promise<ScopeGuardFailure | ScopeGuardSuccess> {
    const scope = await getAdminActorScope();

    if (!scope) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), scope: null };
    if (!roles.includes(scope.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), scope: null };

    return { error: null, scope };
}

/**
 * Mengambil outlet sekaligus memastikan aktor berhak atasnya.
 *
 * Outlet di luar wewenang menghasilkan 404, bukan 403, supaya keberadaan sebuah record tidak
 * bisa ditebak dengan mencoba id satu per satu -- pesan "dilarang" sudah memberi tahu bahwa
 * record-nya ada.
 */
export async function findOutletInScope(scope: AdminActorScope, outletId: string, untukUbah = false) {
    const [outlet] = await db
        .select()
        .from(mitraOutlets)
        .where(eq(mitraOutlets.id, outletId))
        .limit(1);

    if (!outlet) return { error: NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 }), outlet: null };

    const info: OutletScopeInfo = { tap: outlet.tap, salesforceId: outlet.salesforceId };
    if (!canAccessOutlet(scope, info)) {
        return { error: NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 }), outlet: null };
    }

    // Peran yang boleh melihat tetapi tidak boleh mengubah (MANAGER) ditolak di sini dengan
    // 403 -- outletnya memang ada dan boleh dilihatnya, jadi menyamarkannya jadi 404 justru
    // menyesatkan.
    if (untukUbah && !canMutateOutlet(scope, info)) {
        return { error: NextResponse.json({ error: "Peran Anda tidak berhak mengubah data outlet" }, { status: 403 }), outlet: null };
    }

    return { error: null, outlet };
}
