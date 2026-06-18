import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// MusicBrainz requires a descriptive User-Agent with contact info.
// Without it your IP is throttled to 50 req/sec globally and can be banned.
const USER_AGENT = `${process.env.NEXT_PUBLIC_SITE_NAME}/1.0 (+${process.env.NEXT_PUBLIC_SITE_URL})`;

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";

// One Redis-backed rate limiter: 1 request per second to MusicBrainz.
// Shared across all serverless function instances.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const mbRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "1 s"),
  prefix: "mb:ratelimit",
});

async function mbFetch(path: string): Promise<Response> {
  const { success } = await mbRateLimit.limit("global");

  if (!success) {
    // Back off and retry once after 1.1 seconds
    await new Promise((r) => setTimeout(r, 1100));
  }

  return fetch(`${MB_BASE}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 * 7 }, // Next.js fetch cache: 7 days
  });
}

export interface AlbumResult {
  id: string;           // MusicBrainz release ID
  title: string;
  artist: string;
  year: string | null;
  coverArtUrl: string | null;
}

export async function searchAlbums(query: string): Promise<AlbumResult[]> {
  const params = new URLSearchParams({
    query: `release:${query}`,
    fmt: "json",
    limit: "10",
  });

  const res = await mbFetch(`/release/?${params}`);

  if (!res.ok) {
    throw new Error(`MusicBrainz search failed: ${res.status}`);
  }

  const data = await res.json();

  const releases: AlbumResult[] = (data.releases ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    artist: r["artist-credit"]?.[0]?.name ?? "Unknown artist",
    year: r.date ? r.date.slice(0, 4) : null,
    coverArtUrl: null, // fetched lazily via getCoverArtUrl
  }));

  return releases;
}

// Cover art is hosted on the Cover Art Archive CDN — separate from the MB API.
// Returns null if no art exists (not every release has cover art).
export async function getCoverArtUrl(releaseId: string): Promise<string | null> {
  try {
    const res = await fetch(`${CAA_BASE}/release/${releaseId}/front-250`, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      next: { revalidate: 60 * 60 * 24 }, // 24 hours
    });

    if (res.ok) {
      return res.url; // CAA redirects to the actual CDN URL
    }

    return null;
  } catch {
    return null;
  }
}
