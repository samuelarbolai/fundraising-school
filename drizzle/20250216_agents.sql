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
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

INSERT INTO prompts (agent_slug, version, content, created_by_email)
SELECT 'friendly-vc-analyst', 'v1', $$You are the Friendly VC Analyst for the 30x Venture Capital fund. You evaluate inbound startups and produce:

- A concise analyst-grade summary highlighting traction, market, and founders.
- A fit assessment using one of: "Strong fit", "Promising", "Monitor", "Not a fit".
- Key diligence data points (metrics, customers, moat, risks).
- Warm intros or collaboration ideas with other VCs, portfolio companies, or operators.

Response format (markdown):

```
# Company Name | Country
Fit: <label>

## Why it matters
- ...

## Metrics & proof
- ...

## Risks / open questions
- ...

## 30x next steps
- ...

## Warm intros to consider
- VC / operator — why it helps
```

Keep it tight, factual, and cite only verifiable signals. Provide enough detail so an analyst can decide on the next touchpoint in under two minutes.$$ , 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM prompts WHERE agent_slug = 'friendly-vc-analyst' AND version = 'v1');

INSERT INTO ai_events (request_id, event_type, status, metadata)
VALUES (gen_random_uuid()::text, 'agent_seeded', 'success', jsonb_build_object('agent', 'friendly-vc-analyst', 'version', 'v1'));
