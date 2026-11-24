// Pomoluna's dawn band: the last stars fading near the top, and golden sparks rising slowly
// on both sides of the name.
// Draws one still frame when the visitor asks for less motion.
// Wrapped in a block: sky-grid.js on the same page also declares TAU.
{
const TAU = Math.PI * 2;

function startSky() {
  const band = document.querySelector("[data-sky]");
  if (!band) return;
  const canvas = document.createElement("canvas");
  canvas.className = "petals";
  canvas.setAttribute("aria-hidden", "true");
  band.prepend(canvas);
  const c = canvas.getContext("2d");
  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random(), y: Math.random() * 0.8, r: 0.6 + Math.random() * 1.2,
    speed: 0.6 + Math.random() * 1.4, phase: TAU * Math.random(),
  }));
  // A few bigger stars with a soft four-point sparkle.
  const bright = Array.from({ length: 7 }, () => ({
    x: 0.04 + Math.random() * 0.92, y: 0.05 + Math.random() * 0.35,
    r: 5 + Math.random() * 4, speed: 0.5 + Math.random() * 0.7, phase: TAU * Math.random(),
  }));
  // Fireflies stay on both sides of the logo, so they never cross the app's name.
  const flies = Array.from({ length: 10 }, (_, i) => ({
    side: i % 2 ? 1 : -1, u: Math.random(), start: Math.random(),
    phase: TAU * Math.random(), drift: 0.4 + Math.random() * 0.6,
  }));
  const logo = band.querySelector(".app-logo");
  let w = 0, h = 0, dpr = 1, clear = 0, hole = null;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = band.clientWidth; h = band.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    clear = logo ? logo.getBoundingClientRect().width / 2 + 40 : 0;
    // The area around the name and "by Mutisia Studio", kept free of stars.
    const parts = [logo, band.querySelector(".by")].filter(Boolean)
      .map((el) => el.getBoundingClientRect());
    const top = band.getBoundingClientRect();
    hole = parts.length && {
      l: Math.min(...parts.map((r) => r.left)) - top.left - 12,
      r: Math.max(...parts.map((r) => r.right)) - top.left + 12,
      t: Math.min(...parts.map((r) => r.top)) - top.top - 10,
      b: Math.max(...parts.map((r) => r.bottom)) - top.top + 10,
    };
  }
  const inHole = (x, y) => hole && x > hole.l && x < hole.r && y > hole.t && y < hole.b;
  function paint(t) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#FFF6DA";
    for (const s of stars) {
      if (inHole(s.x * w, s.y * h)) continue;
      const fade = Math.max(0, 1 - s.y / 0.65);
      c.globalAlpha = fade * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)));
      c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, TAU); c.fill();
    }
    for (const b of bright) {
      const x = b.x * w, y = b.y * h;
      if (inHole(x, y)) continue;
      const k = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * b.speed + b.phase));
      const r = b.r * k;
      const fade = Math.max(0, 1 - b.y / 0.65);
      c.globalAlpha = 0.9 * k * fade;
      c.beginPath();
      c.moveTo(x, y - r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.quadraticCurveTo(x, y, x, y + r);
      c.quadraticCurveTo(x, y, x - r, y);
      c.quadraticCurveTo(x, y, x, y - r);
      c.fill();
      c.globalAlpha = 0.25 * k * fade;
      c.beginPath(); c.arc(x, y, r * 0.7, 0, TAU); c.fill();
    }
    for (const f of flies) {
      const room = Math.max(0, w / 2 - clear - 12);
      const sway = Math.min(30, room / 2);
      const x = w / 2 + f.side * (clear + sway + f.u * Math.max(0, room - 2 * sway)
        + Math.sin(t * 0.15 * f.drift + f.phase) * sway);
      // Each spark rises from the hills to the middle of the sky, then starts again.
      const life = (f.start + t * 0.04 * f.drift) % 1;
      const y = h * (0.85 - 0.55 * life);
      const glow = Math.sin(Math.PI * life) * (0.55 + 0.3 * Math.sin(t * 1.3 + f.phase));
      const g = c.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, `rgba(255, 214, 140, ${glow})`);
      g.addColorStop(1, "rgba(255, 214, 140, 0)");
      c.globalAlpha = 1; c.fillStyle = g;
      c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
      c.fillStyle = "#FFF6DA";
    }
  }

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, visible = true;
  const t0 = performance.now();
  function tick(now) {
    paint((now - t0) / 1000);
    frame = requestAnimationFrame(tick);
  }
  function update() {
    cancelAnimationFrame(frame);
    if (calm.matches) { paint(4); return; }
    if (document.hidden || !visible) return;
    frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(band);
  document.addEventListener("visibilitychange", update);
  calm.addEventListener("change", update);
  let lastW = window.innerWidth, timer = 0;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(() => { size(); if (calm.matches) paint(4); }, 150);
  });
  size();
  update();
}

startSky();
}
