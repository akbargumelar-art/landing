/**
 * Jarak dua koordinat dalam meter memakai rumus haversine.
 *
 * Haversine menganggap bumi bola sempurna, sehingga melesetnya sekitar 0,3% -- pada jarak
 * 10 km itu berarti belasan meter. Untuk mengurutkan outlet terdekat, ketelitian sebesar
 * itu jauh lebih dari cukup, dan tidak perlu pustaka geodesi tambahan.
 */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const rad = Math.PI / 180;

    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Meter untuk jarak dekat, kilometer untuk yang jauh -- "1.240 m" sulit dibayangkan. */
export function formatJarak(meter: number): string {
    if (meter < 1000) return `${Math.round(meter)} m`;
    return `${(meter / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}
