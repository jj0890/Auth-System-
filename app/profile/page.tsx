// After sign-in, redirect the user to their own profile.
// If they haven't set a handle yet, send them to setup.
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";

export default async function ProfileRedirect() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("handle")
    .eq("clerk_id", userId)
    .single();

  if (!data?.handle) redirect("/profile/setup");
  redirect(`/profile/${data.handle}`);
}
