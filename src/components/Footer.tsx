// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="bg-white border-t mt-8">
      <div className="max-w-screen-xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} bdz-ecommerce • Developed by <a href="https://www.gmreaz.site/" className="text-blue-600 underline" target="_blank" rel="noreferrer">GM Reaz</a>
      </div>
    </footer>
  )
}
