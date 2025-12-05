// src/pages/admin/Orders.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, query, orderBy, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

/** CSV helper (unchanged) */
function toCsv(rows: any[]) {
  const cols = ["id", "productTitle", "quantity", "totalWeightKg", "unitPrice", "grandTotal", "name", "phone", "address", "status", "createdAt"];
  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        const v = r[c] ?? "";
        return `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

/** Try to compute total weight (kg) for an order object.
 * Supports:
 *  - order.unitWeightKg (number, kg per item)
 *  - order.unitWeight (number, either grams or kg; heuristic: <10 => kg else grams)
 *  - order.weightLabel (string like "500g", "1kg", "0.5 kg")
 * Fallback: assume 1 kg per item.
 */
function computeOrderWeightKg(order: any) {
  const qty = Number(order.quantity || 0);
  if (qty <= 0) return 0;

  // 1) explicit kg per item
  if (order.unitWeightKg != null && !Number.isNaN(Number(order.unitWeightKg))) {
    return Number(order.unitWeightKg) * qty;
  }

  // 2) numeric unitWeight ambiguous: if it's < 10 treat as kg, else as grams
  if (order.unitWeight != null && !Number.isNaN(Number(order.unitWeight))) {
    const uw = Number(order.unitWeight);
    if (uw > 0 && uw < 10) {
      return uw * qty; // kg
    } else if (uw > 0) {
      return (uw / 1000) * qty; // grams -> kg
    }
  }

  // 3) parse weightLabel string like "500g", "1kg", "0.5 kg"
  if (order.weightLabel && typeof order.weightLabel === "string") {
    const m = order.weightLabel.toLowerCase().match(/([\d.,]+)\s*(kg|g)?/);
    if (m) {
      const num = parseFloat(m[1].replace(",", "."));
      const unit = (m[2] || "").trim();
      if (!Number.isNaN(num)) {
        if (unit === "kg") return num * qty;
        if (unit === "g") return (num / 1000) * qty;
        // if no unit, heuristics:
        return num < 10 ? num * qty : (num / 1000) * qty;
      }
    }
  }

  // fallback: assume 1 kg per item
  return 1 * qty;
}

/** compute grand total for order: prefer grandTotal, else itemsTotal, else unitPrice*quantity */
function computeOrderTotal(order: any) {
  const q = Number(order.quantity || 0);
  const unit = Number(order.unitPrice || order.price || 0);
  if (order.grandTotal != null && !Number.isNaN(Number(order.grandTotal))) return Number(order.grandTotal);
  if (order.itemsTotal != null && !Number.isNaN(Number(order.itemsTotal))) return Number(order.itemsTotal) + Number(order.deliveryFee || 0);
  return unit * q + Number(order.deliveryFee || 0);
}

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setBusy(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      // normalize: compute derived fields and keep raw
      const rows = snap.docs.map((d) => {
        const r = { id: d.id, ...d.data() } as any;
        r._weightKg = computeOrderWeightKg(r);
        r._grandTotal = computeOrderTotal(r);
        return r;
      });
      setOrders(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder(id: string) {
    setConfirmingId(id);
    try {
      await updateDoc(doc(db, "orders", id), { status: "confirmed" });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "confirmed" } : o)));
      setSelected((s) => ({ ...s, [id]: false }));
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmingId(null);
    }
  }

  async function deleteOrder(id: string) {
    if (!confirm("Delete order?")) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "orders", id));
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setSelected((s) => {
        const copy = { ...s };
        delete copy[id];
        return copy;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function bulkConfirm() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) {
      alert("No orders selected");
      return;
    }
    if (!confirm(`Confirm ${ids.length} orders?`)) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await updateDoc(doc(db, "orders", id), { status: "confirmed" });
      }
      await fetchOrders();
      setSelected({});
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) {
      alert("No orders selected");
      return;
    }
    if (!confirm(`Delete ${ids.length} orders?`)) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, "orders", id));
      }
      await fetchOrders();
      setSelected({});
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    // include derived fields for export
    const rowsForCsv = orders.map((o) => ({
      ...o,
      totalWeightKg: o._weightKg ?? computeOrderWeightKg(o),
      grandTotal: o._grandTotal ?? computeOrderTotal(o),
    }));
    const csv = toCsv(rowsForCsv);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  // aggregates
  const aggregates = useMemo(() => {
    const totalOrders = orders.length;
    const totalQty = orders.reduce((s, o) => s + (Number(o.quantity || 0) || 0), 0);
    const totalWeightKg = orders.reduce((s, o) => s + (Number(o._weightKg ?? computeOrderWeightKg(o)) || 0), 0);
    const totalRevenue = orders.reduce((s, o) => s + (Number(o._grandTotal ?? computeOrderTotal(o)) || 0), 0);
    return { totalOrders, totalQty, totalWeightKg, totalRevenue };
  }, [orders]);

  const fmtPrice = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const fmtKg = (n: number) => {
    if (n === 0) return "0 kg";
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} kg`;
  };

  return (
    <>
      {/* top bar with aggregates */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">Manage customer orders — latest first</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-white px-3 py-2 rounded shadow text-sm">
            <div className="text-xs text-gray-500">Orders</div>
            <div className="font-semibold">{aggregates.totalOrders}</div>
          </div>

          <div className="bg-white px-3 py-2 rounded shadow text-sm">
            <div className="text-xs text-gray-500">Total items</div>
            <div className="font-semibold">{aggregates.totalQty}</div>
          </div>

          <div className="bg-white px-3 py-2 rounded shadow text-sm">
            <div className="text-xs text-gray-500">Total weight</div>
            <div className="font-semibold">{fmtKg(aggregates.totalWeightKg)}</div>
          </div>

          <div className="bg-white px-3 py-2 rounded shadow text-sm">
            <div className="text-xs text-gray-500">Estimated revenue</div>
            <div className="font-semibold">৳ {fmtPrice(aggregates.totalRevenue)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm shadow-sm hover:shadow-md transition"
              title="Refresh"
            >
              Refresh
            </button>

            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm shadow-sm transition"
              title="Export CSV"
            >
              Export CSV
            </button>

            <button
              onClick={bulkConfirm}
              disabled={!selectedCount || busy}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm shadow-sm transition ${selectedCount ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              Confirm ({selectedCount})
            </button>

            <button
              onClick={bulkDelete}
              disabled={!selectedCount || busy}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm shadow-sm transition ${selectedCount ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              Delete ({selectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3 w-12">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600"
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const obj: Record<string, boolean> = {};
                    orders.forEach((o) => (obj[o.id] = checked));
                    setSelected(obj);
                  }}
                  aria-label="Select all"
                />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3 w-20">Qty</th>
              <th className="p-3 w-36">Weight</th>
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Address</th>
              <th className="p-3">Total (৳)</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center w-40">Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50 align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={!!selected[o.id]}
                    onChange={() => toggleSelect(o.id)}
                    className="form-checkbox h-4 w-4 text-blue-600"
                    aria-label={`Select order ${o.id}`}
                  />
                </td>

                <td className="p-3 font-medium">
                  {o.productTitle}
                  <div className="text-xs text-gray-400 mt-1">{new Date((o.createdAt?.seconds || Date.now() / 1000) * 1000).toLocaleString()}</div>
                </td>

                <td className="p-3">{o.quantity}</td>

                <td className="p-3">
                  <div className="text-sm font-medium">{fmtKg(Number(o._weightKg ?? computeOrderWeightKg(o)))}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {o.unitWeightKg != null
                      ? `${o.unitWeightKg} kg / item`
                      : o.unitWeight != null
                      ? `${o.unitWeight}${Number(o.unitWeight) < 10 ? " kg" : " g"} / item`
                      : o.weightLabel
                      ? `${o.weightLabel} / item`
                      : "1 kg / item (assumed)"}
                  </div>
                </td>

                <td className="p-3">{o.name}</td>
                <td className="p-3">{o.phone}</td>
                <td className="p-3 max-w-xs break-words">{o.address}</td>

                <td className="p-3">৳ {fmtPrice(Number(o._grandTotal ?? computeOrderTotal(o)))}</td>

                <td className="p-3">
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${o.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {o.status ?? "pending"}
                  </span>
                </td>

                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {o.status !== "confirmed" && (
                      <button
                        onClick={() => confirmOrder(o.id)}
                        disabled={confirmingId === o.id}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${confirmingId === o.id ? "bg-blue-300 text-white cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                      >
                        {confirmingId === o.id ? "Confirming..." : "Confirm"}
                      </button>
                    )}

                    <button
                      onClick={() => deleteOrder(o.id)}
                      disabled={deletingId === o.id}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${deletingId === o.id ? "bg-red-300 text-white cursor-wait" : "bg-red-600 hover:bg-red-700 text-white"}`}
                    >
                      {deletingId === o.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {orders.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-gray-500">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
