/* ATLAS móvil · funcionamiento sin conexión.
   - La aplicación (index, estilos, programa) se sirve de la red si hay internet y, si no, de la copia guardada.
   - Las lecciones (data/l/) se sirven de la copia guardada y se actualizan por detrás.
   - Las imágenes locales (img/) se guardan al verlas y no cambian. Las de Wikimedia se piden siempre a su servidor. */
const V = "20261011132559";
const APP = "atlas-m-app-" + V, DATOS = "atlas-m-datos", FUENTES = "atlas-m-fuentes";
const PRE = ["./", "index.html", "estilo.css?v=" + V, "app.js?v=" + V, "manifest.webmanifest", "icon-192.png", "data/k.json", "data/i.bin"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("atlas-m-app-") && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function redPrimero(req) {
  const c = await caches.open(APP);
  try {
    const r = await fetch(req);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: false }) || await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") { const i = await c.match("index.html") || await c.match("./"); if (i) return i; }
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
async function guardadoYActualiza(e) {
  const c = await caches.open(DATOS), hit = await c.match(e.request);
  const red = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(red); return hit; }
  return (await red) || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
async function primeroGuardado(req) {
  const c = await caches.open(DATOS), hit = await c.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }
  catch (err) { return new Response("", { status: 504 }); }
}
async function fuentes(e) {
  const c = await caches.open(FUENTES), hit = await c.match(e.request);
  const red = fetch(e.request).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(red); return hit; }
  return (await red) || new Response("", { status: 504 });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (u.pathname.includes("/data/l/")) { e.respondWith(guardadoYActualiza(e)); return; }
    if (u.pathname.includes("/img/")) { e.respondWith(primeroGuardado(req)); return; }
    e.respondWith(redPrimero(req));
    return;
  }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") e.respondWith(fuentes(e));
});
