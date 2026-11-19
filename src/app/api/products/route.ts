import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import Product from "@/models/Products";
import { cacheGet, cacheSet, invalidateProductCache, PRODUCT_LIST_KEY, NO_STORE_HEADERS } from "@/lib/cache";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

// GET: saare products. ?fresh=1 -> Redis cache bypass (cart/checkout/product page stock ke liye)
export async function GET(req: Request) {
  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";

    if (!fresh) {
      const cached = await cacheGet<any>(PRODUCT_LIST_KEY);
      if (cached) {
        const products = typeof cached === "string" ? JSON.parse(cached) : cached;
        return NextResponse.json({ success: true, products, source: "redis-cache" }, { status: 200, headers: NO_STORE_HEADERS });
      }
    }

    await dbConnect();
    const products = await Product.find({}).sort({ createdAt: -1 }).lean();
    await cacheSet(PRODUCT_LIST_KEY, products, 300);

    return NextResponse.json({ success: true, products, source: "mongodb" }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err: any) {
    console.error("Error fetching products:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: naya product (admin only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const newProduct = await Product.create(body);
    await invalidateProductCache([]);

    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating product:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
