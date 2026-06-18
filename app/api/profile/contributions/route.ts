import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { checkApiLimit } from "@/lib/ratelimit";
import type { ContributionType } from "@/types/database";

const VALID_TYPES: ContributionType[] = [
  "Article",
  "Mix",
  "Interview",
  "Feature",
  "Photo essay",
];

// ── GET /api/profile/contributions ────────────────────────────────────────────
// Returns the authenticated user's own contributions (approved + drafts).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to fetch contributions" }, { status: 500 });
  }

  return Response.json(data);
}

// ── POST /api/profile/contributions ──────────────────────────────────────────
// Submits a new contribution (always starts as unapproved draft).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkApiLimit(userId);
  if (!limit.ok) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, title, url, is_external, published_at } = body;

  // Validate type
  if (!type || !VALID_TYPES.includes(type as ContributionType)) {
    return Response.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 422 }
    );
  }

  // Validate title
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return Response.json(
      { error: "title must be at least 3 characters" },
      { status: 422 }
    );
  }

  // Validate URL if external
  if (is_external && !url) {
    return Response.json(
      { error: "url is required for external contributions" },
      { status: 422 }
    );
  }

  if (url && typeof url === "string") {
    try {
      new URL(url); // Throws if malformed
    } catch {
      return Response.json({ error: "url must be a valid URL" }, { status: 422 });
    }
  }

  const { data, error } = await supabase
    .from("contributions")
    .insert({
      author_id: userId,
      type: type as ContributionType,
      title: String(title).trim().slice(0, 500),
      url: url ? String(url) : null,
      is_external: Boolean(is_external),
      published_at: published_at ? String(published_at) : null,
      approved: false, // Always starts unapproved — moderator must review
    })
    .select()
    .single();

  if (error) {
    console.error("Contribution insert error:", error);
    return Response.json({ error: "Failed to submit contribution" }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}

// ── DELETE /api/profile/contributions?id=uuid ─────────────────────────────────
// Authors can delete their own unapproved contributions.
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id query param required" }, { status: 400 });
  }

  // RLS policy: authors can only delete their own unapproved contributions
  const { error } = await supabase
    .from("contributions")
    .delete()
    .eq("id", id)
    .eq("author_id", userId)
    .eq("approved", false); // Cannot delete approved work

  if (error) {
    return Response.json({ error: "Failed to delete contribution" }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
