import { createClient } from '@supabase/supabase-js';

// Server client - used in API routes
// Pass the user's JWT token so RLS policies work correctly
export function createServerClient(token?: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  if (token) {
    client.auth.setSession({ access_token: token, refresh_token: '' });
  }
  return client;
}