import { Redis } from "@upstash/redis";
import { searchAlbums, getCoverArtUrl } from "@/lib/musicbrainz";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return Response.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return Response.json({ error: "Query too long" }, { status: 400 });
  }

  // ── 1. Check Redis cache ──────────────────────────────────────────────────
  const cacheKey = `mb:search:${query.toLowerCase()}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return Response.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // ── 2. Query MusicBrainz (rate-limited, 1 req/sec via Redis) ─────────────
  let albums;
  try {
    albums = await searchAlbums(query);
  } catch (err) {
    console.error("MusicBrainz search error:", err);
    return Response.json(
      { error: "Music search temporarily unavailable" },
      { status: 503 }
    );
  }

  // ── 3. Fetch cover art for each result (parallel, best-effort) ────────────
  const albumsWithArt = await Promise.all(
    albums.map(async (album) => ({
      ...album,
      coverArtUrl: await getCoverArtUrl(album.id).catch(() => null),
    }))
  );

  // ── 4. Cache the enriched results ─────────────────────────────────────────
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, albumsWithArt);

  return Response.json(albumsWithArt, {
    headers: {
      "X-Cache": "MISS",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
