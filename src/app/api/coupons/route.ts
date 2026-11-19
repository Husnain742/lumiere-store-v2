import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

// GET: Tamam coupons fetch karne ke liye (Admin Only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, coupons }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Naya coupon create karne ke liye (Admin Only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { code, discountPercentage, expiryDate } = await req.json();

    if (!code || !discountPercentage || !expiryDate) {
      return NextResponse.json({ success: false, message: "All fields are required" }, { status: 400 });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, message: "This coupon code already exists!" }, { status: 400 });
    }

    const newCoupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discountPercentage: Number(discountPercentage),
      expiryDate: new Date(expiryDate),
      isActive: true,
    });

    return NextResponse.json({ success: true, coupon: newCoupon }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Coupon delete karne ke liye (Admin Only)
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Coupon ID is required" }, { status: 400 });
    }

    await Coupon.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Coupon deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}