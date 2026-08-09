import { NextResponse } from "next/server";
import { asc, count, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { indihomeOdp } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/mitra-utils";
import { ODP_CATEGORIES, normalizeKategori } from "@/lib/indihome-odp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bacaAngka(nilai: unknown): number {
    const hasil = Number(String(nilai ?? "").replace(",", "."));
    return Number.isFinite(hasil) && hasil >= 0 ? Math.round(hasil) : 0;
}

function bacaKoordinat(nilai: unknown): number | null {
    const hasil = Number(String(nilai ?? "").replace(",", "."));
    return Number.isFinite(hasil) ? hasil : null;
}

/** Kolom pada berkas unggahan; alias ditambahkan untuk penulisan yang lazim dipakai. */
function ambil(row: Record<string, unknown>, alias: string[]): unknown {
    for (const [kunci, nilai] of Object.entries(row)) {
        if (alias.includes(kunci.trim().toLowerCase())) return nilai;
    }
    return "";
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    // Unduh template bila diminta, memakai endpoint yang sama supaya kolomnya pasti
    // sinkron dengan yang diterima POST di bawah.
    if (url.searchParams.get("template") === "1") {
        const contoh = [{
            name: "ODP-CRB-001",
            kabupaten: "Kota Cirebon",
            kecamatan: "Kesambi",
            latitude: -6.732,
            longitude: 108.552,
            portTotal: 16,
            portUsed: 12,
            portAvailable: 4,
            category: "ORANGE",
        }];
        const worksheet = XLSX.utils.json_to_sheet(contoh);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ODP");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="template-odp-indihome.xlsx"',
            },
        });
    }

    const where: SQL | undefined = q
        ? or(like(indihomeOdp.name, `%${q}%`), like(indihomeOdp.kabupaten, `%${q}%`), like(indihomeOdp.kecamatan, `%${q}%`))
        : undefined;

    const [rows, [total]] = await Promise.all([
        db.select().from(indihomeOdp).where(where).orderBy(asc(indihomeOdp.kabupaten), asc(indihomeOdp.kecamatan)).limit(500),
        db.select({ value: count() }).from(indihomeOdp).where(where),
    ]);

    return NextResponse.json({ odp: rows, total: total?.value || 0, categories: ODP_CATEGORIES });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const tipe = request.headers.get("content-type") || "";

    // Unggahan berkas dan penambahan satuan berbagi endpoint; dibedakan dari content-type.
    if (tipe.includes("multipart/form-data")) {
        return handleUnggah(request, auth.session?.userId);
    }

    const body = await request.json().catch(() => ({}));
    const latitude = bacaKoordinat(body.latitude);
    const longitude = bacaKoordinat(body.longitude);

    if (!body.kabupaten || !body.kecamatan) {
        return NextResponse.json({ error: "Kabupaten dan kecamatan wajib diisi" }, { status: 400 });
    }
    if (latitude === null || longitude === null) {
        return NextResponse.json({ error: "Koordinat ODP wajib diisi" }, { status: 400 });
    }

    const id = uuid();
    await db.insert(indihomeOdp).values({
        id,
        name: body.name ? String(body.name).trim() : null,
        kabupaten: String(body.kabupaten).trim(),
        kecamatan: String(body.kecamatan).trim(),
        latitude,
        longitude,
        portTotal: bacaAngka(body.portTotal),
        portUsed: bacaAngka(body.portUsed),
        portAvailable: bacaAngka(body.portAvailable),
        category: normalizeKategori(body.category),
        createdAt: new Date(),
    });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "indihome_odp",
        entityId: id,
        diff: { kabupaten: body.kabupaten, kecamatan: body.kecamatan },
        ip: getClientIp(request),
    });

    const [dibuat] = await db.select().from(indihomeOdp).where(eq(indihomeOdp.id, id)).limit(1);
    return NextResponse.json(dibuat, { status: 201 });
}

async function handleUnggah(request: Request, userId?: string) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Berkas belum dipilih" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Ukuran berkas melebihi 5 MB" }, { status: 400 });

    let rows: Record<string, unknown>[];
    try {
        const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    } catch {
        return NextResponse.json({ error: "Berkas tidak terbaca. Pastikan formatnya XLSX atau CSV." }, { status: 400 });
    }

    const errors: { row: number; message: string }[] = [];
    const valid: (typeof indihomeOdp.$inferInsert)[] = [];
    const now = new Date();

    rows.forEach((row, index) => {
        const nomorBaris = index + 2;
        const kabupaten = String(ambil(row, ["kabupaten", "kab", "kota"]) || "").trim();
        const kecamatan = String(ambil(row, ["kecamatan", "kec"]) || "").trim();
        const latitude = bacaKoordinat(ambil(row, ["latitude", "lat"]));
        const longitude = bacaKoordinat(ambil(row, ["longitude", "long", "lng"]));

        if (!kabupaten || !kecamatan) {
            errors.push({ row: nomorBaris, message: "Kabupaten dan kecamatan wajib diisi" });
            return;
        }
        // Koordinat 0,0 ditolak: itu nilai khas pembacaan gagal, bukan lokasi nyata.
        if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) {
            errors.push({ row: nomorBaris, message: "Koordinat tidak valid" });
            return;
        }

        valid.push({
            id: uuid(),
            name: String(ambil(row, ["name", "nama", "nama odp", "code", "kode"]) || "").trim() || null,
            kabupaten,
            kecamatan,
            latitude,
            longitude,
            portTotal: bacaAngka(ambil(row, ["porttotal", "port total", "jumlah port", "total port"])),
            portUsed: bacaAngka(ambil(row, ["portused", "port used", "port terpakai", "terpakai"])),
            portAvailable: bacaAngka(ambil(row, ["portavailable", "port available", "port tersedia", "tersedia"])),
            category: normalizeKategori(ambil(row, ["category", "kategori"])),
            createdAt: now,
        });
    });

    if (valid.length === 0) {
        return NextResponse.json({ error: "Tidak ada baris yang bisa diproses", errors }, { status: 400 });
    }

    // Disisipkan bertahap: satu INSERT berisi ribuan baris melewati batas paket MySQL.
    // onDuplicateKeyUpdate memakai unique index pada `name`, sehingga mengunggah ulang
    // berkas yang sama memperbarui titiknya alih-alih menggandakan seluruh isi tabel.
    for (let i = 0; i < valid.length; i += 200) {
        await db.insert(indihomeOdp).values(valid.slice(i, i + 200)).onDuplicateKeyUpdate({
            set: {
                kabupaten: sql`values(kabupaten)`,
                kecamatan: sql`values(kecamatan)`,
                latitude: sql`values(latitude)`,
                longitude: sql`values(longitude)`,
                portTotal: sql`values(port_total)`,
                portUsed: sql`values(port_used)`,
                portAvailable: sql`values(port_available)`,
                category: sql`values(category)`,
            },
        });
    }

    await writeAdminAuditLog({
        userId,
        action: "IMPORT",
        entity: "indihome_odp",
        diff: { fileName: file.name, tersimpan: valid.length, ditolak: errors.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ saved: valid.length, errors });
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const semua = url.searchParams.get("semua") === "1";

    if (semua) {
        const [jumlah] = await db.select({ value: count() }).from(indihomeOdp);
        await db.delete(indihomeOdp);

        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "DELETE_ALL",
            entity: "indihome_odp",
            diff: { jumlah: jumlah?.value || 0 },
            ip: getClientIp(request),
        });

        return NextResponse.json({ success: true, deleted: jumlah?.value || 0 });
    }

    const ids = id ? [id] : [];
    if (ids.length === 0) return NextResponse.json({ error: "Pilih ODP yang akan dihapus" }, { status: 400 });

    await db.delete(indihomeOdp).where(inArray(indihomeOdp.id, ids));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "indihome_odp",
        entityId: id,
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
