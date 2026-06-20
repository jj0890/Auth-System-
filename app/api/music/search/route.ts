import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface ItunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  releaseDate: string;
  artworkUrl100: string;
}

async function searchItunes(query: string, limit: number) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "album");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("media", "music");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "TheEdit/1.0" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);
  const json = await res.json();

  return (json.results as ItunesAlbum[]).map((item) => ({
    id: String(item.collectionId),
    title: item.collectionName,
    artist: item.artistName,
    year: item.releaseDate ? item.releaseDate.slice(0, 4) : null,
    // Upgrade thumbnail to 600px artwork
    coverArtUrl: item.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 6), 12);

  if (!query || query.length < 2) {
    return Response.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return Response.json({ error: "Query too long" }, { status: 400 });
  }

  const cacheKey = `itunes:search:${query.toLowerCase()}:${limit}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return Response.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" },
    });
  }

  let albums;
  try {
    albums = await searchItunes(query, limit);
  } catch (err) {
    console.error("iTunes search error:", err);
    return Response.json(
      { error: "Music search temporarily unavailable" },
      { status: 503 }
    );
  }

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, albums);

  return Response.json(albums, {
    headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" },
  });
}
