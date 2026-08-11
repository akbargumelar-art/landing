"use client";

import React from "react";

export type AdminRoleName = "SUPER_ADMIN" | "ADMIN_INPUT" | "MANAGER" | "SUPERVISOR" | "SALESFORCE";

export interface AdminScopeView {
    role: AdminRoleName | null;
    taps: string[];
    hasSalesforce: boolean;
    /** Supervisor atau Salesforce: bekerja di lapangan, wewenangnya dibatasi wilayah/binaan. */
    roleLapangan: boolean;
    /** Boleh mengelola konfigurasi dan data lintas wilayah. */
    bolehKelola: boolean;
    /** Boleh menginput serta memperbarui data program/produk. */
    bolehInputData: boolean;
    /** Boleh melakukan penghapusan permanen data master. */
    bolehHapusData: boolean;
    /** Assignment belum lengkap, sehingga daftar apa pun akan kosong. */
    assignmentKurang: boolean;
    loading: boolean;
}

const AWAL: AdminScopeView = {
    role: null,
    taps: [],
    hasSalesforce: false,
    roleLapangan: false,
    // Diawali false supaya kontrol pengelolaan tidak sempat berkedip muncul sebelum peran
    // diketahui. Menyembunyikan tombol yang ternyata boleh dipakai hanya merepotkan sesaat;
    // menampilkan tombol yang ternyata tidak boleh dipakai memberi janji palsu.
    bolehKelola: false,
    bolehInputData: false,
    bolehHapusData: false,
    assignmentKurang: false,
    loading: true,
};

/**
 * Peran dan cakupan aktor untuk keperluan TAMPILAN saja: menamai cakupan, menyembunyikan
 * kontrol yang pasti ditolak, dan memperingatkan assignment yang belum lengkap.
 *
 * Bukan mekanisme keamanan. Pembatasan sesungguhnya terjadi di query dan gerbang server;
 * halaman ini hanya berusaha tidak menawarkan sesuatu yang akan gagal.
 */
export function useAdminScope(): AdminScopeView {
    const [scope, setScope] = React.useState<AdminScopeView>(AWAL);

    React.useEffect(() => {
        let dibatalkan = false;

        fetch("/api/admin/me")
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (dibatalkan) return;

                const role: AdminRoleName | null = data?.session?.role || null;
                const taps: string[] = data?.scope?.taps || [];
                const hasSalesforce = Boolean(data?.scope?.hasSalesforce);
                const roleLapangan = role === "SUPERVISOR" || role === "SALESFORCE";

                setScope({
                    role,
                    taps,
                    hasSalesforce,
                    roleLapangan,
                    bolehKelola: role === "SUPER_ADMIN" || role === "ADMIN_INPUT",
                    bolehInputData: role === "SUPER_ADMIN" || role === "ADMIN_INPUT",
                    bolehHapusData: role === "SUPER_ADMIN",
                    assignmentKurang: role === "SALESFORCE"
                        ? !hasSalesforce || taps.length === 0
                        : role === "SUPERVISOR" ? taps.length === 0 : false,
                    loading: false,
                });
            })
            .catch(() => {
                if (!dibatalkan) setScope({ ...AWAL, loading: false });
            });

        return () => { dibatalkan = true; };
    }, []);

    return scope;
}
