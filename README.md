# ABK Ciraya

Landing page & admin dashboard untuk PT Arena Bola Keluarga Ciraya.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **ORM:** Drizzle ORM
- **Database:** MySQL 8.0
- **Auth:** Better Auth
- **Language:** TypeScript

## Persyaratan

- Node.js ≥ 20
- MySQL 8.0+
- npm / pnpm

## Setup Lokal

```bash
# 1. Clone repository
git clone https://github.com/your-repo/abk-ciraya.git
cd abk-ciraya

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env → isi DATABASE_URL, BETTER_AUTH_SECRET

# 4. Buat database MySQL
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS abk_ciraya"

# 5. Push schema ke database
npx drizzle-kit push

# 6. Jalankan dev server
npm run dev

# 7. Seed data awal (di terminal terpisah)
npx tsx src/db/seed.ts
```

**Login admin:** `admin@abkciraya.com` / `admin123`

## Deployment ke VPS (Ubuntu)

### Opsi A: PM2 (Recommended)

```bash
# 1. Di server, clone repo & install
git clone https://github.com/your-repo/abk-ciraya.git
cd abk-ciraya
npm install

# 2. Setup environment
cp .env.example .env
nano .env  # Isi credentials production

# 3. Build production
npm run build

# 4. Push schema & seed
npx drizzle-kit push
npx tsx src/db/seed.ts

# 5. Install PM2 & jalankan
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start saat reboot
```

### Opsi B: Docker Compose

```bash
# 1. Clone repo
git clone https://github.com/your-repo/abk-ciraya.git
cd abk-ciraya

# 2. Setup environment
cp .env.example .env
nano .env  # Gunakan DATABASE_URL=mysql://root:rootpassword@db:3306/abk_ciraya

# 3. Jalankan
docker compose up -d --build

# 4. Push schema & seed (setelah container berjalan)
docker compose exec app npx drizzle-kit push
docker compose exec app npx tsx src/db/seed.ts
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Setelah Nginx dikonfigurasi, pasang SSL dengan:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## NPM Scripts

| Script | Keterangan |
|--------|------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Build production |
| `npm start` | Jalankan production server |
| `npm run db:push` | Push schema ke database |
| `npm run db:generate` | Generate migration files |
| `npm run db:seed` | Seed data awal |
| `npm run db:studio` | Buka Drizzle Studio |

## Struktur Folder

```
src/
├── app/
│   ├── (public)/        # Halaman publik (beranda, program, kontak)
│   ├── (hidden)/        # Admin pages & login
│   └── api/             # API routes
│       ├── admin/       # Admin CRUD endpoints
│       ├── auth/        # Better Auth handler
│       ├── forms/       # Public form submission
│       └── public/      # Public data endpoints
├── components/ui/       # shadcn/ui components
├── db/                  # Drizzle schema & connection
└── lib/                 # Auth, utilities
```
