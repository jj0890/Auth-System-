import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";

const BUCKET = "avatars";

// ── POST /api/admin/avatar/approve ────────────────────────────────────────────
// Moderator-only: approves or rejects a pending avatar upload.
// On approval: moves file from pending/ to approved/, updates profile avatar_url.
// On rejection: deletes the pending file, notifies via status update.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();

  // Verify the caller is a moderator
  const { data: mod } = await supabase
    .from("moderators")
    .select("id")
    .eq("clerk_id", userId)
    .eq("active", true)
    .single();

  if (!mod) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { uploadId: string; action: "approve" | "reject"; reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { uploadId, action, reason } = body;

  if (!uploadId || !["approve", "reject"].includes(action)) {
    return Response.json(
      { error: "uploadId and action ('approve' | 'reject') are required" },
      { status: 422 }
    );
  }

  // Fetch the upload record
  const { data: upload, error: fetchError } = await supabase
    .from("avatar_uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("status", "pending")
    .single();

  if (fetchError || !upload) {
    return Response.json({ error: "Upload not found or already reviewed" }, { status: 404 });
  }

  const { clerk_id, storage_path } = upload;

  if (action === "approve") {
    // Move file from pending/ to approved/
    const approvedPath = storage_path.replace("pending/", "approved/");
    const thumbPath = storage_path.replace(".webp", "-thumb.webp");
    const approvedThumbPath = thumbPath.replace("pending/", "approved/");

    const [copyResult, copyThumbResult] = await Promise.all([
      supabase.storage.from(BUCKET).copy(storage_path, approvedPath),
      supabase.storage.from(BUCKET).copy(thumbPath, approvedThumbPath),
    ]);

    if (copyResult.error) {
      console.error("Failed to copy approved avatar:", copyResult.error);
      return Response.json({ error: "Approval failed" }, { status: 500 });
    }

    // Delete pending files
    await supabase.storage.from(BUCKET).remove([storage_path, thumbPath]);

    // Build public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(approvedPath);

    // Update profile avatar_url
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("clerk_id", clerk_id);

    // Update queue entry
    await supabase
      .from("avatar_uploads")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        storage_path: approvedPath,
      })
      .eq("id", uploadId);

    // Audit
    await supabase.from("audit_log").insert({
      action: "avatar_approved",
      actor_id: userId,
      target_id: clerk_id,
      metadata: { upload_id: uploadId, path: approvedPath },
    });

    return Response.json({ approved: true, avatarUrl: publicUrl });
  }

  // action === "reject"
  await supabase.storage.from(BUCKET).remove([
    storage_path,
    storage_path.replace(".webp", "-thumb.webp"),
  ]);

  await supabase
    .from("avatar_uploads")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      flagged_reason: reason ?? null,
    })
    .eq("id", uploadId);

  await supabase.from("audit_log").insert({
    action: "avatar_rejected",
    actor_id: userId,
    target_id: clerk_id,
    metadata: { upload_id: uploadId, reason },
  });

  return Response.json({ rejected: true });
}
