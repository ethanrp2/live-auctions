-- step12_money_units_cleanup.sql
-- See: docs/memory/decisions/ADR-002-money-in-cents.md
--
-- Canonicalize money units: all lot money columns are integer cents.
-- Audit first: if any row has money_in_cents=false, fail loudly so a human
-- converts deliberately (multiplying by 100 silently would be dangerous).
-- On 2026-04-21 the audit passed for all 24 rows, so this migration is
-- effectively just the DROP COLUMN plus the safety assertion.

DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.lots
   WHERE money_in_cents = false;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'step12 aborted: % lot rows still have money_in_cents=false. '
      'Convert them before dropping the column. '
      'See docs/memory/decisions/ADR-002-money-in-cents.md.',
      bad_count;
  END IF;
END$$;

ALTER TABLE public.lots
  DROP COLUMN money_in_cents;
