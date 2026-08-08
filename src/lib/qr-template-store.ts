import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraQrTemplates } from "@/db/schema";
import { QR_FIELDS, TEMPLATE_BAWAAN, type QrElement, type QrTemplate } from "@/lib/qr-template";

const FIELD_KEYS = new Set(QR_FIELDS.map((field) => field.key as string));

function angka(nilai: unknown, bawaan: number): number {
    const hasil = Number(nilai);
    return Number.isFinite(hasil) ? hasil : bawaan;
}

/**
 * Membersihkan elemen kiriman klien: hanya field yang dikenal yang lolos, dan seluruh
 * angka dijepit ke dalam ukuran kartu. Tanpa ini satu nilai keliru dari form bisa
 * menempatkan teks di luar halaman, dan hasilnya terlihat seperti elemen yang hilang.
 */
export function sanitizeElements(input: unknown): QrElement[] {
    if (!Array.isArray(input)) return [];

    return input.slice(0, 12).map((raw, index) => {
        const item = (raw || {}) as Record<string, unknown>;
        const field = FIELD_KEYS.has(String(item.field)) ? String(item.field) : "teks";

        return {
            id: String(item.id || `el-${index + 1}`),
            field: field as QrElement["field"],
            text: item.text ? String(item.text).slice(0, 120) : undefined,
            x: Math.min(Math.max(angka(item.x, 4), 0), 90),
            y: Math.min(Math.max(angka(item.y, 4), 0), 55),
            fontSize: Math.min(Math.max(angka(item.fontSize, 8), 4), 36),
            color: String(item.color || "#171717").slice(0, 9),
            bold: Boolean(item.bold),
            maxWidth: Math.min(Math.max(angka(item.maxWidth, 40), 5), 90),
        };
    });
}

export function rowToTemplate(row: typeof mitraQrTemplates.$inferSelect): QrTemplate {
    return {
        name: row.name,
        backgroundColor: row.backgroundColor,
        backgroundImageUrl: row.backgroundImageUrl,
        logoUrl: row.logoUrl,
        logoX: Number(row.logoX),
        logoY: Number(row.logoY),
        logoWidth: Number(row.logoWidth),
        qrX: Number(row.qrX),
        qrY: Number(row.qrY),
        qrSize: Number(row.qrSize),
        elements: sanitizeElements(row.elementsJson),
    };
}

/**
 * Template yang dipakai saat mencetak. Urutan pencarian: id yang diminta, lalu yang
 * ditandai default, lalu template bawaan bila tabelnya masih kosong -- sehingga fitur
 * cetak tetap bekerja sebelum admin membuat template apa pun.
 */
export async function ambilTemplateCetak(templateId?: string | null): Promise<QrTemplate> {
    if (templateId) {
        const [row] = await db.select().from(mitraQrTemplates).where(eq(mitraQrTemplates.id, templateId)).limit(1);
        if (row) return rowToTemplate(row);
    }

    const [bawaan] = await db
        .select()
        .from(mitraQrTemplates)
        .where(eq(mitraQrTemplates.isDefault, true))
        .orderBy(desc(mitraQrTemplates.updatedAt))
        .limit(1);

    return bawaan ? rowToTemplate(bawaan) : TEMPLATE_BAWAAN;
}
