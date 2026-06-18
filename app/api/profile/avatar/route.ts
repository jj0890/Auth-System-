import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";
import { uploadRateLimit } from "@/lib/ratelimit";
import sharp from "sharp";

const BUCKET = "avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 6000;
const OUTPUT_SIZE = 300;   // Final avatar px
const THUMB_SIZE = 80;     // Thumbnail px

// ── POST /api/profile/avatar ──────────────────────────────────────────────────
// Accepts a multipart upload, validates, resizes, and places in the pending
// folder. A moderator must approve before the public avatar URL updates.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit uploads: 5 per hour per user
  const { success } = await uploadRateLimit.limit(userId);
  if (!success) {
    return Response.json(
      { error: "Upload limit reached. Try again in an hour." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  // ── 1. Server-side size check ─────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File must be under 5 MB" }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── 2. Validate it's actually an image (sharp decodes the bytes) ──────────
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return Response.json(
      { error: "File could not be read as an image" },
      { status: 422 }
    );
  }

  if (!metadata.width || !metadata.height) {
    return Response.json({ error: "Could not determine image dimensions" }, { status: 422 });
  }

  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    return Response.json(
      { error: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px` },
      { status: 422 }
    );
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    return Response.json(
      { error: `Image must be no larger than ${MAX_DIMENSION}×${MAX_DIMENSION}px` },
      { status: 422 }
    );
  }

  // ── 3. Resize and convert to WebP ─────────────────────────────────────────
  const [resized, thumbnail] = await Promise.all([
    sharp(buffer)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 90 })
      .toBuffer(),
    sharp(buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer(),
  ]);

  // ── 4. Upload to pending folder (not yet public) ───────────────────────────
  const supabase = getAdminClient();
  const timestamp = Date.now();
  const pendingPath = `pending/${userId}/avatar-${timestamp}.webp`;
  const thumbPath = `pending/${userId}/avatar-${timestamp}-thumb.webp`;

  const [uploadResult, thumbResult] = await Promise.all([
    supabase.storage
      .from(BUCKET)
      .upload(pendingPath, resized, { contentType: "image/webp", upsert: true }),
    supabase.storage
      .from(BUCKET)
      .upload(thumbPath, thumbnail, { contentType: "image/webp", upsert: true }),
  ]);

  if (uploadResult.error || thumbResult.error) {
    console.error("Storage upload error:", uploadResult.error ?? thumbResult.error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  // ── 5. Log in the moderation queue ───────────────────────────────────────
  const { data: queueEntry, error: queueError } = await supabase
    .from("avatar_uploads")
    .insert({
      clerk_id: userId,
      storage_path: pendingPath,
      status: "pending",
    })
    .select()
    .single();

  if (queueError) {
    console.error("Failed to log avatar upload:", queueError);
    // Non-fatal — don't block the user, but log it
  }

  return Response.json({
    queued: true,
    uploadId: queueEntry?.id ?? null,
    message: "Your photo is under review. It will appear on your profile once approved.",
  });
}
