import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const handle = new URL(req.url).searchParams.get("handle")?.trim();
  if (!handle || !/^[a-z0-9-]{2,30}$/.test(handle)) {
    return Response.json({ available: false, error: "Invalid handle" });
  }

  const admin = getAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("clerk_id")
    .eq("handle", handle)
    .single();

  // Available if no row exists, or the row belongs to the current user
  const available = !data || data.clerk_id === userId;
  return Response.json({ available });
}
