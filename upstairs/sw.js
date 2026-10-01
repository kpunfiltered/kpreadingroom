/* upstairs service worker: instant start + offline + OneSignal push (same file, one scope).
   The app page is served from the phone instantly and refreshed in the background,
   so a new upload shows up the next time she opens the app. Bump VERSION when this file changes. */
var VERSION = "upstairs-v2";
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch (e) {}

var PAGE = "/upstairs/";
var SHELL = [PAGE, "/upstairs/manifest.webmanifest", "/upstairs/icons/icon-192.png", "/upstairs/icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("upstairs-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function refreshPage(cache) {
  return fetch(PAGE, {cache: "no-store"}).then(function (res) {
    if (res && res.ok) cache.put(PAGE, res.clone());
    return res;
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (/script\.google|googleusercontent|onesignal/.test(url.hostname)) return;   // never cache the backend
  // the app page: show the saved copy instantly, fetch the newest in the background
  if (req.mode === "navigate" && url.pathname.indexOf("/upstairs") === 0 && url.pathname.indexOf("/upstairs/admin") !== 0) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(PAGE).then(function (hit) {
        var fresh = refreshPage(c);
        if (hit) { e.waitUntil(fresh.catch(function () {})); return hit; }
        return fresh.catch(function () { return new Response("<p style='font-family:sans-serif;background:#15101a;color:#f0e7dc;padding:40px'>you're offline. connect once and upstairs will work offline after that.</p>", {headers: {"Content-Type": "text/html"}}); });
      });
    }));
    return;
  }
  // fonts + icons: saved copy first, refreshed in the background
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname) || url.pathname.indexOf("/upstairs/icons/") === 0) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
