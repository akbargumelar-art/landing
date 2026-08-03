# PRD - Integrasi Portal Mitra Outlet ke Landing Page Existing

Dokumen ini adalah PRD konseptual untuk dipakai di Antigravity IDE. Dokumen ini tidak meminta model menyalin file dari aplikasi Portal Mitra Outlet yang sudah ada. Model di Antigravity bebas menyusun ulang implementasi sesuai struktur, framework, routing, database tooling, dan deployment website landing page existing, selama kebutuhan produk, struktur data, aturan akses, keamanan, dan acceptance criteria di bawah terpenuhi.

Tanggal konteks: 3 Agustus 2026.

## 1. Executive Summary

**Problem Statement**: Perusahaan sudah memiliki website landing page, tetapi membutuhkan fitur operasional untuk mengelola data mitra outlet, QR profil outlet, akses detail via OTP WhatsApp, performansi, program, leaderboard, whitelist, user internal, dan audit. Integrasi harus menjaga landing page tetap berjalan sebagai wajah publik utama tanpa memaksa struktur kode lama dipindahkan mentah-mentah.

**Proposed Solution**: Tambahkan modul "Portal Mitra Outlet" ke website landing page existing sebagai fitur aplikasi internal dan publik yang menyatu secara pengalaman, tetapi implementasinya boleh disusun ulang sesuai infrastruktur landing page. Homepage landing tetap menjadi pintu utama, sementara portal menyediakan route/halaman untuk dashboard, program publik, profil QR outlet, OTP detail, dan API/service backend yang dibutuhkan.

**Success Criteria**:

- Landing page existing tetap tampil di `/` tanpa kehilangan konten, desain utama, SEO, atau performa yang sudah ada.
- Fitur portal tersedia lengkap: dashboard role-based, outlet, QR, OTP, whitelist, performansi, program, leaderboard, import, dan audit.
- Data sensitif outlet tidak pernah terkirim ke halaman publik sebelum OTP valid; target kebocoran data sensitif adalah 0 insiden.
- Sistem mampu menangani target awal 10.000 outlet dan maksimal tiga program aktif bersamaan.
- Quality gate minimum setelah integrasi: typecheck/lint/build lolos, database migration terversi tersedia, dan alur utama `/`, login dashboard, `/program`, serta `/o/{token}` berhasil diuji manual.

## 2. User Experience & Functionality

### User Personas

| Persona | Kebutuhan Utama |
|---|---|
| Pengunjung landing page | Melihat profil perusahaan, layanan, kredibilitas, kontak, dan akses ke fitur publik portal jika diperlukan. |
| Mitra outlet / owner | Scan QR di outlet, melihat data umum outlet, cek program aktif, dan membuka detail performansi setelah OTP WhatsApp. |
| Admin | Menginput dan mengedit data operasional outlet, detail outlet, foto, QR, performansi, dan skor program. |
| Leader | Membaca outlet dan menginput performansi untuk outlet di wilayah yang ditugaskan. |
| Manager | Mengelola seluruh data, user, wilayah, whitelist, program, publikasi, rollback, audit, dan aksi destruktif. |

### User Stories

- As a pengunjung landing page, I want to see the existing company landing page first so that the public marketing experience remains intact.
- As a mitra outlet, I want to scan a QR code and see basic outlet information so that I can confirm the outlet identity quickly.
- As a mitra outlet, I want to request OTP through WhatsApp so that only authorized numbers can access sensitive outlet details.
- As a mitra outlet, I want to see program leaderboard and search my outlet position so that I can monitor ranking without asking sales manually.
- As an Admin, I want to input and edit outlet, performance, and program score data so that operational data stays current.
- As a Leader, I want territory-scoped access so that I only work with outlets under my responsibility.
- As a Manager, I want full configuration, publication, rollback, and audit access so that the portal can be governed safely.

### Acceptance Criteria

- Homepage existing remains available at `/`.
- Portal navigation is reachable from landing page through clear CTA or navigation item, without replacing the landing page.
- Public outlet profile shows only non-sensitive data before OTP.
- Owner phone is masked in public profile and shown fully only after verified detail access.
- OTP request response is generic for registered and unregistered numbers to prevent phone enumeration.
- Dashboard login uses secure password hashing and session cookies.
- Role guard is enforced server-side, not only hidden in UI.
- Import workflows support preview, validation, transaction commit, error report, history, and rollback where relevant.
- QR generator supports single outlet QR PNG/SVG, card output 90 x 55 mm, and bulk PDF 2 x 5 cards per A4 sheet.
- Program module supports custom program parameters, participants, scoring, ranking, winners, and public leaderboard.

### Non-Goals

- Rebuilding the landing page from scratch unless the existing implementation is unusable.
- Copying the existing Portal Mitra Outlet file tree into the landing page repository as-is.
- Integrating Telkomsel core transaction APIs.
- Building a native mobile app.
- Building WhatsApp chatbot conversations; WAHA is only required for OTP sending.
- Showing owner phone, sensitive detail fields, or private performance data publicly without OTP.
- Auto-deploying to production before manual review, backup, and migration validation.

## 3. AI System Requirements

### Tool Requirements

Antigravity may use Opus, Codex, and Gemini with complementary roles:

| Model | Recommended Responsibility |
|---|---|
| Opus | Architecture planning, product reasoning, database design review, security review, and trade-off decisions. |
| Codex | Implementation, schema/migration creation, route/API coding, UI integration, tests, and build fixes. |
| Gemini | Independent review for regression risk, route collision, data leakage, UX consistency, and missing requirements. |

### AI Execution Principles

- Treat this PRD as a product and data contract, not as a file-copy instruction.
- Inspect the landing page codebase first, then design the portal integration around its existing architecture.
- Preserve existing landing page behavior unless a change is explicitly required to expose portal navigation.
- If the landing page already has auth, database, API conventions, design system, or deployment scripts, adapt the portal design to those conventions.
- If a requirement conflicts with the existing landing architecture, propose the least disruptive alternative before editing.
- Mark unknown infrastructure details as `TBD`, especially stack, database engine, route ownership, auth conflicts, hosting layout, and deployment workflow.

### Suggested Antigravity Prompt

```text
Use this PRD as the source of truth. Do not copy the old Portal Mitra Outlet file tree into this landing page project. First inspect the existing landing page architecture, routes, database, auth, API style, design system, and deployment setup. Then design and implement an equivalent Portal Mitra Outlet module that fits this project.

Landing page must remain the homepage at `/`.

The portal must provide:
- public outlet QR profile
- OTP WhatsApp access to sensitive detail
- public program and leaderboard pages
- role-based dashboard for Manager, Admin, and Leader
- outlet, whitelist, performance, program, user, territory, import, QR/PDF, and audit management
- secure database schema/migrations

Do not expose sensitive outlet data publicly. Use server-side authorization. Use versioned migrations for production. Keep secrets out of the repository. When stack details are unknown, inspect first and choose the smallest safe architecture that fits the existing project.
```

### Evaluation Strategy

- Have one model implement and another model review.
- Review must explicitly check data leakage in public pages and APIs.
- Review must compare final behavior against this PRD, not against old file paths.
- Run automated checks available in the landing page project.
- Perform manual route testing for landing, dashboard login, outlet QR profile, OTP request/verify, program leaderboard, and import preview.

## 4. Technical Specifications

### Architecture Overview

The final website should feel like one product with two layers:

1. **Landing Layer**: public marketing/company content that already exists. It remains the default homepage and keeps its current design language unless the owner requests redesign.
2. **Portal Layer**: operational application for outlet information, QR access, OTP-protected detail, program leaderboard, and internal dashboard.

The implementation may be:

| Pattern | When to Use | Requirement |
|---|---|---|
| Single application | Landing stack can support full-stack app features cleanly. | Keep `/` as landing and add portal modules under separate routes. |
| Modular monolith | Landing already has backend/database patterns. | Add portal as domain modules using existing conventions. |
| Separate app behind reverse proxy | Landing stack is static, legacy, or risky to modify. | Keep landing app untouched and route portal paths to a separate service. |

The model should decide after inspecting the landing codebase. Do not force Next.js, Prisma, or any specific file layout if the landing infrastructure already has a better established pattern. However, the data relationships and security behavior must remain equivalent.

### Public Routing Requirements

Route names may be adjusted if the existing landing page already uses them, but the user-facing capabilities must exist.

| Capability | Recommended Route | Notes |
|---|---|---|
| Landing homepage | `/` | Existing page remains primary public entry. |
| Program list | `/program` | Public list of visible programs. |
| Program detail | `/program/{slug}` | Leaderboard, search, winners, filters. |
| QR outlet profile | `/o/{publicToken}` | Public token, not sequential ID. Must be noindex. |
| OTP detail | `/o/{publicToken}/detail` | Requires verified detail session. |
| Internal login | `/login` | Redirect authenticated users to dashboard. |
| Dashboard home | `/dashboard` | Protected. |

If route collision exists, Antigravity should propose route alternatives such as `/mitra/program`, `/mitra/o/{token}`, or `/portal/dashboard`, then update QR URL generation consistently.

### Dashboard Modules

| Module | Required Functionality | Role Access |
|---|---|---|
| Dashboard home | Summary, outlet counts, active program counts, OTP activity, WAHA health, trend charts. | Manager, Admin, Leader |
| Outlet | List/search/filter/sort/pagination, create/edit, photo, map/location, detail, QR single/bulk. | Manager/Admin write; Leader scoped read |
| Performance | Metric definitions, manual input, import, history, rollback. | Manager full; Admin input/import; Leader scoped input |
| Program | Program builder, participants, parameters, scores, ranking, winners, publish. | Manager full; Admin score input/import |
| Whitelist | Number whitelist, scope ALL/OUTLET/TERRITORY, expiry, usage log, import, rollback. | Manager only |
| Territory | Region/Cluster/Area hierarchy and Leader assignment. | Manager only |
| Users | User CRUD, role, active status, password reset, territory assignment. | Manager only |
| Audit | Filter by user/action/entity/date and CSV export. | Manager only |

### Data Model Requirements

The implementation should use a relational database. PostgreSQL is recommended because the portal needs relations, transactions, indexes, and JSON fields for detailed performance groups. If the landing stack uses another relational database, implement equivalent constraints and indexes.

Naming can follow the landing project's convention. The following is the conceptual schema contract.

### Access Control Tables

`users`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `name` | string | Required. |
| `email` | string | Unique, required. |
| `phone` | string nullable | Optional. |
| `password_hash` | string | Argon2id or equivalent strong password hash. |
| `role` | enum | `MANAGER`, `ADMIN`, `LEADER`. |
| `is_active` | boolean | Default true. |
| `last_login_at` | datetime nullable | Audit/login visibility. |
| `failed_login_attempts` | integer | Login protection. |
| `last_failed_login_at` | datetime nullable | Login protection. |
| `locked_until` | datetime nullable | Temporary lockout. |
| `created_at`, `updated_at` | datetime | Required. |

`territories`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `name` | string | Required. |
| `type` | enum | `REGION`, `CLUSTER`, `AREA`. |
| `parent_id` | string nullable | Hierarchy parent. Region has no parent. |

`user_territories`

| Field | Type | Requirement |
|---|---|---|
| `user_id` | string/uuid | References users. |
| `territory_id` | string/uuid | References territories. |

Composite unique or primary key: `user_id + territory_id`.

### Outlet Tables

`outlets`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `outlet_code` | string | Unique. ID DigiPOS. |
| `public_token` | string | Unique random token for QR URL. Must not be sequential. |
| `rs_number` | string | Nomor RS. |
| `name` | string | Nama outlet. |
| `owner_name` | string | Nama owner. |
| `owner_phone` | string | Phone in normalized E.164 format when possible. |
| `tap` | string | TAP. |
| `salesforce` | string | Salesforce owner/area info. |
| `kabupaten` | string | Kabupaten. |
| `kecamatan` | string | Kecamatan. |
| `longitude` | number nullable | Coordinate. |
| `latitude` | number nullable | Coordinate. |
| `location_url` | string nullable | Google Maps URL or equivalent. |
| `territory_id` | string nullable | References territories. |
| `category` | enum/string | `FISIK` or `Non FISIK`. |
| `pjp_day` | enum/string | `Senin` to `Minggu`. |
| `pjp_type` | enum/string | `F1` to `F8`. |
| `branding` | enum/string | Branding status/provider. |
| `status` | enum | `ACTIVE`, `INACTIVE`, `SUSPENDED`. |
| `photo_url` | string nullable | Stored photo reference. |
| `created_at`, `updated_at` | datetime | Required. |

Important: do not design the new portal around old fields such as `address`, `outletType`, `grade`, `joinDate`, `lat`, `lng`, or `gmapsUrl`. The final structure uses `kabupaten`, `kecamatan`, `latitude`, `longitude`, and `location_url`.

`outlet_details`

| Field | Type | Requirement |
|---|---|---|
| `outlet_id` | string/uuid | Primary key and references outlets. |
| `sellthru_digipos_json` | JSON nullable | Sensitive detail group, 48 numeric fields. |
| `sellthru_nota_json` | JSON nullable | Sensitive detail group, 48 numeric fields. |
| `recharge_digipos_json` | JSON nullable | Sensitive detail group, 45 numeric fields. |

The detail field definitions should be centralized in code/config so forms, validators, import, and public detail rendering use the same source.

Required OTP-only detail field groups:

- Store these values as numeric fields inside the three JSON detail groups, or use an equivalent normalized detail-field table if that fits the landing page architecture better.
- The important contract is that these values are sensitive and must only be rendered after OTP verification.
- Missing values are allowed. Present values must be finite numbers.
- Field keys should be stable machine keys, while labels are the display/import labels.

#### Sellthru Digipos Detail Fields

Store in `sellthru_digipos_json` or equivalent group `sellthruDigipos`.

| Key | Label |
|---|---|
| `st_perdana_telkomsel_m_1_qty` | ST Perdana Telkomsel M-1 (qty) |
| `st_perdana_telkomsel_m_qty` | ST Perdana Telkomsel M (qty) |
| `mom_st_perdana_telkomsel_qty` | MoM ST Perdana Telkomsel (qty) |
| `st_perdana_telkomsel_m_1_rev` | ST Perdana Telkomsel M-1 (rev.) |
| `st_perdana_telkomsel_m_rev` | ST Perdana Telkomsel M (rev.) |
| `mom_st_perdana_telkomsel_rev` | MoM ST Perdana Telkomsel (rev.) |
| `st_perdana_byu_m_1_qty` | ST Perdana byU M-1 (qty) |
| `st_perdana_byu_m_qty` | ST Perdana byU M (qty) |
| `mom_st_perdana_byu_qty` | MoM ST Perdana byU (qty) |
| `st_perdana_byu_m_1_rev` | ST Perdana byU M-1 (rev.) |
| `st_perdana_byu_m_rev` | ST Perdana byU M (rev.) |
| `mom_st_perdana_byu_rev` | MoM ST Perdana byU (rev.) |
| `st_kpk_telkomsel_m_1_qty` | ST KPK Telkomsel M-1 (qty) |
| `st_kpk_telkomsel_m_qty` | ST KPK Telkomsel M (qty) |
| `mom_st_kpk_telkomsel_qty` | MoM ST KPK Telkomsel (qty) |
| `st_kpk_telkomsel_m_1_rev` | ST KPK Telkomsel M-1 (rev.) |
| `st_kpk_telkomsel_m_rev` | ST KPK Telkomsel M (rev.) |
| `mom_st_kpk_telkomsel_rev` | MoM ST KPK Telkomsel (rev.) |
| `st_kpk_byu_m_1_qty` | ST KPK byU M-1 (qty) |
| `st_kpk_byu_m_qty` | ST KPK byU M (qty) |
| `mom_st_kpk_byu_qty` | MoM ST KPK byU (qty) |
| `st_kpk_byu_m_1_rev` | ST KPK byU M-1 (rev.) |
| `st_kpk_byu_m_rev` | ST KPK byU M (rev.) |
| `mom_st_kpk_byu_rev` | MoM ST KPK byU (rev.) |
| `st_voucher_telkomsel_m_1_qty` | ST Voucher Telkomsel M-1 (qty) |
| `st_voucher_telkomsel_m_qty` | ST Voucher Telkomsel M (qty) |
| `mom_st_voucher_telkomsel_qty` | MoM ST Voucher Telkomsel (qty) |
| `st_voucher_telkomsel_m_1_rev` | ST Voucher Telkomsel M-1 (rev.) |
| `st_voucher_telkomsel_m_rev` | ST Voucher Telkomsel M (rev.) |
| `mom_st_voucher_telkomsel_rev` | MoM ST Voucher Telkomsel (rev.) |
| `st_voucher_byu_m_1_qty` | ST Voucher byU M-1 (qty) |
| `st_voucher_byu_m_qty` | ST Voucher byU M (qty) |
| `mom_st_voucher_byu_qty` | MoM ST Voucher byU (qty) |
| `st_voucher_byu_m_1_rev` | ST Voucher byU M-1 (rev.) |
| `st_voucher_byu_m_rev` | ST Voucher byU M (rev.) |
| `mom_st_voucher_byu_rev` | MoM ST Voucher byU (rev.) |
| `st_vokos_telkomsel_m_1_qty` | ST Vokos Telkomsel M-1 (qty) |
| `st_vokos_telkomsel_m_qty` | ST Vokos Telkomsel M (qty) |
| `mom_st_vokos_telkomsel_qty` | MoM ST Vokos Telkomsel (qty) |
| `st_vokos_telkomsel_m_1_rev` | ST Vokos Telkomsel M-1 (rev.) |
| `st_vokos_telkomsel_m_rev` | ST Vokos Telkomsel M (rev.) |
| `mom_st_vokos_telkomsel_rev` | MoM ST Vokos Telkomsel (rev.) |
| `st_vokos_byu_m_1_qty` | ST Vokos byU M-1 (qty) |
| `st_vokos_byu_m_qty` | ST Vokos byU M (qty) |
| `mom_st_vokos_byu_qty` | MoM ST Vokos byU (qty) |
| `st_vokos_byu_m_1_rev` | ST Vokos byU M-1 (rev.) |
| `st_vokos_byu_m_rev` | ST Vokos byU M (rev.) |
| `mom_st_vokos_byu_rev` | MoM ST Vokos byU (rev.) |

#### Sellthru Nota Detail Fields

Store in `sellthru_nota_json` or equivalent group `sellthruNota`.

| Key | Label |
|---|---|
| `st_nota_perdana_telkomsel_m_1_qty` | ST Nota Perdana Telkomsel M-1 (qty) |
| `st_nota_perdana_telkomsel_m_qty` | ST Nota Perdana Telkomsel M (qty) |
| `mom_st_nota_perdana_telkomsel_qty` | MoM ST Nota Perdana Telkomsel (qty) |
| `st_nota_perdana_telkomsel_m_1_rev` | ST Nota Perdana Telkomsel M-1 (rev.) |
| `st_nota_perdana_telkomsel_m_rev` | ST Nota Perdana Telkomsel M (rev.) |
| `mom_st_nota_perdana_telkomsel_rev` | MoM ST Nota Perdana Telkomsel (rev.) |
| `st_nota_perdana_byu_m_1_qty` | ST Nota Perdana byU M-1 (qty) |
| `st_nota_perdana_byu_m_qty` | ST Nota Perdana byU M (qty) |
| `mom_st_nota_perdana_byu_qty` | MoM ST Nota Perdana byU (qty) |
| `st_nota_perdana_byu_m_1_rev` | ST Nota Perdana byU M-1 (rev.) |
| `st_nota_perdana_byu_m_rev` | ST Nota Perdana byU M (rev.) |
| `mom_st_nota_perdana_byu_rev` | MoM ST Nota Perdana byU (rev.) |
| `st_nota_kpk_telkomsel_m_1_qty` | ST Nota KPK Telkomsel M-1 (qty) |
| `st_nota_kpk_telkomsel_m_qty` | ST Nota KPK Telkomsel M (qty) |
| `mom_st_nota_kpk_telkomsel_qty` | MoM ST Nota KPK Telkomsel (qty) |
| `st_nota_kpk_telkomsel_m_1_rev` | ST Nota KPK Telkomsel M-1 (rev.) |
| `st_nota_kpk_telkomsel_m_rev` | ST Nota KPK Telkomsel M (rev.) |
| `mom_st_nota_kpk_telkomsel_rev` | MoM ST Nota KPK Telkomsel (rev.) |
| `st_nota_kpk_byu_m_1_qty` | ST Nota KPK byU M-1 (qty) |
| `st_nota_kpk_byu_m_qty` | ST Nota KPK byU M (qty) |
| `mom_st_nota_kpk_byu_qty` | MoM ST Nota KPK byU (qty) |
| `st_nota_kpk_byu_m_1_rev` | ST Nota KPK byU M-1 (rev.) |
| `st_nota_kpk_byu_m_rev` | ST Nota KPK byU M (rev.) |
| `mom_st_nota_kpk_byu_rev` | MoM ST Nota KPK byU (rev.) |
| `st_nota_voucher_telkomsel_m_1_qty` | ST Nota Voucher Telkomsel M-1 (qty) |
| `st_nota_voucher_telkomsel_m_qty` | ST Nota Voucher Telkomsel M (qty) |
| `mom_st_nota_voucher_telkomsel_qty` | MoM ST Nota Voucher Telkomsel (qty) |
| `st_nota_voucher_telkomsel_m_1_rev` | ST Nota Voucher Telkomsel M-1 (rev.) |
| `st_nota_voucher_telkomsel_m_rev` | ST Nota Voucher Telkomsel M (rev.) |
| `mom_st_nota_voucher_telkomsel_rev` | MoM ST Nota Voucher Telkomsel (rev.) |
| `st_nota_voucher_byu_m_1_qty` | ST Nota Voucher byU M-1 (qty) |
| `st_nota_voucher_byu_m_qty` | ST Nota Voucher byU M (qty) |
| `mom_st_nota_voucher_byu_qty` | MoM ST Nota Voucher byU (qty) |
| `st_nota_voucher_byu_m_1_rev` | ST Nota Voucher byU M-1 (rev.) |
| `st_nota_voucher_byu_m_rev` | ST Nota Voucher byU M (rev.) |
| `mom_st_nota_voucher_byu_rev` | MoM ST Nota Voucher byU (rev.) |
| `st_nota_vokos_telkomsel_m_1_qty` | ST Nota Vokos Telkomsel M-1 (qty) |
| `st_nota_vokos_telkomsel_m_qty` | ST Nota Vokos Telkomsel M (qty) |
| `mom_st_nota_vokos_telkomsel_qty` | MoM ST Nota Vokos Telkomsel (qty) |
| `st_nota_vokos_telkomsel_m_1_rev` | ST Nota Vokos Telkomsel M-1 (rev.) |
| `st_nota_vokos_telkomsel_m_rev` | ST Nota Vokos Telkomsel M (rev.) |
| `mom_st_nota_vokos_telkomsel_rev` | MoM ST Nota Vokos Telkomsel (rev.) |
| `st_nota_vokos_byu_m_1_qty` | ST Nota Vokos byU M-1 (qty) |
| `st_nota_vokos_byu_m_qty` | ST Nota Vokos byU M (qty) |
| `mom_st_nota_vokos_byu_qty` | MoM ST Nota Vokos byU (qty) |
| `st_nota_vokos_byu_m_1_rev` | ST Nota Vokos byU M-1 (rev.) |
| `st_nota_vokos_byu_m_rev` | ST Nota Vokos byU M (rev.) |
| `mom_st_nota_vokos_byu_rev` | MoM ST Nota Vokos byU (rev.) |

#### Recharge Digipos Detail Fields

Store in `recharge_digipos_json` or equivalent group `rechargeDigipos`.

| Key | Label |
|---|---|
| `omzet_m_1_qty` | Omzet M-1 (qty) |
| `omzet_m_qty` | Omzet M (qty) |
| `mom_omzet_qty` | MoM Omzet (qty) |
| `omzet_m_1_rev` | Omzet M-1 (rev) |
| `omzet_m_rev` | Omzet M (rev) |
| `mom_omzet_rev` | MoM Omzet (rev) |
| `rech_pulsa_m_1_qty` | Rech. Pulsa M-1 (qty) |
| `rech_pulsa_m_qty` | Rech. Pulsa M (qty) |
| `mom_rech_pulsa_qty` | MoM Rech. Pulsa (qty) |
| `rech_pulsa_m_1_rev` | Rech. Pulsa M-1 (rev) |
| `rech_pulsa_m_rev` | Rech. Pulsa M (rev) |
| `mom_rech_pulsa_rev` | MoM Rech. Pulsa (rev) |
| `inject_voucher_m_1_qty` | Inject Voucher M-1 (qty) |
| `inject_voucher_m_qty` | Inject Voucher M (qty) |
| `mom_inject_voucher_qty` | MoM Inject Voucher (qty) |
| `inject_voucher_m_1_rev` | Inject Voucher M-1 (rev) |
| `inject_voucher_m_rev` | Inject Voucher M (rev) |
| `mom_inject_voucher_rev` | MoM Inject Voucher (rev) |
| `cvm_m_1_qty` | CVM M-1 (qty) |
| `cvm_m_qty` | CVM M (qty) |
| `mom_cvm_qty` | MoM CVM (qty) |
| `cvm_m_1_rev` | CVM M-1 (rev.) |
| `cvm_m_rev` | CVM M (rev.) |
| `mom_cvm_rev` | MoM CVM (rev.) |
| `aktifasi_sa_m_1_qty` | Aktifasi SA M-1 (qty) |
| `aktifasi_sa_m_qty` | Aktifasi SA M (qty) |
| `mom_aktifasi_sa_qty` | MoM Aktifasi SA (qty) |
| `aktifasi_sa_m_1_rev` | Aktifasi SA M-1 (rev.) |
| `aktifasi_sa_m_rev` | Aktifasi SA M (rev.) |
| `mom_aktifasi_sa_rev` | MoM Aktifasi SA (rev.) |
| `so_sellout_m_1_qty` | SO / SellOut M-1 (qty) |
| `so_sellout_m_qty` | SO / SellOut M (qty) |
| `mom_so_sellout_qty` | MoM SO / SellOut (qty) |
| `redeem_vo_m_1_qty` | Redeem Vo. M-1 (qty) |
| `redeem_vo_m_qty` | Redeem Vo. M (qty) |
| `mom_redeem_vo_qty` | MoM Redeem Vo. (qty) |
| `redeem_vo_m_1_rev` | Redeem Vo. M-1 (rev.) |
| `redeem_vo_m_rev` | Redeem Vo. M (rev.) |
| `mom_redeem_vo_rev` | MoM Redeem Vo. (rev) |
| `scan_so_m_1_qty` | Scan SO M-1 (qty) |
| `scan_so_m_qty` | Scan SO M (qty) |
| `mom_scan_so_qty` | MoM Scan SO (qty) |
| `scan_so_m_1_rev` | Scan SO M-1 (rev.) |
| `scan_so_m_rev` | Scan SO M (rev.) |
| `mom_scan_so_rev` | MoM Scan SO (rev.) |

### Performance Tables

`metric_defs`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `key` | string | Unique machine key. |
| `label` | string | Display label. |
| `unit` | string nullable | Unit such as qty, Rp, percent. |
| `aggregation` | enum | `SUM`, `AVG`, `LAST`. |
| `is_public` | boolean | Whether safe for public display. |
| `created_at` | datetime | Required. |

`outlet_metrics`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `outlet_id` | string/uuid | References outlets. |
| `metric_def_id` | string/uuid | References metric definitions. |
| `period_ym` | string | Format `YYYY-MM`. |
| `value` | number | Metric value. |
| `source_batch_id` | string nullable | References import batch. |

Unique key: outlet + metric + period.

### Whitelist and OTP Tables

`whitelist_numbers`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `phone_e164` | string | Normalized phone number. |
| `name` | string nullable | Human label. |
| `scope` | enum | `ALL`, `OUTLET`, `TERRITORY`. |
| `outlet_id` | string nullable | Required when scope is outlet. |
| `territory_id` | string nullable | Required when scope is territory. |
| `is_active` | boolean | Default true. |
| `created_by` | string nullable | References manager user. |
| `source_batch_id` | string nullable | References import batch. |
| `expires_at` | datetime nullable | Optional expiry. |
| `created_at` | datetime | Required. |

`otp_requests`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `phone_e164` | string | Requested phone. |
| `outlet_id` | string/uuid | Detail target outlet. |
| `whitelist_id` | string nullable | Matched whitelist, if any. |
| `code_hash` | string | Hash only. No plaintext OTP. |
| `code_salt` | string | Salt for OTP hash. |
| `purpose` | enum | `OUTLET_DETAIL`. |
| `attempts` | integer | Failed verify attempts. |
| `expires_at` | datetime | OTP expiry. |
| `verified_at` | datetime nullable | Verification timestamp. |
| `ip` | string nullable | Abuse/rate-limit support. |
| `user_agent` | string nullable | Abuse/rate-limit support. |
| `created_at` | datetime | Required. |

`detail_sessions`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `token_hash` | string | Unique hash of session token. |
| `phone_e164` | string | Verified phone. |
| `outlet_id` | string/uuid | Session is valid only for this outlet. |
| `expires_at` | datetime | TTL, recommended 15 minutes. |
| `created_at` | datetime | Required. |

`whitelist_usage_logs`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `whitelist_id` | string nullable | References whitelist. |
| `phone_e164` | string | Phone used. |
| `outlet_id` | string/uuid | Outlet accessed/requested. |
| `action` | enum | `OTP_REQUESTED`, `OTP_VERIFIED`, `OTP_REJECTED`. |
| `ip` | string nullable | Abuse/rate-limit support. |
| `created_at` | datetime | Required. |

### Program and Leaderboard Tables

`programs`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `name` | string | Program name. |
| `slug` | string | Unique public slug. |
| `description_md` | text nullable | Public description. |
| `mechanism_md` | text nullable | Public mechanism/rules. |
| `period_start`, `period_end` | datetime | Program period. |
| `status` | enum | `DRAFT`, `ACTIVE`, `ENDED`, `PUBLISHED`. |
| `ranking_mode` | enum | `POINT` or `RANK`. |
| `tie_breaker` | string nullable | Parameter key for ties. |
| `is_public` | boolean | Public visibility flag. |
| `created_at`, `updated_at` | datetime | Required. |

`program_params`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `program_id` | string/uuid | References programs. |
| `key` | string | Unique per program. |
| `label` | string | Display label. |
| `unit` | string nullable | Unit. |
| `weight` | number | Positive. |
| `aggregation` | enum | `SUM`, `AVG`, `LAST`. |
| `sort_order` | integer | Display order. |

`program_participants`

| Field | Type | Requirement |
|---|---|---|
| `program_id` | string/uuid | References programs. |
| `outlet_id` | string/uuid | References outlets. |
| `joined_at` | datetime | Required. |

Composite key: program + outlet.

`program_scores`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `program_id` | string/uuid | References programs. |
| `outlet_id` | string/uuid | References outlets. |
| `param_id` | string/uuid | References program params. |
| `raw_value` | number | Imported/input score value. |
| `points` | number | Calculated points if needed. |
| `period_ym` | string | Format `YYYY-MM`. |
| `batch_id` | string nullable | References import batch. |
| `updated_at` | datetime | Required. |

Unique key: program + outlet + parameter + period.

`program_leaderboard`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `program_id` | string/uuid | References programs. |
| `outlet_id` | string/uuid | References outlets. |
| `total_points` | number | Calculated total. |
| `rank` | integer | Current rank. |
| `prev_rank` | integer nullable | Previous rank snapshot. |
| `computed_at` | datetime | Required. |

Unique key: program + outlet.

`program_winners`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `program_id` | string/uuid | References programs. |
| `outlet_id` | string/uuid | References outlets. |
| `rank` | integer | Winner rank. |
| `prize_label` | string nullable | Prize label. |
| `is_published` | boolean | Public winner visibility. |

### Import and Audit Tables

`import_batches`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `type` | string | Example: `performance`, `program_score`, `whitelist`. |
| `file_name` | string | Original filename for audit. |
| `row_count` | integer | Number of rows. |
| `status` | enum | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `ROLLED_BACK`. |
| `error_log` | JSON nullable | Validation/import errors. |
| `preview_json` | JSON nullable | Preview data. |
| `rollback_json` | JSON nullable | Snapshot for rollback. |
| `created_by` | string nullable | References user. |
| `created_at` | datetime | Required. |
| `rolled_back_at` | datetime nullable | Rollback timestamp. |

`audit_logs`

| Field | Type | Requirement |
|---|---|---|
| `id` | string/uuid | Primary key. |
| `user_id` | string nullable | Actor. |
| `action` | string | CREATE, UPDATE, DELETE, PUBLISH, ROLLBACK, etc. |
| `entity` | string | Entity name. |
| `entity_id` | string nullable | Target ID. |
| `diff_json` | JSON nullable | Safe diff only, no secrets or OTP. |
| `ip` | string nullable | Optional. |
| `created_at` | datetime | Required. |

### Integration Points

| Integration | Requirement |
|---|---|
| Database | Relational DB with transactions, indexes, JSON field support preferred. |
| Authentication | Credentials login for internal dashboard, secure session cookie, lockout protection. |
| WhatsApp OTP | WAHA or compatible gateway with API key/session config. |
| File upload | Outlet photo upload with type/size validation and safe storage. |
| QR/PDF | Generate QR code URLs from production base URL; output QR PNG/SVG, single card, and bulk PDF. |
| Import | Excel/CSV parsing with max size/row limits, preview, validation, transaction commit, and rollback. |
| Cleanup | Scheduled cleanup for expired OTP requests and detail sessions. |
| Healthcheck | Endpoint/admin view showing database and WAHA status. |

### Security & Privacy

- Public QR URL must use random `public_token`, not sequential database ID.
- Public outlet page must be `noindex`.
- Public page must show only non-sensitive outlet fields.
- Owner phone must be masked before OTP.
- Sensitive detail JSON and full owner phone must only be fetched/rendered after valid detail session.
- Detail session must be tied to one outlet and expire, recommended TTL 15 minutes.
- OTP should be six numeric digits from cryptographic randomness.
- OTP expiry recommended 5 minutes.
- Max OTP attempts recommended 3.
- Request cooldown recommended 60 seconds.
- Rate limits recommended: 5 requests/hour/phone, 10/day/phone, 15/hour/IP.
- OTP request response must not reveal whether a phone is whitelisted.
- Password hashing must use Argon2id or equivalent modern password hash.
- Internal mutating actions must validate input server-side.
- Leader territory scoping must be enforced in database queries/server code.
- Audit logs must never store password, OTP, WAHA API key, auth secret, or raw session token.
- Production must use HTTPS, secure cookies, and security headers.

### UI and Design Requirements

- Keep landing page design as the first impression.
- Portal UI should feel consistent with the landing page branding, but optimized for operational work.
- Dashboard should use dense, clear, scan-friendly layouts rather than marketing-style sections.
- Public outlet and program pages must be mobile-first because QR scans mostly happen on phones.
- Tables must become responsive cards or horizontally manageable views on small screens.
- Buttons and form controls must have accessible labels and minimum tap targets around 44 px.
- Use Indonesian copy, local date formatting, and local number formatting.
- Avoid showing implementation instructions inside the UI.

### Performance Requirements

- Public QR page should load quickly on mobile data.
- Dashboard lists must use server-side pagination for 10.000 outlet target.
- Program leaderboard should be cached/materialized in database so public requests do not recompute every time.
- Import should validate before commit and avoid loading unbounded data into the browser.
- Image upload should be resized or constrained to avoid bloated public pages.

## 5. Risks & Roadmap

### Phased Rollout

**MVP**

- Landing page remains intact.
- Internal auth and role guard.
- Outlet database and dashboard CRUD.
- Public QR outlet profile.
- OTP WhatsApp detail access.
- Whitelist management.
- QR card generation.
- Basic audit log.

**v1.1**

- Performance metric definitions.
- Manual performance input.
- Excel/CSV import with preview, commit, rollback, and history.
- Public outlet detail performance history.
- Dashboard summary charts.

**v1.2**

- Program builder.
- Program participants.
- Dynamic scoring parameters.
- Leaderboard recompute engine.
- Public program list/detail, search, filters, and winners.

**v2.0**

- Stronger analytics dashboard.
- Scheduled leaderboard recompute.
- Optional anti-bot Turnstile.
- Optional offsite backup verification.
- Optional program notification workflow.

### Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Landing page stack unknown | Implementation may conflict with existing routing/auth/db. | Inspect first, choose architecture after discovery, label unknowns `TBD`. |
| Route collision | Existing `/api`, `/login`, `/dashboard`, or `/program` may already exist. | Map routes before coding and propose alternate route namespace if needed. |
| Database migration risk | Existing landing data could be affected. | Backup first, use versioned migrations, test on staging/local clone. |
| Data leakage | Sensitive outlet data may appear in public HTML/API responses. | Separate public query shape from detail query shape; review serialized data. |
| OTP abuse | Attackers may spam OTP endpoint. | Cooldown, per-phone/IP limits, generic response, optional Turnstile. |
| WAHA downtime | OTP detail access blocked. | Healthcheck, friendly error, admin visibility, retry with timeout. |
| Large imports | Browser/server memory pressure. | File size limits, row limits, streaming or chunked processing if stack supports it. |
| Leaderboard latency | Ranking heavy for many outlets. | Cache/materialize leaderboard and recompute on data changes. |
| Deployment conflict | Existing VPS hosts many sites/apps. | Isolate app resources, avoid port conflicts, test reverse proxy config before reload. |

### Final Acceptance Checklist

- [ ] Landing homepage remains at `/`.
- [ ] Portal entry points are visible from landing navigation or CTA.
- [ ] Internal login works.
- [ ] Manager/Admin/Leader permissions are enforced server-side.
- [ ] Outlet CRUD works with final outlet fields.
- [ ] Public QR profile uses random token and masks owner phone.
- [ ] OTP request and verify work with whitelist scopes ALL/OUTLET/TERRITORY.
- [ ] Detail page shows sensitive data only after OTP.
- [ ] Whitelist CRUD/import/history works.
- [ ] Performance manual input/import/history works.
- [ ] Program builder, participant selection, scoring, leaderboard, winners, and publish flow work.
- [ ] QR PNG/SVG/card/bulk PDF generation works.
- [ ] Audit log records important writes.
- [ ] Cleanup for expired OTP/session is available.
- [ ] Build and migration validation pass in the target landing page project.

### Discovery Questions for Antigravity Before Coding

These questions are for Antigravity to answer by inspecting the landing page project before implementation:

1. What framework and routing system does the landing page use?
2. Does the landing page already have a database, ORM, auth system, API routes, middleware, or deployment scripts?
3. Are `/login`, `/dashboard`, `/program`, `/o`, or `/api` already used?
4. Should portal data live in the same database as landing content or in a separate database/service?
5. What production domain and path should QR codes use?
6. What is the safest rollback plan if integration breaks the landing page?

Do not block implementation forever if some answers are unknown. Mark unknowns as `TBD`, propose a safe default, and keep the first implementation reversible.
