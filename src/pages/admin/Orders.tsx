import { useEffect, useMemo, useState } from "react"
import { collection, query, orderBy, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore"
import { db } from "../../firebase/firebase"

function toCsv(rows: any[]) {
  const cols = ["id","productTitle","quantity","name","phone","address","status","createdAt"]
  const header = cols.join(",")
  const lines = rows.map(r => cols.map(c => {
    const v = r[c] ?? ""
    return `"${String(v).replace(/"/g,'""') }"`
  }).join(","))
  return [header,...lines].join("\n")
}

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([])
  const [selected, setSelected] = useState<Record<string,boolean>>({})
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(()=>{ fetchOrders() },[])

  async function fetchOrders() {
    setBusy(true)
    try {
      const q = query(collection(db,"orders"), orderBy("createdAt","desc"))
      const snap = await getDocs(q)
      setOrders(snap.docs.map(d=>({ id:d.id, ...d.data() })))
    } catch(e){ console.error(e) } finally { setBusy(false) }
  }

  async function confirmOrder(id: string) {
    setConfirmingId(id)
    try {
      await updateDoc(doc(db,"orders",id),{ status: "confirmed" })
      setOrders(prev => prev.map(o => o.id===id ? {...o, status:"confirmed"} : o))
      setSelected(s => ({ ...s, [id]: false }))
    } catch(e){ console.error(e) } finally { setConfirmingId(null) }
  }

  async function deleteOrder(id: string) {
    if (!confirm("Delete order?")) return
    setDeletingId(id)
    try {
      await deleteDoc(doc(db,"orders",id))
      setOrders(prev => prev.filter(o=>o.id!==id))
      setSelected(s => { const copy = { ...s }; delete copy[id]; return copy })
    } catch(e){ console.error(e) } finally { setDeletingId(null) }
  }

  function toggleSelect(id: string) {
    setSelected(s => ({ ...s, [id]: !s[id]}))
  }

  async function bulkConfirm() {
    const ids = Object.keys(selected).filter(k=>selected[k])
    if (!ids.length) { alert("No orders selected"); return }
    if (!confirm(`Confirm ${ids.length} orders?`)) return
    setBusy(true)
    try {
      for (const id of ids) {
        await updateDoc(doc(db,"orders",id), { status: "confirmed" })
      }
      await fetchOrders()
      setSelected({})
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function bulkDelete() {
    const ids = Object.keys(selected).filter(k=>selected[k])
    if (!ids.length) { alert("No orders selected"); return }
    if (!confirm(`Delete ${ids.length} orders?`)) return
    setBusy(true)
    try {
      for (const id of ids) {
        await deleteDoc(doc(db,"orders",id))
      }
      await fetchOrders()
      setSelected({})
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  function exportCsv() {
    const csv = toCsv(orders)
    const blob = new Blob([csv],{ type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "orders.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const selectedCount = useMemo(()=> Object.values(selected).filter(Boolean).length, [selected])

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">Manage customer orders — latest first</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm shadow-sm hover:shadow-md transition"
            title="Refresh"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6"/></svg>
            Refresh
          </button>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm shadow-sm transition"
            title="Export CSV"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5"/></svg>
            Export CSV
          </button>

          <button
            onClick={bulkConfirm}
            disabled={!selectedCount || busy}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm shadow-sm transition ${selectedCount ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            title="Confirm selected"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            Confirm ({selectedCount})
          </button>

          <button
            onClick={bulkDelete}
            disabled={!selectedCount || busy}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm shadow-sm transition ${selectedCount ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            title="Delete selected"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18"/><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete ({selectedCount})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3 w-12">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600"
                  onChange={(e)=> {
                    const checked = e.target.checked
                    const obj: Record<string,boolean> = {}
                    orders.forEach(o => obj[o.id] = checked)
                    setSelected(obj)
                  }}
                  aria-label="Select all"
                />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3 w-20">Qty</th>
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Address</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center w-40">Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-t hover:bg-gray-50 align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={!!selected[o.id]}
                    onChange={()=>toggleSelect(o.id)}
                    className="form-checkbox h-4 w-4 text-blue-600"
                    aria-label={`Select order ${o.id}`}
                  />
                </td>

                <td className="p-3 font-medium">
                  {o.productTitle}
                  <div className="text-xs text-gray-400 mt-1">{new Date((o.createdAt?.seconds || Date.now()/1000)*1000).toLocaleString()}</div>
                </td>

                <td className="p-3">{o.quantity}</td>
                <td className="p-3">{o.name}</td>
                <td className="p-3">{o.phone}</td>
                <td className="p-3 max-w-xs break-words">{o.address}</td>

                <td className="p-3">
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${o.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {o.status}
                  </span>
                </td>

                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {o.status !== "confirmed" && (
                      <button
                        onClick={()=>confirmOrder(o.id)}
                        disabled={confirmingId === o.id}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${confirmingId === o.id ? 'bg-blue-300 text-white cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        title="Confirm order"
                      >
                        {confirmingId === o.id ? 'Confirming...' : 'Confirm'}
                      </button>
                    )}

                    <button
                      onClick={()=>deleteOrder(o.id)}
                      disabled={deletingId === o.id}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${deletingId === o.id ? 'bg-red-300 text-white cursor-wait' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                      title="Delete order"
                    >
                      {deletingId === o.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {orders.length===0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
