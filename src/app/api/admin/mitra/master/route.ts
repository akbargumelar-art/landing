import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraKabupatens, mitraKecamatans, mitraOutlets, mitraSalesforces, mitraTaps } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

/**
 * Tiga daftar master berbagi satu route karena bentuknya identik (hanya nama) dan
 * perlakuannya sama persis -- membuat tiga file route kembar hanya akan menggandakan
 * kode yang sama tiga kali.
 */
const TABEL = {
    tap: { table: mitraTaps, label: "TAP", entity: "mitra_tap" },
    kabupaten: { table: mitraKabupatens, label: "Kabupaten", entity: "mitra_kabupaten" },
    kecamatan: { table: mitraKecamatans, label: "Kecamatan", entity: "mitra_kecamatan" },
} as const;

type MasterType = keyof typeof TABEL;

function resolveType(nilai: unknown): MasterType | null {
    const teks = String(nilai || "").toLowerCase();
    return teks in TABEL ? (teks as MasterType) : null;
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const type = resolveType(url.searchParams.get("type"));

    // Tanpa parameter type, ketiganya dikirim sekaligus: form outlet butuh semuanya untuk
    // mengisi dropdown, dan satu permintaan lebih hemat daripada tiga.
    if (!type) {
        const [taps, kabupatens, kecamatans] = await Promise.all([
            db.select().from(mitraTaps).orderBy(asc(mitraTaps.name)),
            db.select().from(mitraKabupatens).orderBy(asc(mitraKabupatens.name)),
            db.select().from(mitraKecamatans).orderBy(asc(mitraKecamatans.name)),
        ]);
        return NextResponse.json({ tap: taps, kabupaten: kabupatens, kecamatan: kecamatans });
    }

    const { table } = TABEL[type];
    const rows = await db.select().from(table).orderBy(asc(table.name));

    /**
     * Jumlah pemakaian ikut dihitung supaya admin tahu dampak sebelum mengganti nama atau
     * menghapus. Kolom di outlet/salesforce berupa teks bebas, jadi kecocokannya dihitung
     * dengan membandingkan nama, bukan lewat foreign key.
     */
    const pemakaian = new Map<string, number>();
    if (type === "tap") {
        const hitung = await db
            .select({ nama: mitraOutlets.tap, jumlah: sql<number>`count(*)` })
            .from(mitraOutlets)
            .groupBy(mitraOutlets.tap);
        for (const baris of hitung) pemakaian.set((baris.nama || "").trim(), Number(baris.jumlah));
    } else {
        const kolom = type === "kabupaten" ? mitraOutlets.kabupaten : mitraOutlets.kecamatan;
        const hitung = await db
            .select({ nama: kolom, jumlah: sql<number>`count(*)` })
            .from(mitraOutlets)
            .groupBy(kolom);
        for (const baris of hitung) pemakaian.set((baris.nama || "").trim(), Number(baris.jumlah));
    }

    return NextResponse.json({
        type,
        rows: rows.map((row) => ({ ...row, outletCount: pemakaian.get(row.name.trim()) || 0 })),
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const type = resolveType(body.type);
    if (!type) return NextResponse.json({ error: "Jenis data master tidak dikenal" }, { status: 400 });

    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: `Nama ${TABEL[type].label} wajib diisi` }, { status: 400 });

    const { table, label, entity } = TABEL[type];
    const [duplikat] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
    if (duplikat) return NextResponse.json({ error: `${label} "${name}" sudah terdaftar` }, { status: 409 });

    const id = uuid();
    await db.insert(table).values({ id, name, createdAt: new Date() });
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity,
        entityId: id,
        diff: { name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ id, name });
}

export async function PUT(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const type = resolveType(body.type);
    if (!type) return NextResponse.json({ error: "Jenis data master tidak dikenal" }, { status: 400 });

    const { table, label, entity } = TABEL[type];
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: `Nama ${label} wajib diisi` }, { status: 400 });

    const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: `${label} tidak ditemukan` }, { status: 404 });

    if (name !== existing.name) {
        const [duplikat] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
        if (duplikat) return NextResponse.json({ error: `${label} "${name}" sudah terdaftar` }, { status: 409 });
    }

    await db.update(table).set({ name }).where(eq(table.id, id));

    /**
     * Outlet dan salesforce menyimpan nama wilayah sebagai teks, jadi mengganti nama di
     * master harus ikut memperbarui pemakainya -- kalau tidak, data lama akan menunjuk
     * nama yang sudah tidak ada di dropdown dan tampak seperti kosong.
     */
    if (existing.name !== name) {
        if (type === "tap") {
            await db.update(mitraOutlets).set({ tap: name }).where(eq(mitraOutlets.tap, existing.name));
            await db.update(mitraSalesforces).set({ tap: name }).where(eq(mitraSalesforces.tap, existing.name));
        } else if (type === "kabupaten") {
            await db.update(mitraOutlets).set({ kabupaten: name }).where(eq(mitraOutlets.kabupaten, existing.name));
        } else {
            await db.update(mitraOutlets).set({ kecamatan: name }).where(eq(mitraOutlets.kecamatan, existing.name));
        }
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity,
        entityId: id,
        diff: { namaLama: existing.name, namaBaru: name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ id, name });
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const type = resolveType(url.searchParams.get("type"));
    if (!type) return NextResponse.json({ error: "Jenis data master tidak dikenal" }, { status: 400 });

    const { table, label, entity } = TABEL[type];
    const id = url.searchParams.get("id") || "";
    const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: `${label} tidak ditemukan` }, { status: 404 });

    // Hanya pilihan dropdown yang hilang; nama pada outlet/salesforce dibiarkan apa adanya
    // supaya menghapus satu entri master tidak diam-diam mengosongkan data outlet.
    await db.delete(table).where(eq(table.id, id));
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity,
        entityId: id,
        diff: { name: existing.name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
