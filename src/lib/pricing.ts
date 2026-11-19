export interface PricedProduct {
  price: number | string;
  discountPercentage?: number | null;
  saleEndDate?: string | Date | null;
}

export function isSaleActive(p: PricedProduct, now = Date.now()): boolean {
  if (!p.saleEndDate) return false;
  return now < new Date(p.saleEndDate).getTime();
}

/** Server aur client dono isi formula se price nikalte hain, taake total kabhi mismatch na ho. */
export function getEffectivePrice(p: PricedProduct, now = Date.now()): number {
  const original = Number(p.price) || 0;
  const pct = Number(p.discountPercentage) || 0;
  if (pct > 0 && isSaleActive(p, now)) {
    return original - (original * pct) / 100;
  }
  return original;
}
