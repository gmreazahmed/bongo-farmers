// src/pages/admin/AdminLayout.tsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { auth } from "../../firebase/firebase"; // adjust path if needed
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import toast from "react-hot-toast";

export default function AdminLayout() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      // if user logs out while on admin subroute, optionally navigate to /admin
      if (!u) navigate("/admin", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  async function login(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success("Welcome back");
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Login failed — credentials incorrect?");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      toast.success("Logged out");
      // navigate back to admin landing (optional)
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    }
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            {/* logo: replace path if needed (public/Bongo_Farmer.png) */}
            <img src="/Bongo_Farmer.png" alt="Bongo Farmers" className="w-12 h-12 object-contain" />
            <div>
              <h2 className="text-2xl font-semibold">Admin Login</h2>
              <p className="text-xs text-gray-400">Secure area — admin only</p>
            </div>
          </div>

          <form onSubmit={login} className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoComplete="username"
            />

            <label className="block text-xs font-medium text-gray-600">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
              >
                {busy ? "Logging in..." : "Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("admin@example.com");
                  setPassword("password123");
                }}
                className="text-sm text-gray-500 underline"
              >
                Autofill demo
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Use Firebase-auth user credentials (create user in Firebase Console).
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Logged-in layout
  const NavItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-md text-sm font-medium ${
          isActive ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
        }`
      }
      onClick={() => setMobileOpen(false)}
    >
      {children}
    </NavLink>
  );

  const initials = (user?.displayName || user?.email || "A")
    .toString()
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        {/* Topbar */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((s) => !s)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md bg-white border shadow-sm"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <img src="/Bongo_Farmer.png" alt="Bongo Farmers" className="w-10 h-10 object-contain rounded" />
              <div>
                <div className="text-lg font-semibold">Bongo Farmers</div>
                <div className="text-xs text-gray-500 hidden sm:block">Admin panel</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 bg-white border rounded px-3 py-1">
              <div className="text-xs text-gray-500">Signed in as</div>
              <div className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{user?.email}</div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar (desktop) */}
          <aside className="w-64 hidden md:block">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                    {initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{user?.displayName || "Admin"}</div>
                    <div className="text-xs text-gray-500">{user?.email}</div>
                  </div>
                </div>
              </div>

              <nav className="p-3 space-y-1">
                <NavItem to="/admin">Dashboard</NavItem>
                <NavItem to="/admin/orders">Orders</NavItem>
                <NavItem to="/admin/products">Products</NavItem>
                <NavItem to="/admin/add-product">Add Product</NavItem>
              </nav>

              <div className="p-3 border-t">
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded bg-red-600 text-white">
                  Logout
                </button>
              </div>
            </div>
          </aside>

          {/* Mobile drawer */}
          {mobileOpen && (
            <div className="md:hidden fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4 overflow-auto shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src="/Bongo_Farmer.png" alt="logo" className="w-10 h-10 object-contain" />
                    <div>
                      <div className="font-semibold">Admin</div>
                      <div className="text-xs text-gray-500">{user?.email}</div>
                    </div>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:bg-gray-100">
                    ✕
                  </button>
                </div>

                <nav className="flex flex-col gap-1">
                  <NavItem to="/admin">Dashboard</NavItem>
                  <NavItem to="/admin/orders">Orders</NavItem>
                  <NavItem to="/admin/products">Products</NavItem>
                  <NavItem to="/admin/add-product">Add Product</NavItem>
                </nav>

                <div className="mt-4">
                  <button onClick={logout} className="w-full px-3 py-2 bg-red-600 text-white rounded">Logout</button>
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Admin Panel</h1>
                <p className="text-sm text-gray-500">Manage orders & products</p>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <button onClick={() => navigate("/admin/add-product")} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">
                  ➕ Add Product
                </button>
                <button onClick={() => navigate("/admin/products")} className="px-3 py-2 bg-white border rounded text-sm">
                  Manage Products
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 min-h-[60vh]">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
