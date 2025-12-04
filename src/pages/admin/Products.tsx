// src/pages/admin/Products.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import toast from "react-hot-toast";

type Product = {
  id: string;
  slug?: string | null;
  title?: string;
  description?: string;
  price?: number;
  regularPrice?: number | null;
  images?: string[];
  category?: string | null;
  createdAt?: any;
  [k: string]: any;
};

function toCsv(rows: Product[]) {
  const cols = ["id", "slug", "title", "price", "regularPrice", "images", "category"];
  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        const v = (r as any)[c] ?? "";
        const s = Array.isArray(v) ? (v as string[]).join("|") : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function slugify(s: string) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [perPage, setPerPage] = useState(12);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const qref = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qref);
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error(e);
      toast.error("Products load failed");
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => {
      if (p.category) s.add(String(p.category));
    });
    return Array.from(s);
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = products.slice();
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    if (term) {
      list = list.filter(
        (p) =>
          (p.title || "").toString().toLowerCase().includes(term) ||
          (p.description || "").toString().toLowerCase().includes(term)
      );
    }
    return list;
  }, [products, q, categoryFilter]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [perPage, q, categoryFilter]);

  function toggleSelect(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((p) => p.filter((x) => x.id !== id));
      setSelected((s) => {
        const copy = { ...s };
        delete copy[id];
        return copy;
      });
      toast.success("Deleted");
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  }

  async function bulkDelete() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) {
      alert("No products selected");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} products?`)) return;
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, "products", id));
      }
      await fetchProducts();
      setSelected({});
      toast.success("Deleted selected");
    } catch (e) {
      console.error(e);
      toast.error("Bulk delete failed");
    }
  }

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Edit modal helpers

  function openEdit(p: Product) {
    setEditing({
      id: p.id,
      slug: p.slug ?? "",
      title: p.title ?? "",
      description: p.description ?? "",
      price: typeof p.price === "number" ? p.price : p.price ? Number(p.price) : 0,
      regularPrice: p.regularPrice === undefined || p.regularPrice === null ? null : Number(p.regularPrice),
      images: Array.isArray(p.images) ? p.images : p.images ? [String(p.images)] : [],
      category: p.category ?? "",
    });
  }

  function addImageUrl(url: string) {
    setEditing((e) => {
      if (!e) return e;
      const imgs = Array.isArray(e.images) ? [...e.images, url] : [url];
      return { ...e, images: imgs };
    });
  }

  function removeImageAt(index: number) {
    setEditing((e) => {
      if (!e) return e;
      const imgs = Array.isArray(e.images) ? [...e.images] : [];
      imgs.splice(index, 1);
      return { ...e, images: imgs };
    });
  }

  function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = URL.createObjectURL(f);
      addImageUrl(url);
    }
    e.currentTarget.value = "";
  }

  // robust saveEdit with safe coercions
  async function saveEdit() {
    if (!editing) return;
    if (!editing.title || String(editing.title).trim() === "") {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const id = editing.id;

      // helpers
      const parseNumber = (v: any): number | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number") return v;
        const cleaned = String(v).replace(/[^\d.-]/g, "");
        const n = parseFloat(cleaned);
        return Number.isNaN(n) ? null : n;
      };

      const parseImages = (imgs: any): string[] => {
        if (!imgs) return [];
        if (Array.isArray(imgs)) return imgs.map((x) => String(x));
        if (typeof imgs === "string") {
          return imgs
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [String(imgs)];
      };

      const title = String(editing.title ?? "").trim();
      const description = editing.description != null ? String(editing.description) : "";
      const parsedPrice = parseNumber(editing.price) ?? 0;
      const parsedRegularPrice = parseNumber(editing.regularPrice);
      const parsedImages = parseImages(editing.images);
      const parsedCategory = editing.category == null ? null : String(editing.category).trim() || null;
      const parsedSlug =
        editing.slug == null ? null : String(editing.slug).trim() === "" ? null : String(editing.slug).trim();

      const payload: Partial<Product> = {
        title,
        description,
        price: parsedPrice,
        regularPrice: parsedRegularPrice === null ? null : parsedRegularPrice,
        images: parsedImages,
        category: parsedCategory,
      };

      // Only include slug if user provided something (to avoid wiping DB unintentionally).
      if (parsedSlug !== null) {
        payload.slug = parsedSlug;
      }

      await updateDoc(doc(db, "products", id), payload);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)));
      toast.success("Product updated");
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  // page slice
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Products</h2>
          <p className="text-sm text-gray-500 mt-1">Manage store products — add / edit / delete</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/add-product"
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm shadow"
          >
            ➕ Add Product
          </Link>

          <button onClick={exportCsv} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm shadow">
            Export CSV
          </button>

          <button onClick={bulkDelete} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm shadow">
            Delete Selected
          </button>

          <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-white">
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "grid" | "table")} className="text-sm outline-none">
              <option value="grid">Grid</option>
              <option value="table">Table</option>
            </select>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
              }}
              className="text-sm outline-none"
            >
              <option value={8}>8 / page</option>
              <option value={12}>12 / page</option>
              <option value={24}>24 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
        <div className="flex items-center gap-2 bg-white border rounded px-3 py-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or description" className="outline-none text-sm" />
          {q && (
            <button onClick={() => setQ("")} className="text-sm text-gray-400">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setCategoryFilter(null)} className={`px-3 py-1 text-sm rounded ${!categoryFilter ? "bg-blue-600 text-white" : "bg-white border"}`}>All</button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter((s: string | null) => (s === c ? null : c))}
              className={`px-3 py-1 text-sm rounded ${categoryFilter === c ? "bg-blue-600 text-white" : "bg-white border"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* content */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-3 flex flex-col">
              <div className="h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                <img src={(p.images && p.images[0]) || "/placeholder.png"} alt={p.title} className="w-full h-full object-cover" />
              </div>

              <div className="mt-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{typeof p.description === "string" ? p.description : ""}</div>
                  </div>

                  <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleSelect(p.id)} className="ml-2 mt-1" aria-label={`select ${p.title}`} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">৳ {Number(p.price || 0).toLocaleString()}</div>
                    {p.regularPrice ? <div className="text-xs text-gray-400 line-through">৳ {Number(p.regularPrice).toLocaleString()}</div> : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Edit</button>
                      <button onClick={() => deleteProduct(p.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                    </div>
                    <Link to={`/product/${p.slug ?? p.id}`} className="text-xs text-blue-600">View on site →</Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3 w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const obj: Record<string, boolean> = {};
                      pageItems.forEach((pi) => (obj[pi.id] = checked));
                      setSelected((s) => ({ ...s, ...obj }));
                    }}
                  />
                </th>
                <th className="p-3">Title</th>
                <th className="p-3 w-28">Price</th>
                <th className="p-3">Category</th>
                <th className="p-3 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3"><input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleSelect(p.id)} /></td>
                  <td className="p-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">{p.images && p.images[0]}</div>
                  </td>
                  <td className="p-3">৳ {Number(p.price || 0).toLocaleString()}</td>
                  <td className="p-3">{p.category || "-"}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => openEdit(p)} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Edit</button>
                      <button onClick={() => deleteProduct(p.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                      <Link to={`/product/${p.slug ?? p.id}`} className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm">View</Link>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} - {Math.min(filtered.length, page * perPage)} of {filtered.length}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page === 1}>Prev</button>
          <div className="px-3 text-sm">{page} / {totalPages}</div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page === totalPages}>Next</button>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4 overflow-auto">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">Edit Product</h3>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-800">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-gray-600">Images</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(editing.images || []).map((img, i) => (
                    <div key={i} className="relative rounded overflow-hidden border">
                      <img src={img} alt={`img-${i}`} className="w-full h-20 object-cover" />
                      <button onClick={() => removeImageAt(i)} className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded" title="Remove">✕</button>
                    </div>
                  ))}
                  {(!editing.images || editing.images.length === 0) && (
                    <div className="col-span-3 text-xs text-gray-400 p-3 border rounded text-center">No images yet</div>
                  )}
                </div>

                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Add image URL and press Enter"
                    className="w-full border px-3 py-2 rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          addImageUrl(val);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-gray-600">Or upload files (local preview)</label>
                  <input type="file" multiple accept="image/*" onChange={handleImageFiles} className="mt-2" />
                  <p className="text-xs text-gray-400 mt-2">Note: uploaded files are only locally previewed. Integrate storage upload to persist files.</p>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600">Title</label>
                      <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full border px-3 py-2 rounded" placeholder="Product title" />
                    </div>

                    <div className="w-48">
                      <label className="text-xs font-medium text-gray-600">Category</label>
                      <input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full border px-3 py-2 rounded" placeholder="Category" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600">Slug</label>
                      <div className="flex gap-2">
                        <input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full border px-3 py-2 rounded" placeholder="kumar-bori" />
                        <button onClick={() => setEditing({ ...editing, slug: slugify(editing.title || "") })} className="px-3 py-2 bg-gray-100 border rounded text-sm" title="Generate from title">Auto</button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Use only letters, numbers and hyphens. Keep unique.</p>
                    </div>

                    <div className="w-40">
                      <label className="text-xs font-medium text-gray-600">Price</label>
                      <input type="number" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full border px-3 py-2 rounded" />
                    </div>

                    <div className="w-44">
                      <label className="text-xs font-medium text-gray-600">Regular price</label>
                      <input
                        type="number"
                        value={editing.regularPrice ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            regularPrice: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-full border px-3 py-2 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600">Description</label>
                    <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full border px-3 py-2 rounded" rows={4} placeholder="Write a short description..." />
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} className={`px-4 py-2 rounded text-sm ${saving ? "bg-blue-300 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-400">Tip: press Enter in the "Add image URL" box to quickly add image links.</div>
          </div>
        </div>
      )}
    </div>
  );
}
