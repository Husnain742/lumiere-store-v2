"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import OrderTimeline from "@/components/OrderTimeline";
import { motion } from "framer-motion";
import { Package, Loader2, ShoppingBag, CheckCircle2, Clock, Truck, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";

export default function MyOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      toast.error("Please sign in to view your orders.");
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserOrders();
    }
  }, [session]);

  const fetchUserOrders = async () => {
    try {
      const res = await axios.get("/api/orders", { params: { t: Date.now() } });
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error("Failed to fetch user orders:", err);
      toast.error("Orders load karne mein masla hua!");
    } finally {
      setLoading(false);
    }
  };

  // Order Cancellation Handler with Time Check (within 30 minutes)
  const handleCancelOrder = async (orderId: string, createdAt: string) => {
    const orderTime = new Date(createdAt).getTime();
    const currentTime = new Date().getTime();
    const diffInMinutes = (currentTime - orderTime) / (1000 * 60);

    if (diffInMinutes > 30) {
      toast.error("Order cancel karne ka waqt (30 minutes) guzar chuka hai!");
      return;
    }

    if (!window.confirm("Kya aap waqai apna yeh order cancel karna chahte hain?")) {
      return;
    }

    setCancellingId(orderId);
    try {
      const res = await axios.put(`/api/orders/${orderId}`, { status: "Cancelled" });
      if (res.data.success || res.status === 200) {
        toast.success("Order kamyabi se cancel ho gaya hai.");
        
        // Instant state update aur background router refresh taake stock aur orders foran sync ho jayein
        setOrders((prevOrders) =>
          prevOrders.map((ord) => (ord._id === orderId ? { ...ord, status: "Cancelled" } : ord))
        );
        fetchUserOrders();
      } else {
        toast.error("Order cancel karne mein nakami hui.");
      }
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      toast.error(err?.response?.data?.error || "Server error ki wajah se order cancel nahi ho saka.");
    } finally {
      setCancellingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F5] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#8C5E73]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#2C2420] font-sans flex flex-col">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-12 flex-grow w-full space-y-6">
        <div className="border-b border-[#E5DFDA] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A120E]">My Orders History</h1>
            <p className="text-xs sm:text-sm text-[#5E4E46] mt-1">Track the live status of your purchases and shipping updates. You can cancel pending orders within 30 minutes.</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchUserOrders();
              toast.success("Orders list synchronized!");
            }}
            className="px-4 py-2 bg-[#EFEAE5] hover:bg-[#E5DFDA] border border-[#E5DFDA] text-[#8C5E73] rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            ↻ Refresh Status
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-[#EFEAE5] border border-[#E5DFDA] rounded-3xl shadow-sm">
            <ShoppingBag size={48} className="mx-auto text-[#B5A59E] mb-3" />
            <p className="text-base font-serif font-bold text-[#1A120E]">You have not placed any orders yet.</p>
            <Link href="/products" className="mt-4 inline-block bg-[#8C5E73] hover:bg-[#784E60] text-white text-xs font-medium px-6 py-3 rounded-full transition-all shadow-md shadow-[#8C5E73]/20">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderStatus = order.status || "Pending";
              
              const orderTime = new Date(order.createdAt).getTime();
              const currentTime = new Date().getTime();
              const diffInMinutes = (currentTime - orderTime) / (1000 * 60);
              const canCancel = orderStatus === "Pending" && diffInMinutes <= 30;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order._id}
                  className="bg-[#EFEAE5] border border-[#E5DFDA] rounded-3xl p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5DFDA] pb-3">
                    <div>
                      <span className="text-xs text-[#5E4E46] font-medium">Order ID: </span>
                      <span className="font-mono text-xs text-[#8C5E73] font-bold">#{order._id.slice(-6).toUpperCase()}</span>
                      <span className="text-xs text-[#8A7A72] ml-3 font-medium">{new Date(order.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-bold ${
                      orderStatus === "Pending" ? "bg-amber-100/80 text-amber-800 border border-amber-300" :
                      orderStatus === "Shipped" ? "bg-blue-100/80 text-blue-800 border border-blue-300" :
                      orderStatus === "Delivered" ? "bg-emerald-100/80 text-emerald-800 border border-emerald-300" :
                      "bg-rose-100/80 text-rose-800 border border-rose-300"
                    }`}>
                      {orderStatus === "Pending" && <Clock size={13} />}
                      {orderStatus === "Shipped" && <Truck size={13} />}
                      {orderStatus === "Delivered" && <CheckCircle2 size={13} />}
                      {orderStatus === "Cancelled" && <XCircle size={13} />}
                      <span>{orderStatus}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs sm:text-sm bg-[#FAF7F5] p-3 rounded-2xl border border-[#E5DFDA]">
                        <span className="text-[#1A120E] font-bold">{item.title} (x{item.quantity})</span>
                        <span className="text-[#8C5E73] font-serif font-extrabold">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t border-[#E5DFDA] text-xs sm:text-sm gap-4">
                    <span className="text-[#5E4E46] font-medium">Total Bill: <strong className="text-[#1A120E] font-serif font-extrabold text-base">Rs. {order.totalAmount?.toLocaleString()}</strong></span>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-[#8C5E73] uppercase tracking-wider text-[11px] font-semibold">Payment: {order.customerDetails?.paymentMethod || "COD"}</span>
                      
                      {canCancel && (
                        <button
                          onClick={() => handleCancelOrder(order._id, order.createdAt)}
                          disabled={cancellingId === order._id}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {cancellingId === order._id ? (
                            <Loader2 className="animate-spin w-3.5 h-3.5" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          <span>Cancel Order</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <OrderTimeline status={orderStatus} />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}