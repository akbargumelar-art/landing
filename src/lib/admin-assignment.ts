import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { adminUserProfiles, mitraSalesforces, user, type AdminRole } from "@/db/schema";

export const VALID_ADMIN_ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"];

/** Role yang wewenangnya dipersempit wilayah, sehingga wajib punya minimal satu TAP. */
export const TAP_SCOPED_ROLES: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

type HasilAssignment =
    | { error: NextResponse; salesforceId?: undefined }
    | { error: null; salesforceId: string | null };

/**
 * Memvalidasi kelengkapan assignment sebuah akun sebelum disimpan.
 *
 * Aturannya ditegakkan di sini, bukan di dua route yang berbeda, karena akun setengah jadi
 * adalah akun yang tidak bisa bekerja: SALESFORCE tanpa identitas petugas tidak akan pernah
 * cocok dengan outlet mana pun, dan role berwilayah tanpa TAP selalu mendapat daftar kosong.
 * Lebih baik ditolak saat dibuat daripada baru ketahuan saat petugasnya gagal bekerja.
 *
 * `userId` diisi saat menyunting akun yang sudah ada, supaya akun itu tidak dianggap
 * bentrok dengan dirinya sendiri.
 */
export async function validateAdminAssignment(input: {
    role: string;
    taps: string[];
    salesforceId: unknown;
    userId?: string;
}): Promise<HasilAssignment> {
    const role = input.role as AdminRole;

    if (!VALID_ADMIN_ROLES.includes(role)) {
        return { error: NextResponse.json({ error: "Role tidak valid" }, { status: 400 }) };
    }

    if (TAP_SCOPED_ROLES.includes(role) && input.taps.length === 0) {
        return { error: NextResponse.json({ error: "Role ini wajib memiliki minimal satu TAP" }, { status: 400 }) };
    }

    // Role selain SALESFORCE tidak menyimpan identitas petugas sama sekali -- membiarkan
    // nilai lama tertinggal saat role diturunkan akan menahan tautan master tanpa ada yang
    // memakainya, dan master itu jadi tidak bisa ditugaskan ke siapa pun.
    if (role !== "SALESFORCE") return { error: null, salesforceId: null };

    const salesforceId = String(input.salesforceId || "").trim();
    if (!salesforceId) {
        return { error: NextResponse.json({ error: "Akun Salesforce wajib ditautkan ke satu master Salesforce" }, { status: 400 }) };
    }

    const [master] = await db
        .select({ id: mitraSalesforces.id, isActive: mitraSalesforces.isActive })
        .from(mitraSalesforces)
        .where(eq(mitraSalesforces.id, salesforceId))
        .limit(1);

    if (!master) {
        return { error: NextResponse.json({ error: "Master Salesforce tidak ditemukan" }, { status: 400 }) };
    }
    if (!master.isActive) {
        return { error: NextResponse.json({ error: "Master Salesforce sudah nonaktif dan tidak bisa ditautkan" }, { status: 400 }) };
    }

    /**
     * Bentrok diperiksa lebih dulu supaya pesannya menyebut akun pemilik tautan saat ini.
     * Tanpa ini yang muncul hanyalah galat unique constraint dari database, yang tidak
     * memberi tahu Super Admin akun mana yang harus disunting.
     */
    const syarat = input.userId
        ? and(eq(adminUserProfiles.salesforceId, salesforceId), ne(adminUserProfiles.userId, input.userId))
        : eq(adminUserProfiles.salesforceId, salesforceId);

    const [bentrok] = await db
        .select({ email: user.email, name: user.name })
        .from(adminUserProfiles)
        .innerJoin(user, eq(adminUserProfiles.userId, user.id))
        .where(syarat)
        .limit(1);

    if (bentrok) {
        return {
            error: NextResponse.json({
                error: `Master Salesforce ini sudah ditautkan ke akun ${bentrok.name || bentrok.email}. `
                    + "Lepas tautan pada akun tersebut lebih dulu, atau sunting akun itu langsung.",
            }, { status: 409 }),
        };
    }

    return { error: null, salesforceId };
}
