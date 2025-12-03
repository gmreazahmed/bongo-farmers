// src/components/Navbar.tsx

import { Link } from "react-router-dom"

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 text-white rounded flex items-center justify-center font-bold">bdz</div>
              <div className="hidden md:block">
                <div className="font-semibold">bdz-ecommerce</div>
                <div className="text-xs text-gray-500">Simple store</div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-gray-700 hover:text-gray-900">Home</Link>
            <Link to="/all-products" className="text-sm text-gray-700 hover:text-gray-900">Products</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
