import assert from "node:assert/strict";
import test from "node:test";

import { FIELD_BRANDING, FIELD_LOKASI, FIELD_PROFIL, ROLE_MUTASI_OUTLET } from "./mitra-outlet-mutations";

/**
 * Kolom yang tidak boleh disentuh role lapangan lewat jalur mutasi mana pun. Diuji sebagai
 * daftar tetap supaya penambahan field ke salah satu allowlist tidak diam-diam membuka
 * identitas administratif atau penugasan organisasi.
 */
const TERLARANG = [
    "id",
    "outletCode",
    "publicToken",
    "rsNumber",
    "tap",
    "salesforceId",
    "status",
    "createdAt",
];

test("allowlist mutasi tidak memuat satu pun field terlarang", () => {
    const semua: string[] = [...FIELD_PROFIL, ...FIELD_LOKASI, ...FIELD_BRANDING];
    for (const kolom of TERLARANG) {
        assert.equal(semua.includes(kolom), false, `${kolom} tidak boleh ada di allowlist mutasi`);
    }
});

test("allowlist tiap aksi tidak saling tumpang tindih", () => {
    const semua: string[] = [...FIELD_PROFIL, ...FIELD_LOKASI, ...FIELD_BRANDING];
    assert.equal(new Set(semua).size, semua.length, "satu field hanya boleh dimiliki satu aksi");
});

test("profil memuat persis field operasional yang disepakati", () => {
    assert.deepEqual([...FIELD_PROFIL], [
        "name", "ownerName", "ownerPhone", "kabupaten", "kecamatan", "category", "pjpDay", "pjpType",
    ]);
});

test("manager tidak termasuk role yang boleh mengubah outlet", () => {
    const roles: readonly string[] = ROLE_MUTASI_OUTLET;
    assert.equal(roles.includes("MANAGER"), false);
    assert.equal(roles.includes("SALESFORCE"), true);
    assert.equal(roles.includes("SUPERVISOR"), true);
});
