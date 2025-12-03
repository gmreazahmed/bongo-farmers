// src/lib/facebook-pixel.ts
type Fbq = (...args: any[]) => void
declare global { interface Window { fbq?: Fbq } }

/**
 * Initialize Facebook Pixel.
 * If pixelId is provided it will use that, otherwise it will try to read
 * from import.meta.env.VITE_FB_PIXEL_ID.
 */
export function initFacebookPixel(pixelId?: string) {
  const id = pixelId || (import.meta.env as any).VITE_FB_PIXEL_ID || ""
  if (!id) return
  if (typeof window === "undefined") return
  if ((window as any).fbq) return

  ;(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return
    n = (f.fbq = function () {
      ;(n!.callMethod ? n!.callMethod : n!.push).apply(n!, arguments as any)
    })
    n.push = n!.slice = function () {}
    n.loaded = !0
    n.version = "2.0"
    t = b.createElement(e)
    t.async = !0
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js")

  try {
    window.fbq?.("init", String(id))
    window.fbq?.("track", "PageView")
  } catch (err) {
    // ignore
    // console.warn('fbq init failed', err)
  }
}

export function fbTrack(event: string, params?: Record<string, any>) {
  try {
    window.fbq?.("track", event, params || {})
  } catch (err) {}
}

export function fbTrackPurchase(value?: number, currency = "BDT") {
  fbTrack("Purchase", { value, currency })
}
