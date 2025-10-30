CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agents_slug_idx ON agents (slug);

INSERT INTO agents (slug, name, description)
VALUES
  ('sales-coach', 'Sales Coach', 'Brutally honest sales coach (Sebas) who diagnoses founder sales fundamentals.'),
  ('friendly-vc-analyst', 'Friendly VC Analyst', 'Friendly VC analyst who screens startups for 30x Venture Capital due diligence.')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS agent_slug text;
UPDATE prompts SET agent_slug = COALESCE(agent_slug, 'sales-coach');
ALTER TABLE prompts ALTER COLUMN agent_slug SET NOT NULL;
DROP INDEX IF EXISTS prompts_version_idx;
CREATE UNIQUE INDEX IF NOT EXISTS prompts_agent_version_idx ON prompts (agent_slug, version);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_slug text DEFAULT 'sales-coach';
UPDATE conversations SET agent_slug = COALESCE(agent_slug, 'sales-coach');
ALTER TABLE conversations ALTER COLUMN agent_slug SET NOT NULL;

CREATE TABLE IF NOT EXISTS agent_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  agent_slug text NOT NULL,
  summary text NOT NULL,
  fit_label text,
  company_name text,
  founder_name text,
  founder_email text,
  founder_phone text,
  connectors text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

INSERT INTO prompts (agent_slug, version, content, created_by_email)
SELECT 'friendly-vc-analyst', 'v1', $$You are the Friendly VC Analyst for the 30x Venture Capital fund. During chat you must:

1. Collect the essential diligence profile: company name, HQ/country, product description, traction metrics (users/revenue/growth), fundraising status, founder full name, founder email, founder phone, notable risks, and potential warm introductions (VCs or operators).
2. Ask follow-up questions until you can confidently fill every field above. If the founder is unsure, push for best estimate or flag as unknown.
3. When ready to summarise, respond with clear sections:
   - Summary (2 sentences)
   - Fit (Strong Fit | Promising | Monitor | Not a Fit + short justification)
   - Metrics & Proof
   - Risks
   - 30x Next Step
   - Warm Intros to Consider (bulleted)

Keep the tone analytical and pragmatic. If critical data is missing, explicitly request it before finalising your summary.$$ , 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM prompts WHERE agent_slug = 'friendly-vc-analyst' AND version = 'v1');

INSERT INTO ai_events (request_id, event_type, status, metadata)
VALUES (gen_random_uuid()::text, 'agent_seeded', 'success', jsonb_build_object('agent', 'friendly-vc-analyst', 'version', 'v1'));
