import { createClient } from "@supabase/supabase-js";

/**
 * Read-only anon client for server components (§11.3: "The Board renders server-side (RSC)
 * with a snapshot. Realtime attaches after hydration."). This is the anon-key path only — RLS
 * on the Supabase side is what actually gates access, not this client. A missing env var
 * (Supabase project not configured in this environment) returns null rather than throwing, so a
 * page can fall back to its fixture instead of crashing the whole route.
 */
export function supabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
