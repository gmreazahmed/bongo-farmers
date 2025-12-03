// src/pages/admin/AddProduct.tsx
import React, { useEffect, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

type ProductPayload = {
  title: string;
  description?: string;
  price: number;
  regularPrice?: number | null;
  images: string[];
  createdAt: Date;
  slug?: string; // <- slug will be saved
};

/** Simple slugify helper (keeps result ASCII-friendly) */
function slugify(s: string) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // spaces -> dashes
    .replace(/-+/g, "-") // collapse dashes
    .replace(/^-+|-+$/g, ""); // trim dashes
}

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [regularPrice, setRegularPrice] = useState<number | "">("");
  const [images, setImages] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // upload state
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length === 0) {
      setFiles([]);
      setPreviews([]);
      return;
    }
    // append to existing selection (prevent duplicates by name)
    setFiles((prev) => [...prev, ...selected]);
  }

  // simple Cloudinary unsigned uploader (XHR for progress)
  async function uploadToCloudinary(file: File, onProgress?: (pct: number) => void): Promise<string> {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error("Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET");
    }
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    return await new Promise<string>((resolve, reject) => {
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
      // iterate files sequentially so progress is easier to show per-file
      for (const file of files) {
        setUploadProgress((p) => ({ ...p, [file.name]: 0 }));
        const url = await uploadToCloudinary(file, (pct) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
        });
        uploadedUrls.push(url);
        setUploadProgress((p) => ({ ...p, [file.name]: 100 }));
      }

      // merge with manual URLs if present
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
      setUploadProgress({});
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title || !price) {
      setNotice("Title ও Price আবশ্যক।");
      return;
    }
    setBusy(true);
    setNotice(null);

    // create slug: readable slug + short suffix to avoid collisions
    const base = slugify(title || "product");
    const suffix = Date.now().toString(36).slice(-5);
    const slug = `${base}-${suffix}`;

    const payload: ProductPayload = {
      title,
      description,
      price: Number(price),
      regularPrice: regularPrice ? Number(regularPrice) : null,
      images: images.split(",").map((s) => s.trim()).filter(Boolean),
      createdAt: new Date(),
      slug, // save slug so frontend can link by /product/:slug
    };

    try {
      await addDoc(collection(db, "products"), payload);
      setNotice("Product তৈরি হয়েছে।");
      setTitle("");
      setDescription("");
      setPrice("");
      setRegularPrice("");
      setImages("");
    } catch (err) {
      console.error(err);
      setNotice("Product তৈরি ব্যর্থ।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* LEFT: preview panel */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="rounded-lg border border-dashed border-gray-200 p-4 flex flex-col items-center justify-center bg-gray-50">
              <div className="w-36 h-36 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                {previews[0] ? (
                  <img src={previews[0]} className="w-full h-full object-cover" alt="preview" />
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
                <input value={images} onChange={(e) => setImages(e.target.value)} placeholder="https://.../img1.jpg, https://.../img2.jpg" className="w-full border rounded px-3 py-2 text-sm" />
              </div>

              <div className="mt-3 w-full text-xs text-gray-500">
                <div>Cloudinary: <span className="font-medium">{CLOUDINARY_CLOUD_NAME || "—"}</span></div>
                <div className="mt-1">Use upload box to add images from your computer</div>
              </div>
            </div>

            <div className="rounded-lg p-3 bg-gradient-to-r from-white to-blue-50 border">
              <div className="text-sm font-semibold">Quick tips</div>
              <ul className="mt-2 text-xs text-gray-600 space-y-1">
                <li>• Admin route প্রোটেক্ট করুন যাতে কেউ জনসমক্ষে আপলোড না করতে পারে।</li>
                <li>• Cloudinary unsigned preset দ্রুত কাজ দেয়, কিন্তু abuse হতে পারে — সাবধান থাকুন।</li>
                <li>• একাধিক ইমেজ আপলোড করলে কমা দিয়ে আলাদা URL গুলো সাজান।</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: form */}
          <div className="lg:col-span-2">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="col-span-2 border rounded px-3 py-2" />
                <input value={price} onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")} placeholder="Price (৳)" className="border rounded px-3 py-2" type="number" />
                <input value={regularPrice} onChange={(e) => setRegularPrice(e.target.value ? Number(e.target.value) : "")} placeholder="Regular price (optional)" className="border rounded px-3 py-2" type="number" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full border rounded px-3 py-2 text-sm" />
              </div>

              {/* Improved file chooser + previews */}
              <div className="rounded-lg border p-3 bg-white">
                <div
                  className="rounded-md border-2 border-dashed border-gray-200 p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-300"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12" />
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M7 8l5 5 5-5" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium">Drag & drop images here, or</div>
                      <div className="text-xs text-gray-500">Click to select (JPEG / PNG). Max recommended 5 images.</div>
                    </div>
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded cursor-pointer">
                      <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                      <span className="text-sm text-gray-700">Choose files</span>
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
                          <img src={p} className="w-full h-full object-cover" alt={`preview-${i}`} />
                          <button
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 bg-white/80 text-xs rounded px-1 py-0.5"
                          >
                            Remove
                          </button>
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

                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={uploadSelectedFiles} disabled={files.length === 0 || uploading} className="px-4 py-2 bg-green-600 text-white rounded">
                    {uploading ? "Uploading..." : "Upload selected images"}
                  </button>

                  <button type="button" onClick={() => { setFiles([]); setPreviews([]); }} className="px-4 py-2 border rounded">Clear selection</button>

                  <div className="ml-auto text-sm text-gray-500">PNG/JPG supported • Drag files to upload</div>
                </div>
              </div>

              {/* actions */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button disabled={busy} type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow">
                    {busy ? "Saving..." : "Create product"}
                  </button>

                  <button type="button" onClick={() => { setTitle(""); setDescription(""); setPrice(""); setRegularPrice(""); setImages(""); }} className="px-4 py-2 border rounded">Reset</button>
                </div>

                <div className="text-sm text-gray-500">{notice}</div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
