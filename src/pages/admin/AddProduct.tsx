// src/pages/admin/AddProduct.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
// optional site URL for preview (set VITE_PUBLIC_SITE_URL=https://yourdomain.com)
const SITE_BASE = (import.meta.env.VITE_PUBLIC_SITE_URL as string) || (typeof window !== "undefined" ? window.location.origin : "");

type ProductPayload = {
  title: string;
  description?: string;
  price: number;
  regularPrice?: number | null;
  images: string[];
  createdAt: Date;
  slug?: string;
};

/* ---------- Helpers ---------- */
function slugify(s: string) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function checkSlugExists(slug: string) {
  if (!slug) return false;
  try {
    const q = query(collection(db, "products"), where("slug", "==", slug), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.error("checkSlugExists error:", err);
    // assume taken on error to be safe
    return true;
  }
}

/* Cloudinary unsigned uploader (XHR for progress) */
async function uploadToCloudinary(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME & VITE_CLOUDINARY_UPLOAD_PRESET");
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          const secureUrl = resp.secure_url || resp.url;
          if (!secureUrl) return reject(new Error("No URL returned from Cloudinary"));
          resolve(secureUrl);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
    xhr.send(form);
  });
}

/* ---------- Component ---------- */
export default function AddProduct() {
  // form
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [regularPrice, setRegularPrice] = useState<number | "">("");
  const [images, setImages] = useState<string>(""); // comma-separated
  const [busy, setBusy] = useState(false);

  // file upload UI
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // slug checking UI
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const slugCheckTimer = useRef<number | null>(null);
  const slugCheckCounter = useRef(0);

  // notice
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Debounced slug availability check (real-time)
  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    setNotice(null);
    // debounce 600ms
    if (slugCheckTimer.current) window.clearTimeout(slugCheckTimer.current);
    const current = ++slugCheckCounter.current;
    slugCheckTimer.current = window.setTimeout(async () => {
      try {
        const exists = await checkSlugExists(slug);
        // ensure latest input
        if (current !== slugCheckCounter.current) return;
        setSlugStatus(exists ? "taken" : "available");
      } catch (err) {
        console.error(err);
        setSlugStatus("error");
      }
    }, 600);

    return () => {
      if (slugCheckTimer.current) window.clearTimeout(slugCheckTimer.current);
    };
  }, [slug]);

  // handle file selection (append, dedupe by name+size)
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length === 0) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const toAdd = selected.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...toAdd].slice(0, 8);
    });
    setNotice(null);
  }

  function removePreviewAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function uploadSelectedFiles() {
    if (files.length === 0) {
      setNotice("প্রথমে ফাইল সিলেক্ট করুন।");
      return;
    }
    setUploading(true);
    setUploadProgress({});
    setNotice(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        setUploadProgress((p) => ({ ...p, [file.name]: 0 }));
        const url = await uploadToCloudinary(file, (pct) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
        });
        uploadedUrls.push(url);
        setUploadProgress((p) => ({ ...p, [file.name]: 100 }));
      }
      const existing = images ? images.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const merged = [...existing, ...uploadedUrls];
      setImages(merged.join(", "));
      setFiles([]);
      setPreviews([]);
      setNotice("ছবি আপলোড হয়েছে এবং লিংক ইনপুটে যোগ করা হয়েছে।");
    } catch (err) {
      console.error(err);
      setNotice("Upload failed — কনসোলে দেখুন।");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress({}), 800);
    }
  }

  // Auto-suggest a slug from title and ensure uniqueness by trying suffixes
  async function handleSuggestSlug() {
    const base = slugify(title || "product");
    if (!base) {
      setNotice("Title দিয়ে Suggest করতে হবে।");
      return;
    }
    setSlugStatus("checking");
    setNotice("Slug সাজেস্ট করা হচ্ছে...");
    try {
      let candidate = base;
      let attempt = 0;
      while (true) {
        const exists = await checkSlugExists(candidate);
        if (!exists) {
          setSlug(candidate);
          setSlugStatus("available");
          setNotice("Suggested slug তৈরি করা হয়েছে। আপনি প্রয়োজনমত পরিবর্তন করতে পারেন।");
          return;
        }
        attempt++;
        // try base-1, base-2, ...
        candidate = `${base}-${attempt}`;
        if (attempt > 12) {
          candidate = `${base}-${Date.now().toString(36).slice(-6)}`;
        }
      }
    } catch (err) {
      console.error(err);
      setSlugStatus("error");
      setNotice("Slug suggest failed — আবার চেষ্টা করুন।");
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setNotice(null);

    if (!title.trim()) {
      setNotice("Title দিন।");
      return;
    }
    if (price === "" || price === null || isNaN(Number(price))) {
      setNotice("Price সঠিকভাবে দিন।");
      return;
    }
    if (!slug.trim()) {
      setNotice("Slug প্রদান করুন (URL)।");
      setSlugStatus("taken");
      return;
    }
    if (slugStatus === "taken") {
      setNotice("Slug ইতোমধ্যেই ব্যস্ত — অন্যটি ব্যবহার করুন বা Suggest দিন।");
      return;
    }
    if (slugStatus === "checking") {
      setNotice("দয়া করে slug availability চেক Complete হওয়া পর্যন্ত অপেক্ষা করুন।");
      return;
    }

    setBusy(true);
    try {
      // double-check on submit to avoid race
      const exists = await checkSlugExists(slug.trim());
      if (exists) {
        setSlugStatus("taken");
        setNotice("এই slug ইতোমধ্যেই আছে — অনুগ্রহ করে অন্যটি দিন।");
        setBusy(false);
        return;
      }

      const payload: ProductPayload = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        regularPrice: regularPrice ? Number(regularPrice) : null,
        images: images.split(",").map((s) => s.trim()).filter(Boolean),
        createdAt: new Date(),
        slug: slug.trim(),
      };

      await addDoc(collection(db, "products"), payload);
      setNotice("Product তৈরি হয়েছে।");
      // reset
      setTitle("");
      setSlug("");
      setDescription("");
      setPrice("");
      setRegularPrice("");
      setImages("");
      setFiles([]);
      setPreviews([]);
      setSlugStatus("idle");
    } catch (err) {
      console.error(err);
      setNotice("Product তৈরি ব্যর্থ।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-semibold mb-4">Add Product — Manual slug + Live check</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: preview + tips */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-dashed border-gray-200 p-4 flex flex-col items-center bg-gray-50">
            <div className="w-36 h-36 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
              {previews[0] ? (
                <img src={previews[0]} alt="preview" className="w-full h-full object-cover" />
              ) : images.split(",").find(Boolean) ? (
                <img src={images.split(",").find(Boolean)} alt="first" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-14 h-14 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M16 3l-4 4-4-4" />
                </svg>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="text-sm font-medium">Product preview</div>
              <div className="text-xs text-gray-500 mt-1">প্রাথমিক থাম্বনেইল এখানে দেখা যাবে</div>
            </div>

            <div className="mt-4 w-full">
              <label className="block text-xs font-medium text-gray-600 mb-2">Manual image URLs</label>
              <input
                value={images}
                onChange={(e) => setImages(e.target.value)}
                placeholder="https://.../img1.jpg, https://.../img2.jpg"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3 w-full text-xs text-gray-500">
              <div>Cloudinary: <span className="font-medium">{CLOUDINARY_CLOUD_NAME || "—"}</span></div>
              <div className="mt-1">Upload images below or paste external URLs</div>
            </div>
          </div>

          <div className="rounded-md p-3 bg-gradient-to-r from-white to-blue-50 border">
            <div className="text-sm font-semibold">Quick tips</div>
            <ul className="mt-2 text-xs text-gray-600 space-y-1">
              <li>• Slug should be URL friendly (lowercase, hyphens, no spaces).</li>
              <li>• Use the <strong>Suggest</strong> button to auto-generate a free slug.</li>
              <li>• Protect this admin route — public uploads may be abused.</li>
            </ul>
          </div>
        </div>

        {/* Right: form */}
        <div className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-4">
            {/* Title & slug row */}
            <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-start">
              <div className="md:col-span-5">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Product title"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                <div className="flex gap-2">
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. smart-led-light"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSuggestSlug}
                    className="px-3 py-2 bg-gray-100 border rounded text-sm hover:bg-gray-200"
                  >
                    Suggest
                  </button>
                </div>

                {/* slug status + preview */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-xs">
                    <span className="text-gray-500">Preview:</span>{" "}
                    <a className="text-sm text-indigo-600 truncate block max-w-[240px]" href={slug ? `${SITE_BASE}/product/${slug}` : "#"} target="_blank" rel="noreferrer">
                      {slug ? `${SITE_BASE}/product/${slug}` : `${SITE_BASE}/product/your-slug`}
                    </a>
                  </div>

                  <div className="ml-auto">
                    {slugStatus === "idle" && <span className="text-xs text-gray-500">—</span>}
                    {slugStatus === "checking" && <span className="text-xs text-yellow-600">Checking…</span>}
                    {slugStatus === "available" && <span className="text-xs text-green-600 font-medium">Available ✓</span>}
                    {slugStatus === "taken" && <span className="text-xs text-red-600 font-medium">Taken ✕</span>}
                    {slugStatus === "error" && <span className="text-xs text-amber-600">Error</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* prices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Price (৳)</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                  type="number"
                  min={0}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Regular price (optional)</label>
                <input
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                  type="number"
                  min={0}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Product details, features, specs..."
              />
            </div>

            {/* Upload UI */}
            <div className="rounded-lg border p-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Upload images</div>
                  <div className="text-xs text-gray-500">Drag & drop or choose. PNG/JPG recommended.</div>
                </div>

                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded cursor-pointer text-sm">
                    <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                    Choose files
                  </label>
                </div>
              </div>

              <div className="mt-3">
                {previews.length === 0 ? (
                  <div className="w-full h-28 bg-gray-50 border rounded-md flex items-center justify-center text-gray-400">No images selected</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {previews.map((p, i) => (
                      <div key={p} className="relative w-full h-24 bg-gray-100 rounded overflow-hidden border">
                        <img src={p} alt={`preview-${i}`} className="w-full h-full object-cover" />
                        <div className="absolute left-1 top-1 text-xs bg-white/90 px-1 rounded max-w-[70%] truncate">{files[i]?.name}</div>
                        <button type="button" onClick={() => removePreviewAt(i)} className="absolute top-1 right-1 bg-white/80 text-xs rounded px-1 py-0.5">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-3 space-y-2">
                  {Object.entries(uploadProgress).map(([name, pct]) => (
                    <div key={name} className="text-xs">
                      <div className="flex justify-between"><div className="truncate max-w-[70%]">{name}</div><div>{pct}%</div></div>
                      <div className="w-full h-2 bg-gray-200 rounded mt-1">
                        <div style={{ width: `${pct}%` }} className="h-2 bg-green-500 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2 items-center">
                <button type="button" onClick={uploadSelectedFiles} disabled={files.length === 0 || uploading} className="px-4 py-2 bg-green-600 text-white rounded">
                  {uploading ? "Uploading..." : "Upload selected images"}
                </button>
                <button type="button" onClick={() => { setFiles([]); setPreviews([]); }} className="px-4 py-2 border rounded">Clear</button>
                <div className="ml-auto text-sm text-gray-500">PNG/JPG supported • Drag files to upload</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                <button disabled={busy} type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow w-full sm:w-auto">
                  {busy ? "Saving..." : "Create product"}
                </button>

                <button type="button" onClick={() => { setTitle(""); setSlug(""); setDescription(""); setPrice(""); setRegularPrice(""); setImages(""); setFiles([]); setPreviews([]); setNotice(null); setSlugStatus("idle"); }} className="px-4 py-2 border rounded w-full sm:w-auto">
                  Reset
                </button>
              </div>

              <div className="text-sm text-gray-500">{notice}</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
