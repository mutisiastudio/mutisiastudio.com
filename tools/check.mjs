// Site checks: each check returns a list of problems (empty = pass).
// Later tasks add a function and append it to `checks`.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const EXTRA_PAGES = ["404.html"];
// The studio's front page and its website privacy at the root; each app under its own folder,
// with the app's own privacy policy (the one its store listing links to).
const PAGES = [
  { path: "index.html", lang: "en", pair: "/es/", privacy: "/privacy/" },
  { path: "es/index.html", lang: "es", pair: "/", privacy: "/es/privacidad/" },
  { path: "privacy/index.html", lang: "en", pair: "/es/privacidad/", privacy: "/privacy/" },
  { path: "es/privacidad/index.html", lang: "es", pair: "/privacy/", privacy: "/es/privacidad/" },
  { path: "pomoluna/index.html", lang: "en", pair: "/es/pomoluna/", privacy: "/pomoluna/privacy/" },
  { path: "es/pomoluna/index.html", lang: "es", pair: "/pomoluna/", privacy: "/es/pomoluna/privacidad/" },
  { path: "pomoluna/privacy/index.html", lang: "en", pair: "/es/pomoluna/privacidad/",
    privacy: "/pomoluna/privacy/" },
  { path: "es/pomoluna/privacidad/index.html", lang: "es", pair: "/pomoluna/privacy/",
    privacy: "/es/pomoluna/privacidad/" },
];
const MAIL = "mailto:contact@mutisiastudio.com";

const stripComments = (s) =>
  s.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === ".superpowers" || name === "node_modules" || name === "spike") continue;
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

// The outside pages the site may link to (as links, never as something loaded).
const GITHUB_PRIVACY =
  "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement";
const COUNTER_PRIVACY = "https://www.goatcounter.com/help/privacy";
const LINKS_OUT = [GITHUB_PRIVACY, COUNTER_PRIVACY];

// Visit counting: our own copy of GoatCounter's script, which sends only to this address.
// The copy is vendored as is, so the site's own rules below skip it.
const COUNTER = "https://mutisiastudio.goatcounter.com/count";
const COUNTER_JS = "assets/js/count.js";
const COUNTER_TAG = `<script data-goatcounter="${COUNTER}" async src="/${COUNTER_JS}"></script>`;

function nothingThirdParty() {
  const errs = [];
  const files = walk(root)
    .filter((f) => [".html", ".css", ".js", ".mjs"].includes(extname(f)))
    .filter((f) => !f.endsWith(join("tools", "check.mjs")))
    .filter((f) => f !== join(root, COUNTER_JS));
  for (const f of files) {
    const rel = f.slice(root.length + 1);
    const text = stripComments(readFileSync(f, "utf8"))
      .replaceAll("http://www.w3.org/2000/svg", "");
    for (const m of text.matchAll(/https?:\/\/[^\s"'<>)]*/g)) {
      const host = m[0].replace(/^https?:\/\//, "").split(/[/?#:]/)[0];
      const asLink = text.includes(`href="${m[0]}"`);
      if (host === "mutisiastudio.com") continue;
      if (m[0] === COUNTER && text.includes(`data-goatcounter="${COUNTER}"`)) continue;
      if (LINKS_OUT.includes(m[0]) && asLink && !text.includes(`src="${m[0]}"`)) continue;
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
  });
  return errs;
}

// Every text color must reach 4.5 on every stop of the page gradient, plain and softened.
const BODY_BG = "linear-gradient(#0B1530, #12274A 560px, #24507F max(40%, 760px), #3A6A9C)";

function contrast() {
  const css = stripComments(read("assets/css/site.css"));
  const rule = css.match(/(?<![\w.#-])body\s*\{([^}]*)\}/g) || [];
  const bg = rule.join(" ").match(/background:\s*([^;]+);/);
  if (!bg) return ["site.css: the body rule has no background"];
  if (bg[1].replace(/\s+/g, " ").trim() !== BODY_BG)
    return [`site.css: body background must be exactly ${BODY_BG}`];
  const mm = css.match(/--muted:\s*([\d.]+)/);
  if (!mm) return ["site.css must define --muted (text softening strength)"];
  const muted = Number(mm[1]);
  const errs = [];
  // Any other dimming would escape the test below.
  for (const m of css.matchAll(/(?<![\w-])opacity:\s*([^;]+);/g))
    if (!["var(--muted)", "1"].includes(m[1].trim()))
      errs.push(`site.css: opacity ${m[1].trim()} is not tested; use var(--muted)`);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const ink = rgb("#EEF9FB");
  for (const stop of ["#0B1530", "#12274A", "#24507F", "#3A6A9C"]) {
    const b = rgb(stop);
    const r = ratio(ink, b);
    if (r < 4.5) errs.push(`ink #EEF9FB on ${stop} is ${r.toFixed(2)} (< 4.5)`);
    const soft = ink.map((v, i) => v * muted + b[i] * (1 - muted));
    const rm = ratio(soft, b);
    if (rm < 4.5) errs.push(`muted ink on ${stop} is ${rm.toFixed(2)} (< 4.5)`);
  }
  return errs;
}

const STUDIO = ["index.html", "es/index.html"];
const HOMES = ["pomoluna/index.html", "es/pomoluna/index.html"];
const langOf = (path) => (path.startsWith("es/") ? "es" : "en");
const SECTIONS = ["hero", "how-it-works", "make-it-yours", "themes", "your-goals", "studio"];
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
  const imgs = (h) => (h.match(/<img\b/g) || []).length;
  if (imgs(en) !== imgs(es)) errs.push(`home pages have ${imgs(en)} and ${imgs(es)} <img>`);
  return errs;
}

// The old picker and moving background are gone for good.
function noOldPicker() {
  const errs = [];
  for (const f of ["assets/js/theme-picker.js", "assets/js/sky-motion.js"])
    if (existsSync(join(root, f))) errs.push(`${f} must be deleted`);
  const assets = walk(join(root, "assets")).map((f) => f.slice(root.length + 1))
    .filter((f) => f !== COUNTER_JS);
  const files = [...PAGES.map((p) => p.path), ...EXTRA_PAGES, ...assets]
    .filter((f) => [".html", ".css", ".js"].includes(extname(f)));
  for (const f of files)
    for (const w of ["theme-picker", "sky-motion", "mode-toggle", "localStorage"])
      if (read(f).includes(w)) errs.push(`${f} mentions ${w}`);
  return errs;
}

// Screenshots: real files in the page's own language, with alt text and a size.
function screenshots() {
  const errs = [];
  const names = {};
  for (const path of HOMES) {
    const lang = langOf(path);
    const html = stripComments(read(path));
    const hero = (html.match(/<section id="hero"[\s\S]*?<\/section>/) || [""])[0];
    names[lang] = [];
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      const attr = (n) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
      const src = attr("src") || "";
      if (src.startsWith("/assets/img/shots/")) {
        const [, folder, file] = src.match(/^\/assets\/img\/shots\/([^/]+)\/(.+)$/) || [];
        if (folder !== lang) errs.push(`${path}: ${src} is not in the ${lang} folder`);
        if (!existsSync(join(root, src))) errs.push(`${path}: missing file ${src}`);
        names[lang].push(file);
        if (!attr("alt")) errs.push(`${path}: ${src} needs non-empty alt`);
        for (const n of ["width", "height"])
          if (!attr(n)) errs.push(`${path}: ${src} needs ${n}`);
      }
      if (!hero.includes(tag) && attr("loading") !== "lazy")
        errs.push(`${path}: <img src="${src}"> outside #hero needs loading="lazy"`);
    }
  }
  const a = [...new Set(names.en)].sort().join(","), b = [...new Set(names.es)].sort().join(",");
  if (a !== b) errs.push(`homes use different screenshots:\n    en: ${a}\n    es: ${b}`);
  if (names.en.length !== 10 || a.split(",").length !== 10)
    errs.push(`each home must use the 10 screenshots once (en has ${names.en.length})`);
  return errs;
}

// One notice per page while the app is not public; swapping it for the real badge is one edit.
function comingSoon() {
  const errs = [];
  for (const path of [...STUDIO, ...HOMES]) {
    const html = stripComments(read(path));
    const n = (html.match(/data-store-badge/g) || []).length;
    if (n !== 1) errs.push(`${path}: expected 1 [data-store-badge], found ${n}`);
    if (/play\.google\.com/.test(html)) errs.push(`${path}: must not link to play.google.com yet`);
  }
  return errs;
}

const MANIFEST = "/home/lucia/projects/pomodoro/app/src/main/AndroidManifest.xml";
const APP_PRIVACY = ["pomoluna/privacy/index.html", "es/pomoluna/privacidad/index.html"];
const SITE_PRIVACY = ["privacy/index.html", "es/privacidad/index.html"];

function manifestPermissions() {
  const xml = readFileSync(MANIFEST, "utf8");
  return [...xml.matchAll(/<uses-permission[^>]*?android:name="android\.permission\.([A-Z_]+)"/g)]
    .map((m) => m[1]);
}

function privacyNamesEveryPermission() {
  const errs = [];
  const perms = manifestPermissions();
  if (!perms.length) errs.push("no permissions found in the manifest");
  for (const p of APP_PRIVACY.filter((p) => existsSync(join(root, p)))) {
    const html = read(p);
    for (const perm of perms)
      if (!new RegExp(`\\b${perm}\\b`).test(html)) errs.push(`${p}: does not name ${perm}`);
  }
  return errs;
}

function privacyBasics() {
  const errs = [];
  for (const p of [...APP_PRIVACY, ...SITE_PRIVACY]) {
    const html = existsSync(join(root, p)) ? read(p) : "";
    if (SITE_PRIVACY.includes(p) && !html.includes(`href="${GITHUB_PRIVACY}"`))
      errs.push(`${p}: missing the GitHub privacy link`);
    if (APP_PRIVACY.includes(p)) {
      if (!html.includes("DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"))
        errs.push(`${p}: missing the library permission note`);
      const site = langOf(p) === "es" ? "/es/privacidad/" : "/privacy/";
      if (!hrefs(html).includes(site)) errs.push(`${p}: must point to the website privacy ${site}`);
    }
    for (const need of ["contact@mutisiastudio.com", "Mutisia Studio", "Leipzig"])
      if (!html.includes(need)) errs.push(`${p}: missing "${need}"`);
    if (!/<time datetime="\d{4}-\d{2}-\d{2}">/.test(html))
      errs.push(`${p}: missing <time datetime="YYYY-MM-DD">`);
  }
  return errs;
}

// Every page counts its visit once, and both policies say so.
function countsVisits() {
  const errs = [];
  if (!existsSync(join(root, COUNTER_JS))) return [`${COUNTER_JS} is missing`];
  if (!/GoatCounter[\s\S]*ISC license/.test(read(COUNTER_JS)))
    errs.push(`${COUNTER_JS}: not GoatCounter's script with its license line`);
  for (const p of [...PAGES.map((p) => p.path), ...EXTRA_PAGES])
    if (read(p).split(COUNTER_TAG).length !== 2) errs.push(`${p}: needs ${COUNTER_TAG} once`);
  for (const p of SITE_PRIVACY)
    for (const need of [`href="${COUNTER_PRIVACY}"`, "1000"])
      if (!read(p).includes(need)) errs.push(`${p}: missing "${need}"`);
  return errs;
}

// The studio's front page leads to each app's page in the same language.
function studioLinksApps() {
  const errs = [];
  for (const path of STUDIO.filter((p) => existsSync(join(root, p)))) {
    const app = langOf(path) === "es" ? "/es/pomoluna/" : "/pomoluna/";
    if (!hrefs(read(path)).includes(app)) errs.push(`${path}: missing link to ${app}`);
  }
  return errs;
}

// The policy says the app has no internet access; fail if the manifest ever disagrees.
function noInternetClaimIsTrue() {
  return manifestPermissions().includes("INTERNET")
    ? ["manifest declares INTERNET: the privacy policy now lies"] : [];
}

const GRID_JS = "assets/js/sky-grid.js";

function gridCoversEverySky() {
  if (!existsSync(join(root, GRID_JS))) return [`${GRID_JS} is missing`];
  const ids = loadThemes().skies.map((s) => s.id).sort();
  const m = read(GRID_JS).match(/^const EFFECTS = \{([\s\S]*?)^\};/m);
  if (!m) return [`${GRID_JS}: no top-level const EFFECTS`];
  const keys = [...m[1].matchAll(/^  (\w+)\(/gm)].map((k) => k[1]).sort();
  return JSON.stringify(keys) === JSON.stringify(ids)
    ? [] : [`EFFECTS keys ${keys} differ from sky ids ${ids}`];
}

function gridIsLight() {
  if (!existsSync(join(root, GRID_JS))) return [`${GRID_JS} is missing`];
  const js = read(GRID_JS);
  const need = ["Math.min(2, window.devicePixelRatio", "< FRAME_MS", "const FRAME_MS = 33",
    "IntersectionObserver", "visibilitychange", "prefers-reduced-motion"];
  const errs = need.filter((n) => !js.includes(n)).map((n) => `${GRID_JS}: missing ${n}`);
  const loops = js.match(/requestAnimationFrame\(tick\)/g) || [];
  if (loops.length !== 1) errs.push(`${GRID_JS}: expected one requestAnimationFrame(tick)`);
  for (const h of HOMES) {
    const html = read(h);
    const a = html.indexOf('src="/assets/js/themes.js"');
    const b = html.indexOf('src="/assets/js/sky-grid.js" defer');
    if (a < 0 || b < a) errs.push(`${h}: must load themes.js then sky-grid.js (defer)`);
    if (!/<head>[\s\S]*classList\.add\("js"\)[\s\S]*<\/head>/.test(html))
      errs.push(`${h}: no inline script adding the js class in <head>`);
  }
  return errs;
}

const checks = [pagesExist, langAndPairs, linksResolve, nothingThirdParty, footerLinks,
  themesMatchApp, contrast, sectionsInOrder, sameStructure, comingSoon, noOldPicker,
  screenshots, previewTags, gridCoversEverySky, gridIsLight,
  privacyNamesEveryPermission, privacyBasics, noInternetClaimIsTrue, countsVisits,
  studioLinksApps];

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
