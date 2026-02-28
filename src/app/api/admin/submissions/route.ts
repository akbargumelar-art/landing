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
    formId: string;
    status: string;
    submittedAt: Date;
    period: string;
    participantName: string;
    participantPhone: string;
    form: {
        id: string;
        createdAt: Date;
        title: string;
        isActive: boolean;
        description: string;
        programId: string;
        formSchema: string;
        program: {
            id: string;
            title: string;
            slug: string;
        } | null;
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
        const dbResult = await db.query.formSubmissions.findMany({
            with: {
                form: {
                    with: {
                        program: true,
                        fields: true, // we might not need to send all fields if we only care about submitted values, but left here for completeness if frontend uses it
                    },
                },
                submissionValues: {
                    with: {
                        field: true,
                    },
                },
                winner: true,
            },
            orderBy: [desc(formSubmissions.submittedAt)],
        });

        const result: FetchedSubmission[] = dbResult.map(s => {
            const valuesRaw = (s as unknown as { submissionValues: any[] }).submissionValues || [];

            // Reconstruct absolute order based on the master formSchema JSON created by the FormBuilder
            let schemaOrder: string[] = [];
            if (s.form?.formSchema) {
                try {
                    const parsedSchema = JSON.parse(s.form.formSchema);
                    if (Array.isArray(parsedSchema)) {
                        schemaOrder = parsedSchema.map((el: any) => el.id);
                    }
                } catch (e) {
                    console.error("Failed to parse formSchema for sorting", e);
                }
            }

            // Sort values matching exactly the layout order
            valuesRaw.sort((a, b) => {
                const indexA = schemaOrder.indexOf(a.field?.id || "");
                const indexB = schemaOrder.indexOf(b.field?.id || "");

                // If both are found in the schema, sort by their index position
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If A is found but B is not, A comes first
                if (indexA !== -1) return -1;
                // If B is found but A is not, B comes first
                if (indexB !== -1) return 1;

                // Fallback to old sort order if absolutely needed
                return (a.field?.sortOrder || 0) - (b.field?.sortOrder || 0);
            });

            return {
                ...s,
                values: valuesRaw,
            };
        }) as FetchedSubmission[];

        // Apply Filters
        let filtered = result;

        if (status) {
            filtered = filtered.filter((s: FetchedSubmission) => s.status === status);
        }

        if (programId) {
            filtered = filtered.filter((s: FetchedSubmission) => s.form.program?.id === programId);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter((s: FetchedSubmission) => {
                // Cari di ID atau nama peserta langsung (denormalisasi)
                if (s.id.toLowerCase().includes(searchLower)) return true;
                if (s.participantName.toLowerCase().includes(searchLower)) return true;
                if (s.participantPhone.toLowerCase().includes(searchLower)) return true;

                // Fallback cari di detail fields
                return (s.values || []).some((v: SubValue) =>
                    v.value?.toLowerCase().includes(searchLower)
                );
            });
        }

        return NextResponse.json(filtered);
    } catch (error) {
        console.error("Submissions GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
