ALTER TABLE agent_outputs
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS founder_name text,
  ADD COLUMN IF NOT EXISTS founder_email text,
  ADD COLUMN IF NOT EXISTS founder_phone text,
  ADD COLUMN IF NOT EXISTS connectors text;
