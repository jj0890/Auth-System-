import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Per-user API rate limiter: 60 requests per minute
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "api:user",
  analytics: true,
});

// Per-user upload rate limiter: 5 uploads per hour
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "api:upload",
});

export async function checkApiLimit(userId: string) {
  const { success, limit, remaining, reset } =
    await apiRateLimit.limit(userId);

  return {
    ok: success,
    headers: {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
      ...(success ? {} : { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) }),
    },
  };
}
