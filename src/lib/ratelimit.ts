import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Auth/OTP endpoints: 1 minute mein sirf 5 requests per IP
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "lumiere_ratelimit",
});

// Orders ka alag bucket, taake register/OTP ki requests order placing ko block na karen
export const orderRatelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "lumiere_orders_ratelimit",
});

/** x-forwarded-for "ip1, ip2, ip3" ho sakta hai: sirf pehla (client) IP lo. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "127.0.0.1";
}

/** Upstash down ho to checkout band na ho (fail-open). */
export async function safeLimit(limiter: Ratelimit, key: string) {
  try {
    return await limiter.limit(key);
  } catch (err) {
    console.warn("[ratelimit] check failed, allowing request:", (err as Error)?.message);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}
