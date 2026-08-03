import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanCategories } from "@/db/schema";
import { v4 as uuid } from "uuid";
import { requireRole } from "@/lib/admin-auth";

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"]);
    if (auth.error) return auth.error;

    try {
        const rows = await db.select().from(cuanCategories).orderBy(cuanCategories.name);
        return NextResponse.json(rows);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

        const id = uuid();
        await db.insert(cuanCategories).values({ id, name, createdAt: new Date() });
        return NextResponse.json({ id, name });
    } catch {
        return NextResponse.json({ error: "Gagal menambah kategori" }, { status: 500 });
    }
}
