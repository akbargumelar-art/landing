import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { writeAdminAuditLog } from "@/lib/admin-auth";
import { findOutletInScope, getAdminActorScope, type AdminActorScope } from "@/lib/admin-scope";
import { writeOutletEditLog, type MitraEditAction } from "@/lib/mitra-outlet-edit";
import { getClientIp } from "@/lib/mitra-utils";

/**
 * Field yang boleh disentuh role lapangan, per aksi.
 *
 * Ditulis sebagai ALLOWLIST, bukan daftar larangan: field baru yang kelak ditambahkan ke
 * tabel outlet otomatis tertutup sampai seseorang sengaja membukanya di sini. Daftar
 * larangan akan berperilaku sebaliknya -- setiap kolom baru langsung ikut terbuka.
 *
 * Yang sengaja TIDAK ada di mana pun: outletCode, publicToken, rsNumber, tap, salesforceId,
 * dan status. Keenamnya identitas administratif atau penugasan organisasi; mengubahnya
 * berarti memindahkan outlet keluar dari wewenang orang yang sedang menyuntingnya.
 */
export const FIELD_PROFIL = ["name", "ownerName", "ownerPhone", "kabupaten", "kecamatan", "category", "pjpDay", "pjpType"] as const;
export const FIELD_LOKASI = ["latitude", "longitude", "locationUrl"] as const;
export const FIELD_BRANDING = ["branding"] as const;

export type OutletMutationField =
    | (typeof FIELD_PROFIL)[number]
    | (typeof FIELD_LOKASI)[number]
    | (typeof FIELD_BRANDING)[number];

/** Role yang boleh memanggil endpoint mutasi outlet sama sekali. */
export const ROLE_MUTASI_OUTLET = ["SUPER_ADMIN", "ADMIN_INPUT", "SUPERVISOR", "SALESFORCE"] as const;

interface GerbangGagal { error: NextResponse; scope?: undefined; outlet?: undefined }
interface GerbangLolos { error: null; scope: AdminActorScope; outlet: typeof mitraOutlets.$inferSelect }

/**
 * Gerbang seragam untuk seluruh endpoint mutasi outlet: sesi, role, dan wewenang atas outlet
 * ini diperiksa ulang di sini -- tidak mengandalkan hasil daftar yang tadi dibuka pengguna,
 * karena assignment bisa saja sudah dicabut sejak halaman itu dimuat.
 */
export async function gerbangMutasiOutlet(outletId: string): Promise<GerbangGagal | GerbangLolos> {
    const scope = await getAdminActorScope();
    if (!scope) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

    if (!(ROLE_MUTASI_OUTLET as readonly string[]).includes(scope.role)) {
        return { error: NextResponse.json({ error: "Peran Anda tidak berhak mengubah data outlet" }, { status: 403 }) };
    }

    const akses = await findOutletInScope(scope, outletId, true);
    if (akses.error) return { error: akses.error };

    return { error: null, scope, outlet: akses.outlet };
}

/**
 * Menyimpan perubahan yang benar-benar berbeda saja, lalu mencatatnya ke dua jalur: riwayat
 * outlet (terlihat di halaman detail publik) dan audit admin. Aktornya selalu akun login --
 * tidak ada lagi mutasi ber-aktor MITRA yang baru.
 *
 * Menulis nol kolom diperlakukan sebagai sukses tanpa jejak: baris riwayat yang mencatat
 * "kabupaten: Cirebon -> Cirebon" hanya membuat riwayat sulit dibaca.
 */
export async function simpanPerubahanOutlet(input: {
    request: Request;
    scope: AdminActorScope;
    outlet: typeof mitraOutlets.$inferSelect;
    action: MitraEditAction;
    perubahan: Partial<Record<OutletMutationField, unknown>>;
}) {
    const { request, scope, outlet, action, perubahan } = input;

    const berubah = Object.entries(perubahan).filter(([kolom, nilai]) => {
        const lama = (outlet as Record<string, unknown>)[kolom];
        return String(lama ?? "") !== String(nilai ?? "");
    });

    if (berubah.length === 0) {
        return NextResponse.json({ success: true, unchanged: true });
    }

    const nilaiBaru = Object.fromEntries(berubah);
    const nilaiLama = Object.fromEntries(berubah.map(([kolom]) => [kolom, (outlet as Record<string, unknown>)[kolom]]));

    await db
        .update(mitraOutlets)
        .set(nilaiBaru as Partial<typeof mitraOutlets.$inferInsert>)
        .where(eq(mitraOutlets.id, outlet.id));

    const ip = getClientIp(request);

    await writeOutletEditLog({
        outletId: outlet.id,
        actorType: "ADMIN",
        actorUserId: scope.userId,
        action,
        before: nilaiLama,
        after: nilaiBaru,
        ip,
    });

    await writeAdminAuditLog({
        userId: scope.userId,
        action: `OUTLET_${action}`,
        entity: "mitra_outlet",
        entityId: outlet.id,
        diff: { before: nilaiLama, after: nilaiBaru },
        ip,
    });

    return NextResponse.json({ success: true, changed: berubah.map(([kolom]) => kolom) });
}

/**
 * Menolak payload yang memuat field di luar allowlist aksi ini, alih-alih mengabaikannya
 * diam-diam. Pengirim yang mencoba menitipkan `tap` atau `status` pada permintaan edit profil
 * harus tahu permintaannya gagal seluruhnya -- bukan mengira semuanya tersimpan.
 */
export function tolakFieldAsing(body: Record<string, unknown>, diizinkan: readonly string[]) {
    const asing = Object.keys(body).filter((kunci) => !diizinkan.includes(kunci));
    if (asing.length === 0) return null;

    return NextResponse.json({
        error: `Field tidak diizinkan pada aksi ini: ${asing.join(", ")}`,
    }, { status: 400 });
}
