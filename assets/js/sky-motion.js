// Moves the four skies that move in the app (mar, cerezo, fogata, aurora) on a canvas
// behind the page. A simpler copy of SkyAmbience.kt and SkyEffects*.kt, drawn as a
// full sky. 1 CSS pixel stands in for the app's 1 dp.
(function () {
  const canvas = document.getElementById("sky-motion");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const TAU = Math.PI * 2;

  // Wide washes of light, as the strongest stack of [color, alpha] each effect can reach.
  // tools/check.mjs tests text on top of them. Aurora is under half the app's strength and
  // the water rays a little under: text scrolls over them here, while in the app they sit
  // in free sky around the clock.
  const WASH = {
    mar: [["#FFFFFF", 0.12]],
    cerezo: [],
    fogata: [["#FF6E23", 0.225], ["#FFBE5A", 0.102]],
    aurora: [["#50E6AA", 0.16], ["#5AC8E6", 0.16], ["#AA78E6", 0.16]],
  };

  // Same numbers as SkyMath.kt's hash01, so seeds match the app.
  function hash01(a, b) {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h & 0x7fffffff) / 2147483647;
  }
  const frac = (v) => v - Math.floor(v);

  let W = 0, H = 0, dpr = 1;
  const base = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // A round light fading to nothing at its edge (softDot in SkyAmbience.kt). One gradient
  // per color, scaled when drawn, so frames make no garbage.
  const dots = {};
  function softDot(x, y, r, color, alpha) {
    if (r <= 0 || alpha <= 0) return;
    let g = dots[color];
    if (!g) {
      g = dots[color] = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, color);
      g.addColorStop(1, color + "00");
    }
    ctx.setTransform(dpr * r, 0, 0, dpr * r, dpr * x, dpr * y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
  }

  // --- mar: light rays from the surface and rising bubbles (SkyAmbience.kt, WATER) ---
  const RAY_TOPS = [0.12, 0.36, 0.6, 0.86];
  let rays = null;
  function shapeRays() {
    const length = H * 0.75, slant = length * 0.27, half = 40;
    const norm = Math.hypot(length, slant);
    const ax = length / norm, ay = slant / norm, reach = half * 1.1;
    const list = RAY_TOPS.map((at) => {
      const top = W * at;
      const path = new Path2D();
      path.moveTo(top - half, 0);
      path.lineTo(top + half, 0);
      path.lineTo(top + half * 1.6 - slant, length);
      path.lineTo(top - half * 1.6 - slant, length);
      path.closePath();
      const mx = top - slant / 2, my = length / 2;
      const g = ctx.createLinearGradient(mx - ax * reach, my - ay * reach, mx + ax * reach, my + ay * reach);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${WASH.mar[0][1]})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      return { path, g };
    });
    const fade = ctx.createLinearGradient(0, 0, 0, length);
    fade.addColorStop(0, "#fff");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    rays = { w: W, h: H, list, fade };
  }

  function drawMar(t) {
    if (!rays || rays.w !== W || rays.h !== H) shapeRays();
    rays.list.forEach((r, i) => {
      const sway = Math.sin((t / 8 + i * 0.23) * TAU) * 8;
      ctx.setTransform(dpr, 0, 0, dpr, dpr * sway, 0);
      ctx.fillStyle = r.g;
      ctx.fill(r.path);
    });
    // Rays are all that is drawn so far, so fading the canvas fades only them.
    base();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = rays.fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 0.8;
    const travel = H + 8;
    for (let i = 0; i < 18; i++) {
      const speed = 8 + 10 * hash01(i, 1);
      const y = H + 4 - frac(t * speed / travel + hash01(i, 2)) * travel;
      const x = W * hash01(i, 3) + Math.sin(t * 1.2 + hash01(i, 5) * TAU) * 4;
      ctx.beginPath();
      ctx.arc(x, y, 1 + 1.6 * hash01(i, 4), 0, TAU);
      ctx.stroke();
    }
  }

  // --- cerezo: petals drifting down and turning over (drawPetals, SkyEffectsFalling.kt) ---
  const petal = new Path2D();
  petal.moveTo(0, 1);
  petal.bezierCurveTo(1.2, 0.2, 0.6, -1, 0, -0.55);
  petal.bezierCurveTo(-0.6, -1, -1.2, 0.2, 0, 1);
  petal.closePath();

  function drawCerezo(t) {
    ctx.fillStyle = "rgba(238,143,171,0.85)";
    const travel = H + 20;
    for (let i = 0; i < 18; i++) {
      const s = 4.5 + 2.5 * hash01(i, 121);
      const k = frac(t * (14 + 12 * hash01(i, 122)) / travel + hash01(i, 123));
      const y = k * travel - 10;
      const p = hash01(i, 124) * TAU;
      const x = W * (hash01(i, 125) * 1.1 - 0.1) + k * 40 + Math.sin(t * 0.9 + p) * 14;
      const turn = (hash01(i, 126) * 360 + (hash01(i, 127) - 0.5) * 200 * t) * Math.PI / 180;
      const flip = Math.cos(t * 1.6 + p) * 0.5 + 0.6;
      base();
      ctx.translate(x, y);
      ctx.rotate(turn);
      ctx.scale(s * flip, s);
      ctx.fill(petal);
    }
  }

  // --- fogata: a glow at the bottom and sparks rising (drawEmbers, SkyEffectsLights.kt) ---
  // The app has 46; fewer keep phones light.
  const EMBERS = 30;
  const FIRE = ["#FFF6BE", "#FFD65A", "#FF9628", "#F04619", "#BE160E"];
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const emberColors = Array.from({ length: EMBERS }, (_, i) => {
    const x = hash01(i, 70) * (FIRE.length - 1);
    const k = Math.min(FIRE.length - 2, Math.floor(x));
    const a = hex(FIRE[k]), b = hex(FIRE[k + 1]);
    return "#" + a.map((v, j) => Math.round(v + (b[j] - v) * (x - k))
      .toString(16).padStart(2, "0")).join("");
  });

  function drawFogata(t) {
    const flicker = 0.16 + 0.03 * Math.sin(t * 3) + 0.02 * Math.sin(t * 7.3) + 0.015 * Math.sin(t * 13.1);
    softDot(W / 2, H + 40, H * 0.5, "#FF6E23", flicker);
    softDot(W / 2, H + 10, H * 0.22, "#FFBE5A", flicker * 0.45);
    for (let i = 0; i < EMBERS; i++) {
      const quick = Math.pow(hash01(i, 66), 2.2);
      const travel = H * (0.45 + 0.45 * hash01(i, 67) + 0.15 * quick);
      const life = 1 - frac(t * (14 + 95 * quick) / travel + hash01(i, 62));
      const y = H + 6 - (1 - life) * travel;
      const sway = Math.sin(t * (1.2 + 2.5 * hash01(i, 68)) + hash01(i, 64) * TAU) * (6 + 10 * hash01(i, 69));
      const x = W * (0.18 + 0.64 * hash01(i, 63)) + sway * (1 - life);
      const r = (1 - quick) * 1.6 + 0.7 + 0.6 * hash01(i, 65);
      const twinkle = 0.75 + 0.25 * Math.sin(t * (6 + 9 * hash01(i, 71)) + i);
      const alpha = Math.min(1, life * 1.4) * twinkle;
      if (r > 1.6) softDot(x, y, r * 4, emberColors[i], 0.28 * alpha);
      base();
      ctx.globalAlpha = 0.95 * alpha;
      ctx.fillStyle = emberColors[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- aurora: stars and three curtains of light (drawAurora, SkyEffectsLights.kt) ---
  const BANDS = WASH.aurora;
  const EDGES = [0.7, 0.76, 0.66];
  const EDGE = 0.68;
  let fades = null;

  function drawAurora(t) {
    base();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.2 + 0.5 * hash01(i, 13);
      ctx.beginPath();
      ctx.arc(W * hash01(i, 11), H * 0.6 * hash01(i, 12), 0.7, 0, TAU);
      ctx.fill();
    }
    if (!fades) {
      fades = BANDS.map(([c]) => {
        const g = ctx.createLinearGradient(0, 0, 0, 1);
        g.addColorStop(0, c + "00");
        g.addColorStop(EDGE, c);
        g.addColorStop(1, c + "00");
        return g;
      });
    }
    // Narrow strips, each slanted to meet the next at its bright lower edge.
    const step = 4;
    BANDS.forEach(([, strength], band) => {
      const phase = band * 1.7;
      const slow = 0.008 + 0.006 * hash01(band, 14);
      const mid = 0.019 + 0.012 * hash01(band, 15);
      const fast = 0.043 + 0.02 * hash01(band, 16);
      const edgeAt = H * EDGES[band];
      const edge = (x) => edgeAt + Math.sin(x * slow + t * 0.11 + phase) * 34 +
        Math.sin(x * mid - t * 0.23 + phase * 2) * 16 + Math.sin(x * fast + t * 0.37) * 6;
      ctx.fillStyle = fades[band];
      let x = -step, y = edge(x);
      while (x < W + step) {
        const next = edge(x + step);
        const length = 190 + Math.sin(x * 0.007 + t * 0.13 + phase) * 70 + Math.sin(x * 0.017 - t * 0.2) * 25;
        const glow = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.011 - t * 0.19 + phase * 3));
        ctx.setTransform(dpr * step, dpr * (next - y), 0, dpr * length, dpr * x, dpr * (y - EDGE * length));
        ctx.globalAlpha = strength * glow;
        ctx.fillRect(0, 0, 1, 1);
        x += step;
        y = next;
      }
    });
    ctx.globalAlpha = 1;
  }

  const EFFECTS = { mar: drawMar, cerezo: drawCerezo, fogata: drawFogata, aurora: drawAurora };

  // --- when to draw ---
  // Light on a phone's battery: at most ~30 frames a second, a canvas no sharper than 2x,
  // and no canvas memory at all while nothing moves.
  const FRAME_MS = 33;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let draw = null, frame = 0, last = 0, lastDrawn = 0, t = 0, timer = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    // Time only runs while drawn, so the sky picks up where it stopped (as in the app).
    t += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (now - lastDrawn < FRAME_MS) return;
    lastDrawn = now;
    clear();
    ctx.globalAlpha = 1;
    draw(t);
  }

  function update() {
    const th = window.currentTheme ? window.currentTheme() : null;
    const effect = th && th.kind === "skies" ? EFFECTS[th.id] : null;
    const run = effect && !calm.matches && !document.hidden;
    cancelAnimationFrame(frame);
    frame = 0;
    if (effect !== draw) t = 0;
    draw = effect;
    if (!run) {
      canvas.width = canvas.height = 0;
      return;
    }
    resize();
    last = lastDrawn = performance.now();
    frame = requestAnimationFrame(tick);
  }

  document.addEventListener("themechange", update);
  document.addEventListener("visibilitychange", update);
  calm.addEventListener("change", update);
  // Only a change of width resizes the canvas (and only after a pause), so the Android
  // address bar sliding in and out does not reallocate it or blank a frame.
  let seenW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === seenW) return;
    seenW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(() => { if (frame) resize(); }, 150);
  });
  update();
})();
