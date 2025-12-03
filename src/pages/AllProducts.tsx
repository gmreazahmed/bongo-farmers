// src/pages/AllProducts.tsx
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PRODUCTS as LOCAL_PRODUCTS } from "../data/products";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

type Product = {
  id: string;
  title: string;
  description?: string;
  price: number;
  regularPrice?: number;
  images: string[];
  category?: string;
};

export default function AllProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  // UI filters
  const [queryText, setQueryText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [sort, setSort] = useState<"latest" | "price-asc" | "price-desc">("latest");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(200));
        const snap = await getDocs(q);
        const firebaseProducts: Product[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title || "",
            description: data.description || "",
            price: Number(data.price || 0),
            regularPrice: data.regularPrice ? Number(data.regularPrice) : undefined,
            images: Array.isArray(data.images) ? data.images : data.images ? [data.images] : [],
            category: data.category,
          };
        });

        const map = new Map<string, Product>();
        LOCAL_PRODUCTS.forEach((p) => map.set(p.id, p));
        firebaseProducts.forEach((p) => map.set(p.id, p));
        const finalList = Array.from(map.values());

        if (!mounted) return;
        setProducts(finalList);
      } catch (err) {
        console.error(err);
        setError("Firebase থেকে পণ্য আনা যায়নি — লোকাল পণ্য দেখানো হচ্ছে।");
        setProducts(LOCAL_PRODUCTS);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // categories (from products)
  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => {
      if (p.category) s.add(String(p.category));
    });
    return ["all", ...Array.from(s)];
  }, [products]);

  // filtered & sorted products
  const filtered = useMemo(() => {
    let list = products.slice();

    if (activeCategory !== "all") {
      list = list.filter((p) => String(p.category) === activeCategory);
    }

    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }

    if (sort === "price-asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "price-desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    // latest is original order from server/local
    return list;
  }, [products, queryText, activeCategory, sort]);

  const shown = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Products</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filtered.length} টি পণ্য {error && <span className="ml-2 text-red-500">· {error}</span>}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <input
                value={queryText}
                onChange={(e) => { setQueryText(e.target.value); setVisibleCount(12); }}
                placeholder="প্রোডাক্ট সার্চ করুন..."
                className="w-full sm:w-64 pl-10 pr-3 py-2 rounded-lg border bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                aria-label="Search products"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="text-sm rounded-lg border px-3 py-2 bg-white shadow-sm"
                aria-label="Sort products"
              >
                <option value="latest">Latest</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* category chips */}
        <div className="mb-6 flex flex-wrap gap-3">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => { setActiveCategory(c as any); setVisibleCount(12); }}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                activeCategory === c ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        {/* grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">কোনো পণ্য পাওয়া যায়নি।</div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {shown.map((p) => (
                    <article
                      key={p.id}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border hover:shadow-xl transition"
                    >
                      <div className="relative">
                        <Link to={`/product/${p.id}`} className="block">
                          <div className="w-full h-48 bg-gray-100 overflow-hidden">
                            <img
                              src={p.images?.[0] || "/placeholder.png"}
                              alt={p.title}
                              className="w-full h-full object-cover transform hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          </div>
                        </Link>

                        <div className="absolute left-3 top-3 bg-white/95 px-3 py-1 rounded-full text-sm font-semibold text-indigo-700 shadow">
                          ৳ {Number(p.price).toLocaleString()}
                        </div>

                        {p.regularPrice && (
                          <div className="absolute right-3 top-3 bg-white/95 px-2 py-0.5 rounded text-xs text-gray-400 line-through">
                            ৳ {Number(p.regularPrice).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="text-base font-semibold text-gray-800 line-clamp-2">{p.title}</h3>
                        <p className="text-xs text-gray-500 mt-2 line-clamp-3 flex-1">{p.description}</p>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-sm text-gray-600">{p.category ?? ""}</div>
                          <Link
                            to={`/product/${p.id}`}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
                            aria-label={`View ${p.title}`}
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* load more */}
                {filtered.length > 12 && (
                  <div className="mt-8 text-center">
                    {canLoadMore ? (
                      <button
                        onClick={() => setVisibleCount((v) => v + 12)}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-white border rounded-full shadow hover:shadow-md"
                      >
                        Load more
                      </button>
                    ) : (
                      <button
                        onClick={() => setVisibleCount(12)}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-white border rounded-full shadow hover:shadow-md"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
