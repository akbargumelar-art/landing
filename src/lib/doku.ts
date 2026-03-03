import crypto from "crypto";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// ========== DOKU Checkout API Integration ==========

const DOKU_SANDBOX_URL = "https://api-sandbox.doku.com";
const DOKU_PRODUCTION_URL = "https://api.doku.com";
const CHECKOUT_PATH = "/checkout/v1/payment";

interface DokuConfig {
    clientId: string;
    secretKey: string;
    isProduction: boolean;
}

interface DokuPaymentRequest {
    orderId: string;
    amount: number;
    customerPhone: string;
    productName: string;
}

interface DokuPaymentResponse {
    success: boolean;
    paymentUrl: string;
    invoiceNumber: string;
    error?: string;
}

/**
 * Fetch DOKU configuration from site_settings table.
 */
async function getDokuConfig(): Promise<DokuConfig | null> {
    const settings = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "doku_client_id"))
        .union(
            db.select().from(siteSettings).where(eq(siteSettings.key, "doku_secret_key"))
        )
        .union(
            db.select().from(siteSettings).where(eq(siteSettings.key, "doku_mode"))
        );

    const map: Record<string, string> = {};
    for (const s of settings) {
        map[s.key] = s.value;
    }

    const clientId = map["doku_client_id"];
    const secretKey = map["doku_secret_key"];
    const mode = map["doku_mode"] || "sandbox";

    if (!clientId || !secretKey) {
        return null;
    }

    return {
        clientId,
        secretKey,
        isProduction: mode === "production",
    };
}

/**
 * Generate SHA256 digest (base64) of the request body.
 */
function generateDigest(body: string): string {
    return crypto.createHash("sha256").update(body, "utf8").digest("base64");
}

/**
 * Generate HMAC-SHA256 signature for DOKU API authentication.
 *
 * Signature components (newline-separated):
 *   Client-Id:<clientId>
 *   Request-Id:<requestId>
 *   Request-Timestamp:<timestamp>
 *   Request-Target:<path>
 *   Digest:<digest>
 */
function generateSignature(
    clientId: string,
    secretKey: string,
    requestId: string,
    timestamp: string,
    requestTarget: string,
    digest: string
): string {
    const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

    const hmac = crypto
        .createHmac("sha256", secretKey)
        .update(componentSignature)
        .digest("base64");

    return `HMACSHA256=${hmac}`;
}

/**
 * Verify DOKU webhook notification signature.
 */
export function verifyNotificationSignature(
    clientId: string,
    secretKey: string,
    requestId: string,
    timestamp: string,
    requestTarget: string,
    digest: string,
    receivedSignature: string
): boolean {
    const expectedSignature = generateSignature(
        clientId,
        secretKey,
        requestId,
        timestamp,
        requestTarget,
        digest
    );
    return expectedSignature === receivedSignature;
}

/**
 * Create a DOKU Checkout payment.
 * Returns a payment URL to redirect the user to, or falls back to mock mode.
 */
export async function createDokuPayment(
    req: DokuPaymentRequest
): Promise<DokuPaymentResponse> {
    const config = await getDokuConfig();

    // --- MOCK MODE (no credentials configured) ---
    if (!config) {
        console.warn("[DOKU] No credentials configured. Using MOCK mode.");
        const mockInvoice = `INV-${Date.now()}`;
        const mockUrl = `/checkout/${req.orderId}`;
        return {
            success: true,
            paymentUrl: mockUrl,
            invoiceNumber: mockInvoice,
        };
    }

    // --- REAL DOKU API CALL ---
    try {
        const baseUrl = config.isProduction ? DOKU_PRODUCTION_URL : DOKU_SANDBOX_URL;
        const invoiceNumber = `INV-${Date.now()}-${req.orderId.slice(0, 8)}`;
        const requestId = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

        const requestBody = JSON.stringify({
            order: {
                amount: Math.round(req.amount),
                invoice_number: invoiceNumber,
            },
            payment: {
                payment_due_date: 60, // 60 minutes to pay
            },
            customer: {
                phone: req.customerPhone,
                name: req.customerPhone,
            },
        });

        const digest = generateDigest(requestBody);
        const signature = generateSignature(
            config.clientId,
            config.secretKey,
            requestId,
            timestamp,
            CHECKOUT_PATH,
            digest
        );

        const response = await fetch(`${baseUrl}${CHECKOUT_PATH}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-Id": config.clientId,
                "Request-Id": requestId,
                "Request-Timestamp": timestamp,
                Signature: signature,
            },
            body: requestBody,
        });

        const data = await response.json();

        if (response.ok && data.response?.payment?.url) {
            return {
                success: true,
                paymentUrl: data.response.payment.url,
                invoiceNumber: invoiceNumber,
            };
        }

        console.error("[DOKU] API Error:", JSON.stringify(data));
        // Fallback to mock if DOKU API returns error
        return {
            success: true,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceNumber: invoiceNumber,
            error: data.error?.message || "DOKU API error, using fallback",
        };
    } catch (error) {
        console.error("[DOKU] Network Error:", error);
        // Fallback to mock on network error
        const fallbackInvoice = `INV-${Date.now()}`;
        return {
            success: true,
            paymentUrl: `/checkout/${req.orderId}`,
            invoiceNumber: fallbackInvoice,
            error: "Network error, using fallback",
        };
    }
}

/**
 * Get DOKU config for webhook verification (exported for webhook route).
 */
export { getDokuConfig };
export type { DokuConfig };
