/* upstairs service worker: offline shell + OneSignal push (same file, one scope).
   Bump VERSION whenever you upload a new index.html so phones pick it up. */
var VERSION = "upstairs-v1";
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch (e) {}

var SHELL = ["/upstairs/", "/upstairs/manifest.webmanifest", "/upstairs/icons/icon-192.png", "/upstairs/icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("upstairs-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // never cache the backend or OneSignal
  if (/script\.google|googleusercontent|onesignal/.test(url.hostname)) return;
  // the app page: network first so updates land, cache as the offline fallback
  if (req.mode === "navigate" && url.pathname.indexOf("/upstairs") === 0 && url.pathname.indexOf("/upstairs/admin") !== 0) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put("/upstairs/", copy); });
      return res;
    }).catch(function () { return caches.match("/upstairs/"); }));
    return;
  }
  // fonts + icons: cache, refresh in the background
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname) || url.pathname.indexOf("/upstairs/icons/") === 0) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
