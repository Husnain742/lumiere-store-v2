import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import Product from "@/models/Products";
import { cacheGet, cacheSet, invalidateProductCache, productKey, NO_STORE_HEADERS } from "@/lib/cache";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return Boolean(session && session.user?.email === ADMIN_EMAIL);
}

// GET: single product. ?fresh=1 -> cache bypass
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";

    if (!fresh) {
      const cached = await cacheGet<any>(productKey(id));
      if (cached) {
        const product = typeof cached === "string" ? JSON.parse(cached) : cached;
        return NextResponse.json({ success: true, product, source: "redis-cache" }, { status: 200, headers: NO_STORE_HEADERS });
      }
    }

    await dbConnect();
    const product = await Product.findById(id).lean();
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    await cacheSet(productKey(id), product, 300);
    return NextResponse.json({ success: true, product, source: "mongodb" }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error: any) {
    console.error("❌ [GET SINGLE PRODUCT ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: edit (admin only). Sirf wohi fields update hongi jo body mein bheji gayi hon.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.description = body.description;
    if (body.category !== undefined) update.category = body.category;
    if (body.image !== undefined) update.image = body.image;
    if (Array.isArray(body.images)) update.images = body.images;
    if (Array.isArray(body.sizes)) update.sizes = body.sizes;
    if (body.price !== undefined) update.price = Number(body.price);
    if (body.stock !== undefined) update.stock = Math.max(0, Number(body.stock));
    if (body.discountPercentage !== undefined) update.discountPercentage = Number(body.discountPercentage) || 0;
    if (body.saleEndDate !== undefined) update.saleEndDate = body.saleEndDate ? new Date(body.saleEndDate) : null;

    const updatedProduct = await Product.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!updatedProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    await invalidateProductCache([id]);
    return NextResponse.json({ success: true, message: "Product updated successfully", product: updatedProduct }, { status: 200 });
  } catch (error: any) {
    console.error("❌ [UPDATE PRODUCT ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE (admin only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    await invalidateProductCache([id]);
    return NextResponse.json({ success: true, message: "Product deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("❌ [DELETE PRODUCT ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
