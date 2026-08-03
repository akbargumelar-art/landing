import { NextResponse } from "next/server";
import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets, mitraTerritories } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const kabupaten = (url.searchParams.get("kabupaten") || "").trim();
    const tap = (url.searchParams.get("tap") || "").trim();
    const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "24"), 1), 48);

    const filters: SQL[] = [eq(mitraOutlets.status, "ACTIVE")];
    if (q) {
        filters.push(or(
            like(mitraOutlets.name, `%${q}%`),
            like(mitraOutlets.outletCode, `%${q}%`),
            like(mitraOutlets.kabupaten, `%${q}%`),
            like(mitraOutlets.kecamatan, `%${q}%`),
            like(mitraOutlets.tap, `%${q}%`)
        ) as SQL);
    }
    if (kabupaten) filters.push(eq(mitraOutlets.kabupaten, kabupaten));
    if (tap) filters.push(eq(mitraOutlets.tap, tap));

    const where = and(...filters);
    const [[totalRow], outlets, filterRows] = await Promise.all([
        db.select({ value: count() }).from(mitraOutlets).where(where),
        db
            .select({
                publicToken: mitraOutlets.publicToken,
                outletCode: mitraOutlets.outletCode,
                name: mitraOutlets.name,
                tap: mitraOutlets.tap,
                kabupaten: mitraOutlets.kabupaten,
                kecamatan: mitraOutlets.kecamatan,
                territoryName: mitraTerritories.name,
                category: mitraOutlets.category,
                pjpDay: mitraOutlets.pjpDay,
                pjpType: mitraOutlets.pjpType,
                branding: mitraOutlets.branding,
                photoUrl: mitraOutlets.photoUrl,
            })
            .from(mitraOutlets)
            .leftJoin(mitraTerritories, eq(mitraOutlets.territoryId, mitraTerritories.id))
            .where(where)
            .orderBy(asc(mitraOutlets.name))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db
            .select({ kabupaten: mitraOutlets.kabupaten, tap: mitraOutlets.tap })
            .from(mitraOutlets)
            .where(eq(mitraOutlets.status, "ACTIVE")),
    ]);

    const total = totalRow?.value || 0;
    return NextResponse.json({
        outlets,
        total,
        page,
        pageSize,
        pageCount: Math.max(Math.ceil(total / pageSize), 1),
        filters: {
            kabupaten: Array.from(new Set(filterRows.map((row) => row.kabupaten).filter(Boolean))).sort(),
            tap: Array.from(new Set(filterRows.map((row) => row.tap).filter(Boolean))).sort(),
        },
    });
}
