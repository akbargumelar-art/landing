import fs from "node:fs";
import path from "node:path";

function parseEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return {};

    const result = {};
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!(key in result)) {
            result[key] = value;
        }
    }

    return result;
}

function readEnv(key, fallback = "") {
    if (process.env[key] !== undefined && process.env[key] !== "") {
        return process.env[key];
    }
    return fallback;
}

const envFileValues = parseEnvFile(path.join(process.cwd(), ".env"));

const nodeEnv = readEnv("NODE_ENV", envFileValues.NODE_ENV || "development");
const databaseUrl = readEnv("DATABASE_URL", envFileValues.DATABASE_URL || "");
const betterAuthSecret = readEnv("BETTER_AUTH_SECRET", envFileValues.BETTER_AUTH_SECRET || "");
const betterAuthUrl = readEnv("BETTER_AUTH_URL", envFileValues.BETTER_AUTH_URL || "");
const port = readEnv("PORT", envFileValues.PORT || "");

const errors = [];
const warnings = [];

if (!databaseUrl) {
    errors.push("DATABASE_URL belum diisi.");
}

if (!betterAuthSecret) {
    errors.push("BETTER_AUTH_SECRET belum diisi.");
} else if (betterAuthSecret.length < 32) {
    errors.push(`BETTER_AUTH_SECRET minimal 32 karakter, saat ini ${betterAuthSecret.length}.`);
}

if (!betterAuthUrl) {
    errors.push("BETTER_AUTH_URL belum diisi.");
} else {
    let parsedUrl;

    try {
        parsedUrl = new URL(betterAuthUrl);
    } catch {
        errors.push("BETTER_AUTH_URL harus berupa URL absolut yang valid.");
    }

    if (parsedUrl) {
        const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);

        if (nodeEnv === "production" && isLocalHost) {
            errors.push("BETTER_AUTH_URL production tidak boleh memakai localhost/127.0.0.1.");
        }

        if (nodeEnv === "production" && parsedUrl.protocol !== "https:") {
            warnings.push("BETTER_AUTH_URL production sebaiknya memakai HTTPS.");
        }
    }
}

if (port && !/^\d+$/.test(port)) {
    errors.push("PORT harus berupa angka.");
}

if (errors.length > 0) {
    console.error("Environment validation failed:");
    for (const error of errors) {
        console.error(`- ${error}`);
    }

    if (warnings.length > 0) {
        console.error("Warnings:");
        for (const warning of warnings) {
            console.error(`- ${warning}`);
        }
    }

    process.exit(1);
}

console.log("Environment validation passed.");
for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
}
