-- step16_lots_live_status_closing.sql
-- M2: allow 'closing' and 'closed' as live_status values for lots.
--
-- Basta emits five ItemStatus enum values — UNPUBLISHED, PUBLISHED, OPEN,
-- CLOSING, CLOSED — and our ItemsStatusChanged handler maps them to our
-- lots.live_status column. The prior check constraint only allowed
-- ('upcoming', 'live', 'sold', 'passed'), which didn't include CLOSING or
-- CLOSED. Expand it so the webhook handler can record those transitions.
--
-- 'sold' and 'passed' remain console-driven (seller actions, M4). Basta
-- doesn't know about them.

alter table public.lots
  drop constraint if exists lots_live_status_check;

alter table public.lots
  add constraint lots_live_status_check
  check (
    live_status is null
    or live_status = any (array[
      'upcoming',
      'live',
      'closing',
      'closed',
      'sold',
      'passed'
    ])
  );
