import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";

const VALID_TYPES = ["Article", "Mix", "Interview", "Feature", "Photo essay"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const { type, title, url, published_at } = body;
  if (type && !VALID_TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });
  if (title !== undefined && !title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("contributions")
    .update({
      ...(type && { type }),
      ...(title && { title: title.trim() }),
      url: url?.trim() || null,
      ...(published_at !== undefined && { published_at: published_at || null }),
    })
    .eq("id", id)
    .eq("author_id", userId)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getAdminClient();
  const { error } = await admin
    .from("contributions")
    .delete()
    .eq("id", id)
    .eq("author_id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
