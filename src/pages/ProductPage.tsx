// src/pages/ProductPage.tsx
import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { PRODUCTS } from "../data/products";
import OrderModal from "../components/OrderModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

type Product = {
  id: string;
  title: string;
  description?: string;
  price: number;
  regularPrice?: number | null;
  images: string[];
  category?: string;
  createdAt?: any;
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateProduct = (location.state as any)?.product as Product | undefined;

  const [product, setProduct] = useState<Product | null>(stateProduct ?? null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showOrder, setShowOrder] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [loading, setLoading] = useState<boolean>(!stateProduct);
  const [error, setError] = useState<string | null>(null);

  // Lightbox ESC close for accessibility
  useEffect(() => {
    if (!showLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLightbox]);

  useEffect(() => {
    let mounted = true;

    async function fetchIfNeeded() {
      if (!id) {
        if (mounted) {
          setError("Invalid product id");
          setLoading(false);
        }
        return;
      }

      // if already in state (from nav) skip fetching
      if (product) {
        setLoading(false);
        return;
      }

      // try local PRODUCTS (match id or slug)
      const local = PRODUCTS.find((p) => p.id === id);
      if (local) {
        if (mounted) {
          setProduct(local);
          setLoading(false);
        }
        return;
      }

      // fallback: fetch from Firestore
      setLoading(true);
      try {
        const dref = doc(db, "products", id);
        const snap = await getDoc(dref);

        if (!snap.exists()) {
          if (mounted) {
            setError("Product not found");
            setLoading(false);
          }
          return;
        }

        const data = snap.data() as any;
        const p: Product = {
          id: snap.id,
          title: data.title || "",
          description: data.description || "",
          price: Number(data.price || 0),
          regularPrice: data.regularPrice != null ? Number(data.regularPrice) : null,
          images: Array.isArray(data.images) ? data.images : data.images ? [data.images] : [],
          category: data.category,
          createdAt: data.createdAt,
        };

        if (mounted) {
          setProduct(p);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError("Failed to load product");
          setLoading(false);
        }
      }
    }

    fetchIfNeeded();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="h-6 w-40 mx-auto mb-4 bg-gray-100 rounded animate-pulse" />
          <p className="text-gray-600">Loading product…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-lg text-red-500">{error}</p>
          <Link to="/all-products" className="mt-4 inline-block text-indigo-600 hover:underline">
            ← Back to products
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-lg">Product not found.</p>
          <Link to="/all-products" className="mt-4 inline-block text-indigo-600 hover:underline">
            ← Back to products
          </Link>
        </div>
      </div>
    );
  }

  // createdAt formatting (Firestore timestamp friendly)
  const createdAt =
    product.createdAt && typeof product.createdAt === "object" && (product.createdAt as any).toDate
      ? (product.createdAt as any).toDate().toLocaleString()
      : product.createdAt instanceof Date
      ? (product.createdAt as Date).toLocaleString()
      : null;

  const priceDisplay = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  // small sticky buy bar for mobile
  const MobileBuyBar = () => (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4 sm:hidden">
      <div className="max-w-screen-xl mx-auto">
        <div className="bg-white rounded-full shadow-lg flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-base font-semibold text-indigo-700">৳ {priceDisplay(product.price)}</div>
          </div>
          <div>
            <button
              onClick={() => setShowOrder(true)}
              className="bg-indigo-600 px-4 py-2 rounded-full text-white text-sm font-medium shadow"
            >
              🛒 Order now
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // layout: gallery left, info right — but info order is Title → Price → Buy → Description
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-500 mb-4">
        <Link to="/" className="hover:underline">Home</Link> ·{" "}
        <Link to="/all-products" className="hover:underline">Products</Link> ·{" "}
        <span className="text-gray-700">{product.title}</span>
      </nav>

      <div className="bg-white rounded-xl shadow p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Gallery */}
          <div>
            <div
              className="rounded-lg overflow-hidden bg-gray-100 cursor-zoom-in"
              onClick={() => setShowLightbox(true)}
              role="button"
              aria-label="Open image lightbox"
            >
              <img
                src={product.images[selectedImage] || "/placeholder.png"}
                alt={product.title}
                className="w-full h-[420px] sm:h-[480px] md:h-[520px] object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-5">
              {(product.images.length ? product.images : ["/placeholder.png"]).map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`relative rounded-md overflow-hidden border ${
                    selectedImage === i ? "ring-2 ring-indigo-500 border-transparent" : "border-gray-200"
                  }`}
                  aria-label={`Show image ${i + 1}`}
                >
                  <img src={src} alt={`${product.title} ${i + 1}`} className="w-full h-16 object-cover" />
                  {selectedImage === i && <span className="absolute inset-0 ring-2 ring-indigo-500 rounded-md pointer-events-none" />}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Info (Title → Price → Buy → Description) */}
          <div className="flex flex-col">
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">{product.title}</h1>

            {/* Price */}
            <div className="mt-3 flex items-center gap-3">
              <div className="text-3xl font-bold text-indigo-600">৳ {priceDisplay(product.price)}</div>
              {product.regularPrice && (
                <div className="text-sm md:text-base line-through text-gray-400">৳ {priceDisplay(product.regularPrice)}</div>
              )}
            </div>

            {/* Buy button */}
            <div className="mt-5">
              <button
                onClick={() => setShowOrder(true)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg shadow-md text-sm md:text-base font-medium"
              >
                🛒 Buy Now
              </button>
            </div>

            {/* Description */}
            <div className="mt-6 text-gray-700 text-sm md:text-base leading-relaxed">
              <h3 className="font-semibold text-lg mb-2">বিস্তারিত</h3>
              <p className="whitespace-pre-line">{product.description}</p>
            </div>

            {/* Delivery + meta */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7"/><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16 3l-4 4-4-4"/></svg>
                <div>
                  <div className="font-medium text-gray-800">Delivery</div>
                  <div className="text-xs">ঢাকার মধ্যে ৳80 · বাইরে ৳120</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                <div>
                  <div className="font-medium text-gray-800">Quality</div>
                  <div className="text-xs">Selected & tested</div>
                </div>
              </div>
            </div>

            {createdAt && <div className="mt-4 text-xs text-gray-400">Added: {createdAt}</div>}
          </div>
        </div>
      </div>

      {/* Mobile sticky buy */}
      <MobileBuyBar />

      {/* Order modal */}
      {showOrder && <OrderModal product={product} onClose={() => setShowOrder(false)} />}

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-6 right-6 text-white text-3xl z-50"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="max-w-[96%] max-h-[96%] bg-black/0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={product.images[selectedImage] || "/placeholder.png"} alt={product.title} className="max-w-full max-h-full object-contain rounded-md shadow-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
