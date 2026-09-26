import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// UI tests run in jsdom against an in-memory fake of the Supabase client
// (src/test/fakeSupabase.js). Database logic is tested separately with
// `npm run test:db` (PGlite, supabase/tests/run.mjs).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
    css: false,
    env: { VITE_SUPABASE_URL: 'https://fake.supabase.co', VITE_SUPABASE_ANON_KEY: 'fake-anon-key' },
  },
});
