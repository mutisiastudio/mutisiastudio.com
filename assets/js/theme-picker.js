// Builds the hero's theme rows, paints the whole page, remembers the choice.
// Works without the rows too (privacy pages): it still applies the theme.
(function () {
  const T = window.THEMES;
  const DEFAULT = { kind: "skies", id: "aurora", mode: "light" };
  const KEY = "pomoluna-theme";
  const lang = document.documentElement.lang === "es" ? "es" : "en";
  const MODE_LABEL = { en: { light: "Light", dark: "Dark" }, es: { light: "Claro", dark: "Oscuro" } }[lang];
  const root = document.documentElement;
  // Lets the CSS hide the theme picker for visitors without JavaScript.
  root.classList.add("js");

  let current = Object.assign({}, DEFAULT);

  const find = (kind, id) => T[kind] && T[kind].find((t) => t.id === id);

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && find(s.kind, s.id) && (s.mode === "light" || s.mode === "dark")) return s;
    } catch (e) { /* no storage: use the default */ }
    return Object.assign({}, DEFAULT);
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* not saved, still works */ }
  }

  // Sets the page colors only. Runs once from <head>, before the first paint, so a saved
  // theme shows right away instead of fading in from Aurora's colors.
  function paint(kind, id, mode) {
    const t = find(kind, id);
    if (!t) return null;
    const m = mode === "dark" ? "dark" : "light";
    let top, mid, bot, ink;
    if (kind === "skies") {
      ({ top, mid, bot, ink } = t);
    } else {
      top = mid = bot = t[m].bg;
      ink = t[m].ink;
    }
    const s = root.style;
    s.setProperty("--top", top);
    s.setProperty("--mid", mid);
    s.setProperty("--bot", bot);
    s.setProperty("--ink", ink);
    s.setProperty("--veil", t.veil);
    return m;
  }

  function applyTheme(kind, id, mode, remember) {
    const m = paint(kind, id, mode);
    if (!m) return;
    current = { kind, id, mode: m };
    if (remember) save();
    markRows();
    document.dispatchEvent(new CustomEvent("themechange", { detail: window.currentTheme() }));
  }

  window.currentTheme = () => Object.assign({}, current);
  window.applyTheme = applyTheme;

  let skiesRow, plainsRow, modeBox, nameBox;

  function card(kind, t) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card " + (kind === "plains" ? "plain" : "sky");
    b.dataset.kind = kind;
    b.dataset.id = t.id;
    b.setAttribute("aria-label", t.name[lang]);
    b.setAttribute("aria-pressed", "false");
    b.title = t.name[lang];
    const clock = document.createElement("span");
    clock.textContent = "18:42";
    clock.setAttribute("aria-hidden", "true");
    b.appendChild(clock);
    if (kind === "plains") b.appendChild(document.createElement("i"));
    b.addEventListener("click", () => applyTheme(kind, t.id, current.mode, true));
    return b;
  }

  function paintCards() {
    document.querySelectorAll(".card.sky").forEach((b) => {
      const t = find("skies", b.dataset.id);
      b.style.background = `linear-gradient(${t.top}, ${t.mid}, ${t.bot})`;
      b.style.color = t.ink;
    });
    document.querySelectorAll(".card.plain").forEach((b) => {
      const t = find("plains", b.dataset.id)[current.mode];
      b.style.background = t.bg;
      b.style.color = t.ink;
    });
  }

  function markRows() {
    paintCards();
    document.querySelectorAll(".card").forEach((b) => {
      const on = b.dataset.kind === current.kind && b.dataset.id === current.id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll("#mode-toggle button").forEach((b) => {
      const on = b.dataset.mode === current.mode;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (nameBox) {
      const t = find(current.kind, current.id);
      nameBox.textContent = t.name[lang] +
        (current.kind === "plains" ? " · " + MODE_LABEL[current.mode] : "");
    }
  }

  const start = load();
  paint(start.kind, start.id, start.mode);
  current = Object.assign({}, start);

  function init() {
    skiesRow = document.getElementById("skies");
    plainsRow = document.getElementById("plains");
    modeBox = document.getElementById("mode-toggle");
    nameBox = document.getElementById("theme-name");
    if (skiesRow) T.skies.forEach((t) => skiesRow.appendChild(card("skies", t)));
    if (plainsRow) T.plains.forEach((t) => plainsRow.appendChild(card("plains", t)));
    if (modeBox) {
      ["light", "dark"].forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.mode = m;
        b.textContent = MODE_LABEL[m];
        b.addEventListener("click", () => applyTheme(current.kind, current.id, m, true));
        modeBox.appendChild(b);
      });
    }

    applyTheme(start.kind, start.id, start.mode, false);
    // Announce the name only on later choices, not on the first fill.
    if (nameBox) nameBox.setAttribute("aria-live", "polite");
    // Bring the chosen sky into view in the sideways row (without moving the page).
    const chosen = skiesRow && skiesRow.querySelector(".card.on");
    if (chosen) skiesRow.scrollLeft = chosen.offsetLeft - skiesRow.clientWidth / 2 + chosen.offsetWidth / 2;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
