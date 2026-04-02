import { db } from "./index";
import { cuanCategories, cuanBrands, cuanProducts } from "./schema";
import { v4 as uuid } from "uuid";

async function seedCuan() {

    console.log("🌱 Seeding Kalkulator Cuan data...\n");

    // ====== Categories ======
    const categoryData = [
        { name: "Pulsa" },
        { name: "Paket Internet" },
        { name: "Paket Digital" },
        { name: "Paket Roaming" },
        { name: "Inject Voucher Fisik" },
        { name: "Aktivasi Perdana" },
    ];

    const categoryIds: Record<string, string> = {};
    for (const cat of categoryData) {
        const id = uuid();
        categoryIds[cat.name] = id;
        await db.insert(cuanCategories).values({
            id,
            name: cat.name,
            createdAt: new Date(),
        });
    }
    console.log(`✅ ${categoryData.length} kategori berhasil ditambahkan`);

    // ====== Brands ======
    const brandData = [
        { name: "Simpati" },
        { name: "Kartu AS" },
        { name: "byU" },
        { name: "Telkomsel Orbit" },
        { name: "PPOB" },
        { name: "e-Wallet" },
    ];

    const brandIds: Record<string, string> = {};
    for (const brand of brandData) {
        const id = uuid();
        brandIds[brand.name] = id;
        await db.insert(cuanBrands).values({
            id,
            name: brand.name,
            createdAt: new Date(),
        });
    }
    console.log(`✅ ${brandData.length} brand berhasil ditambahkan`);

    // ====== Products ======
    const productData = [
        // PULSA - Simpati
        { name: "Pulsa 5rb", category: "Pulsa", brand: "Simpati", capital: 4800, selling: 5500, cashback: 100 },
        { name: "Pulsa 10rb", category: "Pulsa", brand: "Simpati", capital: 9700, selling: 11000, cashback: 200 },
        { name: "Pulsa 15rb", category: "Pulsa", brand: "Simpati", capital: 14500, selling: 16000, cashback: 200 },
        { name: "Pulsa 20rb", category: "Pulsa", brand: "Simpati", capital: 19500, selling: 21500, cashback: 300 },
        { name: "Pulsa 25rb", category: "Pulsa", brand: "Simpati", capital: 24300, selling: 27000, cashback: 300 },
        { name: "Pulsa 50rb", category: "Pulsa", brand: "Simpati", capital: 48500, selling: 52000, cashback: 500 },
        { name: "Pulsa 100rb", category: "Pulsa", brand: "Simpati", capital: 97000, selling: 103000, cashback: 1000 },

        // PULSA - Kartu AS
        { name: "Pulsa 5rb", category: "Pulsa", brand: "Kartu AS", capital: 4850, selling: 5500, cashback: 100 },
        { name: "Pulsa 10rb", category: "Pulsa", brand: "Kartu AS", capital: 9750, selling: 11000, cashback: 150 },
        { name: "Pulsa 25rb", category: "Pulsa", brand: "Kartu AS", capital: 24500, selling: 27000, cashback: 250 },
        { name: "Pulsa 50rb", category: "Pulsa", brand: "Kartu AS", capital: 48800, selling: 52000, cashback: 400 },
        { name: "Pulsa 100rb", category: "Pulsa", brand: "Kartu AS", capital: 97500, selling: 103000, cashback: 800 },

        // PULSA - byU
        { name: "Pulsa 10rb", category: "Pulsa", brand: "byU", capital: 9600, selling: 11000, cashback: 250 },
        { name: "Pulsa 20rb", category: "Pulsa", brand: "byU", capital: 19200, selling: 21500, cashback: 400 },
        { name: "Pulsa 50rb", category: "Pulsa", brand: "byU", capital: 48000, selling: 52000, cashback: 700 },

        // PAKET INTERNET - Simpati
        { name: "Internet 1GB/3 Hari", category: "Paket Internet", brand: "Simpati", capital: 8500, selling: 12000, cashback: 300 },
        { name: "Internet 2GB/7 Hari", category: "Paket Internet", brand: "Simpati", capital: 15000, selling: 20000, cashback: 500 },
        { name: "Internet 5GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 28000, selling: 35000, cashback: 800 },
        { name: "Internet 10GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 45000, selling: 55000, cashback: 1200 },
        { name: "Internet 15GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 60000, selling: 75000, cashback: 1500 },
        { name: "Internet 25GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 85000, selling: 100000, cashback: 2000 },
        { name: "Internet 50GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 130000, selling: 155000, cashback: 3000 },

        // PAKET INTERNET - byU
        { name: "byU 1GB Harian", category: "Paket Internet", brand: "byU", capital: 5500, selling: 8000, cashback: 200 },
        { name: "byU 3GB/7 Hari", category: "Paket Internet", brand: "byU", capital: 12000, selling: 17000, cashback: 400 },
        { name: "byU 8GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 35000, selling: 45000, cashback: 1000 },
        { name: "byU 15GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 55000, selling: 70000, cashback: 1500 },
        { name: "byU 30GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 90000, selling: 110000, cashback: 2500 },

        // PAKET INTERNET - Kartu AS
        { name: "Internet 2GB/7 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 14500, selling: 19000, cashback: 400 },
        { name: "Internet 6GB/30 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 32000, selling: 40000, cashback: 900 },
        { name: "Internet 12GB/30 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 50000, selling: 62000, cashback: 1300 },

        // PAKET DIGITAL - e-Wallet
        { name: "Top Up OVO 25rb", category: "Paket Digital", brand: "e-Wallet", capital: 24500, selling: 26000, cashback: 200 },
        { name: "Top Up OVO 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49000, selling: 51500, cashback: 400 },
        { name: "Top Up OVO 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98000, selling: 102000, cashback: 700 },
        { name: "Top Up GoPay 25rb", category: "Paket Digital", brand: "e-Wallet", capital: 24800, selling: 26000, cashback: 150 },
        { name: "Top Up GoPay 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49200, selling: 51500, cashback: 350 },
        { name: "Top Up GoPay 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98500, selling: 102000, cashback: 600 },
        { name: "Top Up DANA 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49100, selling: 51500, cashback: 300 },
        { name: "Top Up DANA 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98200, selling: 102000, cashback: 650 },
        { name: "Top Up ShopeePay 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49300, selling: 51500, cashback: 250 },
        { name: "Top Up ShopeePay 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98400, selling: 102000, cashback: 500 },

        // PAKET DIGITAL - PPOB
        { name: "Token PLN 20rb", category: "Paket Digital", brand: "PPOB", capital: 19500, selling: 21000, cashback: 200 },
        { name: "Token PLN 50rb", category: "Paket Digital", brand: "PPOB", capital: 49000, selling: 51500, cashback: 500 },
        { name: "Token PLN 100rb", category: "Paket Digital", brand: "PPOB", capital: 98000, selling: 102000, cashback: 800 },
        { name: "BPJS Kesehatan", category: "Paket Digital", brand: "PPOB", capital: 0, selling: 2500, cashback: 500 },
        { name: "Tagihan Listrik", category: "Paket Digital", brand: "PPOB", capital: 0, selling: 3000, cashback: 600 },

        // PAKET ROAMING - Simpati
        { name: "Roaming ASEAN 3 Hari 1GB", category: "Paket Roaming", brand: "Simpati", capital: 75000, selling: 95000, cashback: 2000 },
        { name: "Roaming ASEAN 7 Hari 3GB", category: "Paket Roaming", brand: "Simpati", capital: 150000, selling: 185000, cashback: 4000 },
        { name: "Roaming Global 3 Hari 500MB", category: "Paket Roaming", brand: "Simpati", capital: 120000, selling: 150000, cashback: 3000 },
        { name: "Roaming Global 7 Hari 2GB", category: "Paket Roaming", brand: "Simpati", capital: 250000, selling: 300000, cashback: 5000 },

        // INJECT VOUCHER FISIK - Simpati
        { name: "Voucher Fisik 10rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 9200, selling: 10500, cashback: 200 },
        { name: "Voucher Fisik 25rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 23000, selling: 26000, cashback: 400 },
        { name: "Voucher Fisik 50rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 46000, selling: 52000, cashback: 800 },
        { name: "Voucher Fisik 100rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 92000, selling: 103000, cashback: 1500 },

        // INJECT VOUCHER FISIK - Kartu AS
        { name: "Voucher Fisik 10rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 9300, selling: 10500, cashback: 150 },
        { name: "Voucher Fisik 25rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 23200, selling: 26000, cashback: 350 },
        { name: "Voucher Fisik 50rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 46500, selling: 52000, cashback: 700 },

        // AKTIVASI PERDANA - Simpati
        { name: "Perdana Simpati 5GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 15000, selling: 25000, cashback: 1500 },
        { name: "Perdana Simpati 10GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 25000, selling: 40000, cashback: 2500 },
        { name: "Perdana Simpati 20GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 40000, selling: 60000, cashback: 3000 },

        // AKTIVASI PERDANA - byU
        { name: "Perdana byU 6GB", category: "Aktivasi Perdana", brand: "byU", capital: 12000, selling: 20000, cashback: 1200 },
        { name: "Perdana byU 12GB", category: "Aktivasi Perdana", brand: "byU", capital: 20000, selling: 35000, cashback: 2000 },
        { name: "Perdana byU 25GB", category: "Aktivasi Perdana", brand: "byU", capital: 35000, selling: 55000, cashback: 3000 },

        // AKTIVASI PERDANA - Telkomsel Orbit
        { name: "Perdana Orbit 10GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 30000, selling: 50000, cashback: 3000 },
        { name: "Perdana Orbit 25GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 50000, selling: 80000, cashback: 5000 },
        { name: "Perdana Orbit 50GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 80000, selling: 120000, cashback: 7000 },
    ];

    let count = 0;
    for (const p of productData) {
        const id = uuid();
        await db.insert(cuanProducts).values({
            id,
            name: p.name,
            categoryId: categoryIds[p.category],
            brandId: brandIds[p.brand],
            capitalPrice: String(p.capital),
            sellingPrice: String(p.selling),
            cashback: String(p.cashback),
            isActive: true,
            createdAt: new Date(),
        });
        count++;
    }
    console.log(`✅ ${count} produk berhasil ditambahkan`);

    console.log("\n🎉 Seeding Kalkulator Cuan selesai!");
    console.log(`   📦 ${categoryData.length} Kategori`);
    console.log(`   🏷️  ${brandData.length} Brand`);
    console.log(`   📋 ${count} Produk`);

    process.exit(0);
}

seedCuan().catch((err) => {
    console.error("❌ Seed error:", err);
    process.exit(1);
});
