import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { checkApiLimit } from "@/lib/ratelimit";

// ── GET /api/profile/albums ───────────────────────────────────────────────────
// Returns the authenticated user's album picks (all 5 slots).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profile_albums")
    .select("*")
    .eq("clerk_id", userId)
    .order("rank");

  if (error) {
    return Response.json({ error: "Failed to fetch albums" }, { status: 500 });
  }

  return Response.json(data);
}

// ── PUT /api/profile/albums ───────────────────────────────────────────────────
// Upserts one album slot. Body: { rank, mb_id, title, artist, year, cover_url }
export async function PUT(req: Request) {
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

  const { rank, mb_id, title, artist, year, cover_url } = body;

  // Validate
  if (typeof rank !== "number" || rank < 1 || rank > 5) {
    return Response.json({ error: "rank must be 1–5" }, { status: 422 });
  }
  if (!mb_id || typeof mb_id !== "string") {
    return Response.json({ error: "mb_id is required" }, { status: 422 });
  }
  if (!title || typeof title !== "string") {
    return Response.json({ error: "title is required" }, { status: 422 });
  }
  if (!artist || typeof artist !== "string") {
    return Response.json({ error: "artist is required" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("profile_albums")
    .upsert(
      {
        clerk_id: userId,
        rank,
        mb_id: String(mb_id),
        title: String(title).slice(0, 200),
        artist: String(artist).slice(0, 200),
        year: year ? String(year).slice(0, 4) : null,
        cover_url: cover_url ? String(cover_url) : null,
      },
      { onConflict: "clerk_id,rank" }
    )
    .select()
    .single();

  if (error) {
    console.error("Album upsert error:", error);
    return Response.json({ error: "Failed to save album" }, { status: 500 });
  }

  return Response.json(data);
}

// ── DELETE /api/profile/albums?rank=N ────────────────────────────────────────
// Removes one album slot.
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rank = Number(new URL(req.url).searchParams.get("rank"));

  if (!rank || rank < 1 || rank > 5) {
    return Response.json({ error: "rank query param must be 1–5" }, { status: 422 });
  }

  const { error } = await supabase
    .from("profile_albums")
    .delete()
    .eq("clerk_id", userId)
    .eq("rank", rank);

  if (error) {
    return Response.json({ error: "Failed to delete album" }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
