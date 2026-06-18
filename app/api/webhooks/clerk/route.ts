import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase";

// Clerk webhooks must NOT be protected by auth middleware (they come from Clerk's servers).
// Security is entirely through svix signature verification below.
export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // ── 1. Verify svix signature ──────────────────────────────────────────────
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    // Verification failed — reject. Do not log the body (may contain PII).
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = getAdminClient();

  // ── 2. Handle user.created ────────────────────────────────────────────────
  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === evt.data.primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("user.created: no primary email for", id);
      return Response.json({ error: "No primary email" }, { status: 422 });
    }

    const displayName =
      [first_name, last_name].filter(Boolean).join(" ") || null;

    const { error } = await supabase.from("profiles").insert({
      clerk_id: id,
      email: primaryEmail.email_address,
      display_name: displayName,
    });

    if (error) {
      console.error("Failed to create profile for", id, error);
      // Return 500 so Clerk retries the webhook
      return Response.json({ error: "Profile creation failed" }, { status: 500 });
    }

    await supabase.from("audit_log").insert({
      action: "user_created",
      actor_id: null,
      target_id: id,
      metadata: { email: primaryEmail.email_address },
    });
  }

  // ── 3. Handle user.deleted (GDPR cascade) ────────────────────────────────
  if (evt.type === "user.deleted") {
    const { id } = evt.data;

    if (!id) {
      return Response.json({ error: "Missing user ID" }, { status: 422 });
    }

    // Delete storage files first (before DB rows, so we have the paths)
    const folders = [`avatars/approved/${id}`, `avatars/pending/${id}`];

    for (const folder of folders) {
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(folder.replace("avatars/", ""));

      if (files && files.length > 0) {
        const paths = files.map((f) => `${folder.replace("avatars/", "")}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }
    }

    // Cascade delete DB rows (FK on delete cascade handles children,
    // but we delete explicitly to generate audit entries)
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("clerk_id", id);

    if (profileError) {
      console.error("Failed to delete profile for", id, profileError);
      return Response.json({ error: "Delete failed" }, { status: 500 });
    }

    // Append-only audit record — survives the user deletion for compliance
    await supabase.from("audit_log").insert({
      action: "user_deleted",
      actor_id: null,
      target_id: id,
      metadata: { deleted_at: new Date().toISOString() },
    });
  }

  // ── 4. Handle user.updated (email change) ────────────────────────────────
  if (evt.type === "user.updated") {
    const { id, email_addresses, primary_email_address_id } = evt.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    );

    if (primaryEmail) {
      await supabase
        .from("profiles")
        .update({ email: primaryEmail.email_address })
        .eq("clerk_id", id);
    }
  }

  return Response.json({ received: true });
}
