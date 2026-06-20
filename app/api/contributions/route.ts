import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";

const VALID_TYPES = ["Article", "Mix", "Interview", "Feature", "Photo essay"] as const;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("contributions")
    .select("*")
    .eq("author_id", userId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const { type, title, url, published_at } = body;

  if (!VALID_TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });
  if (!title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("contributions")
    .insert({
      author_id: userId,
      type,
      title: title.trim(),
      url: url?.trim() || null,
      published_at: published_at || null,
      approved: true,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
