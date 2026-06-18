import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: { handle: string };
}

// Generate OG metadata from the profile
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("handle", params.handle)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "Profile not found" };

  return {
    title: `${data.display_name} — ${process.env.NEXT_PUBLIC_SITE_NAME}`,
    description: data.bio ?? undefined,
    openGraph: {
      images: data.avatar_url ? [data.avatar_url] : [],
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  // Fetch profile (RLS: only returns is_public = true)
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", params.handle)
    .eq("is_public", true)
    .single();

  if (!profile) notFound();

  // Fetch albums and approved contributions in parallel
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

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1rem" }}>
      <section aria-label="Profile header">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={`${profile.display_name} profile photo`}
            width={80}
            height={80}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        )}
        <h1>{profile.display_name}</h1>
        {profile.role_label && <p>{profile.role_label}</p>}
        {profile.bio && <p>{profile.bio}</p>}

        {Array.isArray(profile.links) && profile.links.length > 0 && (
          <ul aria-label="Links">
            {profile.links.map((link: { label: string; url: string }, i: number) => (
              <li key={i}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {albums && albums.length > 0 && (
        <section aria-label="Favourite albums">
          <h2>Taste</h2>
          <ol>
            {albums.map((album) => (
              <li key={album.id}>
                {album.cover_url && (
                  <img
                    src={album.cover_url}
                    alt={`${album.title} album art`}
                    width={60}
                    height={60}
                  />
                )}
                <span>{album.title}</span> — <span>{album.artist}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {contributions && contributions.length > 0 && (
        <section aria-label="Contributions">
          <h2>Work</h2>
          <ul>
            {contributions.map((c) => (
              <li key={c.id}>
                <span>{c.type}</span>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.title}
                  </a>
                ) : (
                  <span>{c.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
