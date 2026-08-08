# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# drizzle-kit ada di devDependencies, sedangkan kontainer produksi perlu menjalankan
# migrasi saat start. Dipasang terpisah, bukan dengan membawa seluruh devDependencies,
# supaya image tidak ikut memuat toolchain build.
RUN npm i --no-save drizzle-kit@^0.30.6

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 3: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3011

# Copy only what's needed
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db ./src/db
# Berkas migrasi wajib ikut: tanpa folder ini drizzle-kit migrate tidak punya apa pun
# untuk dijalankan dan diam-diam menganggap database sudah mutakhir.
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/start-production.sh ./scripts/start-production.sh
RUN chmod +x ./scripts/start-production.sh

# Create uploads directory
RUN mkdir -p public/uploads

EXPOSE 3011

CMD ["./scripts/start-production.sh"]
