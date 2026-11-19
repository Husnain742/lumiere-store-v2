import Product from "@/models/Products";
import { invalidateProductCache } from "@/lib/cache";

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

export interface StockLine {
  productId: string;
  quantity: number;
  title?: string;
}

/**
 * ATOMIC stock reservation.
 *
 * Purana tareeqa: findById -> JS mein minus -> save(). Is mein "read-modify-write" race hoti hai
 * (do customers ek saath order karen to dono purani value se minus karte hain) aur agar save
 * silently kuch na kare to pata bhi nahi chalta.
 *
 * Naya tareeqa: ek hi MongoDB operation mein "agar stock >= qty hai to $inc -qty" karo.
 * Result mein naya stock wapas milta hai, aur agar condition fail ho to null aata hai.
 * Beech mein koi line fail ho jaye to jo lines reserve ho chuki thin unhein wapas kar diya jata hai.
 */
export async function reserveStock(lines: StockLine[]) {
  const reserved: StockLine[] = [];
  const newStock: Record<string, number> = {};

  try {
    for (const line of lines) {
      const updated = await Product.findOneAndUpdate(
        { _id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { new: true }
      ).lean();

      if (!updated) {
        throw new StockError(
          `Insufficient stock for "${line.title ?? line.productId}". Please reduce quantity or remove it from cart.`
        );
      }

      reserved.push(line);
      newStock[line.productId] = Number((updated as any).stock);
      console.log(`✅ Stock reduced for "${line.title ?? line.productId}" by ${line.quantity} -> now ${newStock[line.productId]}`);
    }
  } catch (err) {
    await restoreStock(reserved, { invalidate: false });
    await invalidateProductCache(reserved.map((r) => r.productId));
    throw err;
  }

  await invalidateProductCache(lines.map((l) => l.productId));
  return { reserved, newStock };
}

/** Cancel / rollback par stock wapas add karo (atomic $inc) aur cache clear karo. */
export async function restoreStock(lines: StockLine[], opts: { invalidate?: boolean } = {}) {
  const { invalidate = true } = opts;
  for (const line of lines) {
    try {
      await Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } });
      console.log(`🔄 Stock restored for ${line.productId}: +${line.quantity}`);
    } catch (err) {
      console.error(`❌ Failed to restore stock for ${line.productId}:`, err);
    }
  }
  if (invalidate) {
    await invalidateProductCache(lines.map((l) => l.productId));
  }
}

/** Order.items se (productId, qty) lines banao; same product ki multiple sizes ko merge karta hai. */
export function linesFromOrderItems(items: any[] = []): StockLine[] {
  const merged = new Map<string, StockLine>();
  for (const item of items) {
    const id = String(item?._id ?? item?.productId ?? item?.id ?? "");
    const qty = Number(item?.quantity) || 0;
    if (!id || qty <= 0) continue;
    const existing = merged.get(id);
    if (existing) existing.quantity += qty;
    else merged.set(id, { productId: id, quantity: qty, title: item?.title });
  }
  return [...merged.values()];
}
