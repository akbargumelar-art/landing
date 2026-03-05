import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ========== Midtrans Snap API Integration ==========

const MIDTRANS_SANDBOX_URL = "https://app.sandbox.midtrans.com/snap/v1";
const MIDTRANS_PRODUCTION_URL = "https://app.midtrans.com/snap/v1";

const MIDTRANS_SANDBOX_SNAP_URL = "https://app.sandbox.midtrans.com/snap/snap.js";
const MIDTRANS_PRODUCTION_SNAP_URL = "https://app.midtrans.com/snap/snap.js";

export interface MidtransConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
}

interface MidtransTransactionRequest {
    orderId: string;
    amount: number;
    customerPhone: string;
    productName: string;
}

interface MidtransTransactionResponse {
    success: boolean;
    snapToken: string;
    paymentUrl: string;
    error?: string;
}

/**
 * Fetch Midtrans configuration from site_settings table.
 */
export async function getMidtransConfig(): Promise<MidtransConfig | null> {
    const settings = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "midtrans_server_key"))
        .union(
            db.select().from(siteSettings).where(eq(siteSettings.key, "midtrans_client_key"))
        )
        .union(
            db.select().from(siteSettings).where(eq(siteSettings.key, "midtrans_mode"))
        );

    const map: Record<string, string> = {};
    for (const s of settings) {
        map[s.key] = s.value;
    }

    const serverKey = map["midtrans_server_key"];
    const clientKey = map["midtrans_client_key"];
    const mode = map["midtrans_mode"] || "sandbox";

    if (!serverKey) {
        return null;
    }

    return {
        serverKey,
        clientKey: clientKey || "",
        isProduction: mode === "production",
    };
}

/**
 * Create a Midtrans Snap transaction and return the payment URL.
 * Falls back to mock mode if no Server Key is configured.
 */
export async function createMidtransTransaction(
    req: MidtransTransactionRequest
): Promise<MidtransTransactionResponse> {
    const config = await getMidtransConfig();

    // --- MOCK MODE (no credentials configured) ---
    if (!config) {
        console.warn("[Midtrans] No Server Key configured. Using MOCK mode.");
        return {
            success: true,
            snapToken: `MOCK-SNAP-${Date.now()}`,
            paymentUrl: `/checkout/${req.orderId}`,
        };
    }

    // --- REAL MIDTRANS SNAP API CALL ---
    try {
        const baseUrl = config.isProduction ? MIDTRANS_PRODUCTION_URL : MIDTRANS_SANDBOX_URL;

        // Basic Auth: Base64(ServerKey + ":")
        const authString = Buffer.from(`${config.serverKey}:`).toString("base64");

        const requestBody = {
            transaction_details: {
                order_id: req.orderId,
                gross_amount: Math.round(req.amount),
            },
            customer_details: {
                phone: req.customerPhone,
            },
            item_details: [
                {
                    id: req.orderId.slice(0, 50),
                    price: Math.round(req.amount),
                    quantity: 1,
                    name: req.productName.slice(0, 50),
                },
            ],
        };

        console.log("[Midtrans] Creating Snap transaction:", JSON.stringify(requestBody));

        const response = await fetch(`${baseUrl}/transactions`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Basic ${authString}`,
            },
            body: JSON.stringify(requestBody),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await response.json() as any;
        console.log("[Midtrans] API Response status:", response.status, "body:", JSON.stringify(data));

        if (response.ok && data.token && data.redirect_url) {
            return {
                success: true,
                snapToken: data.token,
                paymentUrl: data.redirect_url,
            };
        }

        // API returned error
        const errorMsg = data?.error_messages?.join(", ") || data?.message || JSON.stringify(data);
        console.error("[Midtrans] API Error:", errorMsg);
        return {
            success: false,
            snapToken: "",
            paymentUrl: `/checkout/${req.orderId}`,
            error: errorMsg,
        };
    } catch (error) {
        console.error("[Midtrans] Network Error:", error);
        return {
            success: false,
            snapToken: "",
            paymentUrl: `/checkout/${req.orderId}`,
            error: "Network error",
        };
    }
}

/**
 * Verify Midtrans webhook signature.
 * Signature = SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    serverKey: string,
    signatureKey: string
): boolean {
    const payload = orderId + statusCode + grossAmount + serverKey;
    const expectedSignature = crypto.createHash("sha512").update(payload).digest("hex");
    return expectedSignature === signatureKey;
}

/**
 * Get Snap.js URL based on current mode.
 */
export function getSnapJsUrl(isProduction: boolean): string {
    return isProduction ? MIDTRANS_PRODUCTION_SNAP_URL : MIDTRANS_SANDBOX_SNAP_URL;
}
