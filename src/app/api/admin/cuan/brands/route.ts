import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanBrands } from "@/db/schema";
import { v4 as uuid } from "uuid";

export async function GET() {
    try {
        const rows = await db.select().from(cuanBrands).orderBy(cuanBrands.name);
        return NextResponse.json(rows);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

        const id = uuid();
        await db.insert(cuanBrands).values({ id, name, createdAt: new Date() });
        return NextResponse.json({ id, name });
    } catch {
        return NextResponse.json({ error: "Gagal menambah brand" }, { status: 500 });
    }
}
