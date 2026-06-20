import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import ContributorGrid from "./components/ContributorGrid";

async function getMyHandle(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("handle")
    .eq("clerk_id", userId)
    .single();
  return data?.handle ?? null;
}

async function getContributors() {
  const [{ data: profiles }, { data: albums }] = await Promise.all([
    supabase
      .from("profiles")
      .select("clerk_id, handle, display_name, avatar_url, role_labels, bio")
      .eq("is_public", true)
      .order("display_name"),
    supabase
      .from("profile_albums")
      .select("clerk_id, rank, cover_url, title, artist")
      .lte("rank", 3)
      .order("rank"),
  ]);

  return (profiles ?? []).map((p) => ({
    ...p,
    role_labels: p.role_labels ?? [],
    albums: (albums ?? []).filter((a) => a.clerk_id === p.clerk_id),
  }));
}

export default async function Home() {
  const { userId } = await auth();
  const [contributors, myHandle] = await Promise.all([
    getContributors(),
    getMyHandle(userId),
  ]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Masthead */}
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <span className="label">Est. 2024</span>
        <h1
          className="text-3xl tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Edit
        </h1>
        <nav className="flex gap-5">
          {userId ? (
            <Link
              href={myHandle ? `/profile/${myHandle}` : "/profile/setup"}
              className="label hover:text-ink transition-colors"
            >
              My profile
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="label hover:text-ink transition-colors">
                Sign in
              </Link>
              <Link href="/sign-up" className="label hover:text-ink transition-colors">
                Join
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Slim hero */}
      <section className="border-b border-rule px-6 py-10 flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <p className="label mb-2">Contributors</p>
          <h2
            className="text-4xl md:text-5xl font-normal leading-[1.08]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where taste<br />
            <em>speaks for itself.</em>
          </h2>
        </div>
        {!userId && (
          <Link
            href="/sign-up"
            className="label border border-ink px-5 py-2.5 hover:bg-ink hover:text-paper transition-all duration-200 shrink-0"
          >
            Create a profile →
          </Link>
        )}
      </section>

      {/* Contributor grid */}
      <section className="flex-1 px-6 py-8">
        <ContributorGrid profiles={contributors} />
      </section>

      {/* Footer */}
      <footer className="border-t border-rule px-6 py-5 flex items-center justify-between">
        <span className="label">The Edit</span>
        <span className="label">Culture · Music · Fashion</span>
      </footer>
    </main>
  );
}
