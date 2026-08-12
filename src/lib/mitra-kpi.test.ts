import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregateKpiActual,
    calculateAchievement,
    calculateGap,
    evaluateKpi,
    type KpiParamInput,
    type KpiRuleInput,
} from "./mitra-kpi";

test("achievement mengikuti polaritas dan cap", () => {
    assert.deepEqual(calculateAchievement(150, 100, "HIGHER_BETTER", 120), { achievement: 120, capped: true });
    assert.deepEqual(calculateAchievement(5, 10, "LOWER_BETTER", null), { achievement: 200, capped: false });
    assert.equal(calculateGap(5, 10, "LOWER_BETTER"), 5);
});

test("AVG memasukkan outlet tanpa data sebagai nol dan LAST menjumlah nilai terakhir tiap outlet", () => {
    const rows = [
        { outletId: "a", rawValue: 10, achievementDate: "2026-08-01" },
        { outletId: "a", rawValue: 20, achievementDate: "2026-08-02" },
        { outletId: "b", rawValue: 5, achievementDate: "2026-08-01" },
    ];
    assert.equal(aggregateKpiActual(rows, ["a", "b", "c"], "AVG"), (15 + 5 + 0) / 3);
    assert.equal(aggregateKpiActual(rows, ["a", "b", "c"], "LAST"), 25);
});

test("compliance menjadi gerbang dan aturan KPI memakai first match", () => {
    const params: KpiParamInput[] = [
        { id: "c", key: "visit", label: "Visit", category: "COMPLIANCE", aggregation: "AVG", weight: 0, cap: 100, polarity: "HIGHER_BETTER" },
        { id: "p", key: "sales", label: "Sales", category: "PERFORMANCE", aggregation: "SUM", weight: 100, cap: 120, polarity: "HIGHER_BETTER" },
    ];
    const rules: KpiRuleInput[] = [
        { id: "c-rule", scoreSource: "COMPLIANCE", comparator: "<", threshold: 80, benefitType: "PUNISHMENT", label: "SP Compliance", sortOrder: 0 },
        { id: "high", scoreSource: "PERFORMANCE", comparator: ">=", threshold: 100, benefitType: "REWARD", label: "Rp 100.000", sortOrder: 1 },
        { id: "low", scoreSource: "PERFORMANCE", comparator: ">=", threshold: 90, benefitType: "REWARD", label: "Rp 50.000", sortOrder: 2 },
    ];

    const result = evaluateKpi(params, new Map([["c", 100], ["p", 100]]), new Map([["c", 75], ["p", 120]]), rules, 80);
    assert.equal(result.compliancePassed, false);
    assert.equal(result.performanceScore, 120);
    assert.equal(result.benefitLabel, "SP Compliance");

    const passed = evaluateKpi(params, new Map([["c", 100], ["p", 100]]), new Map([["c", 100], ["p", 120]]), rules, 80);
    assert.equal(passed.compliancePassed, true);
    assert.equal(passed.benefitLabel, "Rp 100.000");
});

test("compliance berbobot dinormalisasi dengan jumlah bobot", () => {
    const params: KpiParamInput[] = [
        { id: "a", key: "a", label: "A", category: "COMPLIANCE", aggregation: "SUM", weight: 30, cap: null, polarity: "HIGHER_BETTER" },
        { id: "b", key: "b", label: "B", category: "COMPLIANCE", aggregation: "SUM", weight: 70, cap: null, polarity: "HIGHER_BETTER" },
    ];
    const result = evaluateKpi(params, new Map([["a", 100], ["b", 100]]), new Map([["a", 100], ["b", 50]]), [], null);
    assert.equal(result.complianceScore, 65);
});

test("target yang belum diisi dikeluarkan dari skor", () => {
    const params: KpiParamInput[] = [
        { id: "known", key: "known", label: "Known", category: "PERFORMANCE", aggregation: "SUM", weight: 50, cap: null, polarity: "HIGHER_BETTER" },
        { id: "missing", key: "missing", label: "Missing", category: "PERFORMANCE", aggregation: "SUM", weight: 50, cap: null, polarity: "HIGHER_BETTER" },
    ];
    const result = evaluateKpi(params, new Map([["known", 100]]), new Map([["known", 100], ["missing", 999]]), [], null);
    assert.equal(result.performanceScore, 50);
    assert.equal(result.missingTargetCount, 1);
    assert.equal(result.params.find((item) => item.id === "missing")?.achievement, null);
});
