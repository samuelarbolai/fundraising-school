import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './app/lib/db/schema.js',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_POSTGRES_URL,
  },
});
