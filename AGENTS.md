<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Documentation structure

Two primary documents — read both before writing any code:

1. **`LIVE_AUCTIONS_PLATFORM_OVERVIEW.md`** — product concept, user flows, Basta integration boundary, key screens. The stable product reference.

2. **`LIVE_AUCTIONS_IMPLEMENTATION_PLAN.md`** — stack, architecture decisions, DB schema, implementation steps with progress checkboxes, pending actions, open questions. The living implementation tracker. Update this as you complete tasks.

## Key constraints
- Money = integer cents everywhere (DB, UI, Basta API). See `lib/format.ts`.
- Auth cookie domain = `.${ROOT_DOMAIN}` (dot-prefixed, shared across subdomains).
- Lots are ordered by `lots.sort_order`, not by Basta. `auctions.current_lot_id` is the active lot pointer.
- Shipping is record-keeping only for MVP — no Shippo. Sellers view winner info in the console.
- All seller console actions go through the Fastify backend with `requireSeller` auth guard.
- Run `pnpm typecheck` (root) and `cd backend && pnpm typecheck` before committing.