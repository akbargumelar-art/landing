import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { ROLE_MUTASI_OUTLET } from "./mitra-outlet-mutations";

/**
 * Kebijakan: peran lapangan hanya boleh menulis data outlet dan fotonya. Selebihnya lihat saja.
 *
 * Diuji terhadap berkas route yang sesungguhnya, bukan terhadap daftar yang ditulis ulang di
 * sini, supaya endpoint tulis baru yang kelak menyertakan SUPERVISOR/SALESFORCE langsung
 * menggagalkan test alih-alih lolos tanpa ada yang menyadari.
 */
const AKAR_API = join(process.cwd(), "src", "app", "api", "admin");

/** Satu-satunya jalur tulis yang boleh dibuka untuk peran lapangan. */
const JALUR_TULIS_LAPANGAN = [
    join("mitra", "outlets", "[id]", "profile"),
    join("mitra", "outlets", "[id]", "location"),
    join("mitra", "outlets", "[id]", "branding"),
    join("mitra", "outlets", "[id]", "photos"),
];

function daftarRoute(dir: string): string[] {
    const hasil: string[] = [];
    for (const nama of readdirSync(dir)) {
        const penuh = join(dir, nama);
        if (statSync(penuh).isDirectory()) hasil.push(...daftarRoute(penuh));
        else if (nama === "route.ts") hasil.push(penuh);
    }
    return hasil;
}

const routes = daftarRoute(AKAR_API);

test("ada route admin yang terbaca", () => {
    assert.ok(routes.length > 10, `hanya menemukan ${routes.length} route`);
});

test("tidak ada requireRole pada method tulis yang memuat peran lapangan", () => {
    const pelanggaran: string[] = [];

    for (const berkas of routes) {
        const isi = readFileSync(berkas, "utf8");
        if (!/export async function (POST|PUT|PATCH|DELETE)/.test(isi)) continue;

        /**
         * Potongan sesudah handler tulis pertama. GET biasanya dideklarasikan lebih dulu dan
         * memang boleh memuat peran lapangan, jadi yang diperiksa hanya bagian setelahnya.
         */
        const mulaiTulis = isi.search(/export async function (POST|PUT|PATCH|DELETE)/);
        const bagianTulis = isi.slice(mulaiTulis);

        for (const cocok of bagianTulis.matchAll(/requireRole\(\[([^\]]*)\]/g)) {
            if (/SUPERVISOR|SALESFORCE/.test(cocok[1])) {
                pelanggaran.push(berkas.replace(process.cwd(), ""));
            }
        }
    }

    assert.deepEqual(pelanggaran, [], "peran lapangan tidak boleh menulis lewat requireRole");
});

test("gerbang mutasi outlet hanya dipakai empat jalur yang disepakati", () => {
    const pemakai = routes
        .filter((berkas) => readFileSync(berkas, "utf8").includes("gerbangMutasiOutlet"))
        .map((berkas) => berkas.slice(AKAR_API.length + 1).replace(join("", "route.ts"), "").replace(/[\\/]$/, ""));

    assert.deepEqual(pemakai.sort(), [...JALUR_TULIS_LAPANGAN].sort());
});

test("route tulis lain tidak melewatkan pemeriksaan peran", () => {
    const tanpaPenjaga: string[] = [];

    for (const berkas of routes) {
        const isi = readFileSync(berkas, "utf8");
        if (!/export async function (POST|PUT|PATCH|DELETE)/.test(isi)) continue;
        if (/requireRole|gerbangMutasiOutlet|requireAdminScope/.test(isi)) continue;
        tanpaPenjaga.push(berkas.replace(process.cwd(), ""));
    }

    assert.deepEqual(tanpaPenjaga, [], "setiap route tulis wajib punya pemeriksaan peran");
});

test("peran yang boleh mengubah outlet tidak melebar", () => {
    assert.deepEqual([...ROLE_MUTASI_OUTLET].sort(), ["ADMIN_INPUT", "SALESFORCE", "SUPERVISOR", "SUPER_ADMIN"]);
});
