import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../src/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    const poolConnection = mysql.createPool({
        uri: process.env.DATABASE_URL!,
    });

    const db = drizzle({ client: poolConnection, schema, mode: "default" });

    const result = await db.query.formSubmissions.findMany({
        with: {
            values: {
                with: {
                    field: true,
                },
            },
        },
        limit: 1,
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}

run();
