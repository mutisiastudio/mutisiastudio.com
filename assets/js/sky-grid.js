// A grid of small squares, each moving like its sky in the app. Simplified from
// SkyAmbience.kt and SkyEffects*.kt, with fewer things per square.
// Needs window.THEMES (themes.js) and the #sky-grid and #plain-grid containers.
const TAU = Math.PI * 2;

function hash01(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0x7fffffff) / 2147483647;
}
const frac = (v) => v - Math.floor(v);
const rgba = (hex, a) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
};

// Every effect draws in a square of side S with unit u (1 app dp, scaled down).
function softDot(c, x, y, r, hex, a, solidTo = 0) {
  if (r <= 0 || a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a));
  if (solidTo) g.addColorStop(solidTo, rgba(hex, a));
  g.addColorStop(1, rgba(hex, 0));
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function dot(c, x, y, r, style) {
  c.fillStyle = style; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

const petal = new Path2D();
petal.moveTo(0, 1);
petal.bezierCurveTo(1.2, 0.2, 0.6, -1, 0, -0.55);
petal.bezierCurveTo(-0.6, -1, -1.2, 0.2, 0, 1);
const leaf = new Path2D();
leaf.moveTo(-1, 0);
leaf.quadraticCurveTo(0, -0.75, 1, 0);
leaf.quadraticCurveTo(0, 0.75, -1, 0);


const EFFECTS = {
  mar(c, t, S, u) {
    for (let i = 0; i < 3; i++) {
      const top = S * (0.15 + 0.35 * i) + Math.sin((t / 8 + i * 0.23) * TAU) * 4 * u;
      const g = c.createLinearGradient(0, 0, 0, S * 0.8);
      g.addColorStop(0, "rgba(255,255,255,0.14)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(top - 12 * u, 0); c.lineTo(top + 12 * u, 0);
      c.lineTo(top + 6 * u, S * 0.8); c.lineTo(top - 30 * u, S * 0.8);
      c.fill();
    }
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) {
      const travel = S + 8;
      const y = S + 4 - frac(t * (8 + 10 * hash01(i, 1)) * u / travel + hash01(i, 2)) * travel;
      const x = S * hash01(i, 3) + Math.sin(t * 1.2 + hash01(i, 5) * TAU) * 3 * u;
      c.beginPath(); c.arc(x, y, (1 + 1.6 * hash01(i, 4)) * u, 0, TAU); c.stroke();
    }
  },
  atardecer(c, t, S, u) {
    for (let k = 0; k < 2; k++) {
      const w = (70 + 30 * k) * u, travel = S + w * 2;
      const x = frac(t / (40 + 15 * k) + k * 0.5) * travel - w;
      const y = S * (0.25 + 0.3 * k);
      c.save(); c.translate(0, y); c.scale(1, 0.42);
      softDot(c, x, 0, w * 0.5, "#FFFFFF", 0.55);
      softDot(c, x - w * 0.28, 0.1 * w, w * 0.34, "#FFFFFF", 0.5);
      c.restore();
    }
    for (let i = 0; i < 7; i++) {
      const loop = frac(t / 8 + hash01(i, 6));
      const a = (loop < 0.25 ? loop / 0.25 : loop > 0.75 ? (1 - loop) / 0.25 : 1) * 0.9;
      const x = S * hash01(i, 7) + Math.sin(loop * TAU) * 6 * u;
      const y = S * (0.6 + 0.35 * hash01(i, 8)) - loop * 50 * u;
      dot(c, x, y, 4 * u, rgba("#F2C98A", a * 0.35));
      dot(c, x, y, 1.6 * u, rgba("#E8B860", a));
    }
  },
  aurora(c, t, S, u) {
    for (let i = 0; i < 12; i++) {
      dot(c, S * hash01(i, 11), S * 0.5 * hash01(i, 12), 0.6, `rgba(255,255,255,${0.2 + 0.5 * hash01(i, 13)})`);
    }
    const bands = ["#50E6AA", "#5AC8E6", "#AA78E6"];
    const step = 3;
    bands.forEach((col, b) => {
      const ph = b * 1.7, base = S * [0.7, 0.76, 0.66][b];
      const edge = (x) => base + Math.sin(x / u * 0.02 + t * 0.11 + ph) * 14 * u +
        Math.sin(x / u * 0.05 - t * 0.23 + ph * 2) * 6 * u;
      for (let x = 0; x < S; x += step) {
        const y = edge(x);
        const len = (90 + Math.sin(x / u * 0.02 + t * 0.13 + ph) * 30) * u;
        const glow = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x / u * 0.03 - t * 0.19 + ph * 3));
        const g = c.createLinearGradient(0, y - len * 0.68, 0, y + len * 0.32);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.68, rgba(col, 0.3 * glow));
        g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.fillRect(x, y - len * 0.68, step + 0.5, len);
      }
    });
  },
  luciernagas(c, t, S, u) {
    for (let i = 0; i < 7; i++) {
      const p = hash01(i, 21) * TAU;
      const x = S * (0.1 + 0.8 * hash01(i, 22)) + Math.sin(t * (0.2 + 0.2 * hash01(i, 23)) + p) * 16 * u;
      const y = S * (0.2 + 0.65 * hash01(i, 24)) + Math.cos(t * (0.15 + 0.2 * hash01(i, 25)) + p) * 12 * u;
      const glow = Math.max(0, Math.sin(t * (0.5 + 0.7 * hash01(i, 26)) + p));
      if (glow < 0.01) continue;
      softDot(c, x, y, 10 * u, "#BEF06E", 0.35 * glow);
      dot(c, x, y, 1.4 * u, rgba("#E6FF96", 0.9 * glow));
    }
  },
  lluvia(c, t, S, u) {
    const ground = S;
    c.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const speed = (110 + 50 * hash01(i, 71)) * u, len = (6 + 4 * hash01(i, 72)) * u;
      const fall = ground + len, cycle = t * speed / fall + hash01(i, 73);
      const y = frac(cycle) * fall - len, x0 = S * 1.1 * hash01(i, 74), x = x0 - y * 0.12;
      c.strokeStyle = `rgba(255,255,255,${0.15 + 0.2 * hash01(i, 75)})`;
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len * 0.12, y - len); c.stroke();
      const lap = Math.floor(cycle);
      if (hash01(i * 31 + lap, 76) < 0.55) {
        const age = frac(cycle) * fall / speed;
        const cx = x0 - ground * 0.12, cy = ground - (5 + 40 * hash01(i * 31 + lap, 77)) * u;
        for (let k = 0; k < 2; k++) {
          const r = 20 * u * age - k * 6 * u;
          if (r <= 0) continue;
          const a = 0.45 * (1 - r / (20 * u));
          if (a <= 0) continue;
          c.strokeStyle = `rgba(255,255,255,${a})`;
          c.beginPath(); c.ellipse(cx, cy, r, r * 0.3, 0, 0, TAU); c.stroke();
        }
      }
    }
  },
  nieve(c, t, S, u) {
    for (let i = 0; i < 22; i++) {
      const r = (0.8 + 1.8 * hash01(i, 81)) * 1.2 * u, travel = S + 8;
      const y = frac(t * (8 + 12 * hash01(i, 82)) * (r / u / 1.6) * u / travel + hash01(i, 83)) * travel - 4;
      const x = S * hash01(i, 84) + Math.sin(t * 0.6 + hash01(i, 85) * TAU) * 6 * u;
      dot(c, x, y + 0.4, r + 0.9 * u, "rgba(60,85,130,0.32)");
      dot(c, x, y, r, `rgba(255,255,255,${Math.min(1, 0.6 + r / u * 0.18)})`);
    }
    const r = 8 * u, travel = S + 4 * r;
    const y = frac(t * 30 * u / travel) * travel - 2 * r;
    softDot(c, S * 0.7 + Math.sin(t * 0.8) * 10 * u, y, r, "#FFFFFF", 0.75);
  },
  constelacion(c, t, S, u, still) {
    for (let i = 0; i < 26; i++) {
      const tw = 0.6 + 0.4 * Math.sin(t + hash01(i, 31) * TAU);
      dot(c, S * hash01(i, 33), S * hash01(i, 34), 0.6, `rgba(255,255,255,${(0.15 + 0.35 * hash01(i, 32)) * tw})`);
    }
    const stars = [[0.18, 0.62, 0.6], [0.36, 0.5, 0.9], [0.55, 0.56, 0.5], [0.7, 0.4, 0.8], [0.84, 0.48, 0.4]];
    const at = (i) => [S * stars[i][0], S * stars[i][1]];
    // The figure draws itself, waits, and fades, over and over. Still, it is drawn complete.
    const loop = still ? 0.6 : frac(t / 14), lit = Math.min(1, loop * 2) * 4;
    const fade = loop > 0.85 ? (1 - loop) / 0.15 : 1;
    c.setLineDash([1.5 * u, 3 * u]);
    c.lineWidth = 0.9;
    c.strokeStyle = `rgba(220,230,255,${0.5 * fade})`;
    for (let i = 0; i < 4; i++) {
      const k = Math.max(0, Math.min(1, lit - i));
      if (!k) continue;
      const [ax, ay] = at(i), [bx, by] = at(i + 1);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); c.stroke();
    }
    c.setLineDash([]);
    stars.forEach((s, i) => {
      const k = Math.max(0, Math.min(1, (lit - i + 1) * 4)) * fade;
      if (!k) return;
      const [x, y] = at(i);
      softDot(c, x, y, (5 + 6 * s[2]) * u, "#C8DCFF", 0.35 * k);
      dot(c, x, y, (0.7 + 1.3 * s[2]) * u, `rgba(255,255,255,${k})`);
    });
  },
  lava(c, t, S) {
    ["#EC6EAA", "#FFA06E", "#8C6EFF", "#6EBEFF"].forEach((col, i) => {
      const p = i * 1.7;
      const x = S / 2 + Math.sin(t * (0.05 + 0.06 * hash01(i, 51)) * TAU * 0.6 + p) * S * 0.35;
      const y = S / 2 + Math.cos(t * (0.04 + 0.05 * hash01(i, 52)) * TAU * 0.6 + p * 1.3) * S * 0.32;
      softDot(c, x, y, S * (0.45 + 0.15 * hash01(i, 53)), col, 0.5);
    });
  },
  otono(c, t, S, u) {
    const cols = ["#E07A35", "#C94A2C", "#F0B44A", "#B8662E"];
    for (let i = 0; i < 5; i++) {
      const s = (5 + 2.5 * hash01(i, 111)) * u, travel = S + 24 * u;
      const y = frac(t * (14 + 10 * hash01(i, 112)) * u / travel + hash01(i, 113)) * travel - 12 * u;
      const p = hash01(i, 114) * TAU;
      const x = S * hash01(i, 115) + Math.sin(t * 0.8 + p) * 10 * u;
      const turn = (hash01(i, 116) * 360 + (hash01(i, 117) - 0.5) * 160 * t) * Math.PI / 180;
      const flip = Math.abs(Math.cos(t * 1.3 + p)) * 0.6 + 0.4;
      c.save(); c.translate(x, y); c.rotate(turn); c.scale(s, s * flip);
      c.fillStyle = rgba(cols[i % 4], 0.8); c.fill(leaf);
      c.restore();
    }
  },
  cerezo(c, t, S, u) {
    c.fillStyle = "rgba(238,143,171,0.85)";
    for (let i = 0; i < 8; i++) {
      const s = (3.5 + 2 * hash01(i, 121)) * u, travel = S + 20 * u;
      const k = frac(t * (12 + 10 * hash01(i, 122)) * u / travel + hash01(i, 123));
      const p = hash01(i, 124) * TAU;
      const x = S * (hash01(i, 125) * 1.1 - 0.1) + k * 25 * u + Math.sin(t * 0.9 + p) * 8 * u;
      const turn = (hash01(i, 126) * 360 + (hash01(i, 127) - 0.5) * 200 * t) * Math.PI / 180;
      c.save(); c.translate(x, k * travel - 10 * u); c.rotate(turn);
      c.scale(s * (Math.cos(t * 1.6 + p) * 0.5 + 0.6), s); c.fill(petal);
      c.restore();
    }
  },
  fogata(c, t, S, u) {
    const fire = ["#FFF6BE", "#FFD65A", "#FF9628", "#F04619", "#BE160E"];
    const f = 0.2 + 0.04 * Math.sin(t * 3) + 0.03 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1);
    softDot(c, S / 2, S + 20 * u, S * 0.6, "#FF6E23", f);
    softDot(c, S / 2, S + 5 * u, S * 0.3, "#FFBE5A", f * 0.5);
    for (let i = 0; i < 16; i++) {
      const quick = Math.pow(hash01(i, 66), 2.2);
      const travel = S * (0.45 + 0.45 * hash01(i, 67) + 0.15 * quick);
      const life = 1 - frac(t * (10 + 60 * quick) * u / travel + hash01(i, 62));
      const sway = Math.sin(t * (1.2 + 2.5 * hash01(i, 68)) + hash01(i, 64) * TAU) * (4 + 6 * hash01(i, 69)) * u;
      const x = S * (0.2 + 0.6 * hash01(i, 63)) + sway * (1 - life);
      const y = S + 4 - (1 - life) * travel;
      const r = ((1 - quick) * 1.3 + 0.6 + 0.5 * hash01(i, 65)) * u;
      const a = Math.min(1, life * 1.4) * (0.75 + 0.25 * Math.sin(t * (6 + 9 * hash01(i, 71)) + i));
      const col = fire[Math.min(4, Math.floor(hash01(i, 70) * 5))];
      softDot(c, x, y, r * 4, col, 0.25 * a);
      dot(c, x, y, r, rgba(col, 0.95 * a));
    }
  },
  dunas(c, t, S, u) {
    [[0.62, 8, 1, "rgba(255,235,200,0.25)"], [0.76, 6, 3, "rgba(190,120,60,0.18)"]].forEach(([h, w, p, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0, S);
      for (let x = 0; x <= S + 4; x += 4) {
        c.lineTo(x, S * h + (Math.sin(x / u * 0.03 + p) * w + Math.sin(x / u * 0.07 + p * 2) * w * 0.3) * u);
      }
      c.lineTo(S, S); c.fill();
    });
    for (let i = 0; i < 24; i++) {
      const x = frac(t * (20 + 30 * hash01(i, 131)) * u / S + hash01(i, 132)) * S;
      const y = S * (0.35 + 0.65 * hash01(i, 133)) + Math.sin(t * 3 + i) * 2 * u;
      const side = (1.3 + 0.9 * hash01(i, 135)) * u;
      c.fillStyle = `rgba(140,90,40,${0.2 + 0.3 * hash01(i, 134)})`;
      c.fillRect(x, y, side, side);
    }
  },
  acuarela(c, t, S, u) {
    const cols = ["#E88C78", "#F0BE5A", "#78AAA0", "#AA8CC8"];
    const every = 2.2, life = 12, newest = Math.floor(t / every);
    for (let slot = newest - life / every; slot <= newest; slot++) {
      const s = Math.floor(slot), age = (t - s * every) / life;
      if (age < 0 || age > 1) continue;
      const col = cols[Math.min(3, Math.floor(hash01(s, 152) * 4))];
      const x = S * (0.1 + 0.8 * hash01(s, 153)), y = S * (0.1 + 0.8 * hash01(s, 154));
      const r = (22 + 16 * hash01(s, 155)) * u * Math.sqrt(Math.min(1, age * 2.5));
      const a = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.4;
      softDot(c, x, y, r, col, 0.22 * a, 0.85);
      c.strokeStyle = rgba(col, 0.2 * a); c.lineWidth = 1.5 * u;
      c.beginPath(); c.arc(x, y, r * 0.92, 0, TAU); c.stroke();
    }
  },
  farolitos(c, t, S, u) {
    for (let i = 0; i < 5; i++) {
      const s = 0.6 + 0.7 * i / 4, travel = S + 40 * u;
      const y = S + 20 * u - frac(t * 7 * s * u / travel + hash01(i, 101)) * travel;
      const x = S * (0.1 + 0.8 * hash01(i, 102)) + Math.sin(t * 0.4 + hash01(i, 103) * TAU) * 6 * u;
      const w = 7 * s * u, h = 9.5 * s * u;
      const fl = 0.85 + 0.15 * Math.sin(t * 4 + hash01(i, 104) * TAU);
      softDot(c, x, y, h * 2.2, "#FFAA50", 0.35 * fl * s);
      c.fillStyle = `rgba(255,${Math.round(150 + 40 * fl)},90,${0.55 + 0.3 * s / 1.3})`;
      c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, w * 0.45); c.fill();
    }
  },
  dorado(c, t, S, u) {
    c.fillStyle = "rgba(230,195,120,0.4)";
    for (let i = 0; i < 14; i++) {
      const y = S - frac(t * (2 + 4 * hash01(i, 91)) * u / S + hash01(i, 92)) * S;
      c.fillRect(S * hash01(i, 93), y, u, u);
    }
    for (let i = 0; i < 12; i++) {
      const fl = Math.pow(Math.max(0, Math.sin(t * (0.4 + 0.6 * hash01(i, 94)) + hash01(i, 95) * TAU)), 6);
      if (fl < 0.02) continue;
      const x = S * hash01(i, 96), y = S * hash01(i, 97);
      const r = (2 + 2.5 * hash01(i, 98)) * u * (0.6 + 0.4 * fl);
      c.strokeStyle = rgba("#F5D78C", fl); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
      dot(c, x, y, 0.9 * u, rgba("#FFF0C8", fl));
    }
  },
  girasol(c, t, S, u) {
    for (let i = 0; i < 12; i++) {
      const p = hash01(i, 161) * TAU;
      const y = S - frac(t * (4 + 6 * hash01(i, 162)) * u / S + hash01(i, 163)) * S;
      const x = S * hash01(i, 164) + Math.sin(t * 0.5 + p) * 5 * u;
      dot(c, x, y, (0.8 + 1.2 * hash01(i, 165)) * u, rgba("#DCA01E", 0.35 + 0.25 * Math.sin(t + p)));
    }
    const bx = S / 2 + Math.sin(t * 0.23) * S * 0.3 + Math.sin(t * 0.61) * 8 * u;
    const by = S * 0.5 + Math.sin(t * 0.31) * S * 0.18 + Math.sin(t * 1.7) * 4 * u;
    const flap = Math.abs(Math.sin(t * 9)) * 0.7 + 0.3;
    c.save(); c.translate(bx, by); c.rotate(Math.sin(t * 0.4) * 0.3); c.scale(u * 0.8, u * 0.8);
    c.fillStyle = "rgba(225,115,50,0.85)";
    for (const side of [-1, 1]) {
      c.save(); c.scale(side * flap, 1);
      c.beginPath(); c.ellipse(5, -3, 6, 4.5, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(4, 4, 4, 3.2, 0, 0, TAU); c.fill();
      c.restore();
    }
    c.fillStyle = "rgba(70,40,20,0.8)"; c.fillRect(-0.7, -5, 1.4, 10);
    c.restore();
  },
};

const FRAME_MS = 33;
const LANG = document.documentElement.lang === "es" ? "es" : "en";
const STILL_T = 4;

function buildSkySquares(grid) {
  return window.THEMES.skies.map((sky) => {
    const fig = document.createElement("figure");
    fig.className = "sq";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.background = `linear-gradient(${sky.top}, ${sky.mid}, ${sky.bot})`;
    const cap = document.createElement("figcaption");
    cap.textContent = sky.name[LANG];
    fig.append(canvas, cap);
    grid.appendChild(fig);
    return { canvas, ctx: canvas.getContext("2d"), fx: EFFECTS[sky.id], seen: false, S: 0, dpr: 1 };
  });
}

// Each plain shows its light and dark side by side.
function buildPlainSwatches(grid) {
  window.THEMES.plains.forEach((p) => {
    const fig = document.createElement("figure");
    fig.className = "sq";
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.setAttribute("aria-hidden", "true");
    [p.light.bg, p.dark.bg].forEach((bg) => {
      const half = document.createElement("i");
      half.style.background = bg;
      sw.appendChild(half);
    });
    const cap = document.createElement("figcaption");
    cap.textContent = p.name[LANG];
    fig.append(sw, cap);
    grid.appendChild(fig);
  });
}

function startSkyGrid() {
  const skyGrid = document.getElementById("sky-grid");
  const plainGrid = document.getElementById("plain-grid");
  if (!window.THEMES || !skyGrid || !plainGrid) return;
  buildPlainSwatches(plainGrid);
  if (!window.IntersectionObserver || !window.CanvasRenderingContext2D) return;
  const tiles = buildSkySquares(skyGrid);

  function size(tile) {
    tile.dpr = Math.min(2, window.devicePixelRatio || 1);
    tile.S = tile.canvas.clientWidth;
    tile.canvas.width = tile.canvas.height = Math.round(tile.S * tile.dpr);
  }
  function paint(tile, t, still) {
    const c = tile.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
    c.setTransform(tile.dpr, 0, 0, tile.dpr, 0, 0);
    c.globalAlpha = 1;
    // 1 app dp is drawn as a little under a CSS pixel, so a square looks like a small screen.
    tile.fx(c, t, tile.S, tile.S / 150, still);
  }

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, last = 0, lastDrawn = 0, t = STILL_T;
  const paintSeen = () => tiles.forEach((tile) => { if (tile.seen) paint(tile, t, calm.matches); });

  // One clock for every square; only squares on screen are drawn.
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => { tiles.find((x) => x.canvas === e.target).seen = e.isIntersecting; });
    if (calm.matches) paintSeen();
  });
  tiles.forEach((tile) => { size(tile); seen.observe(tile.canvas); });

  function tick(now) {
    frame = requestAnimationFrame(tick);
    t += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (now - lastDrawn < FRAME_MS) return;
    lastDrawn = now;
    paintSeen();
  }
  function update() {
    cancelAnimationFrame(frame);
    if (calm.matches) { t = STILL_T; paintSeen(); return; }
    if (document.hidden) return;
    last = lastDrawn = performance.now();
    tick(last);
  }
  document.addEventListener("visibilitychange", update);
  calm.addEventListener("change", update);
  // Width only: phone browsers fire resize when the address bar hides on scroll.
  let w = window.innerWidth, timer = 0;
  window.addEventListener("resize", () => {
    if (window.innerWidth === w) return;
    w = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(() => { tiles.forEach(size); if (calm.matches) paintSeen(); }, 150);
  });
  update();
}

startSkyGrid();
