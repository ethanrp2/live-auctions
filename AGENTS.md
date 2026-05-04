<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Documentation structure

Two primary documents — read both before writing any code:

1. **`LIVE_AUCTIONS_PLAN.md`** — product concept, stack decisions, architecture ADRs, Basta integration surface, DB schema, milestone definitions. The stable reference.

2. **`WORKING_NOTES.md`** — current milestone, task checklist, pending manual actions, open questions, session log. The living progress tracker. Update this as you complete tasks.

Supporting deep-dives:
- `docs/memory/INDEX.md` — index of architecture, ADR, risk, and session files
- `docs/memory/architecture/` — per-topic architecture notes (auth, money units, RLS, Basta, realtime, tenant model)

## Key constraints
- Money = integer cents everywhere (DB, UI, Basta API). See `lib/format.ts`.
- Auth cookie domain = `.${ROOT_DOMAIN}` (dot-prefixed, shared across subdomains).
- Lots are ordered by `lots.sort_order`, not by Basta. `auctions.current_lot_id` is the active lot pointer.
- Shipping is record-keeping only for MVP — no Shippo. Sellers view winner info in the console.
- All seller console actions go through the Fastify backend with `requireSeller` auth guard.
- Run `pnpm typecheck` (root) and `cd backend && pnpm typecheck` before committing.