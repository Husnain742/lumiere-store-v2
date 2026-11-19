"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export interface LiveProduct {
  _id: string;
  price: number;
  stock: number;
  discountPercentage?: number;
  saleEndDate?: string | null;
  [key: string]: any;
}

/**
 * Database se FRESH products laata hai (Redis cache bypass: ?fresh=1) aur
 * tab dobara refresh karta hai jab user tab/window par wapas aaye.
 * Cart aur Checkout is se live stock + live price dikhate hain.
 */
export function useLiveProducts() {
  const [map, setMap] = useState<Record<string, LiveProduct>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get("/api/products", { params: { fresh: 1, t: Date.now() } });
      const next: Record<string, LiveProduct> = {};
      (res.data.products || []).forEach((p: LiveProduct) => {
        next[p._id] = p;
      });
      setMap(next);
    } catch (err) {
      console.error("Failed to sync live products:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { liveProducts: map, loaded, refresh };
}
