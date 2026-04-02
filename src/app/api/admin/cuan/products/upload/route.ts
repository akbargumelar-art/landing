import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanProducts, cuanCategories, cuanBrands } from "@/db/schema";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        if (rows.length === 0) {
            return NextResponse.json({ error: "File kosong" }, { status: 400 });
        }

        // Fetch existing categories and brands for matching
        const existingCategories = await db.select().from(cuanCategories);
        const existingBrands = await db.select().from(cuanBrands);

        const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));
        const brandMap = new Map(existingBrands.map(b => [b.name.toLowerCase(), b.id]));

        let imported = 0;
        let skipped = 0;

        for (const row of rows) {
            const name = row["Nama"] || row["nama"] || row["Name"] || row["name"];
            const categoryName = row["Kategori"] || row["kategori"] || row["Category"] || row["category"];
            const brandName = row["Brand"] || row["brand"] || row["Merek"] || row["merek"];
            const capitalPrice = parseFloat(String(row["Harga Modal"] || row["harga_modal"] || row["capital_price"] || "0").replace(/[^0-9.]/g, ""));
            const sellingPrice = parseFloat(String(row["Harga Jual"] || row["harga_jual"] || row["selling_price"] || "0").replace(/[^0-9.]/g, ""));
            const cashback = parseFloat(String(row["Cashback"] || row["cashback"] || "0").replace(/[^0-9.]/g, ""));
            const hotRaw = String(row["Hot Produk"] || row["hot_produk"] || row["Hot"] || row["hot"] || "0").toLowerCase().trim();
            const isHot = ["1", "y", "ya", "yes", "true", "hot"].includes(hotRaw);

            if (!name || !categoryName || !brandName) {
                skipped++;
                continue;
            }

            // Auto-create category if not exists
            let categoryId = categoryMap.get(categoryName.toLowerCase());
            if (!categoryId) {
                categoryId = uuid();
                await db.insert(cuanCategories).values({ id: categoryId, name: categoryName, createdAt: new Date() });
                categoryMap.set(categoryName.toLowerCase(), categoryId);
            }

            // Auto-create brand if not exists
            let brandId = brandMap.get(brandName.toLowerCase());
            if (!brandId) {
                brandId = uuid();
                await db.insert(cuanBrands).values({ id: brandId, name: brandName, createdAt: new Date() });
                brandMap.set(brandName.toLowerCase(), brandId);
            }

            const id = uuid();
            await db.insert(cuanProducts).values({
                id,
                name,
                categoryId,
                brandId,
                capitalPrice: String(capitalPrice || 0),
                sellingPrice: String(sellingPrice || 0),
                cashback: String(cashback || 0),
                isActive: true,
                isHot,
                createdAt: new Date(),
            });
            imported++;
        }

        return NextResponse.json({ imported, skipped, total: rows.length });
    } catch (err) {
        console.error("Excel upload error:", err);
        return NextResponse.json({ error: "Gagal memproses file Excel" }, { status: 500 });
    }
}
