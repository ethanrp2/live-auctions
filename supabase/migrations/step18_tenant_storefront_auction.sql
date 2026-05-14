-- Allow sellers to choose which auction appears on the tenant storefront.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS storefront_auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenants_storefront_auction_id_idx
  ON tenants(storefront_auction_id);
