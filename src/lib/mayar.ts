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

        const response = await fetch(`${baseUrl}/invoice`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                name: req.productName,
                amount: Math.round(req.amount),
                mobile: req.customerPhone,
                description: `Pembelian ${req.productName} — Order #${req.orderId.slice(0, 8)}`,
                redirect_url: config.isProduction
                    ? `${process.env.NEXT_PUBLIC_BASE_URL || ""}/checkout/${req.orderId}`
                    : `/checkout/${req.orderId}`,
            }),
        });

        const data = await response.json();

        if (response.ok && data.data?.link) {
            return {
                success: true,
                paymentUrl: data.data.link,
                invoiceId: data.data.id || `INV-${Date.now()}-${req.orderId.slice(0, 8)}`,
            };
        }

        console.error("[Mayar] API Error:", JSON.stringify(data));
        // Fallback to mock if Mayar API returns error
        return {
            success: true,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceId: `INV-${Date.now()}-${req.orderId.slice(0, 8)}`,
            error: data.messages || "Mayar API error, using fallback",
        };
    } catch (error) {
        console.error("[Mayar] Network Error:", error);
        // Fallback to mock on network error
        const fallbackInvoiceId = `INV-${Date.now()}`;
        return {
            success: true,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceId: fallbackInvoiceId,
            error: "Network error, using fallback",
        };
    }
}

/**
 * Get Mayar config for webhook verification (exported for webhook route).
 */
export { getMayarConfig };
export type { MayarConfig };
