import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      // Allow avatars from Supabase Storage + album art from Cover Art Archive
      "img-src 'self' data: blob: https://*.supabase.co https://coverartarchive.org https://archive.org",
      "font-src 'self'",
      // API connections: Supabase, Clerk, MusicBrainz (proxied server-side, but listed for completeness)
      "connect-src 'self' https://*.supabase.co https://api.clerk.com https://*.clerk.accounts.dev wss://*.supabase.co",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Supabase Storage for avatars
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Cover Art Archive for album art
      {
        protocol: "https",
        hostname: "coverartarchive.org",
      },
      {
        protocol: "https",
        hostname: "archive.org",
      },
    ],
  },
  // Sharp is used server-side only for image processing
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
