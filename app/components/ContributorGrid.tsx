"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Album {
  rank: number;
  cover_url: string | null;
  title: string;
  artist: string;
}

interface Profile {
  clerk_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  role_labels: string[];
  bio: string | null;
  albums: Album[];
}

const ALL_ROLES = ["All", "Writer", "DJ", "Photographer", "Editor", "Director", "Producer", "Stylist"];

export default function ContributorGrid({ profiles }: { profiles: Profile[] }) {
  const [activeRole, setActiveRole] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      const matchesRole =
        activeRole === "All" ||
        p.role_labels?.some((r) => r.toLowerCase() === activeRole.toLowerCase());
      const matchesQuery =
        !query ||
        p.display_name.toLowerCase().includes(query.toLowerCase()) ||
        p.role_labels?.some((r) => r.toLowerCase().includes(query.toLowerCase()));
      return matchesRole && matchesQuery;
    });
  }, [profiles, activeRole, query]);

  // Collect roles that actually appear in the data
  const presentRoles = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.role_labels?.forEach((r) => set.add(r)));
    return ALL_ROLES.filter((r) => r === "All" || set.has(r));
  }, [profiles]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
        {/* Role filter tabs */}
        <div className="flex flex-wrap gap-2">
          {presentRoles.map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`label px-3 py-1 border transition-colors ${
                activeRole === role
                  ? "border-ink bg-ink text-paper"
                  : "border-rule hover:border-ink"
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search contributors…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="label border border-rule px-3 py-1.5 bg-transparent placeholder:text-muted focus:outline-none focus:border-ink transition-colors w-full sm:w-52"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-muted text-sm text-center py-24">No contributors found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-rule">
          {filtered.map((profile) => (
            <Link
              key={profile.clerk_id}
              href={`/profile/${profile.handle}`}
              className="bg-paper p-4 flex flex-col gap-3 hover:bg-card transition-colors group"
            >
              {/* Avatar */}
              <div className="aspect-square bg-card border border-rule overflow-hidden">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span
                      className="text-2xl text-muted"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {profile.display_name?.[0] ?? "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + roles */}
              <div>
                <p
                  className="text-sm font-normal leading-tight mb-1 group-hover:underline underline-offset-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {profile.display_name}
                </p>
                <p className="label text-muted truncate">
                  {profile.role_labels?.length
                    ? profile.role_labels.join(" · ")
                    : "Contributor"}
                </p>
              </div>

              {/* Album taste strip */}
              {profile.albums?.length > 0 && (
                <div className="flex gap-1 mt-auto">
                  {profile.albums.slice(0, 3).map((album, i) =>
                    album.cover_url ? (
                      <div key={i} className="w-8 h-8 bg-card border border-rule overflow-hidden shrink-0">
                        <img
                          src={album.cover_url}
                          alt={album.title}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <p className="label text-muted mt-6 text-center">
        {filtered.length} contributor{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
