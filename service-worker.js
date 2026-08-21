/*
 * Service Worker - بازی گنج دانش
 * هدف: کش کردن تمام فایل‌های ضروری برنامه برای اجرای کاملاً آفلاین.
 * استراتژی: Cache First با به‌روزرسانی پس‌زمینه (Stale-While-Revalidate) برای دارایی‌های ایستا
 * و Network First با بازگشت به کش برای فایل‌های JSON سؤال (تا در صورت آپدیت داده، جدیدترین نسخه گرفته شود).
 */

const CACHE_VERSION = "ganje-danesh-v1";
const STATIC_CACHE = CACHE_VERSION + "-static";

/* تمام مسیرهایی که باید در اولین نصب کش شوند */
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./data/question1.json",
  "./data/question2.json",
  "./data/question3.json",
  "./fonts/Vazirmatn-Bold.woff2",
  "./fonts/Vazirmatn-Black.woff2",
  "./fonts/Vazirmatn-ExtraBold.woff2",
  "./fonts/Vazirmatn[wght].woff2",
  "./images/hafez.png",
  "./images/safineh.png",
  "./images/oloom.png",
  "./images/ganjedanesh.png",
  "./images/tumar.png",
  "./images/coin.png",
  "./images/emtiaz.png",
  "./images/medal.png",
  "./icons/192.png",
  "./icons/512.png"
];

/* کش کردن تک‌تک فایل‌ها به‌صورت مجزا تا نبود یک فایل (مثلاً تصویری که هنوز اضافه نشده)
   باعث شکست کل نصب Service Worker نشود. */
async function cacheAllIndividually(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(url, response.clone());
        }
      } catch (err) {
        console.warn("[Service Worker] عدم امکان کش کردن فایل:", url);
      }
    })
  );
  return results;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheAllIndividually(STATIC_CACHE, CORE_ASSETS));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("ganje-danesh-") && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isDataFile = url.pathname.includes("/data/");

  if (isDataFile) {
    /* برای فایل‌های سؤال: ابتدا شبکه، در صورت نبود اینترنت از کش استفاده شود */
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: true, message: "فایل سؤال در دسترس نیست." }),
            { headers: { "Content-Type": "application/json; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  /* برای بقیه دارایی‌ها: کش اول، سپس شبکه */
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        if (request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        return new Response("آفلاین هستید و این فایل هنوز کش نشده است.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});
