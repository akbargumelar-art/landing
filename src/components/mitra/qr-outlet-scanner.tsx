"use client";

import React from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Camera, ImageUp, Loader2, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function QrOutletScanner() {
    const router = useRouter();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [cameraActive, setCameraActive] = React.useState(false);
    const [error, setError] = React.useState("");

    const openOutlet = React.useCallback((rawValue: string) => {
        try {
            const parsed = new URL(rawValue, window.location.origin);
            const match = parsed.pathname.match(/^\/mitra\/o\/([^/?#]+)/i);
            if (!match) {
                setError("QR bukan profil Mitra Outlet ABK Ciraya.");
                return false;
            }

            setOpen(false);
            router.push(`/mitra/o/${encodeURIComponent(decodeURIComponent(match[1]))}`);
            return true;
        } catch {
            setError("Isi QR tidak dapat dibaca.");
            return false;
        }
    }, [router]);

    React.useEffect(() => {
        if (!open || !cameraActive) return;

        let stream: MediaStream | null = null;
        let animationFrame = 0;
        let cancelled = false;
        const videoElement = videoRef.current;

        async function startCamera() {
            try {
                setError("");
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                    audio: false,
                });
                if (cancelled || !videoElement) return;
                videoElement.srcObject = stream;
                await videoElement.play();

                function scanFrame() {
                    if (cancelled) return;
                    const video = videoElement;
                    const canvas = canvasRef.current;
                    if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                        const width = video.videoWidth;
                        const height = video.videoHeight;
                        if (width > 0 && height > 0) {
                            canvas.width = width;
                            canvas.height = height;
                            const context = canvas.getContext("2d", { willReadFrequently: true });
                            context?.drawImage(video, 0, 0, width, height);
                            const image = context?.getImageData(0, 0, width, height);
                            if (image) {
                                const result = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
                                if (result && openOutlet(result.data)) return;
                            }
                        }
                    }
                    animationFrame = requestAnimationFrame(scanFrame);
                }

                animationFrame = requestAnimationFrame(scanFrame);
            } catch {
                setError("Kamera tidak dapat diakses. Periksa izin browser atau gunakan gambar QR.");
                setCameraActive(false);
            }
        }

        startCamera();
        return () => {
            cancelled = true;
            cancelAnimationFrame(animationFrame);
            stream?.getTracks().forEach((track) => track.stop());
            if (videoElement) videoElement.srcObject = null;
        };
    }, [cameraActive, open, openOutlet]);

    const scanImage = async (file: File) => {
        setError("");
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context?.drawImage(bitmap, 0, 0);
            bitmap.close();
            const image = context?.getImageData(0, 0, canvas.width, canvas.height);
            const result = image ? jsQR(image.data, image.width, image.height) : null;
            if (!result) setError("QR tidak ditemukan pada gambar tersebut.");
            else openOutlet(result.data);
        } catch {
            setError("Gambar QR tidak dapat diproses.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setCameraActive(false); }}>
            <DialogTrigger asChild>
                <Button type="button">
                    <ScanLine className="h-4 w-4" />
                    Scan QR Outlet
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Scan QR Mitra Outlet</DialogTitle>
                    <DialogDescription>Arahkan kamera ke QR profil outlet atau pilih gambar QR dari perangkat.</DialogDescription>
                </DialogHeader>

                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-950">
                    {cameraActive ? (
                        <>
                            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                            <div className="pointer-events-none absolute inset-8 border-2 border-white/80" />
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
                            <Camera className="h-10 w-10" />
                            <p className="text-sm text-white/75">Kamera belum aktif.</p>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden" />

                {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => setCameraActive((active) => !active)}>
                        {cameraActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {cameraActive ? "Hentikan Kamera" : "Aktifkan Kamera"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                        <ImageUp className="h-4 w-4" />
                        Pilih Gambar QR
                    </Button>
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) scanImage(file);
                        event.currentTarget.value = "";
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
