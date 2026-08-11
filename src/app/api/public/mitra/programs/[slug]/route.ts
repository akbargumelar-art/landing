import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraPrograms } from "@/db/schema";
import { getPublicProgramDetail, hasValidProgramSession, normalizeTargetType } from "@/lib/mitra-programs";
import { MITRA_PROGRAM_SESSION_COOKIE } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const url = new URL(request.url);
    const targetType = normalizeTargetType(url.searchParams.get("targetType"));

    /**
     * Program salesforce memuat pencapaian dan insentif per orang, jadi isinya hanya
     * terbuka setelah verifikasi OTP. Nama dan periodenya tetap dikirim agar halaman bisa
     * memperkenalkan program sebelum meminta nomor -- yang ditahan adalah papan peringkat
     * dan pencapaiannya, bukan keberadaan programnya.
     */
    if (targetType === "SALESFORCE") {
        const [program] = await db
            .select({
                id: mitraPrograms.id,
                name: mitraPrograms.name,
                mechanismType: mitraPrograms.mechanismType,
                thumbnailUrl: mitraPrograms.thumbnailUrl,
                descriptionMd: mitraPrograms.descriptionMd,
                periodStart: mitraPrograms.periodStart,
                periodEnd: mitraPrograms.periodEnd,
                status: mitraPrograms.status,
            })
            .from(mitraPrograms)
            .where(and(
                eq(mitraPrograms.slug, slug),
                eq(mitraPrograms.targetType, "SALESFORCE"),
                eq(mitraPrograms.isPublic, true)
            ))
            .limit(1);

        if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

        const sessionToken = (await cookies()).get(MITRA_PROGRAM_SESSION_COOKIE)?.value;
        if (!await hasValidProgramSession(program.id, sessionToken)) {
            return NextResponse.json({ locked: true, program }, { status: 401 });
        }
    }

    const data = await getPublicProgramDetail(slug, targetType, url.searchParams.get("q") || "");
    if (!data) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

    return NextResponse.json(data);
}
