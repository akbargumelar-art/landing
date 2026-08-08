/**
 * Street View memakai Maps Embed API, bukan Maps JavaScript API.
 *
 * Mode embed cukup sebuah iframe dan tidak ditagih per pemuatan, sementara Maps
 * JavaScript API menagih tiap kali peta dimuat. Karena itu peta sebaran tetap
 * memakai Leaflet/OpenStreetMap dan Google hanya dipakai untuk panoramanya.
 *
 * Konsekuensinya: isi iframe tidak bisa dikendalikan dari halaman (tidak ada API
 * yang bisa dipanggil ke dalamnya), jadi yang bisa diatur hanya titik awal panorama
 * lewat URL. Berpindah outlet berarti memuat ulang iframe-nya.
 */
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || "";

/**
 * Tanpa API key, seluruh jejak Street View disembunyikan -- iframe tanpa key hanya
 * menampilkan kotak error Google, yang lebih buruk daripada tidak ada fiturnya.
 */
export const STREET_VIEW_ENABLED = EMBED_KEY.length > 0;

export function buildStreetViewEmbedUrl(latitude: number, longitude: number): string {
    const params = new URLSearchParams({
        key: EMBED_KEY,
        location: `${latitude},${longitude}`,
        // Google memilih panorama jalan terdekat dari koordinat ini beserta arah
        // hadap bawaannya; fov 90 kira-kira sudut pandang mata normal.
        fov: "90",
    });

    return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}
