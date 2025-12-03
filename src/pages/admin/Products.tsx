// src/pages/admin/Products.tsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore"
import { db } from "../../firebase/firebase" // <-- adjust path if needed
import toast from "react-hot-toast"

type Product = any

function toCsv(rows: any[]) {
  const cols = ["id", "title", "price", "regularPrice", "images", "category"]
  const header = cols.join(",")
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        const v = r[c] ?? ""
        const s = Array.isArray(v) ? v.join("|") : String(v)
        return `"${s.replace(/"/g, '""')}"`
      })
      .join(",")
  )
  return [header, ...lines].join("\n")
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [perPage, setPerPage] = useState(12)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    try {
      const qref = query(collection(db, "products"), orderBy("createdAt", "desc"))
      const snap = await getDocs(qref)
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error(e)
      toast.error("Products load failed")
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const s = new Set<string>()
    products.forEach((p) => {
      if (p.category) s.add(p.category)
    })
    return Array.from(s)
  }, [products])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = products.slice()
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter)
    if (term) {
      list = list.filter(
        (p) =>
          (p.title || "").toString().toLowerCase().includes(term) ||
          (p.description || "").toString().toLowerCase().includes(term)
      )
    }
    return list
  }, [products, q, categoryFilter])

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [totalPages, page])

  function toggleSelect(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return
    try {
      await deleteDoc(doc(db, "products", id))
      setProducts((p) => p.filter((x) => x.id !== id))
      toast.success("Deleted")
    } catch (e) {
      console.error(e)
      toast.error("Delete failed")
    }
  }

  async function bulkDelete() {
    const ids = Object.keys(selected).filter((k) => selected[k])
    if (!ids.length) { alert("No products selected"); return }
    if (!confirm(`Delete ${ids.length} products?`)) return
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, "products", id))
      }
      await fetchProducts()
      setSelected({})
      toast.success("Deleted selected")
    } catch (e) {
      console.error(e)
      toast.error("Bulk delete failed")
    }
  }

  function exportCsv() {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "products.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // edit handlers (simple inline modal)
  function openEdit(p: Product) {
    setEditing({ ...p })
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const id = editing.id
      const payload = {
        title: editing.title,
        description: editing.description,
        price: Number(editing.price) || 0,
        regularPrice: editing.regularPrice ? Number(editing.regularPrice) : null,
        images: Array.isArray(editing.images) ? editing.images : (editing.images ? [String(editing.images)] : []),
        category: editing.category || null,
      }
      await updateDoc(doc(db, "products", id), payload)
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)))
      toast.success("Product updated")
      setEditing(null)
    } catch (e) {
      console.error(e)
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  // slice for current page
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Products</h2>
          <p className="text-sm text-gray-500 mt-1">Manage store products — add / edit / delete</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/add-product" className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm shadow">
            ➕ Add Product
          </Link>

          <button onClick={exportCsv} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm shadow">Export CSV</button>

          <button onClick={bulkDelete} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm shadow">Delete Selected</button>

          <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-white">
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className="text-sm outline-none">
              <option value="grid">Grid</option>
              <option value="table">Table</option>
            </select>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="text-sm outline-none">
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
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search title or description" className="outline-none text-sm" />
          {q && <button onClick={()=>setQ("")} className="text-sm text-gray-400">✕</button>}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={()=>setCategoryFilter(null)} className={`px-3 py-1 text-sm rounded ${!categoryFilter ? "bg-blue-600 text-white" : "bg-white border"}`}>All</button>
          {categories.map(c=>(
            <button key={c} onClick={()=>setCategoryFilter(s=> s===c ? null : c)} className={`px-3 py-1 text-sm rounded ${categoryFilter===c ? "bg-blue-600 text-white" : "bg-white border"}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* content */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map(p => (
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

                  <input type="checkbox" checked={!!selected[p.id]} onChange={()=>toggleSelect(p.id)} className="ml-2 mt-1" aria-label={`select ${p.title}`} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">৳ {Number(p.price || 0).toLocaleString()}</div>
                    {p.regularPrice ? <div className="text-xs text-gray-400 line-through">৳ {Number(p.regularPrice).toLocaleString()}</div> : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button onClick={()=>openEdit(p)} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Edit</button>
                      <button onClick={()=>deleteProduct(p.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                    </div>
                    <Link to={`/product/${p.id}`} className="text-xs text-blue-600">View on site →</Link>
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
                  <input type="checkbox" onChange={(e)=> {
                    const checked = e.target.checked
                    const obj: Record<string, boolean> = {}
                    pageItems.forEach(pi => obj[pi.id] = checked)
                    setSelected(s => ({ ...s, ...obj }))
                  }} />
                </th>
                <th className="p-3">Title</th>
                <th className="p-3 w-28">Price</th>
                <th className="p-3">Category</th>
                <th className="p-3 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3"><input type="checkbox" checked={!!selected[p.id]} onChange={()=>toggleSelect(p.id)} /></td>
                  <td className="p-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">{p.images && p.images[0]}</div>
                  </td>
                  <td className="p-3">৳ {Number(p.price || 0).toLocaleString()}</td>
                  <td className="p-3">{p.category || "-"}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={()=>openEdit(p)} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Edit</button>
                      <button onClick={()=>deleteProduct(p.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
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
        <div className="text-sm text-gray-500">Showing {Math.min(filtered.length, (page-1)*perPage + 1)} - {Math.min(filtered.length, page*perPage)} of {filtered.length}</div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page===1}>Prev</button>
          <div className="px-3 text-sm">{page} / {totalPages}</div>
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 bg-white border rounded disabled:opacity-50" disabled={page===totalPages}>Next</button>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-xl rounded-lg shadow p-5">
            <h3 className="text-lg font-semibold mb-3">Edit Product</h3>

            <div className="grid grid-cols-1 gap-3">
              <input value={editing.title} onChange={(e)=>setEditing({...editing, title: e.target.value})} className="border px-3 py-2 rounded" />
              <textarea value={editing.description} onChange={(e)=>setEditing({...editing, description: e.target.value})} className="border px-3 py-2 rounded" rows={4} />
              <div className="flex gap-2">
                <input type="number" value={editing.price ?? ""} onChange={(e)=>setEditing({...editing, price: Number(e.target.value)})} className="border px-3 py-2 rounded w-1/2" placeholder="Price" />
                <input type="number" value={editing.regularPrice ?? ""} onChange={(e)=>setEditing({...editing, regularPrice: e.target.value ? Number(e.target.value) : ""})} className="border px-3 py-2 rounded w-1/2" placeholder="Regular price (optional)" />
              </div>
              <input value={(editing.images && editing.images.join("\n")) || ""} onChange={(e)=>setEditing({...editing, images: e.target.value.split("\n").map(s=>s.trim()).filter(Boolean)})} className="border px-3 py-2 rounded" placeholder="Image URLs (one per line)" />
              <input value={editing.category || ""} onChange={(e)=>setEditing({...editing, category: e.target.value})} className="border px-3 py-2 rounded" placeholder="Category (optional)" />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className={`px-4 py-2 rounded ${saving ? "bg-blue-300 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
