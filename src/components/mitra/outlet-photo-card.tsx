"use client";

import Image from "next/image";
import React from "react";
import { Camera, ImageIcon, Images, Loader2, TriangleAlert, X } from "lucide-react";

import {
    BATAS_SEGAR_HARI,
    MITRA_PHOTO_SLOTS,
    formatTanggalFoto,
    statusFoto,
    type MitraPhotoSlotKey,
} from "@/lib/mitra-outlet-photos";

/**
 * Sengaja longgar: dua halaman pemanggilnya memiliki bentuk data berbeda (profil publik
 * dan detail terverifikasi), dan kartu ini hanya membaca kolom foto yang namanya sudah
 * ditetapkan MITRA_PHOTO_SLOTS. Nilainya dinormalkan saat dibaca.
 */
type SumberFoto = Record<string, unknown>;

function bacaTeks(nilai: unknown): string | null {
    return typeof nilai === "string" && nilai.length > 0 ? nilai : null;
}

interface FotoTerbuka {
    url: string;
    label: string;
}

/**
 * Penampil foto ukuran penuh.
 *
 * Kartunya memotong foto jadi petak 144 px (object-cover), jadi POP material dan papan
 * nama yang justru ingin diperiksa sering terpotong. Di sini foto ditampilkan utuh dengan
 * object-contain -- diperbesar sebesar layar, bukan sekadar diperlebar.
 */
function PopupFoto({ foto, onTutup }: { foto: FotoTerbuka; onTutup: () => void }) {
    // Ukuran awal hanya dipakai sampai gambar selesai dibaca. Setelah itu atribut dimensi
    // mengikuti ukuran aslinya, sehingga kotak klik sama dengan gambar yang terlihat --
    // bukan persegi panjang 80vh penuh yang mencakup area letterbox gelap.
    const [dimensi, setDimensi] = React.useState({ width: 1600, height: 900 });

    React.useEffect(() => {
        const tekan = (event: KeyboardEvent) => {
            if (event.key === "Escape") onTutup();
        };
        window.addEventListener("keydown", tekan);

        // Halaman di belakangnya dikunci supaya gulir jari di ponsel tidak menggeser
        // daftar outlet sementara fotonya menutupi layar.
        const gulirSemula = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", tekan);
            document.body.style.overflow = gulirSemula;
        };
    }, [onTutup]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={foto.label}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
            onClick={onTutup}
        >
            <button
                type="button"
                aria-label="Tutup"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={onTutup}
            >
                <X className="h-5 w-5" />
            </button>

            {/* Pembungkus tidak menghentikan event: area kosong di sekeliling gambar tetap
                menjadi bagian backdrop. Hanya elemen gambar yang menghentikan klik. */}
            <div className="flex max-h-[80vh] max-w-[calc(100vw-2rem)] items-center justify-center">
                <Image
                    src={foto.url}
                    alt={foto.label}
                    width={dimensi.width}
                    height={dimensi.height}
                    sizes="100vw"
                    className="h-auto max-h-[80vh] w-auto max-w-full object-contain"
                    unoptimized
                    onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget;
                        if (naturalWidth > 0 && naturalHeight > 0) {
                            setDimensi({ width: naturalWidth, height: naturalHeight });
                        }
                    }}
                    onClick={(event) => event.stopPropagation()}
                />
            </div>

            <p className="text-sm font-semibold text-white">{foto.label}</p>
        </div>
    );
}

/**
 * Satu tombol pilih berkas. Dipakai dua kali per slot dengan satu-satunya perbedaan pada
 * atribut `capture`, supaya aturan berkas yang diterima -- tipe dan penanganan pilihan --
 * tidak punya dua salinan yang bisa menyimpang diam-diam.
 */
function TombolPilihFoto({
    label,
    icon: Icon,
    langsungKamera,
    nonaktif,
    onPilih,
}: {
    label: string;
    icon: typeof Camera;
    langsungKamera?: boolean;
    nonaktif: boolean;
    onPilih: (file: File) => void;
}) {
    return (
        <label
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold ${
                nonaktif ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"
            }`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                // Hanya tombol kamera yang memakai `capture`. Di tombol galeri atribut ini
                // harus BENAR-BENAR tidak ada, bukan diisi string kosong -- sebagian ponsel
                // memperlakukan `capture=""` sebagai perintah membuka kamera juga.
                {...(langsungKamera ? { capture: "environment" as const } : {})}
                className="hidden"
                disabled={nonaktif}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onPilih(file);
                    event.target.value = "";
                }}
            />
        </label>
    );
}

/**
 * Kartu empat foto outlet, dipakai dua halaman dengan satu perbedaan: di profil publik
 * hanya ditampilkan, di halaman detail bisa diunggah ulang. Perbedaan itu diatur lewat
 * ada-tidaknya `onUpload`, bukan lewat dua komponen yang mudah berbeda diam-diam.
 */
export function OutletPhotoCard({
    outlet,
    onUpload,
    sedangUnggah,
    compactMobile = false,
}: {
    outlet: SumberFoto;
    onUpload?: (slot: MitraPhotoSlotKey, file: File) => void;
    sedangUnggah?: MitraPhotoSlotKey | null;
    /** Memadatkan kartu dalam editor lapangan tanpa mengubah profil publik. */
    compactMobile?: boolean;
}) {
    const bisaUnggah = Boolean(onUpload);
    const jumlahPerluDiperbarui = MITRA_PHOTO_SLOTS.filter(
        (slot) => statusFoto(bacaTeks(outlet[slot.atColumn])).perluDiperbarui
    ).length;

    const [fotoTerbuka, setFotoTerbuka] = React.useState<FotoTerbuka | null>(null);
    const tutupFoto = React.useCallback(() => setFotoTerbuka(null), []);

    return (
        <div className={`rounded-lg border bg-white shadow-sm ${compactMobile ? "p-3 sm:p-5" : "p-5"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="font-bold">Foto Outlet</h2>
                    <p className={`mt-0.5 text-xs text-muted-foreground ${compactMobile ? "hidden sm:block" : ""}`}>
                        Diperbarui salesforce setiap kunjungan, dijadwalkan {BATAS_SEGAR_HARI} hari sekali.
                    </p>
                </div>
                {jumlahPerluDiperbarui > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {jumlahPerluDiperbarui} foto perlu diperbarui
                    </span>
                )}
            </div>

            <div className={compactMobile
                ? "mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4 lg:grid-cols-4"
                : "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"}
            >
                {MITRA_PHOTO_SLOTS.map((slot) => {
                    const url = bacaTeks(outlet[slot.urlColumn]);
                    const status = statusFoto(bacaTeks(outlet[slot.atColumn]));
                    const unggahSlotIni = sedangUnggah === slot.key;

                    return (
                        <div key={slot.key} className="overflow-hidden rounded-lg border">
                            <div className={`relative w-full bg-gray-100 ${compactMobile ? "h-24 sm:h-36" : "h-36"}`}>
                                {url ? (
                                    // Tombol, bukan div ber-onClick: petak ini membuka dialog, jadi
                                    // harus bisa dicapai lewat Tab dan dipicu dengan Enter juga.
                                    <button
                                        type="button"
                                        aria-label={`Perbesar foto ${slot.label}`}
                                        className="group absolute inset-0 cursor-zoom-in"
                                        onClick={() => setFotoTerbuka({ url, label: slot.label })}
                                    >
                                        <Image src={url} alt={slot.label} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" unoptimized />
                                        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                                    </button>
                                ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                                        <ImageIcon className="h-7 w-7" />
                                        <span className="text-xs">Belum ada foto</span>
                                    </div>
                                )}
                                {slot.utama && (
                                    // pointer-events-none: label ini menumpuk di atas tombol perbesar,
                                    // dan tanpanya sudut kiri-atas foto jadi mati saat diklik.
                                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                        Foto utama
                                    </span>
                                )}
                            </div>

                            <div className={`space-y-1 ${compactMobile ? "p-2 sm:p-3" : "p-3"}`}>
                                <p className={`${compactMobile ? "text-xs sm:text-sm" : "text-sm"} font-semibold text-gray-950`}>{slot.label}</p>
                                <p className={`text-xs text-muted-foreground ${compactMobile ? "hidden sm:block" : ""}`}>{slot.hint}</p>
                                <p className={`text-xs font-semibold ${status.perluDiperbarui ? "text-amber-700" : "text-green-700"}`}>
                                    {status.label}
                                </p>
                                {url && <p className="text-xs text-muted-foreground">{formatTanggalFoto(bacaTeks(outlet[slot.atColumn]))}</p>}

                                {bisaUnggah && (unggahSlotIni ? (
                                    <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Mengunggah...
                                    </div>
                                ) : (
                                    /* Dua jalan masuk yang setara. Tombol Kamera didahulukan karena
                                       memotret di tempat adalah cara yang diharapkan; Galeri untuk
                                       foto yang sudah diambil lebih dulu, mis. saat sinyal di outlet
                                       mati dan unggahannya baru bisa dilakukan setelah pindah tempat. */
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <TombolPilihFoto
                                            label="Kamera"
                                            icon={Camera}
                                            langsungKamera
                                            nonaktif={Boolean(sedangUnggah)}
                                            onPilih={(file) => onUpload?.(slot.key, file)}
                                        />
                                        <TombolPilihFoto
                                            label="Galeri"
                                            icon={Images}
                                            nonaktif={Boolean(sedangUnggah)}
                                            onPilih={(file) => onUpload?.(slot.key, file)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {bisaUnggah && (
                <p className={`mt-3 text-xs text-muted-foreground ${compactMobile ? "hidden sm:block" : ""}`}>
                    Format JPG, PNG, atau WebP. Maksimal 5 MB per foto. Klik foto untuk memperbesar.
                </p>
            )}

            {fotoTerbuka && <PopupFoto foto={fotoTerbuka} onTutup={tutupFoto} />}
        </div>
    );
}
