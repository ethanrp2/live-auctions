#!/usr/bin/env bash
# scripts/bootstrap.sh
# First-time setup helper for a fresh clone of live-auctions.
# Not a production orchestrator; just catches the obvious "you forgot X"
# before the dev server confuses you with cryptic errors.
#
# Usage:   pnpm bootstrap   (from repo root)
# See:     docs/memory/architecture/tenant-model.md
set -euo pipefail

RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; NC=$'\033[0m'

info()  { echo "${DIM}•${NC} $*"; }
ok()    { echo "${GRN}✓${NC} $*"; }
warn()  { echo "${YEL}!${NC} $*"; }
fail()  { echo "${RED}✗${NC} $*"; exit 1; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

# 1. pnpm + node present
command -v pnpm >/dev/null 2>&1 || fail "pnpm not on PATH. Install: npm i -g pnpm"
command -v node >/dev/null 2>&1 || fail "node not on PATH."

# 2. Env files
if [[ ! -f .env.local ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env.local
    warn "Created .env.local from .env.example — fill in real values before dev."
  else
    fail ".env.example missing; cannot bootstrap frontend env."
  fi
else
  ok ".env.local present."
fi

if [[ ! -f backend/.env ]]; then
  if [[ -f backend/.env.example ]]; then
    cp backend/.env.example backend/.env
    warn "Created backend/.env from backend/.env.example — fill in real values."
  else
    fail "backend/.env.example missing; cannot bootstrap backend env."
  fi
else
  ok "backend/.env present."
fi

# 3. Dependencies
info "Installing dependencies (pnpm install)…"
pnpm install --prefer-offline --silent
ok "Dependencies installed."

# 4. Remind about Supabase
if grep -q "<your-project-ref>" .env.local 2>/dev/null || grep -q "sb_publishable_\\.\\.\\." .env.local 2>/dev/null; then
  warn ".env.local still has placeholders. Fill NEXT_PUBLIC_SUPABASE_* before running 'pnpm dev:all'."
fi
if grep -q "<your-project-ref>" backend/.env 2>/dev/null || [[ -z "$(grep '^BASTA_API_KEY=' backend/.env | cut -d= -f2)" ]]; then
  warn "backend/.env still has placeholders. Fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BASTA_* before publishing auctions."
fi

# 5. Tenants exist?
info "Current tenants expected: demo, unsoundrags, basa."
info "If this is a brand-new Supabase project, run the seed scripts:"
info "  cd backend && pnpm tsx scripts/seed-unsoundrags.ts"
info "  cd backend && pnpm tsx scripts/seed-basa.ts"

ok "Bootstrap done. Next: pnpm dev:all  (visit http://basa.localhost:3000)"
