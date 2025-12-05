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

  // weight per unit: "500g" or "1kg"
  const [unitSize, setUnitSize] = useState<"500g" | "1kg">("500g");

  // NOTE: we assume product.price is price per 1 kg.
  const pricePerKg = parsePriceToNumber(product?.price); // price per kg
  const unitKg = unitSize === "500g" ? 0.5 : 1;
  const unitPrice = pricePerKg * unitKg;
  const itemsTotal = unitPrice * (Number(quantity) || 0);
  const deliveryFee = deliveryType === "inside" ? 80 : 120;
  const grandTotal = itemsTotal + deliveryFee;

  const totalWeightKg = unitKg * quantity;
  const totalWeightDisplay = totalWeightKg >= 1 ? `${totalWeightKg.toFixed(2)} kg` : `${Math.round(totalWeightKg * 1000)} g`;

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
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

  // Typed for HTML form event
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
        pricePerKg,
        unitSize,
        unitWeightGram: unitKg * 1000,
        unitPrice,
        quantity,
        totalWeightKg,
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
              pricePerKg,
              unitSize,
              unitWeightGram: unitKg * 1000,
              unitPrice,
              quantity,
              totalWeightKg,
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

      toast.success("🎉 আপনার অর্ডার সফলভাবে জমা হয়েছে!");
      setShowThanks(true);

      // reset
      setName("");
      setPhone("");
      setAddress("");
      setQuantity(1);
      setUnitSize("500g");
      setDeliveryType("inside");
      setErrors({});

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl transform transition-all flex flex-col md:flex-row max-h-[90vh] overflow-hidden"
        >
          {/* Left: Product summary */}
          <div className="md:w-1/2 bg-gradient-to-b from-white to-gray-50 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 shadow-inner">
                <img src={product?.images?.[0] || "/placeholder.png"} alt={product?.title} className="w-full h-full object-cover" />
              </div>

              <div className="min-w-0">
                <h3 id="order-modal-title" className="text-lg font-bold text-gray-900 truncate">{product?.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-3">{product?.description || ""}</p>
              </div>
            </div>

            <div className="pt-2 border-t mt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Price (per kg)</div>
                  <div className="text-xl font-semibold text-indigo-700">৳ {fmt(pricePerKg)}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Selected unit</div>
                  <div className="text-base font-medium"> {unitSize === "500g" ? "500 g" : "1 kg"}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-white border rounded p-3 text-center">
                  <div className="text-xs text-gray-500">Unit price</div>
                  <div className="text-lg font-semibold">৳ {fmt(unitPrice)}</div>
                </div>
                <div className="bg-white border rounded p-3 text-center">
                  <div className="text-xs text-gray-500">Total weight</div>
                  <div className="text-lg font-semibold">{totalWeightDisplay}</div>
                </div>
              </div>
            </div>

            <div className="mt-auto text-xs text-gray-500">
              <div>ডেলিভারি: ঢাকার মধ্যে ৳80 · বাইরে ৳120</div>
              <div className="mt-2">আপনার অর্ডার সংগ্রহ করা হলে আমরা আপনাকে কল/ম্যাসেজ করবো যাচাইয়ের জন্য।</div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="md:w-1/2 p-6 overflow-auto">
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Unit size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">প্যাক সাইজ</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setUnitSize("500g")}
                    className={`flex-1 px-4 py-2 rounded-lg border transition focus:outline-none ${
                      unitSize === "500g"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-sm font-medium">500 g</div>
                    <div className="text-xs text-gray-200/90">{unitSize === "500g" ? "Selected" : ""}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitSize("1kg")}
                    className={`flex-1 px-4 py-2 rounded-lg border transition focus:outline-none ${
                      unitSize === "1kg"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-sm font-medium">1 kg</div>
                    <div className="text-xs text-gray-200/90">{unitSize === "1kg" ? "Selected" : ""}</div>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">পরিমাণ</label>
                <div className="inline-flex items-center border rounded-md overflow-hidden">
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
                  className="mt-2 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
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
                  className="mt-2 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
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
                  rows={3}
                  className="mt-2 w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
              </div>

              {/* Delivery */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ডেলিভারি অঞ্চল</label>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${deliveryType === "inside" ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}>
                    <input type="radio" name="delivery" checked={deliveryType === "inside"} onChange={() => setDeliveryType("inside")} />
                    <div>
                      <div className="text-sm font-medium">ঢাকার মধ্যে</div>
                      <div className="text-xs text-gray-500">৳ ৮০</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${deliveryType === "outside" ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}>
                    <input type="radio" name="delivery" checked={deliveryType === "outside"} onChange={() => setDeliveryType("outside")} />
                    <div>
                      <div className="text-sm font-medium">ঢাকার বাইরে</div>
                      <div className="text-xs text-gray-500">৳ ১২০</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border p-4 bg-gradient-to-b from-white to-indigo-50">
                <div className="flex justify-between text-sm text-gray-700"><span>Unit price</span><span>৳ {fmt(unitPrice)}</span></div>
                <div className="flex justify-between text-sm text-gray-700 mt-2"><span>Quantity</span><span>{quantity}</span></div>
                <div className="flex justify-between text-sm text-gray-700 mt-2"><span>Items total</span><span>৳ {fmt(itemsTotal)}</span></div>
                <div className="flex justify-between text-sm text-gray-700 mt-2"><span>Delivery fee</span><span>৳ {fmt(deliveryFee)}</span></div>
                <div className="flex justify-between font-semibold text-indigo-700 mt-3 border-t pt-3"><span>Grand total</span><span>৳ {fmt(grandTotal)}</span></div>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border hover:bg-gray-50">
                  বাতিল
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium shadow ${
                    loading ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {loading ? "অর্ডার হচ্ছে..." : `অর্ডার করুন — ৳ ${fmt(grandTotal)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-4 left-0 right-0 z-50 px-4 md:hidden">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-full shadow-lg flex items-center justify-between px-4 py-2">
            <div>
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-sm font-semibold text-indigo-700">৳ {fmt(grandTotal)}</div>
            </div>

            <div>
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className={`px-4 py-2 rounded-full text-white font-medium ${loading ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {loading ? "অর্ডার হচ্ছে..." : "Order"}
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
              0% { transform: scale(.96); opacity: 0 }
              60% { transform: scale(1.02); opacity: 1 }
              100% { transform: scale(1); opacity: 1 }
            }
            .animate-pop { animation: popIn 320ms cubic-bezier(.2,.9,.3,1); }
          `}</style>
        </div>
      )}
    </>
  );
}
