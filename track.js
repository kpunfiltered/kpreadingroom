/* KP Reading Room · visit tracker (v1 · 1 Nov 2026)
   Logs page views, sections reached, link/button taps and time on page to the "visits" tab
   of the signups sheet. Never sends anything she types. Loaded by index.html with one script tag. */
(function () {
  "use strict";
  var API = "https://script.google.com/macros/s/AKfycbyyFkxJ-6jMacOrIE5jZsYveGMcpFOkAFBOXhyjmFrBJ8rtGwXS_sALWDv5w7K01m3T/exec";
  var STATE_KEY = "kp_reading_room_v1", VID_KEY = "kp_vid", ME_KEY = "kp_me";
  var ME_EMAILS = ["kartikaypawar24@gmail.com", "info@unfilteredprojects.com", "team@unfilteredprojects.com"];
  if (navigator.webdriver) return;

  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var vid = ls(VID_KEY); if (!vid) { vid = rid(); ls(VID_KEY, vid); }
  var sid = ss("kp_sid"); if (!sid) { sid = rid(); ss("kp_sid", sid); }
  var q; try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
  if (q.get("me") === "1") ls(ME_KEY, "1");
  if (q.get("me") === "0") ls(ME_KEY, "0");

  function who() {
    var s = {}; try { s = JSON.parse(ls(STATE_KEY) || "{}") || {}; } catch (e) {}
    return { email: String(s.email || "").toLowerCase(), name: String(s.name || ""), src: String(s.src || "") };
  }
  function source() {
    var w = who(); if (w.src) return w.src;
    var src = q.get("src") || q.get("utm_source");
    if (!src && document.referrer) { try { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) src = h.replace(/^www\./, ""); } catch (e) {} }
    return (src || "direct").slice(0, 60);
  }
  function device() {
    var ua = navigator.userAgent || "", d = /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop";
    if (/Instagram/i.test(ua)) d += " · ig app"; else if (/FBAN|FBAV/i.test(ua)) d += " · fb app";
    else if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) d += " · tiktok app";
    return d;
  }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } }

  /* ---------- queue + send ---------- */
  var queue = [], timer = null;
  function payload(evts) {
    var w = who();
    var me = ls(ME_KEY) === "1" || ME_EMAILS.indexOf(w.email) >= 0;
    return JSON.stringify({ action: "pvs", vid: vid, sid: sid, email: w.email, name: w.name, source: source(),
      ref: (document.referrer || "").slice(0, 120), device: device(), tz: tz(),
      lang: (navigator.language || "").slice(0, 12), me: me, events: evts });
  }
  function flush(beacon) {
    clearTimeout(timer); timer = null;
    if (!queue.length) return;
    var evts = queue.splice(0, 40), body = payload(evts);
    var sent = false;
    if (beacon && navigator.sendBeacon) { try { sent = navigator.sendBeacon(API, new Blob([body], { type: "text/plain;charset=utf-8" })); } catch (e) {} }
    if (!sent) { try { fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body, keepalive: true }).catch(function () {}); } catch (e) {} }
    if (queue.length) flush(beacon);
  }
  function emit(e, page, extra) {
    var ev = { e: e, page: page || cur || "home", t: Date.now() };
    if (extra) for (var k in extra) ev[k] = extra[k];
    queue.push(ev);
    if (queue.length >= 20) flush(false); else if (!timer) timer = setTimeout(function () { flush(false); }, 4000);
  }

  /* ---------- which view is showing ---------- */
  var cur = null, viewStart = 0, seen = {};
  function visibleView() {
    var vs = document.querySelectorAll("main[data-view]");
    for (var i = 0; i < vs.length; i++) if (!vs[i].hidden) return vs[i].id.replace(/^v-/, "");
    return "home";
  }
  function leave(reason) {
    if (!cur || !viewStart) return;
    var secs = Math.round((Date.now() - viewStart) / 1000);
    emit("leave", cur, { secs: Math.min(secs, 3600), section: reason || "" });
    viewStart = 0;
  }
  function checkView() {
    var v = visibleView();
    if (v === cur) return;
    leave("switch");
    cur = v; viewStart = Date.now(); seen = {};
    emit("view", v, { section: (location.hash || "").replace("#", "").slice(0, 40) });
    watchSections();
  }

  /* ---------- sections reached ---------- */
  var io = null;
  function watchSections() {
    if (!("IntersectionObserver" in window)) return;
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id; if (!id || seen[id]) return;
        seen[id] = 1; emit("section", cur, { section: id });
      });
    }, { threshold: 0.35 });
    var main = document.getElementById("v-" + cur);
    if (!main) return;
    main.querySelectorAll("section[id], [id=secret]").forEach(function (s) { io.observe(s); });
  }

  /* ---------- taps on links and buttons (labels only, never what she typed) ---------- */
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest("a[href], button") : null;
    if (!el) return;
    var target;
    if (el.tagName === "A") {
      var href = el.getAttribute("href") || "";
      if (el.dataset && el.dataset.link) target = "link:" + el.dataset.link;
      else if (/^#/.test(href)) target = "nav:" + href.slice(1, 40);
      else { try { var u = new URL(href, location.href); target = (u.hostname === location.hostname ? "nav:" : "out:") + (u.hostname.replace(/^www\./, "") + u.pathname).slice(0, 80); } catch (e) { target = "link"; } }
    } else {
      target = "btn:" + (el.id || (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase());
    }
    emit("tap", cur, { target: target });
    if (el.tagName === "A" && /^out:|^link:/.test(target)) flush(true);
  }, true);

  /* ---------- lifecycle ---------- */
  window.addEventListener("hashchange", function () { setTimeout(checkView, 0); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { leave("hidden"); flush(true); }
    else if (cur && !viewStart) { viewStart = Date.now(); }
  });
  window.addEventListener("pagehide", function () { leave("close"); flush(true); });
  if ("MutationObserver" in window) {
    new MutationObserver(function () { checkView(); })
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }
  function start() { checkView(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);

  window.__kpTrack = { flush: flush, emit: emit, queue: queue, vid: vid };
})();
