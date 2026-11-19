import { redis } from "@/lib/redis";

/**
 * Redis down ho ya slow ho to poori API crash nahi honi chahiye.
 * Isliye har cache helper "fail-open" hai: error aaye to DB se kaam chalta rehta hai.
 */
export const PRODUCT_LIST_KEY = "all_products";
export const productKey = (id: string) => `product_${id}`;

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const v = await redis.get(key);
    return (v as T) ?? null;
  } catch (err) {
    console.warn(`[cache] GET failed for ${key}:`, (err as Error)?.message);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[cache] SET failed for ${key}:`, (err as Error)?.message);
  }
}

export async function cacheDel(...keys: string[]) {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn("[cache] DEL failed:", (err as Error)?.message);
  }
}

/** Stock/price/product change hone ke baad list + single product cache dono clear karo. */
export async function invalidateProductCache(productIds: Array<string | { toString(): string }> = []) {
  const keys = [PRODUCT_LIST_KEY, ...productIds.map((id) => productKey(String(id)))];
  await cacheDel(...keys);
}

/** Browser/CDN ko in responses ko cache karne se rokta hai. */
export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};
