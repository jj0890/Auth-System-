import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Browser / client-side client ────────────────────────────────────────────
// Uses the anon key. Fully governed by RLS policies.
// Safe to create on the client — this key is intentionally public.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ─── Server-side admin client ─────────────────────────────────────────────────
// Uses the service role key. BYPASSES ALL RLS POLICIES.
// Only import this in server files (API routes, Server Actions, webhooks).
// Never assign to a variable named anything that could end up client-side.
export function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This function must only be called server-side."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Admin client should never persist sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
