// src/components/Footer.tsx
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-12">
      <div className="max-w-screen-xl mx-auto px-4 py-10">
        
        {/* Top Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-left">
          
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold text-white">Bongo Farmers</h3>
            <p className="text-sm text-gray-400 mt-2">
              Trusted organic & quality products delivered to your door.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Quick Links</h4>
            <div className="flex flex-col gap-2 text-gray-400">
              <Link to="/" className="hover:text-white transition">Home</Link>
              <Link to="/all-products" className="hover:text-white transition">Products</Link>
            </div>
          </div>

          {/* Social */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-white mb-3">Follow Us</h4>

            <div className="flex sm:justify-end justify-center gap-4">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/BongoFarmers"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22 12.07C22 6.48 17.52 2 11.93 2S2 6.48 2 12.07C2 17.09 5.66 21.22 10.44 22v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.9h-2.33V22c4.78-.78 8.44-4.91 8.44-9.93z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 my-6"></div>

        {/* Bottom Section */}
        <div className="text-center text-xs text-gray-500">
          © {year} Bongo Farmers — All Rights Reserved  
          <br />
          Developed by{" "}
          <a
            href="https://www.gmreaz.site/"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            GM Reaz
          </a>
        </div>
      </div>
    </footer>
  );
}
