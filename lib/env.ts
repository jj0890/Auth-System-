// Validated at module load time — crashes the server at startup if misconfigured,
// not silently at runtime when a user hits an endpoint.

const required = {
  // Safe to expose
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,

  // Server-only — these must never appear in NEXT_PUBLIC_ form
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
} as const;

// Only validate server-side vars on the server
if (typeof window === "undefined") {
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    const isDev = process.env.NODE_ENV === "development";
    const isPlaceholder = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_placeholder";

    if (isDev && isPlaceholder) {
      console.warn(
        `[dev] Running with placeholder env vars — real API calls will fail.\nMissing: ${missing.join(", ")}`
      );
    } else {
      throw new Error(
        `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nCopy .env.example to .env.local and fill in the values.`
      );
    }
  }
}

export const env = required as Record<keyof typeof required, string>;
