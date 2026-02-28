import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions } from "@/db/schema";
import { desc } from "drizzle-orm";

interface SubValue {
    value: string;
    field: { label: string } | null;
}

interface FetchedSubmission {
    id: string;
    status: string;
    form: {
        program: { id: string } | null;
    };
    values: SubValue[];
}

// GET submissions with filters
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        // Fetch using Drizzle Relational Queries
        const result = await db.query.formSubmissions.findMany({
            with: {
                form: {
                    with: {
                        program: true,
                        fields: true, // we might not need to send all fields if we only care about submitted values, but left here for completeness if frontend uses it
                    },
                },
                values: {
                    with: {
                        field: true,
                    },
                },
                winner: true,
            },
            orderBy: [desc(formSubmissions.submittedAt)],
        });

        // Apply Filters
        let filtered = result;

        if (status) {
            filtered = filtered.filter((s: FetchedSubmission) => s.status === status);
        }

        if (programId) {
            filtered = filtered.filter((s: FetchedSubmission) => s.form.program?.id === programId);
        }

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter((s: FetchedSubmission) =>
                s.values.some(
                    (v: SubValue) =>
                        v.value.toLowerCase().includes(q) ||
                        (v.field?.label || "").toLowerCase().includes(q)
                )
            );
        }

        return NextResponse.json(filtered);
    } catch (error) {
        console.error("Submissions GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
