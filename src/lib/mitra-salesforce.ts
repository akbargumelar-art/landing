import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraSalesforces } from "@/db/schema";

/**
 * Nama disimpan apa adanya (kapitalisasi asli dipertahankan) tetapi dicocokkan setelah
 * spasi berlebih dibuang. Pencocokan huruf besar/kecil diserahkan ke collation MySQL
 * yang case-insensitive, jadi "Aditia" dan "aditia" tidak menghasilkan dua master.
 */
export function normalizeSalesforceName(input: unknown): string {
    return String(input ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Menerjemahkan nama salesforce menjadi id master, membuat barisnya bila belum ada.
 *
 * Dibuat otomatis, bukan ditolak, karena file import hanya membawa nama: menolak nama
 * baru akan menggagalkan baris import yang datanya sebenarnya sah. Konsekuensinya salah
 * ketik nama menghasilkan master baru, yang bisa dirapikan admin lewat menu Salesforce.
 */
export async function resolveSalesforceId(name: unknown): Promise<string | null> {
    const clean = normalizeSalesforceName(name);
    if (!clean) return null;

    const [existing] = await db
        .select({ id: mitraSalesforces.id })
        .from(mitraSalesforces)
        .where(eq(mitraSalesforces.name, clean))
        .limit(1);

    if (existing) return existing.id;

    const id = uuid();
    await db.insert(mitraSalesforces).values({ id, name: clean, createdAt: new Date() });
    return id;
}

/** Versi banyak nama sekaligus untuk jalur import, supaya tidak query per baris. */
export async function resolveSalesforceIds(names: unknown[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(names.map(normalizeSalesforceName).filter(Boolean)));
    const hasil = new Map<string, string>();

    for (const name of unique) {
        const id = await resolveSalesforceId(name);
        if (id) hasil.set(name.toLowerCase(), id);
    }

    return hasil;
}
