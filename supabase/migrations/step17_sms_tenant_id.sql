-- Add tenant_id to sms_subscribers for proper multi-tenant scoping
ALTER TABLE sms_subscribers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS sms_subscribers_tenant_id_idx ON sms_subscribers(tenant_id);
