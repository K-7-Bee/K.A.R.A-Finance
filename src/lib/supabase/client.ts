import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Supabase client for Client Components, acting as the signed-in user. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
