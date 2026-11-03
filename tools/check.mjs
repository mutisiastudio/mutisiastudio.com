// Site checks: each check returns a list of problems (empty = pass).
// Later tasks add a function and append it to `checks`.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const EXTRA_PAGES = ["404.html"];
const PAGES = [
  { path: "index.html", lang: "en", pair: "/es/", privacy: "/privacy/" },
  { path: "es/index.html", lang: "es", pair: "/", privacy: "/es/privacidad/" },
  { path: "privacy/index.html", lang: "en", pair: "/es/privacidad/", privacy: "/privacy/" },
  { path: "es/privacidad/index.html", lang: "es", pair: "/privacy/", privacy: "/es/privacidad/" },
];
const MAIL = "mailto:contact@mutisiastudio.com";

const stripComments = (s) =>
  s.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === ".superpowers" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hrefs = (html) =>
  [...stripComments(html).matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

function pagesExist() {
  const errs = PAGES.filter((p) => !existsSync(join(root, p.path)))
    .map((p) => `missing page ${p.path}`);
  for (const f of [...EXTRA_PAGES, ".nojekyll"])
    if (!existsSync(join(root, f))) errs.push(`missing ${f}`);
  if (!existsSync(join(root, "CNAME"))) errs.push("missing CNAME");
  else if (!/^mutisiastudio\.com\n?$/.test(read("CNAME")))
    errs.push("CNAME must contain exactly mutisiastudio.com");
  return errs;
}

function langAndPairs() {
  const errs = [];
  for (const p of PAGES.filter((p) => existsSync(join(root, p.path)))) {
    const html = read(p.path);
    if (!html.includes(`<html lang="${p.lang}"`)) errs.push(`${p.path}: lang must be "${p.lang}"`);
    if (!/<title>[^<]+<\/title>/.test(html)) errs.push(`${p.path}: missing <title>`);
    if (!hrefs(html).includes(p.pair)) errs.push(`${p.path}: missing link to ${p.pair}`);
  }
  return errs;
}

function linksResolve() {
  const errs = [];
  const all = [...PAGES, ...EXTRA_PAGES.map((path) => ({ path }))];
  for (const p of all.filter((p) => existsSync(join(root, p.path)))) {
    for (const h of hrefs(read(p.path))) {
      if (/^(mailto:|https?:|#)/.test(h)) continue;
      const target = h.split(/[#?]/)[0];
      if (!target) continue;
      let file = target.startsWith("/") ? join(root, target) : join(root, dirname(p.path), target);
      if (target.endsWith("/")) file = join(file, "index.html");
      if (!existsSync(file)) errs.push(`${p.path}: broken link ${h}`);
    }
  }
  return errs;
}

// The one outside website the pages may link to (as a link, never as something loaded).
const GITHUB_PRIVACY =
  "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement";

function nothingThirdParty() {
  const errs = [];
  const files = walk(root)
    .filter((f) => [".html", ".css", ".js", ".mjs"].includes(extname(f)))
    .filter((f) => !f.endsWith(join("tools", "check.mjs")));
  for (const f of files) {
    const rel = f.slice(root.length + 1);
    const text = stripComments(readFileSync(f, "utf8"))
      .replaceAll("http://www.w3.org/2000/svg", "");
    for (const m of text.matchAll(/https?:\/\/[^\s"'<>)]*/g)) {
      const host = m[0].replace(/^https?:\/\//, "").split(/[/?#:]/)[0];
      const asLink = text.includes(`href="${m[0]}"`);
      if (host === "mutisiastudio.com") continue;
      if (m[0] === GITHUB_PRIVACY && asLink && !text.includes(`src="${m[0]}"`)) continue;
      errs.push(`${rel}: contains the URL ${m[0]}`);
    }
    for (const m of text.matchAll(/mailto:[^"'\s<>)]*/g))
      if (m[0] !== MAIL) errs.push(`${rel}: unexpected ${m[0]}`);
  }
  return errs;
}

const SITE = "https://mutisiastudio.com";

function previewTags() {
  const errs = [];
  for (const p of PAGES.filter((p) => existsSync(join(root, p.path)))) {
    const html = stripComments(read(p.path));
    const meta = (name) =>
      (html.match(new RegExp(`<meta [^>]*(?:property|name)="${name}" content="([^"]+)"`)) || [])[1];
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (!canon) errs.push(`${p.path}: missing canonical`);
    else if (canon !== SITE + (p.path === "index.html" ? "/" : "/" + p.path.replace("index.html", "")))
      errs.push(`${p.path}: canonical ${canon} is not this page's address`);
    for (const n of ["og:title", "og:description", "og:url", "og:image", "og:type", "og:locale", "description"])
      if (!meta(n)) errs.push(`${p.path}: missing ${n}`);
    if (canon && meta("og:url") !== canon) errs.push(`${p.path}: og:url must equal canonical`);
    if (meta("og:image") !== SITE + "/assets/img/og.png") errs.push(`${p.path}: og:image must be ${SITE}/assets/img/og.png`);
    const alt = (l) => new RegExp(`<link rel="alternate" hreflang="${l}" href="${SITE}${p.pair}"`);
    const own = (l) => html.includes(`hreflang="${l}" href="${canon}"`);
    const other = p.lang === "en" ? "es" : "en";
    if (!alt(other).test(html)) errs.push(`${p.path}: missing hreflang ${other} to ${p.pair}`);
    if (!own(p.lang)) errs.push(`${p.path}: missing hreflang ${p.lang} to itself`);
    const en = p.lang === "en" ? canon : SITE + p.pair;
    if (!html.includes(`hreflang="x-default" href="${en}"`)) errs.push(`${p.path}: x-default must point to ${en}`);
  }
  if (!existsSync(join(root, "assets/img/og.png"))) errs.push("missing assets/img/og.png");
  return errs;
}

// Small pages for a phone's battery: the sky must not cost more than it has to.
function motionIsLight() {
  if (!existsSync(join(root, MOTION))) return [`missing ${MOTION}`];
  const src = stripComments(read(MOTION));
  const errs = [];
  if (!/Math\.min\(\s*2\s*,\s*window\.devicePixelRatio/.test(src)) errs.push(`${MOTION}: dpr must be capped at 2`);
  if (!/FRAME_MS\s*=\s*33/.test(src) || !/< FRAME_MS/.test(src)) errs.push(`${MOTION}: missing the ~30 fps frame-interval guard`);
  if (!/canvas\.width\s*=\s*canvas\.height\s*=\s*0/.test(src)) errs.push(`${MOTION}: must shrink the canvas to 0 when idle`);
  return errs;
}

function footerLinks() {
  const errs = [];
  for (const p of PAGES.filter((p) => existsSync(join(root, p.path)))) {
    const h = hrefs(read(p.path));
    if (!h.includes(p.privacy)) errs.push(`${p.path}: missing link to ${p.privacy}`);
    if (!h.includes(MAIL)) errs.push(`${p.path}: missing ${MAIL}`);
  }
  return errs;
}

const APP = "/home/lucia/projects/pomodoro/app/src/main/java/com/lucia/pomodoro/";

function loadThemes() {
  const ctx = { window: {} };
  vm.runInNewContext(read("assets/js/themes.js"), ctx);
  return ctx.window.THEMES;
}

const hex6 = (h) => "#" + h.slice(2).toUpperCase();

function themesMatchApp() {
  const errs = [];
  let T;
  try { T = loadThemes(); } catch (e) { return [`themes.js: ${e.message}`]; }
  const sky = readFileSync(APP + "Sky.kt", "utf8");
  const color = readFileSync(APP + "ui/theme/Color.kt", "utf8");
  const words = readFileSync(APP + "Words.kt", "utf8");
  const rows = [...sky.matchAll(
    /^\s+(\w+)\("(\w+)", Color\(0x(\w+)\), Color\(0x(\w+)\), Color\(0x(\w+)\), Color\(0x(\w+)\)/gm)];
  const wordsOf = (cls) => {
    const i = words.indexOf(`class ${cls}`) >= 0 ? words.indexOf(`class ${cls}`) : words.indexOf(`object ${cls}`);
    return words.slice(i);
  };
  const nameMap = (txt, kind, fn) => {
    const at = txt.indexOf(`override fun ${fn}`);
    return Object.fromEntries([...txt.slice(at, at + 1700)
      .matchAll(new RegExp(`${kind}\\.(\\w+) -> "([^"]+)"`, "g"))].map((m) => [m[1], m[2]]));
  };
  const es = wordsOf("SpanishWords"), en = wordsOf("EnglishWords");
  const esS = nameMap(es, "Sky", "skyName"), enS = nameMap(en, "Sky", "skyName");
  const esC = nameMap(es, "AppColor", "colorName"), enC = nameMap(en, "AppColor", "colorName");
  if (T.skies.length !== rows.length) errs.push(`expected ${rows.length} skies, got ${T.skies.length}`);
  rows.forEach((m, i) => {
    const t = T.skies[i];
    if (!t) return;
    const want = [m[2], hex6(m[3]), hex6(m[4]), hex6(m[5]), hex6(m[6])];
    const got = [t.id, t.top, t.mid, t.bot, t.ink].map((x) => String(x).toUpperCase());
    want.forEach((w, k) => { if (w.toUpperCase() !== got[k]) errs.push(`sky #${i} ${m[2]}: ${["id", "top", "mid", "bot", "ink"][k]} ${got[k]} != ${w}`); });
    if (t.name?.es !== esS[m[1]]) errs.push(`sky ${m[2]}: es name ${t.name?.es} != ${esS[m[1]]}`);
    if (t.name?.en !== enS[m[1]]) errs.push(`sky ${m[2]}: en name ${t.name?.en} != ${enS[m[1]]}`);
    if (typeof t.veil !== "string" || !t.veil.startsWith("rgba(")) errs.push(`sky ${m[2]}: veil must be rgba()`);
    const mv = ["mar", "cerezo", "fogata", "aurora"].includes(m[2]);
    if (t.moves !== mv) errs.push(`sky ${m[2]}: moves must be ${mv}`);
  });
  const ids = ["BLANCO", "AZUL", "SALMON", "VERDE", "LILA"];
  if (T.plains.length !== ids.length) errs.push(`expected 5 plains, got ${T.plains.length}`);
  ids.forEach((id, i) => {
    const t = T.plains[i];
    if (!t) return;
    const at = color.indexOf(`    ${id}(`);
    const blk = color.slice(at, at + 1500);
    const bg = [...blk.matchAll(/background = Color\(0x(\w+)\)/g)].map((m) => hex6(m[1]));
    const ink = [...blk.matchAll(/\bink = Color\(0x(\w+)\)/g)].map((m) => hex6(m[1]));
    const eq = (a, b, what) => { if (String(a).toUpperCase() !== b) errs.push(`plain ${id} ${what}: ${a} != ${b}`); };
    eq(t.light?.bg, bg[0], "light bg"); eq(t.light?.ink, ink[0], "light ink");
    eq(t.dark?.bg, bg[1], "dark bg"); eq(t.dark?.ink, ink[1], "dark ink");
    if (t.id !== id.toLowerCase()) errs.push(`plain ${id}: id ${t.id}`);
    if (t.name?.es !== esC[id]) errs.push(`plain ${id}: es name ${t.name?.es} != ${esC[id]}`);
    if (t.name?.en !== enC[id]) errs.push(`plain ${id}: en name ${t.name?.en} != ${enC[id]}`);
    if (typeof t.veil !== "string" || !t.veil.startsWith("rgba(")) errs.push(`plain ${id}: veil must be rgba()`);
  });
  return errs;
}

function contrast() {
  let T;
  try { T = loadThemes(); } catch (e) { return [`themes.js: ${e.message}`]; }
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const blend = (bg, veil) => {
    const m = veil.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
    if (!m) return bg;
    const a = Number(m[4]);
    return bg.map((v, i) => v * (1 - a) + Number(m[i + 1]) * a);
  };
  const errs = [];
  const test = (label, ink, bgs, veil) => {
    for (const bg of bgs) {
      const r = ratio(rgb(ink), blend(rgb(bg), veil));
      if (r < 4.5) errs.push(`${label}: ink ${ink} on ${bg}+veil is ${r.toFixed(2)} (< 4.5)`);
    }
  };
  const css = stripComments(read("assets/css/site.css"));
  const mm = css.match(/--muted:\s*([\d.]+)/);
  if (!mm) return ["site.css must define --muted (text softening strength)"];
  const muted = Number(mm[1]);
  // Any other dimming would escape the test below (0.18 is the decorative water ball).
  for (const m of css.matchAll(/(?<![\w-])opacity:\s*([^;]+);/g))
    if (!["var(--muted)", "1", "0.18"].includes(m[1].trim()))
      errs.push(`site.css: opacity ${m[1].trim()} is not tested; use var(--muted)`);
  // Toggle labels must sit on the page, not on a filled track or pill.
  for (const m of css.matchAll(/(\.toggle[^{]*)\{([^}]*)\}/g))
    for (const d of m[2].matchAll(/background(?:-color)?:\s*([^;]+);/g))
      if (d[1].trim() !== "transparent")
        errs.push(`site.css: ${m[1].trim()} has background ${d[1].trim()}; contrast is not tested on it`);
  // The card clock "18:42" is exempt: aria-hidden decoration imitating the app's own screen.
  // Softened text is ink mixed toward the background by --muted.
  const soften = (ink, bg) => ink.map((v, i) => v * muted + bg[i] * (1 - muted));
  const test2 = (label, ink, bgs, veil) => {
    test(label, ink, bgs, veil);
    for (const bg of bgs) {
      const b = blend(rgb(bg), veil);
      const r = ratio(soften(rgb(ink), b), b);
      if (r < 4.5) errs.push(`${label}: muted ink on ${bg}+veil is ${r.toFixed(2)} (< 4.5)`);
    }
  };
  for (const s of T.skies) test2(`sky ${s.id}`, s.ink, [s.top, s.mid, s.bot], s.veil);
  for (const p of T.plains)
    for (const m of ["light", "dark"]) test2(`plain ${p.id} ${m}`, p[m].ink, [p[m].bg], p.veil);
  return errs;
}

function defaultTheme() {
  if (!existsSync(join(root, "assets/js/theme-picker.js"))) return ["missing assets/js/theme-picker.js"];
  const src = read("assets/js/theme-picker.js");
  const errs = [];
  if (!/DEFAULT\s*=\s*\{\s*kind:\s*"skies",\s*id:\s*"aurora"/.test(src))
    errs.push('theme-picker.js must default to {kind: "skies", id: "aurora"}');
  if (!/localStorage/.test(src)) errs.push("theme-picker.js must save to localStorage");
  if (!/themechange/.test(src)) errs.push("theme-picker.js must dispatch themechange");
  return errs;
}

const HOMES = ["index.html", "es/index.html"];
const SECTIONS = ["hero", "make-it-yours", "how-it-works", "your-goals", "studio"];
const idsOf = (html) => [...stripComments(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

function sectionsInOrder() {
  const errs = [];
  for (const path of HOMES) {
    const ids = idsOf(read(path));
    const at = SECTIONS.map((id) => ids.indexOf(id));
    SECTIONS.forEach((id, i) => { if (at[i] < 0) errs.push(`${path}: missing id="${id}"`); });
    const found = at.filter((i) => i >= 0);
    if (found.some((v, i) => i > 0 && v < found[i - 1]))
      errs.push(`${path}: sections must come in the order ${SECTIONS.join(", ")}`);
  }
  return errs;
}

function sameStructure() {
  const [en, es] = HOMES.map((p) => stripComments(read(p)));
  const errs = [];
  const a = idsOf(en).join(","), b = idsOf(es).join(",");
  if (a !== b) errs.push(`home pages have different ids:\n    en: ${a}\n    es: ${b}`);
  const svgs = (h) => (h.match(/<svg\b/g) || []).length;
  if (svgs(en) !== svgs(es)) errs.push(`home pages have ${svgs(en)} and ${svgs(es)} <svg>`);
  return errs;
}

// One notice per page while the app is not public; swapping it for the real badge is one edit.
function comingSoon() {
  const errs = [];
  for (const path of HOMES) {
    const html = stripComments(read(path));
    const n = (html.match(/data-store-badge/g) || []).length;
    if (n !== 1) errs.push(`${path}: expected 1 [data-store-badge], found ${n}`);
    if (/play\.google\.com/.test(html)) errs.push(`${path}: must not link to play.google.com yet`);
  }
  return errs;
}

const MOTION = "assets/js/sky-motion.js";

// The effect table is `const EFFECTS = { id: draw, ... }` in sky-motion.js.
function motionCoversMovingSkies() {
  if (!existsSync(join(root, MOTION))) return [`missing ${MOTION}`];
  const m = stripComments(read(MOTION)).match(/const EFFECTS = \{([^}]*)\}/);
  if (!m) return [`${MOTION}: missing const EFFECTS = { ... }`];
  const have = [...m[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]).sort().join(",");
  const want = loadThemes().skies.filter((s) => s.moves).map((s) => s.id).sort().join(",");
  return have === want ? [] : [`${MOTION}: effects for ${have}, skies that move are ${want}`];
}

function motionRespectsUser() {
  if (!existsSync(join(root, MOTION))) return [`missing ${MOTION}`];
  const src = stripComments(read(MOTION));
  const errs = ["prefers-reduced-motion", "visibilitychange", "devicePixelRatio", "themechange"]
    .filter((w) => !src.includes(w)).map((w) => `${MOTION} must handle ${w}`);
  for (const path of HOMES)
    if (!hrefs(read(path)).includes("/" + MOTION)) errs.push(`${path}: must load /${MOTION}`);
  return errs;
}

// Wide washes of light (aurora curtains, fire glow, water rays) are declared in WASH
// as the worst stack of [color, alpha] they can reach; text must still read on top.
// Small particles (bubbles, petals, sparks) pass behind a letter for a moment and are not tested.
function motionKeepsContrast() {
  if (!existsSync(join(root, MOTION))) return [`missing ${MOTION}`];
  const m = stripComments(read(MOTION)).match(/const WASH = (\{[\s\S]*?\n {2}\});/);
  if (!m) return [`${MOTION}: missing const WASH = { ... };`];
  const wash = vm.runInNewContext("(" + m[1] + ")");
  const css = stripComments(read("assets/css/site.css"));
  const muted = Number(css.match(/--muted:\s*([\d.]+)/)[1]);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (bg, c, a) => bg.map((v, i) => v * (1 - a) + c[i] * a);
  const errs = [];
  for (const s of loadThemes().skies.filter((s) => s.moves)) {
    if (!wash[s.id]) { errs.push(`${MOTION}: WASH has no entry for ${s.id}`); continue; }
    const v = s.veil.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
    for (const stop of [s.top, s.mid, s.bot]) {
      let b = rgb(stop);
      for (const [c, a] of wash[s.id]) b = over(b, rgb(c), a);
      b = over(b, [v[1], v[2], v[3]].map(Number), Number(v[4]));
      const ink = rgb(s.ink);
      const r = ratio(ink, b);
      const rm = ratio(ink.map((x, i) => x * muted + b[i] * (1 - muted)), b);
      if (Math.min(r, rm) < 4.5)
        errs.push(`sky ${s.id}: text over its wash on ${stop} is ${Math.min(r, rm).toFixed(2)} (< 4.5)`);
    }
  }
  return errs;
}

const MANIFEST = "/home/lucia/projects/pomodoro/app/src/main/AndroidManifest.xml";
const PRIVACY = ["privacy/index.html", "es/privacidad/index.html"];

function manifestPermissions() {
  const xml = readFileSync(MANIFEST, "utf8");
  return [...xml.matchAll(/<uses-permission[^>]*?android:name="android\.permission\.([A-Z_]+)"/g)]
    .map((m) => m[1]);
}

function privacyNamesEveryPermission() {
  const errs = [];
  const perms = manifestPermissions();
  if (!perms.length) errs.push("no permissions found in the manifest");
  for (const p of PRIVACY.filter((p) => existsSync(join(root, p)))) {
    const html = read(p);
    for (const perm of perms)
      if (!new RegExp(`\\b${perm}\\b`).test(html)) errs.push(`${p}: does not name ${perm}`);
  }
  return errs;
}

function privacyBasics() {
  const errs = [];
  for (const p of PRIVACY) {
    const html = existsSync(join(root, p)) ? read(p) : "";
    if (!html.includes(`href="${GITHUB_PRIVACY}"`)) errs.push(`${p}: missing the GitHub privacy link`);
    if (!html.includes("DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION")) errs.push(`${p}: missing the library permission note`);
    for (const need of ["contact@mutisiastudio.com", "Mutisia Studio", "Leipzig"])
      if (!html.includes(need)) errs.push(`${p}: missing "${need}"`);
    if (!/<time datetime="\d{4}-\d{2}-\d{2}">/.test(html))
      errs.push(`${p}: missing <time datetime="YYYY-MM-DD">`);
  }
  return errs;
}

// The policy says the app has no internet access; fail if the manifest ever disagrees.
function noInternetClaimIsTrue() {
  return manifestPermissions().includes("INTERNET")
    ? ["manifest declares INTERNET: the privacy policy now lies"] : [];
}

const checks = [pagesExist, langAndPairs, linksResolve, nothingThirdParty, footerLinks,
  themesMatchApp, contrast, defaultTheme, sectionsInOrder, sameStructure, comingSoon,
  motionCoversMovingSkies, motionRespectsUser, motionKeepsContrast, motionIsLight, previewTags,
  privacyNamesEveryPermission, privacyBasics, noInternetClaimIsTrue];

let failed = 0;
for (const check of checks) {
  const errs = check();
  if (errs.length) {
    failed++;
    console.log(`FAIL ${check.name}`);
    for (const e of errs) console.log(`  - ${e}`);
  }
}
if (failed) process.exit(1);
console.log("OK");
