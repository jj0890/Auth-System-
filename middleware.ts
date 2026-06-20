import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In dev/test with placeholder keys, skip Clerk entirely so the server runs
const isPlaceholderKey =
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_placeholder";

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/profile/(.*)",      // Public profile pages are readable
  "/api/(.*)",          // API routes handle their own auth checks
  "/api/music/(.*)",    // Album search is public (proxied, rate-limited)
  "/api/webhooks/(.*)", // Clerk webhooks must be public (verified by signature)
]);

// Routes only moderators can access (enforced additionally at route level)
const isModRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

// Bypass export for placeholder/test environments
export default isPlaceholderKey
  ? function devMiddleware(_req: NextRequest) { return NextResponse.next(); }
  : clerkMiddleware(async (auth, request: NextRequest) => {
  // Protect all non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();

  // Block direct browser access to internal API routes from other origins
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const isWebhook = request.nextUrl.pathname.startsWith("/api/webhooks/");

    // Webhooks come from Clerk's servers — no origin check needed (signature-verified instead)
    if (!isWebhook && origin) {
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_SITE_URL,
        "http://localhost:3000",
      ].filter(Boolean);

      if (!allowedOrigins.some((o) => origin.startsWith(o!))) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  return response;
// Close the conditional clerkMiddleware (only used when not placeholder)
});

export const config = {
  matcher: [
    // Run on all routes except static files and Next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
