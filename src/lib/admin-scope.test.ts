import assert from "node:assert/strict";
import test from "node:test";

import { canAccessOutlet, canMutateOutlet, isScopedRole, type AdminActorScope } from "./admin-scope";

const scope = (over: Partial<AdminActorScope>): AdminActorScope => ({
    userId: "u1",
    role: "SALESFORCE",
    taps: ["TAP A"],
    salesforceId: "sf-1",
    ...over,
});

const outlet = (tap: string | null, salesforceId: string | null) => ({ tap, salesforceId });

test("role tak berwilayah menjangkau seluruh outlet", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"] as const) {
        assert.equal(isScopedRole(role), false);
        assert.equal(canAccessOutlet(scope({ role, taps: [], salesforceId: null }), outlet("TAP Z", "sf-9")), true);
    }
});

test("salesforce hanya menjangkau outlet binaannya di TAP-nya", () => {
    const sf = scope({});
    assert.equal(canAccessOutlet(sf, outlet("TAP A", "sf-1")), true);
    // Rekan setim: TAP sama, petugas berbeda -- justru kasus yang tidak tertutup bila
    // pembatasan hanya mengandalkan TAP.
    assert.equal(canAccessOutlet(sf, outlet("TAP A", "sf-2")), false);
    // Outlet sendiri tetapi sudah pindah ke TAP lain.
    assert.equal(canAccessOutlet(sf, outlet("TAP B", "sf-1")), false);
    assert.equal(canAccessOutlet(sf, outlet(null, "sf-1")), false);
});

test("supervisor menjangkau seluruh outlet dalam TAP-nya, lintas petugas", () => {
    const spv = scope({ role: "SUPERVISOR", salesforceId: null, taps: ["TAP A", "TAP B"] });
    assert.equal(canAccessOutlet(spv, outlet("TAP A", "sf-2")), true);
    assert.equal(canAccessOutlet(spv, outlet("TAP B", null)), true);
    assert.equal(canAccessOutlet(spv, outlet("TAP C", "sf-2")), false);
});

test("assignment setengah jadi tidak membuka apa pun", () => {
    // Salesforce tanpa tautan master.
    assert.equal(canAccessOutlet(scope({ salesforceId: null }), outlet("TAP A", "sf-1")), false);
    // Role berwilayah tanpa satu pun TAP.
    assert.equal(canAccessOutlet(scope({ taps: [] }), outlet("TAP A", "sf-1")), false);
    assert.equal(canAccessOutlet(scope({ role: "SUPERVISOR", salesforceId: null, taps: [] }), outlet("TAP A", "sf-1")), false);
});

test("manager boleh melihat tetapi tidak boleh mengubah", () => {
    const manager = scope({ role: "MANAGER", taps: [], salesforceId: null });
    assert.equal(canAccessOutlet(manager, outlet("TAP A", "sf-1")), true);
    assert.equal(canMutateOutlet(manager, outlet("TAP A", "sf-1")), false);
});

test("hak ubah tidak pernah melampaui hak lihat", () => {
    const sf = scope({});
    assert.equal(canMutateOutlet(sf, outlet("TAP A", "sf-1")), true);
    assert.equal(canMutateOutlet(sf, outlet("TAP A", "sf-2")), false);

    const spv = scope({ role: "SUPERVISOR", salesforceId: null });
    assert.equal(canMutateOutlet(spv, outlet("TAP A", "sf-2")), true);
    assert.equal(canMutateOutlet(spv, outlet("TAP C", "sf-2")), false);
});
