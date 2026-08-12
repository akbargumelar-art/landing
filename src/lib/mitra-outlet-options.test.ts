import assert from "node:assert/strict";
import test from "node:test";

import { pjpDayInJakarta } from "./mitra-outlet-options";

test("hari PJP berganti tepat pada tengah malam Asia Jakarta", () => {
    assert.equal(pjpDayInJakarta(new Date("2026-08-09T16:59:59.000Z")), "Minggu");
    assert.equal(pjpDayInJakarta(new Date("2026-08-09T17:00:00.000Z")), "Senin");
});

test("hari PJP tidak mengikuti zona waktu mesin yang menjalankan test", () => {
    assert.equal(pjpDayInJakarta(new Date("2026-08-11T00:30:00.000Z")), "Selasa");
});
