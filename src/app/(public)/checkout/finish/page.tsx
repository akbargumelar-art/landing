"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";

function FinishRedirect() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const orderId = searchParams.get("order_id");
        if (orderId) {
            router.replace(`/checkout/${orderId}`);
        } else {
            router.replace("/belanja");
        }
    }, [searchParams, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            <p className="text-gray-500 font-medium">Mengalihkan ke halaman status pesanan...</p>
        </div>
    );
}

export default function CheckoutFinishPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
            </div>
        }>
            <FinishRedirect />
        </Suspense>
    );
}
