import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ handle: string }>;
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  Article: "bg-ink text-paper",
  Mix: "bg-stone-700 text-paper",
  Interview: "bg-stone-500 text-paper",
  Feature: "bg-stone-400 text-ink",
  "Photo essay": "bg-card text-ink",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const { data } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("handle", handle)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "Profile not found" };

  return {
    title: `${data.display_name} — The Edit`,
    description: data.bio ?? undefined,
    openGraph: { images: data.avatar_url ? [data.avatar_url] : [] },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const { userId } = await auth();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", handle)
    .eq("is_public", true)
    .single();

  if (!profile) notFound();
  const isOwner = userId === (profile as any).clerk_id;

  const [{ data: albums }, { data: contributions }] = await Promise.all([
    supabase
      .from("profile_albums")
      .select("*")
      .eq("clerk_id", profile.clerk_id)
      .order("rank"),
    supabase
      .from("contributions")
      .select("*")
      .eq("author_id", profile.clerk_id)
      .eq("approved", true)
      .order("created_at", { ascending: false }),
  ]);

  const contributionCount = contributions?.length ?? 0;

  return (
    <div className="min-h-screen bg-paper">
      {/* Site header */}
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Edit
        </Link>
        {userId && userId === profile.clerk_id ? (
          <Link href="/profile/setup" className="label hover:text-ink transition-colors">
            Edit profile
          </Link>
        ) : (
          <Link href="/sign-in" className="label hover:text-ink transition-colors">
            Sign in
          </Link>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Profile card */}
        <section className="flex gap-8 items-start mb-12 pb-12 border-b border-rule">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${profile.display_name} photo`}
                className="w-24 h-24 object-cover grayscale"
              />
            ) : (
              <div className="w-24 h-24 bg-card border border-rule flex items-center justify-center">
                <span className="label">{profile.display_name?.[0] ?? "?"}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="label mb-1">
              {(profile.role_labels?.length ? profile.role_labels : ["Contributor"]).join(" · ")}
            </p>
            <h1
              className="text-3xl font-normal mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {profile.display_name}
            </h1>
            {profile.bio && (
              <p className="text-sm text-muted leading-relaxed mb-4 max-w-prose">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-5">
              <span className="label">{contributionCount} contribution{contributionCount !== 1 ? "s" : ""}</span>

              {Array.isArray(profile.links) && profile.links.map((link: { label: string; url: string }, i: number) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label underline underline-offset-2 hover:text-ink transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Top 5 Albums — always visible */}
        <section className="mb-14">
          <div className="flex items-baseline gap-4 mb-5">
            <h2 className="text-xl font-normal" style={{ fontFamily: "var(--font-display)" }}>
              Taste
            </h2>
            <span className="label">Top 5 albums</span>
            {isOwner && (
              <Link href="/profile/setup" className="label text-muted underline underline-offset-2 hover:text-ink transition-colors ml-auto">
                {albums && albums.length > 0 ? "Edit" : "Add albums"}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((rank) => {
              const album = albums?.find((a) => a.rank === rank);
              return album ? (
                <div key={rank} className="group">
                  <div className="aspect-square bg-card border border-rule overflow-hidden mb-2">
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={`${album.title} by ${album.artist}`}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                        <span className="text-muted text-[10px] leading-tight">{album.title}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium leading-tight truncate">{album.title}</p>
                  <p className="text-[10px] text-muted truncate">{album.artist}</p>
                </div>
              ) : (
                <div key={rank}>
                  {isOwner ? (
                    <Link href="/profile/setup" className="block aspect-square border border-dashed border-rule hover:border-ink hover:bg-card transition-colors flex items-center justify-center mb-2">
                      <span className="label text-muted/50">+</span>
                    </Link>
                  ) : (
                    <div className="aspect-square border border-dashed border-rule/50 mb-2" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Contributions — NTS-style grid */}
        {contributions && contributions.length > 0 && (
          <section>
            <div className="flex items-baseline gap-4 mb-5">
              <h2
                className="text-xl font-normal"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Work
              </h2>
              <span className="label">{contributionCount} piece{contributionCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-rule">
              {contributions.map((c) => (
                <div key={c.id} className="bg-paper p-5 flex flex-col gap-3">
                  <span
                    className={`label inline-block self-start px-2 py-0.5 ${CONTENT_TYPE_COLORS[c.type] ?? "bg-card text-ink"}`}
                  >
                    {c.type}
                  </span>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium leading-snug hover:underline underline-offset-2"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {c.title}
                    </a>
                  ) : (
                    <span
                      className="text-sm font-medium leading-snug"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {c.title}
                    </span>
                  )}
                  {c.published_at && (
                    <span className="label mt-auto">
                      {new Date(c.published_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {contributions?.length === 0 && albums?.length === 0 && (
          <p className="text-muted text-sm text-center py-16">Nothing here yet.</p>
        )}
      </main>

      <footer className="border-t border-rule px-6 py-5 mt-16">
        <span className="label">The Edit</span>
      </footer>
    </div>
  );
}
