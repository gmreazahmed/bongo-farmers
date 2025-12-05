// src/components/Navbar.tsx
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/Bongo_Farmer.png"
              alt="Bongo Farmers"
              className="w-10 h-10 rounded-md object-cover shadow-sm"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-gray-900">Bongo Farmers</div>
              <div className="text-xs text-gray-500">Trusted local store</div>
            </div>
          </Link>

          {/* Desktop menu */}
          <nav className="hidden sm:flex items-center gap-6">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm ${
                  isActive ? "text-indigo-600 font-semibold" : "text-gray-700 hover:text-gray-900"
                }`
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/all-products"
              className={({ isActive }) =>
                `text-sm ${
                  isActive ? "text-indigo-600 font-semibold" : "text-gray-700 hover:text-gray-900"
                }`
              }
            >
              Products
            </NavLink>
          </nav>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="sm:hidden flex items-center justify-center p-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="sm:hidden mt-2 pb-4">
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 block"
              >
                Home
              </Link>

              <Link
                to="/all-products"
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 block"
              >
                Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
