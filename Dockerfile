# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

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
ENV PORT=3000

# Copy only what's needed
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db ./src/db

# Create uploads directory
RUN mkdir -p public/uploads

EXPOSE 3000

CMD ["npm", "start"]
