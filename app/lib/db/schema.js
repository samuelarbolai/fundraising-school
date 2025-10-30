import { pgTable, text, timestamp, uuid, pgSchema, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  title: text('title'),
  promptVersion: text('prompt_version').default('v1'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastInteractedAt: timestamp('last_interacted_at').defaultNow(),
  agentSlug: text('agent_slug').default('sales-coach'),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  role: text('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  sequence: integer('sequence'),
  model: text('model'),
  tokenUsage: jsonb('token_usage'),
  latencyMs: integer('latency_ms'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const aiEvents = pgTable('ai_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: text('request_id').notNull(),
  userId: uuid('user_id').references(() => users.id),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  eventType: text('event_type').notNull(),
  status: text('status').notNull(),
  model: text('model'),
  latencyMs: integer('latency_ms'),
  tokenUsage: jsonb('token_usage'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  email: text('email').primaryKey(),
  role: text('role').default('admin'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  slugIdx: uniqueIndex('agents_slug_idx').on(table.slug),
}));

export const prompts = pgTable('prompts', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentSlug: text('agent_slug').notNull(),
  version: text('version').notNull(),
  content: text('content').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdByEmail: text('created_by_email'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  promptsAgentVersionIdx: uniqueIndex('prompts_agent_version_idx').on(table.agentSlug, table.version),
}));

export const agentOutputs = pgTable('agent_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  agentSlug: text('agent_slug').notNull(),
  summary: text('summary').notNull(),
  fitLabel: text('fit_label'),
  companyName: text('company_name'),
  founderName: text('founder_name'),
  founderEmail: text('founder_email'),
  founderPhone: text('founder_phone'),
  connectors: text('connectors'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});
