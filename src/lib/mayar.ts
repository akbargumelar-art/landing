import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// ========== Mayar.id Headless API Integration ==========

const MAYAR_SANDBOX_URL = "https://api.mayar.club/hl/v1";
const MAYAR_PRODUCTION_URL = "https://api.mayar.id/hl/v1";

interface MayarConfig {
    apiKey: string;
    isProduction: boolean;
}

interface MayarInvoiceRequest {
    orderId: string;
    amount: number;
    customerPhone: string;
    productName: string;
}

interface MayarInvoiceResponse {
    success: boolean;
    paymentUrl: string;
    invoiceId: string;
    error?: string;
}

/**
 * Fetch Mayar.id configuration from site_settings table.
 */
async function getMayarConfig(): Promise<MayarConfig | null> {
    const settings = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "mayar_api_key"))
        .union(
            db.select().from(siteSettings).where(eq(siteSettings.key, "mayar_mode"))
        );

    const map: Record<string, string> = {};
    for (const s of settings) {
        map[s.key] = s.value;
    }

    const apiKey = map["mayar_api_key"];
    const mode = map["mayar_mode"] || "sandbox";

    if (!apiKey) {
        return null;
    }

    return {
        apiKey,
        isProduction: mode === "production",
    };
}

/**
 * Create a Mayar.id invoice and return the payment URL.
 * Falls back to mock mode if no API key is configured.
 */
export async function createMayarInvoice(
    req: MayarInvoiceRequest
): Promise<MayarInvoiceResponse> {
    const config = await getMayarConfig();

    // --- MOCK MODE (no credentials configured) ---
    if (!config) {
        console.warn("[Mayar] No API key configured. Using MOCK mode.");
        const mockInvoiceId = `INV-${Date.now()}`;
        const mockUrl = `/checkout/${req.orderId}`;
        return {
            success: true,
            paymentUrl: mockUrl,
            invoiceId: mockInvoiceId,
        };
    }

    // --- REAL MAYAR API CALL ---
    try {
        const baseUrl = config.isProduction ? MAYAR_PRODUCTION_URL : MAYAR_SANDBOX_URL;
        const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || (config.isProduction ? "https://abkciraya.cloud" : "");

        const requestBody = {
            name: req.productName,
            email: `${req.customerPhone}@guest.abkciraya.cloud`,
            amount: Math.round(req.amount),
            mobile: req.customerPhone,
            description: `Pembelian ${req.productName} — Order #${req.orderId.slice(0, 8)}`,
            redirectUrl: `${siteUrl}/checkout/${req.orderId}`,
        };

        console.log("[Mayar] Creating invoice:", JSON.stringify(requestBody));

        const response = await fetch(`${baseUrl}/invoice/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        const lastData = await response.json();
        console.log("[Mayar] API Response status:", response.status, "body:", JSON.stringify(lastData));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = lastData as any;

        // Try multiple possible response paths for payment URL
        const paymentUrl = data?.data?.link || data?.data?.paymentUrl || data?.data?.payment_url || data?.link;
        const invoiceId = data?.data?.id || data?.id;

        if (response.ok && paymentUrl) {
            return {
                success: true,
                paymentUrl: paymentUrl,
                invoiceId: invoiceId || `INV-${Date.now()}-${req.orderId.slice(0, 8)}`,
            };
        }

        // API returned error — log clearly and still return the error
        const errorMsg = data?.messages || data?.message || data?.error || JSON.stringify(data);
        console.error("[Mayar] All endpoints failed. Last error:", errorMsg);
        return {
            success: false,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceId: `INV-${Date.now()}-${req.orderId.slice(0, 8)}`,
            error: errorMsg,
        };
    } catch (error) {
        console.error("[Mayar] Network Error:", error);
        return {
            success: false,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceId: `INV-${Date.now()}`,
            error: "Network error",
        };
    }
}

/**
 * Get Mayar config for webhook verification (exported for webhook route).
 */
export { getMayarConfig };
export type { MayarConfig };
