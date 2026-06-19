import { auth } from "@clerk/nextjs/server";
import { getAdminClient, supabase } from "@/lib/supabase";
import { checkApiLimit } from "@/lib/ratelimit";

// ── GET /api/profile ──────────────────────────────────────────────────────────
// Returns the authenticated user's own profile (including private data).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkApiLimit(userId);
  if (!limit.ok) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: limit.headers });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  if (error) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  return Response.json(data, { headers: limit.headers });
}

// ── PATCH /api/profile ────────────────────────────────────────────────────────
// Updates the authenticated user's own profile.
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkApiLimit(userId);
  if (!limit.ok) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: limit.headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Whitelist only the fields users are allowed to update.
  // clerk_id, email, created_at are never user-editable.
  const allowed = ["display_name", "handle", "role_label", "bio", "links", "is_public"] as const;
  const update: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields provided" }, { status: 400 });
  }

  // Validate handle format if provided
  if (update.handle !== undefined) {
    const handle = String(update.handle);
    if (!/^[a-z0-9-]{2,30}$/.test(handle)) {
      return Response.json(
        { error: "Handle must be 2–30 lowercase letters, numbers, or hyphens" },
        { status: 422 }
      );
    }
  }

  // Validate links array if provided
  if (update.links !== undefined) {
    const links = update.links as unknown[];
    if (!Array.isArray(links) || links.length > 10) {
      return Response.json({ error: "Links must be an array of up to 10 items" }, { status: 422 });
    }
    for (const link of links) {
      if (
        typeof link !== "object" ||
        link === null ||
        typeof (link as any).label !== "string" ||
        typeof (link as any).url !== "string"
      ) {
        return Response.json(
          { error: "Each link must have a label and url string" },
          { status: 422 }
        );
      }
    }
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update(update)
    .eq("clerk_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Handle already taken" }, { status: 409 });
    }
    console.error("Profile update error:", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json(data, { headers: limit.headers });
}
