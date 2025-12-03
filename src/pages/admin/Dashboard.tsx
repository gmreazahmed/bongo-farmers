import { useEffect, useState } from "react"
import { collection, query, getDocs, orderBy } from "firebase/firestore"
import { db } from "../../firebase/firebase"
import { Link } from "react-router-dom"

export default function Dashboard() {
  const [totalOrders, setTotalOrders] = useState(0)
  const [pending, setPending] = useState(0)
  const [confirmed, setConfirmed] = useState(0)
  const [revenueEstimate, setRevenueEstimate] = useState(0)
  const [, setLoading] = useState(false)

  useEffect(() => {
    fetchSummary()
  }, [])

  async function fetchSummary() {
    setLoading(true)
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() as any }))
      setTotalOrders(rows.length)
      setPending(rows.filter(r => r.status === "pending").length)
      setConfirmed(rows.filter(r => r.status === "confirmed").length)
      // revenue estimate: sum of grandTotal / totalPrice or unitPrice*quantity
      const revenue = rows.reduce((s, r) => s + (Number(r.grandTotal ?? r.totalPrice ?? (r.unitPrice * r.quantity)) || 0), 0)
      setRevenueEstimate(revenue)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div>
          <Link to="/admin/orders" className="text-sm px-3 py-2 bg-blue-600 text-white rounded">View Orders</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-r from-white to-blue-50 rounded shadow">
          <div className="text-sm text-gray-500">Total Orders</div>
          <div className="text-2xl font-bold">{totalOrders}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{pending}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Confirmed</div>
          <div className="text-2xl font-bold text-green-600">{confirmed}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Revenue (estimate)</div>
          <div className="text-2xl font-bold">৳ {revenueEstimate.toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2">Quick actions</h3>
        <div className="flex gap-3">
          <Link to="/admin/add-product" className="px-3 py-2 bg-emerald-500 text-white rounded">Add Product</Link>
          <Link to="/admin/products" className="px-3 py-2 bg-gray-200 rounded">Manage Products</Link>
          <Link to="/admin/orders" className="px-3 py-2 bg-blue-200 rounded">View Orders</Link>
        </div>
      </div>
    </>
  )
}
