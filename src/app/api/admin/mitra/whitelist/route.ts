import { NextResponse } from "next/server";
import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutlets, mitraWhitelistNumbers } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

type WhitelistScope = "ALL" | "OUTLET" | "TAP";

function normalizeScope(input: unknown): WhitelistScope {
    return input === "OUTLET" || input === "TAP" ? input : "ALL";
}

/** Scope OUTLET butuh outlet, scope TAP butuh nama TAP; ALL tidak butuh apa pun. */
function validateScope(scope: WhitelistScope, outletId: unknown, tap: unknown) {
    if (scope === "OUTLET" && !outletId) return "Scope outlet tertentu membutuhkan pilihan outlet";
    if (scope === "TAP" && !String(tap || "").trim()) return "Scope TAP membutuhkan pilihan TAP";
    return null;
}

export async function GET() {
    // Whitelist berada di halaman Pengaturan, dan seluruh grup "Sistem & Konten" kini
    // khusus Admin Super atas permintaan pemilik aplikasi - menggantikan baris View-all
    // untuk Manager pada matriks di prd-total-revamp.md 2.2.
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const whitelist = await db
        .select({
            id: mitraWhitelistNumbers.id,
            phoneE164: mitraWhitelistNumbers.phoneE164,
            name: mitraWhitelistNumbers.name,
            keterangan: mitraWhitelistNumbers.keterangan,
            scope: mitraWhitelistNumbers.scope,
            outletId: mitraWhitelistNumbers.outletId,
            outletName: mitraOutlets.name,
            tap: mitraWhitelistNumbers.tap,
            isActive: mitraWhitelistNumbers.isActive,
            expiresAt: mitraWhitelistNumbers.expiresAt,
            createdAt: mitraWhitelistNumbers.createdAt,
        })
        .from(mitraWhitelistNumbers)
        .leftJoin(mitraOutlets, eq(mitraWhitelistNumbers.outletId, mitraOutlets.id))
        .orderBy(desc(mitraWhitelistNumbers.createdAt))
        .limit(500);

    const outlets = await db
        .select({ id: mitraOutlets.id, name: mitraOutlets.name, outletCode: mitraOutlets.outletCode })
        .from(mitraOutlets)
        .orderBy(asc(mitraOutlets.name));

    // Daftar TAP diambil dari data outlet, bukan tabel master tersendiri, karena di situlah
    // TAP sebenarnya hidup -- sehingga pilihannya selalu sama dengan yang dipakai outlet.
    const tapRows = await db
        .selectDistinct({ tap: mitraOutlets.tap })
        .from(mitraOutlets)
        .where(isNotNull(mitraOutlets.tap))
        .orderBy(asc(mitraOutlets.tap));

    return NextResponse.json({
        whitelist,
        outlets,
        taps: tapRows.map((row) => row.tap).filter((tap): tap is string => Boolean(tap && tap.trim())),
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const scope = normalizeScope(body.scope);

    // Bulk add: `phones` berisi banyak baris sekaligus, seluruhnya berbagi scope yang sama.
    if (body.phones !== undefined) {
        return handleBulkCreate(request, body, scope, auth.session?.userId);
    }

    const phoneE164 = normalizePhoneE164(String(body.phoneE164 || body.phone || ""));

    if (!phoneE164) {
        return NextResponse.json({ error: "Nomor WhatsApp wajib diisi" }, { status: 400 });
    }

    const salahScope = validateScope(scope, body.outletId, body.tap);
    if (salahScope) return NextResponse.json({ error: salahScope }, { status: 400 });

    const id = uuid();
    await db.insert(mitraWhitelistNumbers).values({
        id,
        phoneE164,
        name: body.name || null,
        keterangan: body.keterangan || null,
        scope,
        outletId: scope === "OUTLET" ? body.outletId : null,
        tap: scope === "TAP" ? String(body.tap).trim() : null,
        isActive: body.isActive ?? true,
        createdBy: auth.session?.userId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdAt: new Date(),
    });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_whitelist",
        entityId: id,
        diff: { phoneE164, scope },
        ip: getClientIp(request),
    });

    const [created] = await db.select().from(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id));
    return NextResponse.json(created, { status: 201 });
}

/**
 * Baris bulk berformat `nomor,nama,keterangan` -- koma kini pemisah KOLOM, bukan pemisah
 * nomor seperti sebelumnya, supaya satu tempelan bisa mengisi seluruh field. Karena itu
 * satu nomor wajib satu baris.
 */
function parseBarisBulk(raw: string) {
    const [nomor, nama, keterangan] = raw.split(",").map((bagian) => bagian.trim());
    return { nomor: nomor || "", nama: nama || null, keterangan: keterangan || null };
}

async function handleBulkCreate(
    request: Request,
    body: Record<string, unknown>,
    scope: WhitelistScope,
    userId?: string
) {
    const salahScope = validateScope(scope, body.outletId, body.tap);
    if (salahScope) return NextResponse.json({ error: salahScope }, { status: 400 });

    const baris = Array.isArray(body.phones)
        ? (body.phones as unknown[]).map(String)
        : String(body.phones || "").split(/[\n;]+/);

    const invalid: string[] = [];
    const terkumpul = new Map<string, { nama: string | null; keterangan: string | null }>();

    for (const raw of baris) {
        if (!raw.trim()) continue;
        const { nomor, nama, keterangan } = parseBarisBulk(raw);
        const phone = normalizePhoneE164(nomor);

        if (!phone) {
            invalid.push(raw.trim());
            continue;
        }
        // Baris duplikat dalam satu tempelan: yang pertama menang, supaya hasilnya
        // tidak bergantung urutan pemrosesan.
        if (!terkumpul.has(phone)) terkumpul.set(phone, { nama, keterangan });
    }

    if (terkumpul.size === 0) {
        return NextResponse.json({ error: "Tidak ada nomor WhatsApp yang valid" }, { status: 400 });
    }

    const unique = Array.from(terkumpul.keys());
    const existing = await db
        .select({ phoneE164: mitraWhitelistNumbers.phoneE164 })
        .from(mitraWhitelistNumbers)
        .where(inArray(mitraWhitelistNumbers.phoneE164, unique));
    const existingSet = new Set(existing.map((row) => row.phoneE164));
    const toInsert = unique.filter((phone) => !existingSet.has(phone));

    if (toInsert.length > 0) {
        const now = new Date();
        const namaBersama = body.name ? String(body.name) : null;
        const keteranganBersama = body.keterangan ? String(body.keterangan) : null;

        await db.insert(mitraWhitelistNumbers).values(toInsert.map((phoneE164) => {
            const perBaris = terkumpul.get(phoneE164)!;
            return {
                id: uuid(),
                phoneE164,
                // Nilai per baris menang atas nilai bersama di form, supaya tempelan yang
                // sudah lengkap tidak tertimpa isian formulir.
                name: perBaris.nama || namaBersama,
                keterangan: perBaris.keterangan || keteranganBersama,
                scope,
                outletId: scope === "OUTLET" ? String(body.outletId) : null,
                tap: scope === "TAP" ? String(body.tap).trim() : null,
                isActive: true,
                createdBy: userId,
                expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
                createdAt: now,
            };
        }));

        await writeAdminAuditLog({
            userId,
            action: "CREATE_BULK",
            entity: "mitra_whitelist",
            diff: { scope, added: toInsert.length, skippedExisting: existingSet.size, invalid: invalid.length },
            ip: getClientIp(request),
        });
    }

    return NextResponse.json({
        added: toInsert.length,
        skippedExisting: unique.length - toInsert.length,
        invalid,
    }, { status: 201 });
}

/** Hapus beberapa nomor sekaligus dari tabel. */
export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String).filter(Boolean) : [];

    if (ids.length === 0) {
        return NextResponse.json({ error: "Pilih minimal satu nomor" }, { status: 400 });
    }

    const targets = await db
        .select({ id: mitraWhitelistNumbers.id, phoneE164: mitraWhitelistNumbers.phoneE164 })
        .from(mitraWhitelistNumbers)
        .where(inArray(mitraWhitelistNumbers.id, ids));

    if (targets.length === 0) {
        return NextResponse.json({ error: "Nomor tidak ditemukan" }, { status: 404 });
    }

    await db.delete(mitraWhitelistNumbers).where(inArray(mitraWhitelistNumbers.id, targets.map((row) => row.id)));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE_BULK",
        entity: "mitra_whitelist",
        diff: { jumlah: targets.length, nomor: targets.map((row) => row.phoneE164) },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, deleted: targets.length });
}
