import {
    MITRA_MARKET_SHARE_AFTER_OPERATORS,
    MITRA_MARKET_SHARE_BEFORE_OPERATORS,
    type MitraMarketShareKey,
} from "@/lib/mitra-market-share";

export interface OperatorShareDatum {
    key: string;
    label: string;
    color: string;
    percent: number;
}

const GARIS_BANTU = [25, 50, 75, 100];

/**
 * Grafik bar horizontal untuk pangsa pasar operator. Skala tetap 0-100% (bukan
 * mengikuti nilai maksimum data) supaya panjang bar antar kecamatan/tampilan bisa
 * dibandingkan apa adanya. Diurutkan menurun supaya operator terbesar langsung
 * terlihat di baris paling atas.
 */
export function OperatorShareChart({ data, className = "" }: { data: OperatorShareDatum[]; className?: string }) {
    const terurut = [...data].sort((a, b) => b.percent - a.percent);

    return (
        <div className={`space-y-3 ${className}`} role="img" aria-label="Grafik pangsa pasar operator">
            {terurut.map((operator) => {
                const lebar = Math.min(Math.max(operator.percent, 0), 100);
                return (
                    <div key={operator.key} className="flex items-center gap-3">
                        <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: operator.color }} />
                            <span className="truncate text-xs font-semibold text-gray-700 sm:text-sm">{operator.label}</span>
                        </div>
                        <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm bg-gray-100">
                            {GARIS_BANTU.map((tanda) => (
                                <div key={tanda} className="absolute inset-y-0 w-px bg-gray-200" style={{ left: `${tanda}%` }} />
                            ))}
                            <div
                                className="relative h-full rounded-r-sm"
                                style={{ width: `${lebar}%`, background: operator.color }}
                            />
                        </div>
                        <div className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-gray-950 sm:text-sm">
                            {operator.percent.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function operatorShareData(values: Partial<Record<MitraMarketShareKey, string | number>>): OperatorShareDatum[] {
    return MITRA_MARKET_SHARE_BEFORE_OPERATORS.map((operator) => ({
        key: operator.key,
        label: operator.label,
        color: operator.color,
        percent: Number(values[operator.key] ?? 0),
    }));
}

/** Data pasca-merger dibaca dari kolom mandiri, bukan hasil penjumlahan data lama. */
export function afterMergerShareData(values: Partial<Record<MitraMarketShareKey, string | number>>): OperatorShareDatum[] {
    return MITRA_MARKET_SHARE_AFTER_OPERATORS.map((operator) => ({
        key: operator.key,
        label: operator.label,
        color: operator.color,
        percent: Number(values[operator.key] ?? 0),
    }));
}
