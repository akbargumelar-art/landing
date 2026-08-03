import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { indihomeProducts } from "@/db/schema";
import { parseIndihomeProductInput } from "@/lib/indihome-admin";
import { requireMitraAccess } from "@/lib/mitra-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireMitraAccess(["MANAGER", "ADMIN"]);
    if (auth.error) return auth.error;

    try {
        const products = await db
            .select()
            .from(indihomeProducts)
            .orderBy(asc(indihomeProducts.sortOrder), asc(indihomeProducts.speedMbps));
        return NextResponse.json({ products });
    } catch (error) {
        console.error("Indihome products GET error:", error);
        return NextResponse.json({ error: "Produk gagal dimuat." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireMitraAccess(["MANAGER", "ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const parsed = parseIndihomeProductInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        const id = uuid();
        await db.insert(indihomeProducts).values({ id, ...parsed.values, createdAt: new Date() });
        const [product] = await db.select().from(indihomeProducts).where(eq(indihomeProducts.id, id));
        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        console.error("Indihome products POST error:", error);
        return NextResponse.json({ error: "Produk gagal disimpan." }, { status: 500 });
    }
}
