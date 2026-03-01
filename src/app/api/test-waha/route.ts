export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendWhatsAppNotification } from "@/lib/whatsapp";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone") || "081285755557";

    console.log("Triggering explicit WAHA Test to:", phone);

    // Simulate what the form submission does
    try {
        await sendWhatsAppNotification(phone, {
            name: "Akbar Gumelar",
            programName: "Undian Mingguan Telkomsel Test"
        });

        return NextResponse.json({ success: true, message: `Check terminal logs to see WAHA HTTP status code for ${phone}` });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e?.message });
    }
}
