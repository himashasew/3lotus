import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// The anon key is public by design; access is enforced by row level security (supabase/schema.sql).
export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key',
);
