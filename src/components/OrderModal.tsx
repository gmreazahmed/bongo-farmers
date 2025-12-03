// src/components/OrderModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import toast from "react-hot-toast";

/** price parsing helper (handles Bangla digits & symbols) */
function parsePriceToNumber(val: any) {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  let s = String(val);
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  for (let i = 0; i < bn.length; i++) {
    const re = new RegExp(bn[i], "g");
    s = s.replace(re, String(i));
  }
  s = s.replace(/[^\d.-]/g, "");
  const f = parseFloat(s);
  return isNaN(f) ? 0 : f;
}

export default function OrderModal({
  product,
  quantity: initialQuantity = 1,
  onClose,
}: {
  product: any;
  quantity?: number;
  onClose?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState<number>(initialQuantity || 1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // delivery
  const [deliveryType, setDeliveryType] = useState<"inside" | "outside">("inside");
  const [showThanks, setShowThanks] = useState(false);

  // price calculations
  const unitPrice = parsePriceToNumber(product?.price);
  const itemsTotal = unitPrice * (Number(quantity) || 0);
  const deliveryFee = deliveryType === "inside" ? 80 : 120;
  const grandTotal = itemsTotal + deliveryFee;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    // focus the name input shortly after mount
    const t = setTimeout(() => nameRef.current?.focus(), 40);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "নাম লিখুন";
    const digits = phone.toString().replace(/\D/g, "");
    if (digits.length < 10) errs.phone = "মোবাইল নম্বর দিন";
    if (!address.trim()) errs.address = "ঠিকানা লিখুন";
    if (!quantity || quantity < 1) errs.quantity = "কমপক্ষে ১টি নির্বাচন করুন";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Typed for HTML form event (no unsafe casting)
  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    if (!validate()) {
      toast.error("অনুগ্রহ করে ফর্মটি ঠিকভাবে পূরণ করুন");
      return;
    }
    setLoading(true);

    try {
      const docRef = await addDoc(collection(db, "orders"), {
        productId: product?.id || null,
        productTitle: product?.title || "",
        unitPrice,
        quantity,
        itemsTotal,
        deliveryType,
        deliveryFee,
        grandTotal,
        name,
        phone,
        address,
        createdAt: serverTimestamp(),
        status: "pending",
      });

      // optional webhook notify (non-blocking)
      (async () => {
        try {
          const notifyUrl = (import.meta.env as any).VITE_NOTIFY_URL || "/api/notify";
          await fetch(notifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: docRef.id,
              productTitle: product?.title,
              unitPrice,
              quantity,
              itemsTotal,
              deliveryType,
              deliveryFee,
              grandTotal,
              name,
              phone,
              address,
            }),
          });
        } catch (err) {
          console.error("Notify failed", err);
        }
      })();

      // Success UX: toast + thanks popup
      toast.success("🎉 আপনার অর্ডার সফলভাবে জমা হয়েছে!");
      setShowThanks(true);

      // reset
      setName("");
      setPhone("");
      setAddress("");
      setQuantity(1);
      setDeliveryType("inside");
      setErrors({});

      // auto-close after a short delay
      setTimeout(() => {
        setShowThanks(false);
        onClose?.();
      }, 3200);
    } catch (err) {
      console.error(err);
      toast.error("❌ অর্ডার জমা দিতে সমস্যা হয়েছে — আবার চেষ্টা করুন");
    } finally {
      setLoading(false);
    }
  }

  function backdropClick(e: React.MouseEvent) {
    if (e.target === containerRef.current) onClose?.();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={containerRef}
        onClick={backdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 id="order-modal-title" className="text-lg font-semibold truncate">
                🛒 অর্ডার — {product?.title}
              </h3>
              <p className="text-sm text-indigo-100 mt-1">
                ইউনিট: ৳ {fmt(unitPrice)} · আইটেমস: ৳ {fmt(itemsTotal)}
              </p>
            </div>

            <button onClick={onClose} className="text-white/95 hover:text-white text-xl leading-none" title="বন্ধ করুন" aria-label="Close">
              ✕
            </button>
          </div>

          {/* Content (scrollable) */}
          <div className="p-6 overflow-auto flex-1">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700">পরিমাণ</label>
                <div className="mt-2 inline-flex items-center border rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>

                  <input
                    value={quantity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || "1", 10);
                      setQuantity(isNaN(v) ? 1 : Math.max(1, v));
                    }}
                    className="w-28 text-center px-3 py-2 outline-none text-sm"
                    aria-label="Quantity"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700">নাম</label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="আপনার নাম"
                  className="mt-2 w-full border rounded-md px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700">মোবাইল নম্বর</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  inputMode="tel"
                  className="mt-2 w-full border rounded-md px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ঠিকানা</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ঠিকানা লিখুন"
                  rows={4}
                  className="mt-2 w-full border rounded-md px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
              </div>

              {/* Delivery */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ডেলিভারি অঞ্চল</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <label className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${deliveryType === "inside" ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}>
                    <input type="radio" name="delivery" checked={deliveryType === "inside"} onChange={() => setDeliveryType("inside")} />
                    <div>
                      <div className="text-sm font-medium">ঢাকার মধ্যে</div>
                      <div className="text-xs text-gray-500">ডেলিভারি: ৳ ৮০</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${deliveryType === "outside" ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}>
                    <input type="radio" name="delivery" checked={deliveryType === "outside"} onChange={() => setDeliveryType("outside")} />
                    <div>
                      <div className="text-sm font-medium">ঢাকার বাইরে</div>
                      <div className="text-xs text-gray-500">ডেলিভারি: ৳ ১২০</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg border p-4 bg-gradient-to-b from-white to-indigo-50/40">
                <div className="flex justify-between text-gray-700 text-sm"><span>Unit price</span><span>৳ {fmt(unitPrice)}</span></div>
                <div className="flex justify-between text-gray-700 text-sm mt-2"><span>Quantity</span><span>{quantity}</span></div>
                <div className="flex justify-between text-gray-700 text-sm mt-2"><span>Items total</span><span>৳ {fmt(itemsTotal)}</span></div>
                <div className="flex justify-between text-gray-700 text-sm mt-2"><span>Delivery fee</span><span>৳ {fmt(deliveryFee)}</span></div>
                <div className="flex justify-between font-semibold text-indigo-700 mt-3 border-t pt-3"><span>Grand total</span><span>৳ {fmt(grandTotal)}</span></div>
              </div>
            </form>
          </div>

          {/* Sticky footer (actions) */}
          <div className="border-t px-6 py-4 bg-white flex items-center justify-between gap-4">
            <div className="text-sm text-gray-700">মোট: <span className="font-semibold">৳ {fmt(grandTotal)}</span></div>

            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">বাতিল</button>

              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm text-sm"
              >
                {loading ? "অর্ডার হচ্ছে..." : `অর্ডার করুন — ৳ ${fmt(grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Thank you popup */}
      {showThanks && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10 pointer-events-auto max-w-sm w-[92%] mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-center animate-pop">
              <div className="text-5xl mb-2">🎉</div>
              <h4 className="text-xl font-bold text-gray-800 mb-1">ধন্যবাদ!</h4>
              <p className="text-sm text-gray-600 mb-4">আপনার অর্ডার সফলভাবে জমা হয়েছে। আমরা দ্রুত যোগাযোগ করবো।</p>
              <div className="flex justify-center">
                <button onClick={() => { setShowThanks(false); onClose?.(); }} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">ঠিক আছে</button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes popIn {
              0% { transform: scale(.95); opacity: 0 }
              60% { transform: scale(1.02); opacity: 1 }
              100% { transform: scale(1); opacity: 1 }
            }
            .animate-pop { animation: popIn 340ms cubic-bezier(.2,.9,.3,1); }
          `}</style>
        </div>
      )}
    </>
  );
}
