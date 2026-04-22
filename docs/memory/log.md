# Log

Append-only, chronological. One line per meaningful event. ISO-dated. When a line reveals durable truth, lift it to a compiled page and replace this line with a link.

---

- `[2026-04-21]` — Scanned the full repo + Supabase schema + Figma (5 sections) + Basta docs. Wrote [GAP_ANALYSIS_AND_PLAN.md](../../GAP_ANALYSIS_AND_PLAN.md) (~24KB) with 8-workstream plan.
- `[2026-04-21]` — Restructured plan into 8 demo-gated milestones (M0–M8) and wrote it to `.claude/plans/fancy-knitting-bunny.md`; user approved.
- `[2026-04-21]` — Seeded this memory system (`docs/memory/`) following Karpathy's LLM-wiki pattern. See [SCHEMA.md](SCHEMA.md) for rules.
- `[2026-04-21]` — Supabase schema state snapshot: 3 tenants (`demo`, `unsoundrags`, `basa`), 5 auctions (1 live — BASA's "Vintage Furniture Archive"), 24 lots, 0 orders. Compiled into [architecture/tenant-model.md](architecture/tenant-model.md).
- `[2026-04-21]` — Audited `lots.money_in_cents` — all 24 rows already `true` (cents). No backfill needed; migration will just drop the column. Updated [ADR-002](decisions/ADR-002-money-in-cents.md).
- `[2026-04-21]` — Basta skill reference (in the Claude agent skills dir) is richer than our local `docs/docs.basta.app_*.md` — confirmed two bid types (MAX/NORMAL), subscription surface (`itemUpdates`, `saleUpdates`), error codes. Compiled into [architecture/basta-integration.md](architecture/basta-integration.md). Open questions filed to [risks/basta-questions.md](risks/basta-questions.md).
- `[2026-04-21]` — Applied migration `step12_money_units_cleanup` via Supabase MCP. Column `lots.money_in_cents` dropped after audit (all 24 rows were `true`). See [ADR-002](decisions/ADR-002-money-in-cents.md).
- `[2026-04-21]` — Rewrote [`lib/format.ts`](../../lib/format.ts): `formatMoney(dollars)` → `formatMoneyCents(cents)`, same for estimate. Added `parseDollarsToCents(input)` for form inputs. Updated all 3 call sites (`max-bid-section`, `lot-info`, `lot-card`) + mock data in `lib/storefront-data.ts` (multiplied literals by 100). Frontend + backend typecheck clean.
- `[2026-04-21]` — Fixed seed scripts: `seed-unsoundrags.ts` and `seed-basa.ts` now convert dollar seed literals to cents at DB INSERT boundary (`toCents(...)`). `seed-unsoundrags.ts` had an undefined `toCents` reference — now correct.
- `[2026-04-21]` — Added `.env.example` (root + `backend/`) documenting every var with source URLs + milestone annotations for future-ready Stripe/LiveKit/Twilio/Shippo slots.
- `[2026-04-21]` — Added `scripts/bootstrap.sh` + `pnpm bootstrap` + `pnpm typecheck` to root `package.json`. Bootstrap copies env examples, runs install, prints next steps.
- `[2026-04-21]` — **M0 complete.** Demo gate ≈ passing (structural — needs env fill + `pnpm dev:all` to render on a fresh machine). Ready to start M1 next session.
- `[2026-04-21]` — Env files filled: `.env.local` (Supabase publishable key, root domain `localhost`, backend URL), `backend/.env` (Supabase service role, Basta account id `af9d77d6-2feb-4293-bd1d-dddc66b831d1` + API key). `.gitignore` already excludes `.env*`.
- `[2026-04-21]` — **M0 demo gate ✅ VERIFIED.** `pnpm dev:all` boots both servers; `Host: basa.localhost:3000` renders BASA's "Vintage Furniture Archive"; `/lots/<lot1>` shows Ligne Roset with `$15` starting bid + `$2,400` estimate. Cents→dollars formatting via `formatMoneyCents` works end-to-end. Typecheck clean both workspaces.
- `[2026-04-21]` — Fixed `lib/storefront-data.ts` auction lookup: was filtering `status='published' AND scheduled_date >= now`, which hid BASA's currently-live auction (status `live`, past-date because seed used `now()`). Now accepts `status IN ('live','published')` and orders live-first.
- `[2026-04-21]` — Data debt noted (NOT blocking): BASA's seeded auction has 6 furniture lots + 3 orphaned "Cross Patch Denim Jacket" rows at sort_order 6-8 (leftover from a prior shared-seed run). Doesn't affect the live-auction flow; clean up during M1 or when reseeding.
