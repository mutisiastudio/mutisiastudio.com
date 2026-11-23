// Thin orange mutisia petals drifting down the studio's green band, like Pomoluna's Fall sky.
// Draws one still frame when the visitor asks for less motion.
const TAU = Math.PI * 2;
const COLORS = ["#F07A2B", "#E2661C", "#F59A55", "#FFB070"];
const COUNT = 16;

// A long thin petal, pointed at both ends, along the x axis from -1 to 1.
const petal = new Path2D();
petal.moveTo(-1, 0);
petal.quadraticCurveTo(0, -0.28, 1, 0);
petal.quadraticCurveTo(0, 0.28, -1, 0);

function startPetals() {
  const band = document.querySelector("[data-petals]");
  if (!band) return;
  const canvas = document.createElement("canvas");
  canvas.className = "petals";
  canvas.setAttribute("aria-hidden", "true");
  band.prepend(canvas);
  const c = canvas.getContext("2d");
  // Each petal keeps its own speed, size, sway and spin.
  const petals = Array.from({ length: COUNT }, (_, i) => ({
    x: Math.random(), start: Math.random(), speed: 0.035 + Math.random() * 0.04,
    size: 7 + Math.random() * 6, sway: TAU * Math.random(), spin: (Math.random() - 0.5) * 1.6,
    turn: Math.random() * TAU, color: COLORS[i % COLORS.length],
  }));
  let w = 0, h = 0, dpr = 1;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = band.clientWidth; h = band.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  function paint(t) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    for (const p of petals) {
      const travel = h + 40;
      const y = ((t * p.speed + p.start) % 1) * travel - 20;
      const x = p.x * w + Math.sin(t * 0.7 + p.sway) * 24;
      const flip = Math.abs(Math.cos(t * 1.2 + p.sway)) * 0.7 + 0.3;
      c.save();
      c.translate(x, y);
      c.rotate(p.turn + t * p.spin);
      c.scale(p.size, p.size * flip);
      c.globalAlpha = 0.85;
      c.fillStyle = p.color;
      c.fill(petal);
      c.restore();
    }
  }

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, visible = true;
  const t0 = performance.now() - 8000;
  function tick(now) {
    paint((now - t0) / 1000);
    frame = requestAnimationFrame(tick);
  }
  function update() {
    cancelAnimationFrame(frame);
    if (calm.matches) { paint(8); return; }
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
    timer = setTimeout(() => { size(); if (calm.matches) paint(8); }, 150);
  });
  size();
  update();
}

startPetals();
