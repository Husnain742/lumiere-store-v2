import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { restoreStock, linesFromOrderItems } from "@/lib/stock";
import Order from "@/models/Order";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
const ALLOWED_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
const CANCEL_WINDOW_MINUTES = 30;

// PUT: order cancel/update. Pehle ye route bina login ke koi bhi order cancel kar sakta tha.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const { status } = await req.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid order ID" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
    }

    const existingOrder: any = await Order.findById(id);
    if (!existingOrder) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const isAdmin = session.user.email === ADMIN_EMAIL;
    const isOwner =
      existingOrder.userEmail === session.user.email ||
      existingOrder.customerDetails?.email === session.user.email;

    if (!isAdmin) {
      if (!isOwner) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (status !== "Cancelled") {
        return NextResponse.json({ success: false, error: "Customers sirf order cancel kar sakte hain." }, { status: 403 });
      }
      if ((existingOrder.status || "Pending") !== "Pending") {
        return NextResponse.json({ success: false, error: "Sirf Pending order cancel ho sakta hai." }, { status: 400 });
      }
      const ageMinutes = (Date.now() - new Date(existingOrder.createdAt).getTime()) / 60000;
      if (ageMinutes > CANCEL_WINDOW_MINUTES) {
        return NextResponse.json(
          { success: false, error: `Order cancel karne ka waqt (${CANCEL_WINDOW_MINUTES} minutes) guzar chuka hai.` },
          { status: 400 }
        );
      }
    }

    if (existingOrder.status === "Cancelled" && status !== "Cancelled") {
      return NextResponse.json({ success: false, error: "Cancelled order dobara active nahi ho sakta." }, { status: 400 });
    }

    let updatedOrder: any;
    if (status === "Cancelled") {
      // Atomic: double-click / do requests se stock do baar restore nahi hoga
      const before: any = await Order.findOneAndUpdate(
        { _id: id, status: { $ne: "Cancelled" } },
        { status: "Cancelled" },
        { new: false }
      );
      if (before) await restoreStock(linesFromOrderItems(before.items));
      updatedOrder = await Order.findById(id);
    } else {
      updatedOrder = await Order.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    }

    return NextResponse.json(
      { success: true, message: "Order status updated successfully", order: updatedOrder },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ [UPDATE ORDER STATUS ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
