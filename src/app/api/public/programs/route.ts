import { NextResponse } from "next/server";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
    try {
        const result = await db
            .select()
            .from(programs)
            .where(eq(programs.status, "published"))
            .orderBy(asc(programs.sortOrder));
        return NextResponse.json(result);
    } catch (error) {
        console.error("Public programs error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
