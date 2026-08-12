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

test("jalur tulis program dan produk hanya menerima peran admin data", () => {
    const akarYangDiperiksa = [
        "programs",
        "products",
        join("mitra", "programs"),
        "vouchers",
        "cuan",
        "indihome",
    ];
    const pelanggaran: string[] = [];

    for (const berkas of routes) {
        const relatif = berkas.slice(AKAR_API.length + 1);
        if (!akarYangDiperiksa.some((akar) => relatif.startsWith(`${akar}\\`) || relatif.startsWith(`${akar}/`))) continue;

        const isi = readFileSync(berkas, "utf8");
        const handlers = [...isi.matchAll(/export async function (POST|PUT|PATCH|DELETE)/g)];
        handlers.forEach((handler, index) => {
            const mulai = handler.index || 0;
            const selesai = handlers[index + 1]?.index ?? isi.length;
            const bagian = isi.slice(mulai, selesai);
            const role = bagian.match(/requireRole\(\[([^\]]*)\]/)?.[1] || "";
            if (/MANAGER|SUPERVISOR|SALESFORCE/.test(role)) {
                pelanggaran.push(`${relatif}:${handler[1]}`);
            }
        });
    }

    assert.deepEqual(pelanggaran, [], "viewer tidak boleh masuk gerbang tulis program/produk");
});

test("penghapusan permanen program dan produk hanya untuk Super Admin", () => {
    const pelanggaran: string[] = [];

    for (const berkas of routes) {
        const relatif = berkas.slice(AKAR_API.length + 1);
        if (!/^(programs|products|mitra[\\/]programs|vouchers|cuan|indihome)[\\/]/.test(relatif) && !/^(programs|products|vouchers)[\\/]?route\.ts$/.test(relatif)) continue;

        const isi = readFileSync(berkas, "utf8");
        const handlers = [...isi.matchAll(/export async function (POST|PUT|PATCH|DELETE)/g)];
        handlers.forEach((handler, index) => {
            if (handler[1] !== "DELETE") return;
            const mulai = handler.index || 0;
            const selesai = handlers[index + 1]?.index ?? isi.length;
            const role = isi.slice(mulai, selesai).match(/requireRole\(\[([^\]]*)\]/)?.[1] || "";
            if (!/^\s*"SUPER_ADMIN"\s*$/.test(role)) pelanggaran.push(`${relatif}:DELETE`);
        });
    }

    assert.deepEqual(pelanggaran, [], "hapus permanen harus khusus SUPER_ADMIN");
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

test("PUT master outlet tidak dapat mengubah grup performance", () => {
    const berkas = join(AKAR_API, "mitra", "outlets", "[id]", "route.ts");
    const isi = readFileSync(berkas, "utf8");
    const mulai = isi.indexOf("export async function PUT");
    const selesai = isi.indexOf("export async function DELETE", mulai);
    const handlerPut = isi.slice(mulai, selesai);

    assert.ok(mulai >= 0 && selesai > mulai, "handler PUT outlet harus ditemukan");
    for (const field of ["sellthruDigipos", "sellthruNota", "rechargeDigipos"]) {
        assert.equal(handlerPut.includes(field), false, `${field} hanya boleh ditulis lewat import admin`);
    }
    assert.equal(handlerPut.includes("mitraOutletDetails"), false, "PUT outlet tidak boleh menulis tabel detail");
    assert.match(handlerPut, /grupPerformanceDikirim/);
    assert.match(handlerPut, /hanya dapat diperbarui melalui Upload Data admin/);
});

test("import admin tetap menjadi jalur tulis grup performance", () => {
    const berkas = join(AKAR_API, "mitra", "imports", "route.ts");
    const isi = readFileSync(berkas, "utf8");

    assert.match(isi, /requireRole\(\["SUPER_ADMIN", "ADMIN_INPUT"\]\)/);
    assert.match(isi, /commitOutletDetailRows/);
});
