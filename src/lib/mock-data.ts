export interface Program {
    id: string;
    slug: string;
    title: string;
    description: string;
    period: string;
    thumbnail: string;
    content: string;
    terms: string[];
    mechanics: string[];
}

export interface Winner {
    id: string;
    name: string;
    phone: string;
    outlet: string;
    photo: string;
    week: string;
    programId: string;
}

export interface LotteryEntry {
    id: string;
    name: string;
    phone: string;
    outlet: string;
    submittedAt: string;
    proofImage: string;
    status: "pending" | "approved" | "rejected";
}

export interface ContentItem {
    id: string;
    title: string;
    type: string;
    status: "published" | "draft";
    createdAt: string;
    updatedAt: string;
}

export const programs: Program[] = [
    {
        id: "1",
        slug: "undian-mingguan",
        title: "Undian Mingguan Telkomsel",
        description: "Dapatkan kesempatan memenangkan hadiah menarik setiap minggu! Beli paket Telkomsel di outlet mitra dan ikuti undian berhadiah.",
        period: "1 Januari - 31 Maret 2026",
        thumbnail: "/images/promo-undian.jpg",
        content: "Program Undian Mingguan Telkomsel memberikan kesempatan kepada setiap pelanggan yang membeli paket Telkomsel di outlet mitra resmi untuk mengikuti undian berhadiah yang diundi setiap minggu.",
        terms: [
            "Pelanggan harus membeli paket Telkomsel minimal Rp 50.000",
            "Pembelian dilakukan di outlet mitra resmi ABK Ciraya",
            "Satu nomor Telkomsel bisa mendaftar maksimal 1x per minggu",
            "Pengundian dilakukan setiap hari Jumat pukul 15.00 WIB",
            "Pemenang akan dihubungi via WhatsApp dalam 1x24 jam"
        ],
        mechanics: [
            "Beli paket Telkomsel di outlet mitra resmi",
            "Simpan bukti pembelian (struk/screenshot)",
            "Kunjungi halaman pendaftaran undian",
            "Isi data diri dan upload bukti pembelian",
            "Tunggu pengumuman pemenang setiap Jumat"
        ]
    },
    {
        id: "2",
        slug: "bonus-kuota-mitra",
        title: "Bonus Kuota Mitra Outlet",
        description: "Program khusus mitra outlet! Dapatkan bonus kuota internet setiap mencapai target penjualan bulanan.",
        period: "1 Februari - 30 April 2026",
        thumbnail: "/images/promo-kuota.jpg",
        content: "Program Bonus Kuota dirancang untuk mengapresiasi mitra outlet yang berhasil mencapai target penjualan. Setiap mitra yang mencapai target akan mendapatkan bonus kuota internet gratis.",
        terms: [
            "Khusus mitra outlet terdaftar di wilayah Cirebon & Kuningan",
            "Target penjualan minimal 100 transaksi per bulan",
            "Bonus kuota berlaku 30 hari sejak diterima",
            "Program dapat berubah sewaktu-waktu tanpa pemberitahuan"
        ],
        mechanics: [
            "Capai target penjualan bulanan",
            "Lapor pencapaian ke admin ABK Ciraya",
            "Verifikasi oleh tim internal",
            "Bonus kuota dikirim ke nomor mitra"
        ]
    },
    {
        id: "3",
        slug: "cashback-pelanggan-setia",
        title: "Cashback Pelanggan Setia",
        description: "Pelanggan setia Telkomsel berhak mendapatkan cashback hingga 20% untuk setiap pembelian paket di outlet mitra.",
        period: "15 Maret - 15 Juni 2026",
        thumbnail: "/images/promo-cashback.jpg",
        content: "Program cashback untuk pelanggan yang telah aktif menggunakan Telkomsel minimal 6 bulan berturut-turut. Cashback langsung diberikan dalam bentuk saldo.",
        terms: [
            "Pelanggan aktif minimal 6 bulan berturut-turut",
            "Cashback maksimal Rp 25.000 per transaksi",
            "Berlaku untuk semua jenis paket data dan pulsa",
            "Satu pelanggan maksimal 2x cashback per bulan"
        ],
        mechanics: [
            "Kunjungi outlet mitra ABK Ciraya terdekat",
            "Tunjukkan nomor Telkomsel aktif",
            "Lakukan pembelian paket atau pulsa",
            "Cashback otomatis masuk dalam 1x24 jam"
        ]
    },
    {
        id: "4",
        slug: "paket-hemat-spesial",
        title: "Paket Hemat Spesial ABK",
        description: "Nikmati paket data super hemat eksklusif hanya di outlet mitra ABK Ciraya. Kuota besar, harga bersahabat!",
        period: "1 Januari - 31 Desember 2026",
        thumbnail: "/images/promo-hemat.jpg",
        content: "Paket Hemat Spesial ABK adalah paket eksklusif yang hanya tersedia di outlet mitra ABK Ciraya. Menawarkan kuota internet besar dengan harga yang sangat kompetitif.",
        terms: [
            "Hanya tersedia di outlet mitra ABK Ciraya",
            "Berlaku untuk nomor Telkomsel prabayar",
            "Paket tidak dapat digabung dengan promo lain",
            "Ketersediaan paket terbatas setiap bulannya"
        ],
        mechanics: [
            "Kunjungi outlet mitra ABK Ciraya",
            "Pilih paket hemat yang diinginkan",
            "Lakukan pembayaran",
            "Paket aktif dalam 5 menit"
        ]
    }
];

export const winners: Winner[] = [
    {
        id: "1",
        name: "Budi Santoso",
        phone: "0812****7890",
        outlet: "Outlet Sumber Jaya",
        photo: "/images/winner-1.jpg",
        week: "Minggu ke-1 Februari 2026",
        programId: "1"
    },
    {
        id: "2",
        name: "Siti Aminah",
        phone: "0813****4567",
        outlet: "Outlet Mitra Cell",
        photo: "/images/winner-2.jpg",
        week: "Minggu ke-2 Februari 2026",
        programId: "1"
    },
    {
        id: "3",
        name: "Ahmad Fauzi",
        phone: "0821****2345",
        outlet: "Outlet Indo Cellular",
        photo: "/images/winner-3.jpg",
        week: "Minggu ke-3 Februari 2026",
        programId: "1"
    },
    {
        id: "4",
        name: "Dewi Lestari",
        phone: "0852****6789",
        outlet: "Outlet Berkah Cell",
        photo: "/images/winner-4.jpg",
        week: "Minggu ke-4 Februari 2026",
        programId: "1"
    },
    {
        id: "5",
        name: "Rina Kurniawati",
        phone: "0811****1234",
        outlet: "Outlet Telko Jaya",
        photo: "/images/winner-5.jpg",
        week: "Minggu ke-1 Maret 2026",
        programId: "1"
    },
    {
        id: "6",
        name: "Hendra Wijaya",
        phone: "0858****9012",
        outlet: "Outlet Digital Cell",
        photo: "/images/winner-6.jpg",
        week: "Minggu ke-2 Maret 2026",
        programId: "1"
    }
];

export const lotteryEntries: LotteryEntry[] = [
    {
        id: "1",
        name: "Budi Santoso",
        phone: "081234567890",
        outlet: "Outlet Sumber Jaya",
        submittedAt: "2026-02-20 14:30",
        proofImage: "/images/proof-1.jpg",
        status: "approved"
    },
    {
        id: "2",
        name: "Siti Aminah",
        phone: "081345674567",
        outlet: "Outlet Mitra Cell",
        submittedAt: "2026-02-20 15:45",
        proofImage: "/images/proof-2.jpg",
        status: "approved"
    },
    {
        id: "3",
        name: "Ahmad Fauzi",
        phone: "082112342345",
        outlet: "Outlet Indo Cellular",
        submittedAt: "2026-02-21 09:15",
        proofImage: "/images/proof-3.jpg",
        status: "pending"
    },
    {
        id: "4",
        name: "Dewi Lestari",
        phone: "085234566789",
        outlet: "Outlet Berkah Cell",
        submittedAt: "2026-02-21 10:00",
        proofImage: "/images/proof-4.jpg",
        status: "rejected"
    },
    {
        id: "5",
        name: "Rina Kurniawati",
        phone: "081112341234",
        outlet: "Outlet Telko Jaya",
        submittedAt: "2026-02-22 08:30",
        proofImage: "/images/proof-5.jpg",
        status: "approved"
    },
    {
        id: "6",
        name: "Hendra Wijaya",
        phone: "085812349012",
        outlet: "Outlet Digital Cell",
        submittedAt: "2026-02-22 11:20",
        proofImage: "/images/proof-6.jpg",
        status: "pending"
    },
    {
        id: "7",
        name: "Yanti Susanti",
        phone: "081398765432",
        outlet: "Outlet Sumber Jaya",
        submittedAt: "2026-02-23 13:00",
        proofImage: "/images/proof-7.jpg",
        status: "approved"
    }
];

export const contentItems: ContentItem[] = [
    {
        id: "1",
        title: "Undian Mingguan Telkomsel",
        type: "Program",
        status: "published",
        createdAt: "2026-01-01",
        updatedAt: "2026-02-20"
    },
    {
        id: "2",
        title: "Bonus Kuota Mitra Outlet",
        type: "Program",
        status: "published",
        createdAt: "2026-01-15",
        updatedAt: "2026-02-15"
    },
    {
        id: "3",
        title: "Cashback Pelanggan Setia",
        type: "Program",
        status: "draft",
        createdAt: "2026-02-01",
        updatedAt: "2026-02-25"
    },
    {
        id: "4",
        title: "Paket Hemat Spesial ABK",
        type: "Program",
        status: "published",
        createdAt: "2026-01-01",
        updatedAt: "2026-02-10"
    },
    {
        id: "5",
        title: "Hero Banner - Promo Februari",
        type: "Banner",
        status: "published",
        createdAt: "2026-02-01",
        updatedAt: "2026-02-01"
    }
];

export const heroSlides = [
    {
        id: "1",
        title: "Undian Mingguan Berhadiah!",
        subtitle: "Beli paket Telkomsel di outlet mitra dan menangkan hadiah menarik setiap minggu",
        cta: "Ikut Sekarang",
        ctaLink: "/program/undian-mingguan",
        bgColor: "from-red-600 via-red-500 to-red-700"
    },
    {
        id: "2",
        title: "Paket Internet Super Hemat",
        subtitle: "Kuota besar harga bersahabat, eksklusif di outlet mitra ABK Ciraya",
        cta: "Lihat Paket",
        ctaLink: "/program/paket-hemat-spesial",
        bgColor: "from-red-600 via-orange-500 to-red-500"
    },
    {
        id: "3",
        title: "Gabung Jadi Mitra Outlet",
        subtitle: "Raih keuntungan lebih dengan menjadi mitra outlet resmi Telkomsel ABK Ciraya",
        cta: "Daftar Mitra",
        ctaLink: "https://poin.abkciraya.cloud",
        bgColor: "from-red-700 via-red-600 to-orange-600"
    }
];

export const outletList = [
    "Outlet Sumber Jaya",
    "Outlet Mitra Cell",
    "Outlet Indo Cellular",
    "Outlet Berkah Cell",
    "Outlet Telko Jaya",
    "Outlet Digital Cell",
    "Outlet Karya Mandiri",
    "Outlet Surya Ponsel",
    "Outlet Makmur Cell",
    "Outlet Bintang Cellular"
];
