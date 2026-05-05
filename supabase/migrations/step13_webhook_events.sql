-- step13_webhook_events.sql
-- M2: Basta webhook ingestion.
--
-- Basta sends webhook events with a per-event `idempotencyKey` (UUID). We
-- record every event we accept here so we can (a) dedupe redelivery and
-- (b) audit-trail every state transition that flowed from a webhook.
--
-- The handler writes a row with processed_at=NULL + error=NULL on receipt,
-- then updates processed_at=now() once the handler has run successfully, or
-- sets error=<message> if the handler threw. That way we can requeue failed
-- events without fear of double-processing successful ones.

create table if not exists public.webhook_events (
  -- Basta's idempotencyKey (a UUID string). PK so duplicates are a hard no.
  idempotency_key text primary key,

  -- "BidOnItem" | "SaleStatusChanged" | "ItemsStatusChanged" (per Basta docs)
  action_type text not null,

  -- Raw body, untouched. Source of truth for reprocessing.
  payload jsonb not null,

  -- When we received it (server time, not Basta's bidDate).
  received_at timestamptz not null default now(),

  -- Set by the handler on success. NULL = not yet applied.
  processed_at timestamptz,

  -- Populated if the handler threw. NULL = no error (or not yet attempted).
  error text,

  -- Denormalized for fast filtering in admin dashboards (`?saleId=...`).
  basta_sale_id text,
  basta_item_id text
);

comment on table public.webhook_events is
  'Inbound Basta webhook events. PK is Basta idempotencyKey so redelivery is a no-op.';

create index if not exists webhook_events_action_type_idx
  on public.webhook_events (action_type);

create index if not exists webhook_events_received_at_idx
  on public.webhook_events (received_at desc);

create index if not exists webhook_events_unprocessed_idx
  on public.webhook_events (received_at)
  where processed_at is null;

create index if not exists webhook_events_sale_id_idx
  on public.webhook_events (basta_sale_id)
  where basta_sale_id is not null;

-- RLS: service-role writes only. Admins can read via dashboard (Supabase
-- Studio uses service role). No public exposure.
alter table public.webhook_events enable row level security;

-- No policies = default-deny for anon/authenticated roles. Service role
-- bypasses RLS so the Fastify backend can insert/update.
