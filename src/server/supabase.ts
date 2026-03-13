import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY.';

export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
