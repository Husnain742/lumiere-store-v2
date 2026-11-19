import mongoose, { Schema } from "mongoose";

// Ek hi Order schema poore project mein (pehle orders/route.ts aur orders/[id]/route.ts mein
// do alag copies thin, jo out-of-sync ho sakti thin).
const OrderSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    customerDetails: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      city: { type: String, required: true },
      address: { type: String, required: true },
      paymentMethod: { type: String, required: true },
    },
    paymentInfo: {
      method: { type: String, default: "cod" },
      paymentStatus: { type: String, default: "Pending" },
      last4: { type: String },
    },
    items: { type: Array, required: true },
    couponApplied: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: false, collection: "orders" }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);
export default Order;
