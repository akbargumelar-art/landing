# Audit Agentic dan Dependency - 2026-08-10

## Ringkasan eksekutif

Audit memakai skill lokal `agent-owasp-compliance`, pemeriksaan kode, dan data advisory npm
terbaru. Kesimpulannya:

1. **OWASP Top 10 for Agentic Applications 2026 tidak berlaku pada runtime aplikasi ini.**
   Repo adalah aplikasi Next.js/Drizzle/Better Auth dan tidak memuat SDK LLM, planner, registry
   tool, eksekusi prompt, memori agent, atau komunikasi antar-agent. Folder `.agents/` adalah
   instruksi bantuan pengembangan, bukan komponen produksi.
2. **Skill lokal tidak boleh menghasilkan skor kepatuhan ASI sebelum diperbarui.** Nama dan
   pemetaan ASI-01 sampai ASI-10 di skill tidak sama dengan daftar resmi OWASP 2026. Memberi
   nilai `0/10` atau `10/10` kepada aplikasi ini akan menyesatkan.
3. **Audit dependency produksi menemukan 12 package terdampak:** 1 kritis, 9 tinggi, dan 2
   sedang. Enam di antaranya dependency langsung. Angka audit penuh (termasuk development
   tooling) adalah 21: 2 kritis, 13 tinggi, dan 6 sedang.
4. Tidak ada dependency yang diubah dalam audit ini. Upgrade perlu dikerjakan terpisah agar
   perubahan versi, migrasi Drizzle, login, upload gambar, dan impor Excel bisa diuji secara
   proporsional.

Snapshot audit: branch `fix/payment-webhooks-and-migration-blockers`, HEAD
`a4e15df2e310c825bb1bf79d5a2caef958279c8e`. Working tree sudah berisi perubahan lain sebelum
audit; perubahan tersebut tidak dimodifikasi atau dimasukkan ke laporan ini.

## Ruang lingkup dan metode

- Membaca skill `.agents/skills/agent-owasp-compliance/SKILL.md` dan membandingkan taksonominya
  dengan [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
  serta [dokumen resmi lengkap](https://genai.owasp.org/download/52117/?tmstv=1765059207).
- Mencari SDK/model/LLM, prompt execution, tool calling, MCP, agent orchestration, dynamic code
  execution, dan komunikasi antar-agent di source runtime.
- Meninjau `.agents/`, konfigurasi lokal `.claude/`, `package.json`, lockfile, auth,
  middleware, jalur upload, dan jalur impor Excel.
- Menjalankan `npm audit --json` dan `npm audit --omit=dev --json` pada 10 Agustus 2026.
- Menjalankan pemindaian pola rahasia ringan tanpa mencetak nilai kandidat ke terminal.

Audit ini bukan penetration test, bukan review seluruh route aplikasi, dan tidak membuktikan
bahwa dependency yang ditandai dapat dieksploitasi pada deployment produksi.

## Hasil OWASP Agentic Top 10 2026

| ID | Risiko resmi | Status | Bukti |
| --- | --- | --- | --- |
| ASI01 | Agent Goal Hijack | N/A | Tidak ada agent, goal, prompt, atau model pada runtime. |
| ASI02 | Tool Misuse & Exploitation | N/A | Tidak ada tool registry maupun pemanggilan tool oleh model. |
| ASI03 | Identity & Privilege Abuse | N/A | Auth user web ada, tetapi tidak ada identitas agent/non-human agent. |
| ASI04 | Agentic Supply Chain Vulnerabilities | N/A | Tidak ada plugin/tool/MCP agent yang dimuat aplikasi. Risiko dependency web dicatat terpisah. |
| ASI05 | Unexpected Code Execution | N/A | Tidak ditemukan jalur model/agent ke shell, `eval`, `Function`, atau child process. |
| ASI06 | Memory & Context Poisoning | N/A | Tidak ada memori, vector store, atau konteks persisten agent. |
| ASI07 | Insecure Inter-Agent Communication | N/A | Tidak ada protokol atau komunikasi antar-agent. |
| ASI08 | Cascading Failures | N/A | Tidak ada orkestrasi atau delegasi agent. |
| ASI09 | Human-Agent Trust Exploitation | N/A | Produk tidak menyajikan output agent kepada pengguna. |
| ASI10 | Rogue Agents | N/A | Tidak ada autonomous agent pada runtime. |

### Ketidaksesuaian skill lokal

Skill lokal memetakan, antara lain, ASI-01 sebagai “Prompt Injection”, ASI-06 sebagai
“Insufficient Logging”, dan ASI-09 sebagai “Supply Chain Integrity”. Daftar resmi 2026 memakai
ASI01 **Agent Goal Hijack**, ASI06 **Memory & Context Poisoning**, dan ASI09 **Human-Agent Trust
Exploitation**. Ini bukan sekadar perbedaan label; kontrol yang diuji juga berbeda.

Rekomendasi untuk skill:

- Tambahkan gerbang applicability sebelum memberi skor: pastikan sistem benar-benar memiliki
  model yang merencanakan/bertindak dan tool atau tingkat otonomi.
- Ganti seluruh taksonomi dengan daftar resmi 2026 dan gunakan status `PASS`, `PARTIAL`, `FAIL`,
  atau `N/A` berbasis bukti.
- Hapus rekomendasi instalasi toolkit yang tidak diverifikasi sebagai syarat baku kepatuhan.
- Cantumkan tanggal framework dan sumber resmi agar drift dapat dideteksi pada audit berikutnya.

## Temuan dependency produksi

Versi di bawah berasal dari lockfile/node_modules pada saat audit. Severity adalah severity yang
dilaporkan npm untuk package, bukan penetapan exploitability aplikasi.

| Prioritas | Dependency | Versi | Audit npm | Penilaian penggunaan saat ini | Tindakan minimum |
| --- | --- | ---: | --- | --- | --- |
| P0 | `next` | 15.5.12 | Tinggi | App Router dan middleware dipakai langsung. Beberapa advisory DoS, middleware bypass, SSRF, dan cache confusion mencakup versi ini. | Naikkan minimal ke 15.5.21 atau patch supported yang lebih baru; uji build, middleware, Server Actions, image, dan route publik/admin. |
| P0 | `sharp` | 0.34.5 | Tinggi | Buffer unggahan pengguna diproses oleh `sharp`, sehingga parser gambar adalah permukaan serangan nyata. | Naikkan ke 0.35.3 atau versi aman supported; uji JPG/PNG/WebP valid, korup, besar, dan metadata EXIF. |
| P0 | `xlsx` | 0.18.5 | Tinggi, tanpa fix npm | File Excel dari admin dibaca pada beberapa endpoint impor. Advisory prototype pollution dan ReDoS relevan pada input workbook. | Evaluasi distribusi SheetJS supported atau pengganti yang terawat; batasi ukuran/waktu parsing dan uji workbook berbahaya sebelum migrasi. |
| P1 | `better-auth` | 1.5.0 | Kritis | Konfigurasi repo hanya mengaktifkan email/password. Plugin OAuth provider, OIDC, MCP, magic-link, dan email-OTP yang disebut mayoritas advisory tidak terlihat aktif, jadi eksploitasi kritis belum terbukti. Versi tetap berada dalam rentang terdampak. | Naikkan minimal ke 1.6.22; uji login, logout, sesi lama, penghapusan/nonaktif user, cookie secure, dan seluruh RBAC. |
| P1 | `drizzle-orm` | 0.39.3 | Tinggi | Tidak ditemukan `sql.raw`/`sql.identifier` atau identifier tabel dinamis di source. Risiko SQL identifier injection tampak berkurang, bukan hilang. | Naikkan minimal ke 0.45.2 dalam perubahan terisolasi; review breaking change dan jalankan schema/migration/runtime DB test. |
| P2 | `uuid` | 11.1.0 | Sedang | Repo memakai `v4()` tanpa output buffer; advisory yang dilaporkan mengenai v3/v5/v6 saat buffer diberikan. | Naikkan minimal ke 11.1.1 sebagai patch rendah risiko. |

Dependency produksi transitif yang ikut ditandai: `defu`, `kysely`, `linkify-it`, `markdown-it`,
`nanoid`, dan `postcss`. Perbaikannya harus diverifikasi setelah dependency langsung dinaikkan;
jangan memakai `npm audit fix --force` tanpa review diff dan regression test.

Referensi advisory langsung:

- [Better Auth advisories](https://github.com/advisories?query=ecosystem%3Anpm+package%3Abetter-auth)
- [Drizzle ORM SQL identifier injection](https://github.com/advisories/GHSA-gpj5-g38j-94v9)
- [Sharp/libvips vulnerabilities](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
- [UUID buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- [SheetJS prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)
- [SheetJS ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)

## Keamanan konfigurasi agent pengembangan

Folder `.agents/` dilacak Git, tetapi dikecualikan dari image produksi oleh `.dockerignore`.
Tidak ditemukan `CODEOWNERS`, CI policy, SBOM, atau manifest integritas yang secara khusus
melindungi perubahan skill. Karena coding assistant dapat membaca instruksi repo, perubahan skill
harus diperlakukan seperti perubahan CI/build: review manusia dan kepemilikan eksplisit.

`.claude/settings.local.json` saat audit bersifat untracked dan tidak masuk image, tetapi belum
di-ignore. Isinya mengizinkan pola luas seperti `npm install *` dan `git commit *`. Berkas ini
tidak dimasukkan ke commit audit. Rekomendasi:

- ignore `.claude/settings.local.json` agar konfigurasi izin personal tidak ter-commit tanpa
  sengaja;
- persempit izin wildcard ke command yang benar-benar dibutuhkan;
- tambahkan code owner/review wajib untuk `.agents/**`, lockfile, skrip deployment, dan workflow;
- hasilkan SBOM pada pipeline release dan arsipkan hasil audit dependency per build.

## Pemeriksaan rahasia

Pemindaian pola ringan tidak menemukan private key, token GitHub/OpenAI/AWS, atau assignment
secret berformat umum di luar contoh/dokumentasi yang dikecualikan. Ini hanya pemeriksaan cepat;
gunakan secret scanner khusus pada seluruh riwayat Git sebelum rilis produksi.

## Urutan tindak lanjut

1. Buat PR dependency terpisah untuk Next, Sharp, UUID, dan Better Auth; jangan campur dengan
   migrasi database yang saat ini belum selesai.
2. Putuskan pengganti/kanal distribusi aman untuk `xlsx`, lalu uji semua impor Excel dan ekspor.
3. Upgrade Drizzle ORM setelah backup dan review kompatibilitas migrasi.
4. Perbarui skill ASI agar memakai taksonomi resmi dan applicability gate.
5. Tambahkan guardrail repo untuk konfigurasi agent pengembangan dan dependency supply chain.

## Verifikasi audit

- `npm audit --omit=dev --json`: 12 dependency produksi (1 kritis, 9 tinggi, 2 sedang).
- `npm audit --json`: 21 dependency total (2 kritis, 13 tinggi, 6 sedang).
- Pencarian runtime AI/agent/MCP/tool calling: tidak ada kecocokan.
- Pencarian dynamic code/shell execution di `src` dan `scripts`: tidak ada kecocokan.
- Pencarian `sql.raw`/`sql.identifier` dan pemakaian UUID v3/v5/v6: tidak ada kecocokan.
- Tidak ada build atau runtime test aplikasi karena audit ini tidak mengubah source maupun
  dependency.

