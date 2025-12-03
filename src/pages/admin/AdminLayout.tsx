import React, { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { auth } from "../../firebase/firebase" // adjust path if needed
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import toast from "react-hot-toast"

export default function AdminLayout() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u)
      // if user logs out while on admin subroute, optionally navigate to /admin
      if (!u) navigate("/admin", { replace: true })
    })
    return () => unsub()
  }, [navigate])

  async function login(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast.success("Welcome back")
      setEmail("")
      setPassword("")
    } catch (err) {
      console.error(err)
      toast.error("Login failed")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      toast.success("Logged out")
    } catch (err) {
      console.error(err)
      toast.error("Logout failed")
    }
  }

  // if not logged in -> show centered login form
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 text-center">Admin Login</h2>
          <form onSubmit={login} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
            <div className="flex items-center justify-between">
              <button disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded">
                {busy ? "Logging in..." : "Login"}
              </button>
              <button
                type="button"
                onClick={() => { setEmail("admin@example.com"); setPassword("password123") }}
                className="text-sm text-gray-500"
              >
                autofill demo
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Use Firebase-auth user credentials (create user in Firebase Console).</p>
          </form>
        </div>
      </div>
    )
  }

  // logged-in layout
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex gap-6">
          {/* SIDEBAR */}
          <aside className="w-60 hidden md:block">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Admin</h3>
                <div className="text-xs text-gray-500 mt-1">Signed in as <span className="font-medium">{user.email}</span></div>
              </div>

              <nav className="p-3">
                <NavLink to="/admin" end className={({isActive})=> `block px-3 py-2 rounded ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>Dashboard</NavLink>
                <NavLink to="/admin/orders" className={({isActive})=> `block px-3 py-2 rounded mt-1 ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>Orders</NavLink>
                <NavLink to="/admin/products" className={({isActive})=> `block px-3 py-2 rounded mt-1 ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>Products</NavLink>
                <NavLink to="/admin/add-product" className={({isActive})=> `block px-3 py-2 rounded mt-1 ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>Add Product</NavLink>
              </nav>

              <div className="p-3 border-t">
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded bg-red-600 text-white">Logout</button>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <div className="flex-1">
            {/* topbar for small screens & header */}
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Admin Panel</h1>
                <p className="text-sm text-gray-500">Manage orders & products</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={logout} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded">Logout</button>
              </div>
            </div>

            {/* content outlet */}
            <div className="bg-white rounded-lg shadow p-4 min-h-[60vh]">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
