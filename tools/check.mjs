// Site checks: each check returns a list of problems (empty = pass).
// Later tasks add a function and append it to `checks`.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

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
  for (const p of PAGES.filter((p) => existsSync(join(root, p.path)))) {
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

function nothingThirdParty() {
  const errs = [];
  const files = walk(root)
    .filter((f) => [".html", ".css", ".js", ".mjs"].includes(extname(f)))
    .filter((f) => !f.endsWith(join("tools", "check.mjs")));
  for (const f of files) {
    const rel = f.slice(root.length + 1);
    const text = stripComments(readFileSync(f, "utf8"))
      .replaceAll("http://www.w3.org/2000/svg", "");
    if (/https?:\/\//.test(text)) errs.push(`${rel}: contains an http(s):// URL`);
    for (const m of text.matchAll(/mailto:[^"'\s<>)]*/g))
      if (m[0] !== MAIL) errs.push(`${rel}: unexpected ${m[0]}`);
  }
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

const checks = [pagesExist, langAndPairs, linksResolve, nothingThirdParty, footerLinks];

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
