-- step15_auctions_increment_table.sql
--
-- M1: persist the bid increment table + closing-time countdown locally at publish
-- time so the buyer live screen can render "next bid = current + nextIncrement"
-- without an extra Basta Client API round-trip.
--
-- Shape of bid_increment_table matches Basta's input schema:
--   [ { "lowRange": <cents>, "highRange": <cents>, "step": <cents> }, ... ]
-- See: docs/memory/architecture/basta-integration.md (bid increment table).
--
-- Safe to run on a non-empty table: columns nullable, no backfill required.

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS bid_increment_table jsonb,
  ADD COLUMN IF NOT EXISTS closing_time_countdown_ms integer;

COMMENT ON COLUMN public.auctions.bid_increment_table IS
  'Mirror of Basta sale.bidIncrementTable.rules persisted at publish time. Array of {lowRange,highRange,step} in cents. See ADR-002 + basta-integration.md.';

COMMENT ON COLUMN public.auctions.closing_time_countdown_ms IS
  'Mirror of Basta sale.closingTimeCountdown (ms). Drives anti-snipe countdown on the buyer live screen.';
