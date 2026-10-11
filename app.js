/* =====================================================================
   ATLAS móvil · lista, lectura, mapa en anillo y ajustes
   Todo en un fichero, sin dependencias. Las lecciones se descargan al abrirlas (data/l/<id>.json).
   ===================================================================== */
(function () {
"use strict";

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const root = document.documentElement;
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const quitar = k => { try { localStorage.removeItem(k); } catch (e) {} };
const cargarSet = k => { try { return new Set(JSON.parse(leer(k) || "[]")); } catch (e) { return new Set(); } };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const recorta = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s;
const anio = n => n < 0 ? Math.abs(n) + " a.C." : String(n);
function rango(r) {
  if (!r || !r.length) return "";
  const [a, b] = r;
  if (b === undefined || a === b) return anio(a);
  if (a < 0 && b < 0) return Math.abs(a) + "–" + Math.abs(b) + " a.C.";
  if (a < 0 && b > 0) return Math.abs(a) + " a.C. – " + b + " d.C.";
  return a + "–" + b;
}
const NOMBRES = {
  "islas-britanicas": "Islas Británicas", "japon-corea": "Japón y Corea", "arabia-persia": "Arabia y Persia", "sudeste-asiatico": "Sudeste asiático",
  "africa-occidental": "África occidental", "africa-austral": "África austral", "asia-central": "Asia central", norteamerica: "Norteamérica",
  sudamerica: "Sudamérica", mesoamerica: "Mesoamérica", atlantico: "Atlántico", pacifico: "Pacífico", indico: "Índico", mediterraneo: "Mediterráneo",
  baltico: "Báltico", africa: "África", "boletín": "Boletín", boletin: "Boletín"
};
const bonito = s => NOMBRES[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ") : "");

/* ---------- datos: llegan cifrados y se preparan al arrancar (ver «clave de acceso») ---------- */
let D = null, P = [], POR_ID = new Map(), VECINOS = new Map(), ARISTAS = [], GRADO = new Map(), IDX = new Map();
const LANES = [
  { nombre: "Américas", corto: "Américas", amb: ["norteamerica", "mesoamerica", "sudamerica", "andes"], ci: 1 },
  { nombre: "Mares y océanos", corto: "Mares", amb: ["atlantico", "pacifico", "indico", "polinesia"], ci: 2 },
  { nombre: "Europa occidental", corto: "Europa occidental", amb: ["islas-britanicas", "galia", "iberia", "italia", "germania", "escandinavia", "baltico", "europa"], ci: 3 },
  { nombre: "Europa oriental y Rusia", corto: "Europa oriental", amb: ["balcanes", "rusia"], ci: 4 },
  { nombre: "Mediterráneo y Próximo Oriente", corto: "Mediterráneo", amb: ["anatolia", "arabia-persia", "egipto", "magreb", "mediterraneo"], ci: 5 },
  { nombre: "Asia", corto: "Asia", amb: ["asia-central", "india", "china", "japon-corea", "sudeste-asiatico"], ci: 6 },
  { nombre: "África", corto: "África", amb: ["africa", "africa-occidental", "africa-austral"], ci: 7 },
  { nombre: "Transversales y boletines", corto: "Transversal", amb: [], ci: 8 }
];
const LANE_DE_AMB = new Map();
LANES.forEach(l => l.amb.forEach(a => LANE_DE_AMB.set(a, l)));
const vecinosUnicos = id => { const m = new Map(); VECINOS.get(id).forEach(v => { if (!m.has(v.id)) m.set(v.id, v); }); return [...m.values()]; };
function prepararDatos(datos) {
  D = datos; P = D.piezas; POR_ID = new Map(P.map(p => [p.id, p]));
  P.forEach(p => {
    p.a = p.a || []; p.r = Array.isArray(p.r) ? p.r : [];
    p.ar = (p.ar || []).map(x => [D.rels[x[0]], P[x[1]].id]);
    p._lane = p.a.map(a => LANE_DE_AMB.get(a)).find(Boolean) || LANES[LANES.length - 1];
  });
  VECINOS = new Map(P.map(p => [p.id, []])); ARISTAS = [];
  const vistas = new Set();
  P.forEach(p => p.ar.forEach(([rel, dest]) => {
    if (!POR_ID.has(dest) || dest === p.id) return;
    VECINOS.get(p.id).push({ id: dest, rel, sal: true });
    VECINOS.get(dest).push({ id: p.id, rel, sal: false });
    const k = p.id < dest ? p.id + "|" + dest : dest + "|" + p.id;
    if (!vistas.has(k)) { vistas.add(k); ARISTAS.push({ a: p.id, b: dest, rel }); }
  }));
  GRADO = new Map(P.map(p => [p.id, vecinosUnicos(p.id).length]));
  IDX = new Map(P.map(p => [p.id, norm(p.t + " " + p.p + " " + p.a.map(bonito).join(" ") + " " + bonito(p.c) + " " + p._lane.nombre)]));
  [...abiertas].forEach(id => { if (!POR_ID.has(id)) abiertas.delete(id); });
  [...leidas].forEach(id => { if (!POR_ID.has(id)) leidas.delete(id); });
}
const ETIQ_REL = { paralelo: "Paralelo", atraviesa: "Atraviesa", contradice: "Contradice", causa: "Causa", pertenece: "Pertenece a", corrobora: "Corrobora", contra: "Contra", _ent: "Otras lecciones que la citan" };

/* ---------- progreso de lectura: 0 sin abrir · 1 abierta · 2 leída ---------- */
let abiertas = cargarSet("atlas-m-abiertas"), leidas = cargarSet("atlas-m-lect");
const persistir = () => { guardar("atlas-m-abiertas", JSON.stringify([...abiertas])); guardar("atlas-m-lect", JSON.stringify([...leidas])); };
const estado = id => leidas.has(id) ? 2 : abiertas.has(id) ? 1 : 0;
const clase = id => ["", " abierta", " leida"][estado(id)];
const ETIQ_ESTADO = ["Sin abrir", "Abierta", "Leída"];
const totales = () => {
  let l = 0, a = 0;
  P.forEach(p => { const e = estado(p.id); if (e === 2) l++; else if (e === 1) a++; });
  return { l, a, n: P.length - l - a, t: P.length };
};

/* ---------- avisos ---------- */
function avisar(html) {
  const t = document.createElement("div");
  t.className = "aviso-t"; t.innerHTML = html;
  const c = $("avisos"); c.appendChild(t);
  while (c.children.length > 2) c.firstChild.remove();
  setTimeout(() => { t.classList.add("sale"); setTimeout(() => t.remove(), 450); }, 3200);
}

/* ---------- markdown ---------- */
let IMGS = {};                                   // imágenes de la lección que se está pintando
const plano = s => s.replace(/\*+/g, "").replace(/\[\?\]/g, "").replace(/\s+/g, " ").trim();
function refChip(id) { return '<a class="ref' + clase(id) + '" data-id="' + id + '">' + esc(POR_ID.get(id).t) + "</a>"; }
function inline(s) {
  let h = esc(s);
  h = h.replace(/\(`([a-z0-9-]+)`\)/g, (m, id) => POR_ID.has(id) ? refChip(id) : m);
  h = h.replace(/`([^`]+)`/g, (m, c) => POR_ID.has(c) ? refChip(c) : "<code>" + c + "</code>");
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  h = h.replace(/\*\*([^*\n]+?)\*([^*\n]+?)\*\*\*/g, "<strong>$1<em>$2</em></strong>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  h = h.replace(/\[\?\]/g, '<span class="inc" title="Dato dudoso o discutido">?</span>');
  return h;
}
function imagen(src, alt) {
  const archivo = src.split("/").pop(), url = IMGS[archivo];
  const cap = alt ? "<figcaption>" + inline(alt) + "</figcaption>" : "";
  if (!url) return "";                           // imagen del paquete original que nunca llegó a bajarse: no se muestra hueco
  const local = Array.isArray(url), lam = local && /\.svg$/i.test(archivo) ? ' class="lam"' : "";
  const fuente = local ? ' data-e="' + esc(url[0]) + '" data-t="' + esc(url[1]) + '"' : ' loading="lazy" referrerpolicy="no-referrer" src="' + esc(url) + '"';
  return "<figure" + lam + '><div class="plate"><img decoding="async"' + fuente + ' alt="' + esc(plano(alt)) + '"></div>' + cap + "</figure>";
}
const celdas = l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, "|").trim());
function render(md) {
  const L = md.split("\n"), out = [], toc = [];
  let i = 0;
  while (i < L.length) {
    const s = L[i].trim();
    if (!s) { i++; continue; }
    let m;
    if ((m = s.match(/^(#{1,6})\s+(.*)$/))) {
      const n = Math.max(2, m[1].length), id = "s" + toc.length;
      if (n === 2) toc.push([id, plano(m[2])]);
      out.push("<h" + n + (n === 2 ? ' id="' + id + '"' : "") + ">" + inline(m[2]) + "</h" + n + ">");
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(s)) { out.push("<hr>"); i++; continue; }
    if ((m = s.match(/^!\[(.*)\]\(([^)]+)\)$/))) { out.push(imagen(m[2], m[1])); i++; continue; }
    if (s.startsWith("|") && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      const cab = celdas(s); i += 2;
      const ficha = cab[0] === "Ficha";
      let t = (ficha ? '<div class="ficha-wrap">' : "") + "<table" + (ficha ? ' class="ficha' + (cab.length > 2 ? " multi" : "") + '"' : "") + "><thead><tr>" + cab.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
      while (i < L.length && L[i].trim().startsWith("|")) { t += "<tr>" + celdas(L[i]).map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>"; i++; }
      out.push(t + "</tbody></table>" + (ficha ? "</div>" : "")); continue;
    }
    if (s.startsWith(">")) {
      const b = [];
      while (i < L.length && L[i].trim().startsWith(">")) { b.push(L[i].trim().replace(/^>\s?/, "")); i++; }
      out.push("<blockquote><p>" + inline(b.join(" ")) + "</p></blockquote>"); continue;
    }
    if (/^[-*+]\s+/.test(s) || /^\d+[.)]\s+/.test(s)) {
      const ord = /^\d+[.)]\s+/.test(s), it = [], re = ord ? /^\d+[.)]\s+/ : /^[-*+]\s+/;
      while (i < L.length && re.test(L[i].trim())) {
        let t = L[i].trim().replace(re, ""); i++;
        while (i < L.length && L[i].trim() && /^\s{2,}\S/.test(L[i]) && !re.test(L[i].trim())) { t += " " + L[i].trim(); i++; }
        it.push("<li>" + inline(t) + "</li>");
      }
      out.push((ord ? "<ol>" : "<ul>") + it.join("") + (ord ? "</ol>" : "</ul>")); continue;
    }
    const par = [];
    while (i < L.length && L[i].trim() && !/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||!\[.*\]\([^)]+\)$|-{3,}$)/.test(L[i].trim())) { par.push(L[i].trim()); i++; }
    if (!par.length) { par.push(s); i++; }
    out.push("<p>" + inline(par.join(" ")) + "</p>");
  }
  return { html: out.join("\n"), toc };
}

/* ---------- clave de acceso ----------
   El contenido del repositorio va cifrado (AES-256-GCM). La clave se deriva de la contraseña con PBKDF2 (SHA-256) y,
   una vez comprobada, se guarda en este dispositivo para no volver a pedirla. */
const enc = new TextEncoder(), dec = new TextDecoder();
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const aB64 = u => btoa(String.fromCharCode(...u));
const normClave = s => s.normalize("NFKC").trim().toLowerCase();
let KEY = null;
const claveDeBytes = raw => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
async function derivarBytes(clave, kj) {
  const mat = await crypto.subtle.importKey("raw", enc.encode(normClave(clave)), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deB64(kj.sal), iterations: kj.it }, mat, 256));
}
async function descifrar(k, buf) {
  const u = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, k, u.slice(12));
}
async function comprobarClave(k, kj) {
  const r = await descifrar(k, deB64(kj.chk));          // lanza si la clave no es la buena
  if (dec.decode(r) !== "ATLAS") throw new Error("clave");
}
function pedirClave(kj) {
  return new Promise(resolve => {
    const c = $("candado"), f = $("f-candado"), i = $("i-clave"), e = $("e-clave"), b = f.querySelector("button[type=submit]");
    c.hidden = false; setTimeout(() => i.focus(), 200);
    f.onsubmit = async ev => {
      ev.preventDefault();
      if (!i.value.trim()) return;
      b.disabled = true; e.textContent = "Comprobando…";
      try {
        const raw = await derivarBytes(i.value, kj), k = await claveDeBytes(raw);
        await comprobarClave(k, kj);
        guardar("atlas-m-k", aB64(raw)); i.value = ""; e.textContent = ""; c.hidden = true; resolve(k);
      } catch (err) { e.textContent = "Clave incorrecta"; b.disabled = false; i.select(); }
    };
  });
}
function mostrarFallo(msg) {
  const c = $("candado");
  c.innerHTML = '<div class="tarjeta"><svg class="rosa"><use href="#i-rosa"/></svg><h1>ATLAS</h1><p>' + esc(msg) + '</p><button class="btn p" onclick="location.reload()">Reintentar</button></div>';
  c.hidden = false;
}
const BLOBS = new Map();                         // ruta cifrada -> URL del blob ya descifrado
async function urlImagen(ruta, mime) {
  if (BLOBS.has(ruta)) return BLOBS.get(ruta);
  const r = await fetch(ruta);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const url = URL.createObjectURL(new Blob([await descifrar(KEY, await r.arrayBuffer())], { type: mime }));
  BLOBS.set(ruta, url); return url;
}
let obsImg = null;
function cargarImagenes(cont) {
  const pend = [...cont.querySelectorAll("img[data-e]")];
  const poner = async im => {
    try { im.src = await urlImagen(im.dataset.e, im.dataset.t); }
    catch (e) { const f = im.closest("figure"); if (f) f.classList.add("sin-img"); }
  };
  if (obsImg) { obsImg.disconnect(); obsImg = null; }
  if (!("IntersectionObserver" in window)) { pend.forEach(poner); return; }
  obsImg = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { obsImg.unobserve(en.target); poner(en.target); } }), { root: $("lectura"), rootMargin: "700px 0px" });
  pend.forEach(im => obsImg.observe(im));
}

/* ---------- lecciones: se descargan al abrirlas ---------- */
const CACHE_LEC = new Map();
async function cargarLeccion(id) {
  if (CACHE_LEC.has(id)) return CACHE_LEC.get(id);
  const r = await fetch("data/l/" + POR_ID.get(id).f + ".bin");
  if (!r.ok) throw new Error("HTTP " + r.status);
  const L = JSON.parse(dec.decode(await descifrar(KEY, await r.arrayBuffer())));
  CACHE_LEC.set(id, L);
  if (CACHE_LEC.size > 10) CACHE_LEC.delete(CACHE_LEC.keys().next().value);
  return L;
}
const TEXTOS = new Map();                        // id -> { n: texto normalizado, p: texto plano }  (búsqueda en el texto)
const aTexto = md => md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/[#*|>_`]/g, " ").replace(/\s+/g, " ");

/* =====================================================================
   LISTA
   ===================================================================== */
const E = { q: "", estado: "", region: "", orden: "az", visibles: [] };
const ACENTOS = { a: "aáàäâ", e: "eéèëê", i: "iíìïî", o: "oóòöô", u: "uúùüû", n: "nñ", c: "cç" };
function resaltar(texto, toks) {
  let h = esc(texto);
  toks.forEach(t => {
    if (t.length < 2) return;
    const pat = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[aeiounc]/g, c => "[" + ACENTOS[c] + "]");
    h = h.replace(new RegExp("(" + pat + ")(?![^<]*>)", "gi"), "<mark>$1</mark>");
  });
  return h;
}
function fragmento(id, toks) {
  const x = TEXTOS.get(id); if (!x) return "";
  for (const t of toks) {
    const k = x.n.indexOf(t);
    if (k >= 0) { const a = Math.max(0, k - 50); return (a ? "…" : "") + x.p.slice(a, k + 120) + "…"; }
  }
  return "";
}
const filtroActivo = () => !!(E.q.trim() || E.estado !== "" || E.region !== "");
function filtrar() {
  const toks = norm(E.q.trim()).split(/\s+/).filter(Boolean);
  const conTexto = TEXTOS.size === P.length;
  const punt = new Map();
  let r = P.filter(p => (E.estado === "" || estado(p.id) === +E.estado) && (E.region === "" || p._lane.ci === +E.region));
  if (toks.length) {
    r = r.filter(p => {
      const t = IDX.get(p.id), x = conTexto ? TEXTOS.get(p.id).n : "";
      if (!toks.every(k => t.includes(k) || (conTexto && x.includes(k)))) return false;
      punt.set(p.id, toks.reduce((a, k) => a + (t.includes(k) ? 10 : 0) + (conTexto ? Math.min(5, x.split(k).length - 1) : 0), 0));
      return true;
    });
    r.sort((a, b) => punt.get(b.id) - punt.get(a.id) || a.t.localeCompare(b.t, "es"));
  } else if (E.orden === "cron") {
    const clave = p => p.r.length ? p.r[0] : 1e9;
    r.sort((a, b) => clave(a) - clave(b) || a.t.localeCompare(b.t, "es"));
  } else r.sort((a, b) => a.t.localeCompare(b.t, "es"));
  E.visibles = r;
  return toks;
}
function pintarChips() {
  const T = totales();
  const est = [["", "Todas", P.length], ["0", "Sin leer", T.n], ["1", "Abiertas", T.a], ["2", "Leídas", T.l]];
  $("ch-estado").innerHTML = est.map(([v, n, c]) => '<button class="chip' + (E.estado === v ? " on" : "") + '" data-estado="' + v + '">' + n + " · " + c + "</button>").join("");
  const cuenta = {}; P.forEach(p => { cuenta[p._lane.ci] = (cuenta[p._lane.ci] || 0) + 1; });
  $("ch-region").innerHTML = '<button class="chip' + (E.region === "" ? " on" : "") + '" data-region="">Todas las regiones</button>' +
    LANES.filter(l => cuenta[l.ci]).map(l => '<button class="chip' + (E.region === String(l.ci) ? " on" : "") + '" data-region="' + l.ci + '" style="--rc:var(--r' + l.ci + ')"><i></i>' + esc(l.corto) + " · " + cuenta[l.ci] + "</button>").join("");
  $("orden").textContent = E.orden === "cron" ? "Orden: cronológico" : "Orden: A → Z";
}
function pintarRapido() {
  const ult = leer("atlas-m-ultima"), pu = ult && POR_ID.get(ult);
  $("rapido").innerHTML = pu ? '<button class="sigue" data-id="' + esc(ult) + '"><svg class="ic"><use href="#i-sigue"/></svg><span class="txt"><small>Continuar</small><b>' + esc(pu.t) + "</b></span></button>" : "";
}
function pintarLista() {
  const toks = filtrar();
  pintarChips();
  $("cuenta").textContent = filtroActivo() ? E.visibles.length + " de " + P.length + " lecciones" : P.length + " lecciones";
  if (!E.visibles.length) {
    $("lista").innerHTML = '<div class="vacio">Nada coincide.<br>' + (toks.length && TEXTOS.size !== P.length ? "Prueba a buscar también en el texto de las lecciones.<br>" : "") +
      '<button class="btn" data-limpiar>Quitar filtros</button></div>';
  } else {
    $("lista").innerHTML = E.visibles.map(p => {
      const sn = toks.length ? fragmento(p.id, toks) : "";
      return '<button class="item' + clase(p.id) + '" data-id="' + esc(p.id) + '" style="--rc:var(--r' + p._lane.ci + ')"><i class="est"></i>' +
        '<span class="t">' + resaltar(p.t, toks) + '</span><span class="m"><span>' + esc(bonito(p.c)) + "</span>" +
        (p.r.length ? "<span>" + esc(rango(p.r)) + "</span>" : "") + "<span>" + esc(p._lane.corto) + "</span></span>" +
        (sn ? '<span class="s">' + resaltar(sn, toks) + "</span>" : "") + "</button>";
    }).join("");
  }
  if (toks.length && TEXTOS.size !== P.length) {
    $("lista").insertAdjacentHTML("beforeend", '<div class="texto-buscar">Buscando solo en títulos y nombres. ' +
      '<button class="btn" data-buscar-texto style="margin-top:10px">Buscar también en el texto</button><div class="barra-prog" id="bt-barra" hidden><i></i></div></div>');
  }
}
function refrescarItem(id) {
  const it = document.querySelector('.item[data-id="' + CSS.escape(id) + '"]');
  if (it) { it.classList.remove("abierta", "leida"); const c = clase(id).trim(); if (c) it.classList.add(c); }
}
function pintarProgreso() {
  const T = totales(), R = 12, C = 2 * Math.PI * R;
  const arco = (id, n) => { const e = $(id); e.style.strokeDasharray = (C * n / T.t).toFixed(2) + " " + C.toFixed(2); e.style.opacity = n > 0 ? 1 : 0; };
  arco("an-a", T.l + T.a); arco("an-l", T.l);
  $("b-pct").textContent = Math.round(T.l / T.t * 100) + " %";
}
async function cargarTextos(avance) {
  if (TEXTOS.size === P.length) return;
  const pend = P.filter(p => !TEXTOS.has(p.id));
  let hechas = P.length - pend.length;
  const trabajar = async () => {
    while (pend.length) {
      const p = pend.pop();
      try {
        const L = await cargarLeccion(p.id), pl = aTexto(L.md);
        TEXTOS.set(p.id, { n: norm(pl), p: pl });
        if (avance) await avance(L);
      } catch (e) { /* sin conexión o fallo: se seguirá con las demás */ }
      hechas++;
      if (avance) avance(null, hechas);
    }
  };
  await Promise.all(Array.from({ length: 5 }, trabajar));
}

/* =====================================================================
   LECTURA
   ===================================================================== */
let ACTUAL = null, vigia = null, token = 0;
const A = { tam: clamp(parseInt(leer("atlas-m-tam") || "17", 10) || 17, 14, 26) };
function aplicarTam() { root.style.setProperty("--size", A.tam + "px"); guardar("atlas-m-tam", String(A.tam)); }

function cabeceraLeccion(p, L) {
  const chips = ['<span class="chip-l reg" style="--rc:var(--r' + p._lane.ci + ')"><i></i>' + esc(p._lane.corto) + "</span>"];
  if (p.p) chips.push('<span class="chip-l">' + esc(recorta(p.p, 46)) + "</span>");
  if (L) {
    const v = (L.ver || "").toLowerCase();
    if (v === "no") chips.push('<span class="chip-l" title="Redactada con ayuda de IA y aún sin revisar por una persona">Sin verificar</span>');
    else if (v) chips.push('<span class="chip-l">Verificado: ' + esc(L.ver) + "</span>");
  }
  return '<div class="kicker">' + esc(bonito(p.c)) + (p.r.length ? " · " + esc(rango(p.r)) : "") + " · " + p.m + " min de lectura</div>" +
    '<h1 class="titulo">' + esc(p.t) + '</h1><div class="chips-l">' + chips.join("") + "</div>";
}
function relacionadas(id) {
  const grupos = {};
  VECINOS.get(id).forEach(v => { if (v.sal) (grupos[v.rel] = grupos[v.rel] || []).push(v.id); });
  const ent = vecinosUnicos(id).filter(v => !v.sal && !(grupos[v.rel] || []).includes(v.id));
  if (ent.length) grupos._ent = ent.map(v => v.id);
  const li = d => '<a class="' + clase(d).trim() + '" data-id="' + esc(d) + '"><i class="est"></i><span>' + esc(POR_ID.get(d).t) + "</span></a>";
  return Object.entries(grupos).map(([g, ds]) => '<div class="grupo"><b>' + esc(ETIQ_REL[g] || bonito(g)) + "</b>" + [...new Set(ds)].map(li).join("") + "</div>").join("");
}
function pintarLeccion(p, L) {
  IMGS = L.img || {};
  const r = render(L.md), id = p.id;
  const orden = E.visibles.length ? E.visibles : P, k = orden.findIndex(x => x.id === id);
  const prev = k > 0 ? orden[k - 1] : null, sig = k >= 0 && k < orden.length - 1 ? orden[k + 1] : null;
  const rel = relacionadas(id), leida = leidas.has(id);
  $("hoja").innerHTML = cabeceraLeccion(p, L) +
    (L.resumen ? '<div class="cita">' + esc(L.resumen) + "</div>" : "") +
    (L.cita ? '<div class="cita">' + esc(L.cita) + "</div>" : "") +
    (L.aviso ? '<div class="aviso"><b>Aviso:</b> ' + esc(L.aviso) + "</div>" : "") +
    (r.toc.length > 2 ? '<details class="toc"><summary>Contenido (' + r.toc.length + ")</summary><ol>" + r.toc.map(t => '<li><a href="#" data-ir="' + t[0] + '">' + esc(t[1]) + "</a></li>").join("") + "</ol></details>" : "") +
    '<article class="texto">' + r.html + '</article><div id="fin"></div>' +
    '<div class="fin-acc"><button class="btn p" id="b-fin" data-toggle>' + (leida ? "✓ Leída · quitar marca" : "Marcar como leída") + '</button>' +
    '<button class="btn" data-mapa="' + esc(id) + '">Ver en el mapa</button></div>' +
    (rel ? '<section class="rel"><h2>Relacionadas</h2>' + rel + "</section>" : "") +
    '<div class="nav">' + (prev ? '<button data-id="' + esc(prev.id) + '"><small>← Anterior</small>' + esc(prev.t) + "</button>" : "") +
    (sig ? '<button data-id="' + esc(sig.id) + '"><small>Siguiente →</small>' + esc(sig.t) + "</button>" : "") + "</div>";
  cargarImagenes($("hoja"));
  vigilarFin(id);
}
function estadoBotonesLectura() {
  const l = ACTUAL && leidas.has(ACTUAL);
  $("l-ok").classList.toggle("ok", !!l);
  const b = $("b-fin"); if (b) b.textContent = l ? "✓ Leída · quitar marca" : "Marcar como leída";
}
function quitarVigia() { if (vigia) { vigia(); vigia = null; } }
function vigilarFin(id) {
  quitarVigia();
  const cont = $("lectura");
  let esperando = false;
  const f = () => {
    const max = cont.scrollHeight - cont.clientHeight;
    $("l-prog").style.setProperty("--p", max > 0 ? clamp(cont.scrollTop / max, 0, 1).toFixed(4) : 1);
    if (leidas.has(id) || esperando) return;
    esperando = true;
    requestAnimationFrame(() => {
      esperando = false;
      const fin = $("fin"); if (!fin || ACTUAL !== id) return;
      if (fin.getBoundingClientRect().top < cont.getBoundingClientRect().bottom + 4) marcarLeida(id, true, true);
    });
  };
  cont.addEventListener("scroll", f, { passive: true });
  vigia = () => cont.removeEventListener("scroll", f);
  requestAnimationFrame(f);
}
async function abrir(id, desdeRuta) {
  const p = POR_ID.get(id); if (!p) return;
  const tk = ++token;
  ACTUAL = id;
  abiertas.add(id); persistir(); guardar("atlas-m-ultima", id);
  refrescarItem(id); pintarProgreso(); pintarRapido();
  document.title = p.t + " · ATLAS";
  $("l-titulo").textContent = p.t;
  $("hoja").innerHTML = cabeceraLeccion(p, null) + '<div class="cargando">Cargando…</div>';
  $("l-prog").style.setProperty("--p", 0);
  $("lectura").hidden = false; $("lectura").scrollTop = 0;
  document.body.classList.add("leyendo");
  if (!desdeRuta) history.pushState({ d: 1 }, "", "#" + id);
  estadoBotonesLectura();
  quitarVigia();
  try {
    const L = await cargarLeccion(id);
    if (tk !== token) return;
    pintarLeccion(p, L);
    estadoBotonesLectura();
  } catch (e) {
    if (tk !== token) return;
    $("hoja").innerHTML = cabeceraLeccion(p, null) + '<div class="aviso">No se pudo cargar esta lección. Si estás sin conexión, ábrela una vez con internet o usa «Leer sin conexión» en los ajustes (arriba a la derecha).</div>';
  }
  pedirMapa();
}
function cerrarLectura() {
  if ($("lectura").hidden) return;
  quitarVigia(); token++;
  $("lectura").hidden = true; document.body.classList.remove("leyendo");
  document.title = "ATLAS";
  ACTUAL = null;
  if (E.estado !== "") pintarLista();             // si se filtra por estado, la lección recién leída cambia de grupo
  if (TAB === "mapa") entrarMapa();
}
function volver() {
  if (history.state && history.state.d) history.back();
  else { history.replaceState(null, "", "#" + TAB); cerrarLectura(); }
}
function marcarLeida(id, valor, auto) {
  const era = leidas.has(id);
  if (valor) { leidas.add(id); abiertas.add(id); } else leidas.delete(id);
  persistir(); refrescarItem(id); pintarProgreso(); pintarChips(); estadoBotonesLectura();
  if (E.estado !== "" && !$("v-lista").classList.contains("on")) { /* se repinta al volver */ }
  if (M.sel && M.sel.id === id) pintarHoja(M.sel);
  if (valor && !era) { M.pend.push(id); if (auto) avisar("<b>Leída</b> · se ilumina en el mapa"); }
  pedirMapa();
}

/* =====================================================================
   MAPA EN ANILLO
   ===================================================================== */
const TAU = Math.PI * 2;
const FORMA = { hilo: "circulo", periodo: "cuadrado", episodio: "rombo", grandes: "estrella", "boletín": "triangulo" };
const FORMA_NOMBRE = { circulo: "Hilo", cuadrado: "Periodo", rombo: "Episodio", estrella: "Grandes", triangulo: "Boletín" };
const M = { listo: false, enlazado: false, visible: false, W: 0, H: 0, dpr: 1, cam: { k: 1, tx: 0, ty: 0 }, anim: null, ajuste: null, usuario: false,
  nodos: [], pn: new Map(), aristas: [], sectores: [], R: 318, RL: 112, sel: null, ondas: [], raf: 0, punteros: new Map(), gesto: null, col: null, pend: [], lenteClave: "", pistaT: 0 };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function aRGB(c) {
  c = (c || "").trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.split("").map(x => x + x).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  m = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}
const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
const mezclar = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const pedirMapa = () => { if (!M.raf && M.listo && M.visible) M.raf = requestAnimationFrame(tick); };

function leerColores() {
  const cs = getComputedStyle(root), g = n => cs.getPropertyValue(n).trim();
  const reg = [null]; for (let i = 1; i <= 8; i++) reg.push(aRGB(g("--r" + i)));
  M.col = { bg: aRGB(g("--mapa-bg")), ink: aRGB(g("--mapa-ink")), acc: aRGB(g("--acc")), muted: aRGB(g("--muted")), reg, fuente: g("--f-ui") || "monospace" };
}
function construirMapa() {
  if (M.listo) return;
  M.cv = $("cv"); M.ctx = M.cv.getContext("2d"); leerColores();
  const R = M.R, pista = 27, hueco = 3.4 * Math.PI / 180;
  M.nodos = P.map(p => ({ p, id: p.id, lane: p._lane, deg: GRADO.get(p.id), r: Math.min(12.5, 5.6 + 1.3 * Math.sqrt(GRADO.get(p.id))), forma: FORMA[p.c] || "circulo", x: 0, y: 0, ang: 0, pop: -1e9 }));
  M.pn = new Map(M.nodos.map(n => [n.id, n]));
  const lanes = LANES.filter(l => M.nodos.some(n => n.lane === l));
  const util = TAU - hueco * lanes.length, ini = n => n.p.r.length ? n.p.r[0] : 0;
  let ang = -Math.PI / 2 + hueco / 2;
  lanes.forEach(l => {
    const lista = M.nodos.filter(n => n.lane === l).sort((a, b) => ini(a) - ini(b) || (a.id < b.id ? -1 : 1));
    const span = util * lista.length / M.nodos.length, paso = span / lista.length;
    lista.forEach((n, i) => { const a = ang + paso * (i + .5), rr = R + ((i % 3) - 1) * pista; n.ang = a; n.x = Math.cos(a) * rr; n.y = Math.sin(a) * rr; });
    M.sectores.push({ l, a0: ang, a1: ang + span, n: lista.length, lista, desde: ini(lista[0]), hasta: ini(lista[lista.length - 1]) });
    ang += span + hueco;
  });
  M.aristas = ARISTAS.map(e => {
    const a = M.pn.get(e.a), b = M.pn.get(e.b), d = Math.abs(Math.sin((a.ang - b.ang) / 2)), tau = .05 + .95 * Math.pow(1 - d, 1.7);
    return { a, b, rel: e.rel, q: [(a.x + b.x) / 2 * tau, (a.y + b.y) / 2 * tau] };
  });
  M.listo = true;
}
function ajusteVista() {
  const r = M.R + 128, m = { l: 8, r: 8, t: 12, b: 96 };
  const k = Math.min((M.W - m.l - m.r) / (2 * r), (M.H - m.t - m.b) / (2 * r));
  return { k, tx: m.l + (M.W - m.l - m.r) / 2, ty: m.t + (M.H - m.t - m.b) / 2 };
}
function redimensionarMapa() {
  const w = $("v-mapa").clientWidth, h = $("v-mapa").clientHeight;
  if (!w || !h || !M.listo) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (w === M.W && h === M.H && dpr === M.dpr) return true;
  const primera = M.W === 0;
  M.W = w; M.H = h; M.dpr = dpr; M.cv.width = Math.round(w * dpr); M.cv.height = Math.round(h * dpr);
  M.ajuste = ajusteVista();
  if (primera || !M.usuario) Object.assign(M.cam, M.ajuste);
  pedirMapa(); return true;
}
function animar(a, dur) { M.anim = { t0: performance.now(), dur: dur || 600, de: { k: M.cam.k, tx: M.cam.tx, ty: M.cam.ty }, a }; pedirMapa(); }
function limitar() {
  const ext = (M.R + 40) * M.cam.k * .6;
  M.cam.tx = clamp(M.cam.tx, 30 - ext, M.W + ext - 30); M.cam.ty = clamp(M.cam.ty, 30 - ext, M.H + ext - 30);
}
function zoomEn(sx, sy, f, animado) {
  const k0 = M.cam.k, k1 = clamp(k0 * f, M.ajuste.k * .8, 9);
  const a = { k: k1, tx: sx - (sx - M.cam.tx) * k1 / k0, ty: sy - (sy - M.cam.ty) * k1 / k0 };
  M.usuario = true;
  if (animado) animar(a, 300); else { Object.assign(M.cam, a); M.anim = null; limitar(); pedirMapa(); }
}
function verTodo() { M.usuario = false; M.ajuste = ajusteVista(); animar(Object.assign({}, M.ajuste), 600); }
function centrarEn(nd, k1) {
  const hoja = $("sel"), cv = M.cv.getBoundingClientRect(), vis = !hoja.hidden;
  const libreAbajo = vis ? hoja.getBoundingClientRect().top - cv.top - 6 : M.H - 96, libreArriba = 10;
  return { k: k1, tx: M.W / 2 - nd.x * k1, ty: (libreArriba + libreAbajo) / 2 - nd.y * k1 };
}
function trazar(c, forma, x, y, r) {
  c.beginPath();
  if (forma === "cuadrado") { const h = r * .86; c.rect(x - h, y - h, h * 2, h * 2); }
  else if (forma === "rombo") { const h = r * 1.22; c.moveTo(x, y - h); c.lineTo(x + h, y); c.lineTo(x, y + h); c.lineTo(x - h, y); c.closePath(); }
  else if (forma === "triangulo") { const h = r * 1.28; c.moveTo(x, y - h); c.lineTo(x + h * .95, y + h * .62); c.lineTo(x - h * .95, y + h * .62); c.closePath(); }
  else if (forma === "estrella") {
    const R = r * 1.34, q = r * .6;
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? q : R; c[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  } else c.arc(x, y, r, 0, TAU);
}
function textoArco(c, t, r, ac, sep) {
  const ancho = c.measureText(t).width + sep * t.length, inf = Math.sin(ac) > 0, span = ancho / r;
  let acum = 0;
  [...t].forEach(ch => {
    const w = c.measureText(ch).width + sep, mid = acum + w / 2; acum += w;
    const a = inf ? ac + span / 2 - mid / r : ac - span / 2 + mid / r;
    c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(inf ? a - Math.PI / 2 : a + Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
  });
}
function dibujarDeco(c, k) {
  const col = M.col, R = M.R, fam = col.fuente, px = n => n / k;
  c.save(); c.lineWidth = px(1);
  [[M.RL + 20, .2, []], [R - 56, .09, [px(2), px(6)]], [R + 56, .09, [px(2), px(6)]]].forEach(([r, a, d]) => {
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.strokeStyle = rgba(col.ink, a); c.setLineDash(d); c.stroke();
  });
  c.setLineDash([]);
  for (let g = 0; g < 360; g += 5) {
    const a = g * Math.PI / 180, grande = g % 15 === 0, r0 = R + 70, r1 = r0 + (grande ? 9 : 4.5);
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    c.strokeStyle = rgba(col.ink, grande ? .32 : .16); c.stroke();
  }
  M.sectores.forEach(sc => {
    const rc = col.reg[sc.l.ci], rr = R + 92, le = sc.lista.filter(n => leidas.has(n.id)).length, frac = le / sc.n, ac = (sc.a0 + sc.a1) / 2;
    c.lineCap = "butt";
    c.beginPath(); c.arc(0, 0, rr, sc.a0, sc.a1); c.lineWidth = px(4); c.strokeStyle = rgba(col.ink, .16); c.stroke();
    if (frac > 0) { c.beginPath(); c.arc(0, 0, rr, sc.a0, sc.a0 + (sc.a1 - sc.a0) * frac); c.strokeStyle = rgba(rc, .95); c.stroke(); }
    c.lineCap = "round";
    const texto = sc.l.corto.toUpperCase(), rt = rr + px(17);
    c.font = "700 " + px(10.5) + "px " + fam; c.textAlign = "center"; c.textBaseline = "middle";
    const ancho = c.measureText(texto).width + px(1.2) * texto.length;
    c.fillStyle = rgba(mezclar(rc, [255, 255, 255], .3), 1);
    if (ancho < (sc.a1 - sc.a0) * rt * 1.1) {
      textoArco(c, texto, rt, ac, px(1.2));
      c.font = "600 " + px(10) + "px " + fam; c.fillStyle = rgba(col.muted, 1);
      textoArco(c, le + "/" + sc.n, rt + (Math.sin(ac) > 0 ? -px(14) : px(14)), ac, px(.6));
    } else {                                    // sector estrecho: rótulo radial
      c.save(); c.translate(Math.cos(ac) * rt, Math.sin(ac) * rt); const izq = Math.cos(ac) < 0; c.rotate(izq ? ac + Math.PI : ac);
      c.textAlign = izq ? "right" : "left"; c.fillText(texto + "  " + le + "/" + sc.n, izq ? -px(3) : px(3), 0); c.restore();
    }
  });
  c.restore();
}
function dibujarEtiquetas(c, k, s) {
  const col = M.col, ref = M.sel, vec = ref ? new Set(VECINOS.get(ref.id).map(v => v.id)) : null, cand = [];
  M.nodos.forEach(nd => {
    const sx = nd.x * k + M.cam.tx, sy = nd.y * k + M.cam.ty;
    if (sx < -40 || sx > M.W + 40 || sy < -20 || sy > M.H + 20) return;
    let pr = -1;
    if (nd === ref) pr = 100;
    else if (vec && vec.has(nd.id)) pr = 60 + nd.deg * .1;
    else if (k >= 3.2) pr = 10;
    else if (k >= 2 && nd.deg >= 5) pr = 20 + nd.deg * .1;
    else if (k >= 1.1 && nd.deg >= 10) pr = 30 + nd.deg * .1;
    if (pr >= 0) cand.push({ nd, sx, sy, pr });
  });
  cand.sort((a, b) => b.pr - a.pr);
  const ocupados = [], fam = col.fuente, tope = M.W - 6;
  cand.forEach(q => {
    const nd = q.nd, big = q.pr >= 99, fuente = (big ? "700 12px " : "500 10.5px ") + fam;
    c.font = fuente;
    let t = recorta(nd.p.t, big ? 50 : 32), w = c.measureText(t).width;
    const h = big ? 17 : 14, r = nd.r * s * k + 5;
    const espD = tope - (q.sx + r + 8), espI = q.sx - r - 6, derecha = w <= espD || (w > espI && espD >= espI), esp = derecha ? espD : espI;
    if (w > esp && esp > 50) for (let n = t.length - 2; n > 8 && w > esp; n -= 2) { t = recorta(nd.p.t, n); w = c.measureText(t).width; }
    const x = derecha ? q.sx + r : q.sx - r - w, y = q.sy - h / 2 + 1, caja = [x - 3, y - 2, x + w + 3, y + h + 1];
    if (q.pr < 99 && ocupados.some(o => !(caja[2] < o[0] || caja[0] > o[2] || caja[3] < o[1] || caja[1] > o[3]))) return;
    ocupados.push(caja);
    c.textBaseline = "middle"; c.textAlign = "left"; c.lineWidth = 3.4; c.strokeStyle = rgba(col.bg, .94); c.strokeText(t, x, y + h / 2);
    c.fillStyle = rgba(estado(nd.id) === 2 || big ? col.ink : mezclar(col.ink, col.bg, .25), 1); c.fillText(t, x, y + h / 2);
  });
}
function dibujar(ahora) {
  const c = M.ctx, k = M.cam.k, s = Math.pow(k, -.33), col = M.col;
  const rapido = !!M.anim || !!(M.gesto && M.gesto.movido);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, M.cv.width, M.cv.height);
  c.setTransform(M.dpr * k, 0, 0, M.dpr * k, M.dpr * M.cam.tx, M.dpr * M.cam.ty);
  c.lineJoin = "round"; c.lineCap = "round";
  dibujarDeco(c, k);
  const ref = M.sel, nivel = { vacia: [], front: [], lit: [], alta: [] };
  M.aristas.forEach(e => {
    if (ref && (e.a === ref || e.b === ref)) { nivel.alta.push(e); return; }
    const ea = estado(e.a.id), eb = estado(e.b.id);
    nivel[ea === 2 && eb === 2 ? "lit" : (ea === 2 || eb === 2) ? "front" : "vacia"].push(e);
  });
  const lote = (lista, estilo, ancho, dash) => {
    if (!lista.length) return;
    c.beginPath(); lista.forEach(e => { c.moveTo(e.a.x, e.a.y); c.quadraticCurveTo(e.q[0], e.q[1], e.b.x, e.b.y); });
    c.strokeStyle = estilo; c.lineWidth = ancho / k; c.setLineDash(dash ? dash.map(v => v / k) : []); c.stroke(); c.setLineDash([]);
  };
  lote(nivel.vacia, rgba(col.ink, .07), .8);
  lote(nivel.front, rgba(col.ink, .24), 1, [3, 3]);
  if (rapido) lote(nivel.lit, rgba(col.ink, .6), 1.5);
  else nivel.lit.forEach(e => {
    const ca = col.reg[e.a.lane.ci], cb = col.reg[e.b.lane.ci], g = c.createLinearGradient(e.a.x, e.a.y, e.b.x, e.b.y);
    g.addColorStop(0, rgba(ca, .85)); g.addColorStop(1, rgba(cb, .85));
    c.globalCompositeOperation = "lighter"; c.beginPath(); c.moveTo(e.a.x, e.a.y); c.quadraticCurveTo(e.q[0], e.q[1], e.b.x, e.b.y);
    c.strokeStyle = rgba(mezclar(ca, cb, .5), .1); c.lineWidth = 4.5 / k; c.stroke(); c.globalCompositeOperation = "source-over";
    c.beginPath(); c.moveTo(e.a.x, e.a.y); c.quadraticCurveTo(e.q[0], e.q[1], e.b.x, e.b.y); c.strokeStyle = g; c.lineWidth = 1.5 / k; c.stroke();
  });
  lote(nivel.alta, rgba(col.acc, 1), 2.1);
  const vecinos = ref ? new Set(VECINOS.get(ref.id).map(v => v.id)) : null;
  M.nodos.slice().sort((a, b) => estado(a.id) - estado(b.id)).forEach(nd => {
    const e = estado(nd.id), dim = ref && nd !== ref && !vecinos.has(nd.id) ? .5 : 1;
    const pt = (ahora - nd.pop) / 900, pop = pt >= 0 && pt < 1 ? 1 + .9 * Math.sin(pt * Math.PI) * (1 - pt) : 1;
    const r = nd.r * s * pop, rc = col.reg[nd.lane.ci];
    c.globalAlpha = dim;
    if (e === 2) {
      if (!rapido) {
        c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(nd.x, nd.y, r * .5, nd.x, nd.y, r * 3.6);
        g.addColorStop(0, rgba(rc, .55)); g.addColorStop(1, rgba(rc, 0));
        c.fillStyle = g; c.beginPath(); c.arc(nd.x, nd.y, r * 3.6, 0, TAU); c.fill(); c.globalCompositeOperation = "source-over";
      }
      trazar(c, nd.forma, nd.x, nd.y, r); c.fillStyle = rgba(rc, 1); c.fill();
      c.lineWidth = 1.3 / k; c.strokeStyle = rgba(mezclar(rc, [255, 255, 255], .45), 1); c.stroke();
      c.beginPath(); c.arc(nd.x, nd.y, r * .38, 0, TAU); c.fillStyle = "rgba(255,255,255,.8)"; c.fill();
    } else {
      trazar(c, nd.forma, nd.x, nd.y, r); c.fillStyle = rgba(col.bg, 1); c.fill();
      c.lineWidth = (e === 1 ? 1.7 : 1.35) / k; c.strokeStyle = rgba(rc, e === 1 ? 1 : .78); c.stroke();
      if (e === 1) { c.beginPath(); c.arc(nd.x, nd.y, r * .42, 0, TAU); c.fillStyle = rgba(rc, .7); c.fill(); }
    }
    if (nd === ref) { c.globalAlpha = 1; trazar(c, nd.forma, nd.x, nd.y, r * 1.6); c.lineWidth = 2.2 / k; c.strokeStyle = rgba(col.acc, 1); c.stroke(); }
  });
  c.globalAlpha = 1;
  M.ondas = M.ondas.filter(o => ahora - o.t0 < o.dur);
  M.ondas.forEach(o => {
    const t = (ahora - o.t0) / o.dur, nd = M.pn.get(o.id); if (t < 0 || !nd) return;
    c.beginPath(); c.arc(nd.x, nd.y, nd.r * s * (1.4 + 8 * easeOut(t)), 0, TAU); c.lineWidth = (2.6 - 1.8 * t) / k; c.strokeStyle = rgba(col.reg[nd.lane.ci], .75 * (1 - t)); c.stroke();
  });
  c.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
  dibujarEtiquetas(c, k, s);
  actualizarLente();
}
function tick(ahora) {
  M.raf = 0;
  if (!M.listo || !M.visible || !M.W) return;
  let activo = false;
  if (M.anim) {
    const t = clamp((ahora - M.anim.t0) / M.anim.dur, 0, 1), e = ease(t), d = M.anim.de, a = M.anim.a;
    M.cam.k = d.k + (a.k - d.k) * e; M.cam.tx = d.tx + (a.tx - d.tx) * e; M.cam.ty = d.ty + (a.ty - d.ty) * e;
    if (t >= 1) M.anim = null; else activo = true;
  }
  if (M.ondas.length) activo = true;
  dibujar(ahora);
  if (activo) pedirMapa();
}
function actualizarLente() {
  const L = $("lente"), d = M.RL * 2 * M.cam.k;
  L.hidden = false;
  L.style.setProperty("--d", d.toFixed(1) + "px");
  L.style.transform = "translate(" + (M.cam.tx - d / 2).toFixed(1) + "px," + (M.cam.ty - d / 2).toFixed(1) + "px)";
  L.classList.toggle("chica", d < 100);
  const T = totales(), clave = T.l + ":" + T.a + ":" + T.t;
  if (clave === M.lenteClave) return;
  M.lenteClave = clave;
  const R = 52, C = 2 * Math.PI * R, la = C * T.l / T.t, aa = C * (T.l + T.a) / T.t;
  L.innerHTML = '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="' + R + '" stroke="rgba(255,255,255,.17)"/>' +
    (aa > .5 ? '<circle cx="60" cy="60" r="' + R + '" stroke="rgba(246,246,248,.38)" stroke-dasharray="' + aa.toFixed(1) + " " + C.toFixed(1) + '"/>' : "") +
    (la > .5 ? '<circle cx="60" cy="60" r="' + R + '" stroke="#f6f6f8" stroke-dasharray="' + la.toFixed(1) + " " + C.toFixed(1) + '"/>' : "") + "</svg>" +
    '<div class="lente-num"><b>' + T.l + "</b><span>de " + T.t + "</span></div>";
}
function nodoEn(x, y) {
  const k = M.cam.k, s = Math.pow(k, -.33); let mejor = null, md = 1e9;
  M.nodos.forEach(nd => {
    const dx = nd.x * k + M.cam.tx - x, dy = nd.y * k + M.cam.ty - y, rs = nd.r * s * k * 1.25 + 9, d = Math.hypot(dx, dy);
    if (d <= rs && d / rs < md) { md = d / rs; mejor = nd; }
  });
  return mejor;
}
function pintarHoja(nd) {
  const sel = $("sel");
  if (!nd) { sel.hidden = true; return; }
  const p = nd.p, e = estado(p.id);
  const vec = vecinosUnicos(p.id).sort((a, b) => (estado(b.id) - estado(a.id)) || (GRADO.get(b.id) - GRADO.get(a.id))).slice(0, 8);
  sel.innerHTML = '<button class="cerrar" data-cerrar aria-label="Cerrar"><svg class="ic"><use href="#i-cerrar"/></svg></button>' +
    '<div class="kicker">' + esc(FORMA_NOMBRE[nd.forma]) + (p.r.length ? " · " + esc(rango(p.r)) : "") + "</div><h3>" + esc(p.t) + "</h3>" +
    '<div class="est-lin' + clase(p.id) + '"><i class="est"></i>' + ETIQ_ESTADO[e] + " · " + esc(nd.lane.corto) + "</div>" +
    '<div class="acc"><button class="btn p" data-id="' + esc(p.id) + '">' + (e === 2 ? "Releer" : e === 1 ? "Seguir leyendo" : "Leer") + "</button>" +
    '<button class="btn" data-marcar="' + esc(p.id) + '">' + (e === 2 ? "Quitar marca" : "Marcar leída") + "</button></div>" +
    (vec.length ? "<h5>Conecta con</h5>" + vec.map(v => '<button class="vec' + clase(v.id) + '" data-sel="' + esc(v.id) + '"><i class="est"></i><span>' + esc(POR_ID.get(v.id).t) +
      "</span><small>" + esc(ETIQ_REL[v.rel] || bonito(v.rel)) + "</small></button>").join("") : "");
  sel.hidden = false; sel.scrollTop = 0;
}
function seleccionar(nd, centrar) {
  M.sel = nd || null; pintarHoja(M.sel);
  if (nd && centrar) { M.usuario = true; animar(centrarEn(nd, Math.max(M.cam.k, M.ajuste.k * 2.2)), 650); }
  else if (!nd && !M.usuario) { M.ajuste = ajusteVista(); }
  pedirMapa();
}
function pintarPista() {
  const T = totales(), p = $("pista");
  clearTimeout(M.pistaT);
  if (T.l === 0 && T.a === 0) { p.innerHTML = "<b>Todo está por explorar.</b> Toca un punto y pulsa «Leer»: al llegar al final de la lección se ilumina aquí."; p.classList.add("ver"); }
  else { p.textContent = "Cada región es un sector del anillo; las cuerdas del centro unen lecciones relacionadas."; p.classList.add("ver"); M.pistaT = setTimeout(() => p.classList.remove("ver"), 7000); }
}
function procesarPendientes() {
  if (!M.pend.length || !M.visible) return;
  const ids = M.pend.splice(0);
  ids.forEach((id, i) => setTimeout(() => {
    const nd = M.pn.get(id); if (!nd) return;
    const t = performance.now(); nd.pop = t; M.ondas.push({ id, t0: t, dur: 1100 }); pedirMapa();
  }, 350 + i * 300));
}
function enlazarMapa() {
  if (M.enlazado) return; M.enlazado = true;
  const cv = M.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const iniciarPinza = () => {
    const [a, b] = [...M.punteros.values()];
    M.gesto = { pinza: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: M.cam.k, cx0: (a.x + b.x) / 2, cy0: (a.y + b.y) / 2, tx0: M.cam.tx, ty0: M.cam.ty, movido: true };
  };
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId); const p = pos(e); M.punteros.set(e.pointerId, p); M.anim = null;
    $("pista").classList.remove("ver");
    if (M.punteros.size === 2) iniciarPinza();
    else M.gesto = { x0: p.x, y0: p.y, movido: false, tx0: M.cam.tx, ty0: M.cam.ty };
  });
  cv.addEventListener("pointermove", e => {
    if (!M.punteros.has(e.pointerId)) return;
    const p = pos(e); M.punteros.set(e.pointerId, p);
    if (M.punteros.size === 2 && M.gesto && M.gesto.pinza) {
      const [a, b] = [...M.punteros.values()], g = M.gesto, d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const k1 = clamp(g.k0 * d / g.d0, M.ajuste.k * .8, 9);
      M.cam.k = k1; M.cam.tx = cx - (g.cx0 - g.tx0) * k1 / g.k0; M.cam.ty = cy - (g.cy0 - g.ty0) * k1 / g.k0;
      M.usuario = true; limitar(); pedirMapa(); return;
    }
    if (M.punteros.size === 1 && M.gesto && !M.gesto.pinza) {
      const dx = p.x - M.gesto.x0, dy = p.y - M.gesto.y0;
      if (!M.gesto.movido && Math.hypot(dx, dy) > 6) M.gesto.movido = true;
      if (M.gesto.movido) { M.usuario = true; M.cam.tx = M.gesto.tx0 + dx; M.cam.ty = M.gesto.ty0 + dy; limitar(); pedirMapa(); }
    }
  });
  const fin = e => {
    const p = pos(e), tocar = M.gesto && !M.gesto.movido && !M.gesto.pinza && M.punteros.size === 1;
    M.punteros.delete(e.pointerId);
    if (!M.punteros.size) { M.gesto = null; pedirMapa(); }
    else if (M.punteros.size === 1) { const q = [...M.punteros.values()][0]; M.gesto = { x0: q.x, y0: q.y, movido: true, tx0: M.cam.tx, ty0: M.cam.ty }; }
    if (tocar && e.type === "pointerup") { const nd = nodoEn(p.x, p.y); seleccionar(nd === M.sel ? null : nd, !!nd); }
  };
  cv.addEventListener("pointerup", fin); cv.addEventListener("pointercancel", fin);
  cv.addEventListener("wheel", e => { e.preventDefault(); const p = pos(e); zoomEn(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0017))); }, { passive: false });
  window.addEventListener("resize", () => { if (M.visible) redimensionarMapa(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { if (M.visible) redimensionarMapa(); }).observe($("v-mapa"));
}
function entrarMapa() {
  construirMapa(); enlazarMapa();
  M.visible = true; leerColores(); redimensionarMapa(); pintarPista(); procesarPendientes(); pedirMapa();
}

/* =====================================================================
   AJUSTES Y SIN CONEXIÓN
   ===================================================================== */
let guardando = false;
function abrirMenu() {
  const T = totales(), tod = leer("atlas-m-todo");
  $("menu-c").innerHTML =
    "<h2>Tu progreso</h2>" +
    '<p class="sub">' + T.l + " de " + T.t + " lecciones leídas · " + T.a + " abiertas · " + T.n + " sin abrir</p>" +
    '<div class="fila"><div><b>Tamaño del texto</b><small>Para leer cómodo en el móvil</small></div><div class="tam"><button class="btn" data-tam="-1">A−</button><span id="m-tam">' + A.tam + ' px</span><button class="btn" data-tam="1">A+</button></div></div>' +
    '<div class="fila"><div><b>Leer sin conexión</b><small id="m-off-t">' + (tod ? "Guardado en este móvil. Se actualiza solo cuando hay internet." : "Guarda todas las lecciones y sus imágenes en este móvil (unos 40 MB).") +
    '</small><div class="barra-prog" id="m-off-b" hidden><i></i></div></div><button class="btn" id="m-off">' + (tod ? "Actualizar" : "Guardar") + "</button></div>" +
    '<div class="fila"><div><b>Borrar mi progreso</b><small>Deja todas las lecciones como sin leer.</small></div><button class="btn peligro" data-reset>Borrar</button></div>' +
    '<div class="fila"><div><b>Bloquear este dispositivo</b><small>Olvida la clave guardada: la volverá a pedir.</small></div><button class="btn" data-bloquear>Bloquear</button></div>' +
    '<p class="legal">ATLAS · ' + P.length + " lecciones · creado " + esc(D.creado) + " · licencia " + esc(D.licencia) + ". Lecciones redactadas con ayuda de IA y aún sin verificar por una persona: contrasta los datos importantes. Las imágenes vienen de Wikimedia Commons, con su autoría y licencia en el pie de cada una. Tu progreso se guarda solo en este móvil.</p>" +
    '<button class="btn p" data-cerrar-menu style="width:100%;margin-top:14px">Cerrar</button>';
  $("menu").hidden = false;
}
async function guardarTodo() {
  if (guardando) return; guardando = true;
  const barra = $("m-off-b"), txt = $("m-off-t"), btn = $("m-off");
  if (btn) btn.disabled = true;
  if (barra) barra.hidden = false;
  const imgs = new Set();
  TEXTOS.clear();
  let n = 0;
  const poner = () => { const b = $("m-off-b"); if (b) b.firstElementChild.style.width = Math.round(n / P.length * 100) + "%"; const t = $("m-off-t"); if (t) t.textContent = "Guardando… " + n + " de " + P.length; };
  await cargarTextos((L, hechas) => {
    if (L) Object.values(L.img || {}).forEach(u => { if (Array.isArray(u)) imgs.add(u[0]); });
    if (hechas) { n = hechas; poner(); }
  });
  const lista = [...imgs]; let k = 0;
  const trabajar = async () => { while (lista.length) { const u = lista.pop(); try { await fetch(u); } catch (e) {} k++; const t = $("m-off-t"); if (t) t.textContent = "Guardando imágenes… " + k + " de " + imgs.size; } };
  await Promise.all(Array.from({ length: 5 }, trabajar));
  guardando = false;
  if (TEXTOS.size === P.length) { guardar("atlas-m-todo", String(Date.now())); avisar("<b>Listo</b> · las " + P.length + " lecciones están en este móvil"); }
  else avisar("Faltaron algunas lecciones: vuelve a intentarlo con internet.");
  if (!$("menu").hidden) abrirMenu();
  pintarLista();
}

/* =====================================================================
   RUTAS Y EVENTOS
   ===================================================================== */
let TAB = "lista";
function irTab(t, desdeRuta) {
  TAB = t;
  $("v-lista").classList.toggle("on", t === "lista"); $("v-mapa").classList.toggle("on", t === "mapa");
  $("t-lista").classList.toggle("on", t === "lista"); $("t-mapa").classList.toggle("on", t === "mapa");
  if (!desdeRuta) history.replaceState(history.state, "", "#" + t);
  if (t === "mapa") entrarMapa(); else M.visible = false;
}
function ruta() {
  if (!P.length) return;
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && POR_ID.has(h)) { if (ACTUAL !== h || $("lectura").hidden) abrir(h, true); return; }
  cerrarLectura();
  irTab(h === "mapa" ? "mapa" : "lista", true);
}
window.addEventListener("popstate", ruta);

document.addEventListener("click", e => {
  const t = e.target.closest("[data-id],[data-sel],[data-marcar],[data-toggle],[data-mapa],[data-cerrar],[data-cerrar-menu],[data-estado],[data-region],[data-azar],[data-limpiar],[data-buscar-texto],[data-ir],[data-tam],[data-reset],[data-bloquear],#m-off,#menu,#logo,#b-menu,#t-lista,#t-mapa,#l-atras,#l-menos,#l-mas,#l-ok,#orden,#z-mas,#z-menos,#z-fit,#zoom,figure img");
  if (!t) return;
  if (t.id === "zoom") { t.hidden = true; return; }
  if (t.tagName === "IMG" && t.closest("figure")) { if (!t.getAttribute("src")) return; const z = $("zoom"); z.classList.toggle("lam", !!t.closest("figure.lam")); z.firstElementChild.src = t.src; z.hidden = false; z.scrollTop = 0; z.scrollLeft = 0; return; }
  if (t.id === "menu") { if (e.target === t) t.hidden = true; return; }
  if (t.dataset.cerrarMenu !== undefined) { $("menu").hidden = true; return; }
  if (t.dataset.bloquear !== undefined) { quitar("atlas-m-k"); location.reload(); return; }
  if (t.dataset.reset !== undefined) {
    if (confirm("¿Borrar todo tu progreso de lectura en este móvil?")) {
      abiertas.clear(); leidas.clear(); persistir(); quitar("atlas-m-ultima");
      pintarLista(); pintarRapido(); pintarProgreso(); M.lenteClave = ""; pintarHoja(M.sel); pedirMapa(); abrirMenu();
    }
    return;
  }
  if (t.dataset.tam) { A.tam = clamp(A.tam + +t.dataset.tam, 14, 26); aplicarTam(); const m = $("m-tam"); if (m) m.textContent = A.tam + " px"; return; }
  if (t.dataset.marcar) { marcarLeida(t.dataset.marcar, !leidas.has(t.dataset.marcar)); return; }
  if (t.dataset.toggle !== undefined) { if (ACTUAL) marcarLeida(ACTUAL, !leidas.has(ACTUAL)); return; }
  if (t.dataset.cerrar !== undefined) { seleccionar(null); return; }
  if (t.dataset.sel) { const nd = M.pn.get(t.dataset.sel); if (nd) seleccionar(nd, true); return; }
  if (t.dataset.mapa) {
    const id = t.dataset.mapa; $("lectura").hidden = true; document.body.classList.remove("leyendo"); quitarVigia(); ACTUAL = null; token++;
    history.replaceState(null, "", "#mapa"); irTab("mapa", true);
    const nd = M.pn.get(id); if (nd) setTimeout(() => seleccionar(nd, true), 60);
    return;
  }
  if (t.dataset.id) { abrir(t.dataset.id); return; }
  if (t.dataset.ir) { e.preventDefault(); const n = document.getElementById(t.dataset.ir); if (n) n.scrollIntoView({ block: "start" }); return; }
  if (t.dataset.estado !== undefined) { E.estado = t.dataset.estado; pintarLista(); return; }
  if (t.dataset.region !== undefined) { E.region = t.dataset.region; pintarLista(); return; }
  if (t.dataset.azar !== undefined) {
    const base = (E.visibles.length ? E.visibles : P).filter(p => !leidas.has(p.id)), b = base.length ? base : (E.visibles.length ? E.visibles : P);
    abrir(b[Math.floor(Math.random() * b.length)].id); return;
  }
  if (t.dataset.limpiar !== undefined) { E.q = E.estado = E.region = ""; $("q").value = ""; pintarLista(); return; }
  if (t.dataset.buscarTexto !== undefined) {
    t.disabled = true; const b = $("bt-barra"); if (b) b.hidden = false;
    let n = 0;
    cargarTextos((L, hechas) => { if (hechas) { n = hechas; if (b) b.firstElementChild.style.width = Math.round(n / P.length * 100) + "%"; } }).then(() => pintarLista());
    return;
  }
  switch (t.id) {
    case "m-off": guardarTodo(); break;
    case "logo": volverInicio(); break;
    case "b-menu": abrirMenu(); break;
    case "t-lista": if (TAB === "lista") $("v-lista").scrollTo({ top: 0, behavior: "smooth" }); else irTab("lista"); break;
    case "t-mapa": irTab("mapa"); break;
    case "l-atras": volver(); break;
    case "l-menos": A.tam = clamp(A.tam - 1, 14, 26); aplicarTam(); break;
    case "l-mas": A.tam = clamp(A.tam + 1, 14, 26); aplicarTam(); break;
    case "l-ok": if (ACTUAL) marcarLeida(ACTUAL, !leidas.has(ACTUAL)); break;
    case "orden": E.orden = E.orden === "az" ? "cron" : "az"; pintarLista(); break;
    case "z-mas": zoomEn(M.W / 2, M.H / 2, 1.6, true); break;
    case "z-menos": zoomEn(M.W / 2, M.H / 2, 1 / 1.6, true); break;
    case "z-fit": verTodo(); break;
  }
});
function volverInicio() {
  if (!$("lectura").hidden) { quitarVigia(); token++; $("lectura").hidden = true; document.body.classList.remove("leyendo"); ACTUAL = null; document.title = "ATLAS"; }
  history.replaceState(null, "", "#lista"); irTab("lista", true);
}
// si falla una imagen, se oculta su figura (sin conexión, por ejemplo)
document.addEventListener("error", e => {
  const im = e.target;
  if (im.tagName === "IMG" && im.closest("figure")) im.closest("figure").classList.add("sin-img");
}, true);
let tq;
$("q").addEventListener("input", e => { clearTimeout(tq); tq = setTimeout(() => { E.q = e.target.value; pintarLista(); }, 150); });
$("q").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("zoom").hidden) $("zoom").hidden = true;
    else if (!$("menu").hidden) $("menu").hidden = true;
    else if (!$("lectura").hidden) volver();
    else if (M.sel) seleccionar(null);
  }
});

/* ---------- arranque ---------- */
function iniciar() {
  document.body.classList.remove("cargando");
  aplicarTam();
  pintarProgreso(); pintarRapido(); pintarLista();
  $("pie").textContent = P.length + " lecciones · creado " + D.creado + " · " + D.licencia;
  ruta();
  window.__atlas = { P, M, E, estado, abrir, marcarLeida, seleccionar, irTab };   // para pruebas desde la consola
}
async function arrancar() {
  let kj;
  try { kj = await (await fetch("data/k.json")).json(); }
  catch (e) { mostrarFallo("No se pudo abrir ATLAS. Si estás sin conexión, ábrelo una vez con internet."); return; }
  const guardada = leer("atlas-m-k");
  if (guardada) {
    try { KEY = await claveDeBytes(deB64(guardada)); await comprobarClave(KEY, kj); }
    catch (e) { KEY = null; quitar("atlas-m-k"); }
  }
  if (!KEY) KEY = await pedirClave(kj);
  let datos;
  try { datos = JSON.parse(dec.decode(await descifrar(KEY, await (await fetch("data/i.bin")).arrayBuffer()))); }
  catch (e) { quitar("atlas-m-k"); mostrarFallo("No se pudieron leer los datos. Si estás sin conexión, ábrelo una vez con internet."); return; }
  prepararDatos(datos);
  iniciar();
}
arrancar();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
})();
