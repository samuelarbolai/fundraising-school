ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS prompt_version text DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS last_interacted_at timestamp DEFAULT now();

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sequence integer,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS token_usage jsonb,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

UPDATE conversations
SET prompt_version = COALESCE(prompt_version, 'v1');

CREATE TABLE IF NOT EXISTS ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  conversation_id uuid REFERENCES conversations(id),
  event_type text NOT NULL,
  status text NOT NULL,
  model text,
  latency_ms integer,
  token_usage jsonb,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_events_conversation_idx ON ai_events (conversation_id);
CREATE INDEX IF NOT EXISTS ai_events_created_idx ON ai_events (created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_sequence_idx ON messages (conversation_id, sequence);
