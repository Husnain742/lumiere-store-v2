import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redis } from "@/lib/redis";

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI!);
}

const AnnouncementSchema = new mongoose.Schema({
  text: String,
  couponCode: String,
  isActive: { type: Boolean, default: true },
});

const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", AnnouncementSchema);

// GET: Sabhi users ke liye announcement fetch karne ke liye (With Redis Cache)
export async function GET() {
  try {
    // 1. Pehle Redis Cache check karein
    const cachedBanner = await redis.get("announcement_banner");
    if (cachedBanner) {
      return NextResponse.json(
        { success: true, banner: cachedBanner, source: "redis-cache" },
        { status: 200 }
      );
    }

    // 2. Agar cache mein nahi hai, toh MongoDB se fetch karein
    await connectDB();
    let banner = await Announcement.findOne({});
    if (!banner) {
      banner = {
        text: "✨ Special Offer: Use code at checkout to get 20% OFF! ✨",
        couponCode: "LUMIERE20",
        isActive: true,
      };
    }

    // 3. Banner ko Redis mein save kar dein (10 minutes / 600 seconds expiry)
    await redis.set("announcement_banner", banner, { ex: 600 });

    return NextResponse.json(
      { success: true, banner, source: "mongodb" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Admin ke liye announcement update karne ke liye (With Cache Invalidation)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { text, couponCode, isActive } = await req.json();

    let banner = await Announcement.findOne({});
    if (banner) {
      banner.text = text;
      banner.couponCode = couponCode;
      banner.isActive = isActive;
      await banner.save();
    } else {
      banner = await Announcement.create({ text, couponCode, isActive });
    }

    // 4. Purana cache clear kar dein taake users ko foran naya banner dikhe
    await redis.del("announcement_banner");

    return NextResponse.json({ success: true, banner }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}