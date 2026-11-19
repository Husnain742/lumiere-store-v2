"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext<any>(null);

const CART_KEY = "cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  // FIX: pehle useState ke andar localStorage padha ja raha tha -> server HTML (empty cart) aur
  // client HTML (saved cart) alag hote the = hydration mismatch. Ab pehle [] se start, phir mount par load.
  const [cart, setCart] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showCartReminder, setShowCartReminder] = useState(false);

  // 1) Mount par localStorage se cart load karo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse cart from localStorage", e);
    }
    setHydrated(true);
  }, []);

  // 2) Doosri tab mein cart badle (ya order ke baad clear ho) to yahan bhi sync ho jaye
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CART_KEY) return;
      try {
        setCart(e.newValue ? JSON.parse(e.newValue) : []);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 3) Cart change par save (hydrate hone se pehle save nahi karna, warna saved cart [] se overwrite ho jata)
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    const hasShownReminder = sessionStorage.getItem("cartReminderShown");
    if (cart.length > 0 && !hasShownReminder) {
      const timer = setTimeout(() => {
        setShowCartReminder(true);
        sessionStorage.setItem("cartReminderShown", "true");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [cart, hydrated]);

  const addToCart = (product: any, quantity = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item._id === product._id && item.selectedSize === product.selectedSize
      );
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].quantity + quantity;
        if (newQty <= 0) return prevCart.filter((_, i) => i !== existingIndex);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      if (quantity <= 0) return prevCart;
      return [...prevCart, { ...product, quantity }];
    });
  };

  const removeFromCart = (id: string, selectedSize?: string) => {
    setCart((prev) => prev.filter((item) => !(item._id === id && item.selectedSize === selectedSize)));
  };

  const clearCart = () => {
    setCart([]);
    setShowCartReminder(false);
  };

  return (
    <CartContext.Provider
      value={{ cart, hydrated, addToCart, removeFromCart, clearCart, showCartReminder, setShowCartReminder }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
