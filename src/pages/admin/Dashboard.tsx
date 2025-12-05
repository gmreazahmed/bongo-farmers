// src/pages/admin/Dashboard.tsx
import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Link } from "react-router-dom";

type OrderRow = {
  id: string;
  createdAt?: any;
  status?: string;
  grandTotal?: number;
  unitPrice?: number;
  quantity?: number;
  name?: string;
  phone?: string;
  [k: string]: any;
};

export default function Dashboard() {
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [pending, setPending] = useState<number>(0);
  const [confirmed, setConfirmed] = useState<number>(0);
  const [revenueEstimate, setRevenueEstimate] = useState<number>(0);
  const [recent, setRecent] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    try {
      // load latest 200 orders for stats and show top 8 recent for list
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows: OrderRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setTotalOrders(rows.length);
      setPending(rows.filter((r) => r.status === "pending").length);
      setConfirmed(rows.filter((r) => r.status === "confirmed").length);

      const revenue = rows.reduce((s, r) => {
        const g = Number(r.grandTotal ?? r.totalPrice ?? (r.unitPrice && r.quantity ? r.unitPrice * r.quantity : 0)) || 0;
        return s + g;
      }, 0);
      setRevenueEstimate(revenue);

      // recent 8 (already ordered desc)
      setRecent(rows.slice(0, 8));
    } catch (err) {
      console.error(err);
      setError("সার্ভারে কিছু সমস্যা। পুনরায় চেষ্টা করুন।");
      setTotalOrders(0);
      setPending(0);
      setConfirmed(0);
      setRevenueEstimate(0);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">ড্যাশবোর্ড</h2>
          <p className="text-sm text-gray-500 mt-1">Store overview — দ্রুত সারসংক্ষেপ</p>
        </div>

        <div className="flex gap-2">
          <Link to="/admin/orders" className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded shadow text-sm">
            View Orders
          </Link>
          <Link to="/admin/add-product" className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded shadow text-sm">
            Add Product
          </Link>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white shadow-sm">
          <div className="text-xs text-gray-500">Total Orders</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{loading ? "…" : totalOrders}</div>
          <div className="text-xs text-gray-400 mt-1">All-time / synced</div>
        </div>

        <div className="p-4 rounded-lg bg-white shadow-sm">
          <div className="text-xs text-gray-500">Pending</div>
          <div className="mt-2 text-2xl font-bold text-yellow-600">{loading ? "…" : pending}</div>
          <div className="text-xs text-gray-400 mt-1">পরবর্তী অ্যাকশন অপেক্ষা করছে</div>
        </div>

        <div className="p-4 rounded-lg bg-white shadow-sm">
          <div className="text-xs text-gray-500">Confirmed</div>
          <div className="mt-2 text-2xl font-bold text-green-600">{loading ? "…" : confirmed}</div>
          <div className="text-xs text-gray-400 mt-1">সফল অর্ডার</div>
        </div>

        <div className="p-4 rounded-lg bg-white shadow-sm">
          <div className="text-xs text-gray-500">Revenue (estimate)</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">৳ {loading ? "…" : fmt(revenueEstimate)}</div>
          <div className="text-xs text-gray-400 mt-1">Estimated total income</div>
        </div>
      </div>

      {/* quick actions + error */}
      <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-3">
          <button onClick={fetchSummary} className="px-3 py-2 bg-white border rounded shadow-sm text-sm">Refresh</button>
          <Link to="/admin/products" className="px-3 py-2 bg-white border rounded shadow-sm text-sm">Manage Products</Link>
        </div>

        {error ? <div className="text-sm text-red-600">{error}</div> : <div className="text-sm text-gray-500">Last synced: {loading ? "…" : new Date().toLocaleString()}</div>}
      </div>

      {/* recent orders */}
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-3">Recent orders</h3>

        <div className="bg-white rounded-lg shadow-sm overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3 w-12">#</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">When</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading…</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">কোনো অর্ডার নেই।</td></tr>
              ) : (
                recent.map((r, i) => {
                  const when = r.createdAt && typeof r.createdAt === "object" && r.createdAt.toDate ? r.createdAt.toDate() : r.createdAt instanceof Date ? r.createdAt : null;
                  const whenText = when ? new Date(when).toLocaleString() : "-";
                  const total = Number(r.grandTotal ?? r.totalPrice ?? (r.unitPrice && r.quantity ? r.unitPrice * r.quantity : 0)) || 0;
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 align-top">{i + 1}</td>
                      <td className="p-3 align-top">
                        <div className="font-medium">{r.name ?? "Guest"}</div>
                        <div className="text-xs text-gray-500 mt-1">{r.phone ?? "-"}</div>
                      </td>
                      <td className="p-3 align-top text-xs text-gray-600">{(r.items && Array.isArray(r.items) ? r.items.length : (r.quantity ?? 1))}</td>
                      <td className="p-3 align-top">৳ {fmt(total)}</td>
                      <td className="p-3 align-top">
                        <span className={`text-xs px-2 py-1 rounded-full ${r.status === "confirmed" ? "bg-green-100 text-green-700" : r.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>
                          {r.status ?? "unknown"}
                        </span>
                      </td>
                      <td className="p-3 align-top text-xs text-gray-500">{whenText}</td>
                      <td className="p-3 align-top text-right">
                        <Link to={`/admin/orders`} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">View</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
