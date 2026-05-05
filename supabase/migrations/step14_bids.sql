-- step14_bids.sql
-- M2: persist every bid Basta tells us about via the BidOnItem webhook.
--
-- This is the *source of truth* for our bid history UI. Basta's Client API
-- can be queried for current state, but we need the full ordered history
-- to render "@username bid $X — Ns ago" feeds, compute winning price at
-- SELL time, and compose buyer order records.
--
-- Shape follows Basta's BidOnItem payload (see docs/memory/architecture/
-- basta-integration.md). The bid's owner (user_id) comes from Basta's
-- `userId` field, which we set to Supabase auth.users.id when minting the
-- bidder token. So profiles.id == bids.user_id, direct join, no mapping.

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,

  -- The Supabase auth user who placed the bid. Nullable only because
  -- Basta may emit reactive bids with a userId that predates or outlives
  -- our profiles row; we still record the bid and resolve display name
  -- at read time.
  user_id uuid references auth.users(id) on delete set null,

  -- Basta bid IDs (unique per bid event). Used for idempotency if the
  -- same webhook gets retried.
  basta_bid_id text unique not null,

  -- Bid shape. amount = what Basta will actually try to win at (current
  -- bid level). max_amount = only meaningful for MAX bids; equals amount
  -- for NORMAL bids.
  amount_cents integer not null check (amount_cents >= 0),
  max_amount_cents integer not null check (max_amount_cents >= amount_cents),
  bid_type text not null check (bid_type in ('MAX', 'NORMAL')),

  -- True if this row represents a reactive bid auto-placed by Basta's
  -- engine in response to someone else's bid (i.e. sent as a member of
  -- `reactiveBids[]` in the BidOnItem webhook, not as the top-level bid).
  reactive boolean not null default false,

  -- Basta's bidDate (ISO in payload). We keep both this and received_at
  -- so we can disambiguate clock skew if a handler backfills late.
  placed_at timestamptz not null,
  received_at timestamptz not null default now()
);

comment on table public.bids is
  'Every bid Basta has told us about via BidOnItem webhook. One row per Basta bidId. Reactive bids get reactive=true.';

create index if not exists bids_lot_placed_idx
  on public.bids (lot_id, placed_at desc);

create index if not exists bids_auction_placed_idx
  on public.bids (auction_id, placed_at desc);

create index if not exists bids_user_placed_idx
  on public.bids (user_id, placed_at desc)
  where user_id is not null;

-- RLS: public read of bids in published/live/ended auctions (for feed +
-- leaderboard). Service role writes. Users can see their own bids across
-- anything.
alter table public.bids enable row level security;

-- Public can read bids for auctions that are at least published. This
-- exposes bid history / leaderboards without needing auth. The bidder's
-- identity is resolved separately via profiles (display_name); the raw
-- user_id is a UUID and can be further filtered in views if we need to.
create policy "bids_public_read"
  on public.bids
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.auctions a
      where a.id = bids.auction_id
        and a.status in ('published', 'live', 'ended', 'closed')
    )
  );

-- Inserts are service-role only (webhook handler).
-- No update/delete policies = default-deny for non-service roles.

-- Add to realtime publication so the live bid feed can subscribe.
-- If the publication doesn't exist yet this will fail harmlessly under
-- `if exists`; on Supabase projects it does exist as `supabase_realtime`.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.bids;
    exception when duplicate_object then
      -- already in the publication, no-op
      null;
    end;
  end if;
end $$;
