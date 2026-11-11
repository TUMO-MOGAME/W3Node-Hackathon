import "server-only";
/**
 * Server-only Supabase client using the service-role key (bypasses RLS; never shipped to the browser).
 * Returns null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing, so callers fall back to memory.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
