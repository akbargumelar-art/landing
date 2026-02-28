import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm"; // Lint issue 3f52cbf6 might occur, but it's a known typings hiccup in the project

export interface WAHAData {
    name: string;
    programName: string;
    [key: string]: unknown; // Allow other dynamic fields in the future without triggering any
}

/**
 * Format phone number for WAHA
 * 0812... -> 62812...@c.us
 * 628...  -> 628...@c.us
 * +628... -> 628...@c.us
 */
function formatWahaPhone(phone: string): string {
    let cleanPhone = phone.replace(/\D/g, ""); // Remove non-numeric characters

    if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.substring(1);
    }

    // append WAHA postfix if it doesn't exist
    if (!cleanPhone.endsWith("@c.us")) {
        cleanPhone = `${cleanPhone}@c.us`;
    }

    return cleanPhone;
}

/**
 * Sends a WhatsApp notification using the WAHA HTTP API endpoints
 * This function handles its own errors so it won't crash the main process.
 */
export async function sendWhatsAppNotification(to: string, data: WAHAData): Promise<void> {
    try {
        if (!to) return;

        // 1. Fetch WAHA Settings from DB
        const settingsRaw = await db
            .select({ key: siteSettings.key, value: siteSettings.value })
            .from(siteSettings)
            .where(eq(siteSettings.type, "text")); // wa_gw_endpoint, wa_gw_token, wa_gw_template are type="text"

        const settings = settingsRaw.reduce((acc: Record<string, string>, curr: { key: string, value: string }) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        const endpoint = settings["wa_gw_endpoint"];
        const token = settings["wa_gw_token"];
        const template = settings["wa_gw_template"];

        // 2. Abort if integration is not configured
        if (!endpoint || !template) {
            console.log("[WAHA] Endpoint or Template is not configured. Skipping notification.");
            return;
        }

        // 3. Format phone number
        const chatId = formatWahaPhone(to);

        // 4. Replace template variables
        let finalMessage = template;
        finalMessage = finalMessage.replace(/{nama}/gi, data.name || "");
        finalMessage = finalMessage.replace(/{program}/gi, data.programName || "");

        // 5. Build Headers
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };

        if (token) {
            // Usually WAHA uses X-Api-Key but sometimes Authorization header is supported depending on how it's proxy-ed/set up.
            // Providing both just in case, typical WAHA secure auth uses X-Api-Key or Authorization Bearer.
            // Following the closest requested standard `Authorization: Bearer <token>` or `X-Api-Key`.
            // If the user's setup expects Bearer:
            headers["Authorization"] = `Bearer ${token}`;
            headers["X-Api-Key"] = token;
        }

        // 6. Send Request
        // Payload based on standard WAHA /api/sendText
        const payload = {
            chatId: chatId,
            text: finalMessage,
            session: "default"
        };

        console.log(`[WAHA] Sending notification to ${chatId}...`);

        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[WAHA] Failed to send message to ${chatId}. Status: ${response.status}`, errorText);
        } else {
            console.log(`[WAHA] Successfully sent notification to ${chatId}.`);
        }

    } catch (error) {
        // 7. Catch errors silently to not break surrounding logic
        console.error("[WAHA] Exception during sendWhatsAppNotification:", error);
    }
}
