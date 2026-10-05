/* Paper-and-ink skill effects. Visual state only; never consumes combat RNG. */
(function (global) {
  'use strict';
  const INK = '#232a3b', PAPER = '#fff7df', TAU = Math.PI * 2;
  const profiles = {
    cross: { color: '#79d4ed', life: 0.68 },
    pierce: { color: '#f4c75b', life: 0.72 },
    fire: { color: '#ef6b38', life: 1.1 },
    chain: { color: '#ac91ff', life: 0.78 },
    meteor: { color: '#ff9945', life: 1.15 },
    light: { color: '#84dfb0', life: 1.3 },
    barrier: { color: '#7dcfff', life: 1.45 },
    shadowstep: { color: '#bc89ed', life: 0.95 },
    revive: { color: '#f1cc6d', life: 1.7 },
  };
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  const noise = (i, seed = 0) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const circle = (c, p, r) => { c.beginPath(); c.arc(p.x, p.y, Math.max(0, r), 0, TAU); };
  function path(c, pts, close = false) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (close) c.closePath();
  }
  function stroke(c, color, width = 2) { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function outlined(c, color, width) { stroke(c, INK, width + 3); stroke(c, color, width); }
  function ring(c, p, radius, color, width = 2) { circle(c, p, radius); stroke(c, color, width); }
  function star(c, p, r, color, rotation = 0) {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = rotation + i * Math.PI / 4, s = i % 2 ? r * 0.23 : r;
      return { x: p.x + Math.cos(a) * s, y: p.y + Math.sin(a) * s };
    });
    path(c, pts, true); c.fillStyle = color; c.fill(); stroke(c, INK, 1.5);
  }
  function hex(c, p, r, color, fill = false, rotation = Math.PI / 6) {
    path(c, Array.from({ length: 6 }, (_, i) => ({ x: p.x + Math.cos(rotation + i * TAU / 6) * r, y: p.y + Math.sin(rotation + i * TAU / 6) * r })), true);
    if (fill) { c.fillStyle = color; c.fill(); } else outlined(c, color, 2.5);
  }
  function scraps(c, p, age, col, seed, size, count = 16, inward = false) {
    const t = clamp(age), fade = Math.sin(Math.PI * clamp(t * 1.12));
    if (fade <= 0) return;
    c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < count; i++) {
      const a = noise(i, seed) * TAU, travel = (0.3 + noise(i + 60, seed) * 0.9) * size * (inward ? 1 - ease(t) : ease(t));
      const x = p.x + Math.cos(a) * travel, y = p.y + Math.sin(a) * travel - (inward ? 0 : size * t * 0.22);
      c.save(); c.translate(x, y); c.rotate(a + t * (i % 2 ? 4 : -4));
      c.fillStyle = i % 3 ? col : PAPER;
      const w = 2 + noise(i + 90, seed) * 4;
      c.fillRect(-w / 2, -2, w, 3); c.restore();
    }
    c.restore();
  }
  function slash(c, p, size, angle, t, color) {
    if (t < 0 || t > 1) return;
    c.save(); c.translate(p.x, p.y); c.rotate(angle);
    c.globalAlpha *= Math.pow(1 - t, 0.6);
    const reach = size * (0.8 + ease(t) * 0.35);
    c.beginPath(); c.moveTo(-reach, reach * 0.25);
    c.quadraticCurveTo(-reach * 0.12, -reach * 0.45, reach, -reach * 0.3);
    c.quadraticCurveTo(reach * 0.02, reach * 0.3, -reach, reach * 0.25);
    c.fillStyle = color; c.fill(); stroke(c, INK, 2);
    c.beginPath(); c.moveTo(-reach * 0.8, reach * 0.17); c.quadraticCurveTo(0, -reach * 0.23, reach * 0.8, -reach * 0.25); stroke(c, PAPER, 3);
    c.restore();
  }
  function flame(c, p, h, w, seed, t) {
    c.save(); c.translate(p.x, p.y);
    const sway = Math.sin(seed + t * 13) * w * 0.2;
    c.beginPath(); c.moveTo(-w / 2, 0);
    c.bezierCurveTo(-w, -h * 0.3, -w * 0.12, -h * 0.6, sway, -h);
    c.bezierCurveTo(w * 0.06, -h * 0.6, w * 0.8, -h * 0.4, w / 2, 0);
    c.quadraticCurveTo(0, h * 0.22, -w / 2, 0);
    c.fillStyle = '#ef6936'; c.fill(); stroke(c, INK, 1.6);
    c.beginPath(); c.moveTo(-w * 0.22, 0); c.quadraticCurveTo(-w * 0.18, -h * 0.28, sway * 0.4, -h * 0.58);
    c.quadraticCurveTo(w * 0.35, -h * 0.13, w * 0.2, 0); c.closePath(); c.fillStyle = '#ffe394'; c.fill();
    c.restore();
  }
  function lightning(c, from, to, seed, age, color, width = 3) {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / len, y: dx / len }, n = Math.max(4, Math.ceil(len / 15));
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const p = mix(from, to, i / n), offset = i === 0 || i === n ? 0 : (noise(i, seed + Math.floor(age * 18)) - 0.5) * 22;
      return { x: p.x + normal.x * offset, y: p.y + normal.y * offset };
    });
    path(c, pts); outlined(c, color, width + 3); stroke(c, PAPER, width * 0.65);
  }
  function rune(c, p, radius, color, t) {
    c.save(); c.translate(p.x, p.y); c.scale(1, 0.52); c.rotate(t * 0.35);
    ring(c, { x: 0, y: 0 }, radius, color, 2);
    ring(c, { x: 0, y: 0 }, radius * 0.82, color, 1);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      path(c, [{ x: Math.cos(a) * radius * 0.89, y: Math.sin(a) * radius * 0.89 }, { x: Math.cos(a) * radius * 1.06, y: Math.sin(a) * radius * 1.06 }]); stroke(c, color, 3);
    }
    c.restore();
  }
  function tileMarks(c, e, age, color) {
    const opacity = e.phase === 'warn' ? 0.10 + 0.07 * Math.sin(age * 12) : 0.18 * (1 - clamp(age / 0.75));
    if (opacity <= 0) return;
    for (const p of e.cells) {
      c.save(); c.globalAlpha *= opacity;
      c.fillStyle = color; c.beginPath(); c.roundRect(p.x - e.size * 0.44, p.y - e.size * 0.44, e.size * 0.88, e.size * 0.88, 5); c.fill();
      c.globalAlpha *= 3; stroke(c, color, 1); c.restore();
    }
  }
  function drawUnder(c, e, t) {
    const { size: s, target: p, source, color } = e;
    tileMarks(c, e, t, color);
    if (e.id === 'meteor') {
      if (e.phase === 'warn') {
        const k = clamp(t / e.delay);
        c.save(); c.globalAlpha *= 0.2 + k * 0.22;
        c.fillStyle = INK; c.beginPath(); c.ellipse(p.x, p.y, s * (0.15 + k * 0.7), s * (0.07 + k * 0.32), 0, 0, TAU); c.fill(); c.restore();
        ring(c, p, s * (1.3 - k * 0.55), '#e7713d', 2.5);
        c.setLineDash([4, 6]); ring(c, p, s * 1.05, color, 1.5); c.setLineDash([]);
      } else {
        c.save(); c.globalAlpha *= 1 - clamp(t / e.life);
        c.fillStyle = 'rgba(61,35,26,.35)'; c.beginPath(); c.ellipse(p.x, p.y, s * 0.7, s * 0.32, 0, 0, TAU); c.fill();
        ring(c, p, s * (0.35 + ease(t / 0.7) * 1.45), color, 5 * (1 - clamp(t)) + 1);
        ring(c, p, s * (0.2 + ease(t / 0.9) * 1.8), PAPER, 2);
        c.restore();
      }
    }
    if (e.id === 'light' || e.id === 'barrier' || e.id === 'revive') {
      c.save(); c.globalAlpha *= Math.min(1, (e.life - t) * 2);
      rune(c, e.id === 'revive' ? p : source, s * (0.4 + ease(t * 2) * 0.45), color, t);
      for (const q of e.points) rune(c, q, s * 0.43, color, -t);
      c.restore();
    }
    if (e.id === 'fire') {
      c.save(); c.globalAlpha *= 0.25 * (1 - t / e.life);
      for (const q of e.cells) { c.fillStyle = '#ab4927'; c.beginPath(); c.ellipse(q.x, q.y + s * 0.18, s * 0.38, s * 0.17, 0, 0, TAU); c.fill(); }
      c.restore();
    }
    if (e.id === 'shadowstep') {
      c.save(); c.globalAlpha *= 0.7 * (1 - t / e.life);
      path(c, [source, e.destination || p]); c.setLineDash([4, 7]); stroke(c, color, s * 0.16); c.setLineDash([]); c.restore();
    }
  }
  function drawOver(c, e, t) {
    const { size: s, source, target: p, color, star: rank } = e;
    const intensity = 1 + (rank - 1) * 0.14;
    const fade = Math.min(1, (e.life - t) * 3);
    c.globalAlpha *= fade;
    if (e.id === 'cross') {
      const dir = e.dir || { x: 0, y: -1 }, angle = Math.atan2(dir.y, dir.x);
      const center = { x: source.x + dir.x * s, y: source.y + dir.y * s };
      slash(c, center, s * intensity, angle - 0.75, t / 0.65, color);
      slash(c, center, s * intensity * 0.85, angle + 0.75, t / 0.52, PAPER);
      for (const q of e.points) scraps(c, q, t / e.life, color, q.x, s * 0.6, 9);
    } else if (e.id === 'pierce') {
      const end = e.cells.length ? e.cells[e.cells.length - 1] : p;
      const angle = Math.atan2(end.y - source.y, end.x - source.x), head = mix(source, end, 1 + clamp(t * 3) * 0.12);
      c.save(); c.globalAlpha *= Math.pow(1 - t / e.life, 0.6);
      path(c, [source, head]); outlined(c, color, 7 * intensity * (1 - t / e.life) + 1); stroke(c, PAPER, 2);
      c.translate(head.x, head.y); c.rotate(angle);
      path(c, [{ x: 9, y: 0 }, { x: -13, y: -7 }, { x: -8, y: 0 }, { x: -13, y: 7 }], true); c.fillStyle = PAPER; c.fill(); stroke(c, INK, 1.6); c.restore();
      for (const q of e.points) { star(c, q, s * 0.3 * (1 - t / e.life), color, Math.PI / 4); scraps(c, q, t / e.life, color, q.y, s * 0.65, 8); }
    } else if (e.id === 'fire') {
      const k = clamp(t / e.life);
      for (let i = 0; i < e.cells.length; i++) {
        const q = e.cells[i];
        flame(c, { x: q.x, y: q.y + s * 0.26 }, s * (0.6 + noise(i, e.seed) * 0.55) * (1 - k) * intensity, s * 0.55 * (1 - k * 0.6), i, t);
        scraps(c, q, k, '#ffb653', i + e.seed, s * 0.75, 10);
      }
      if (t < 0.18) star(c, p, s * 0.8 * (1 - t / 0.18), PAPER, 0.2);
    } else if (e.id === 'chain') {
      const pts = [source, ...e.points];
      for (let i = 1; i < pts.length; i++) {
        c.save(); c.globalAlpha *= 0.6 + 0.4 * Math.abs(Math.sin(t * 27 + i));
        lightning(c, pts[i - 1], pts[i], e.seed + i * 9, t, color, 2.7 * intensity * (1 - t / e.life) + 0.5); c.restore();
        star(c, pts[i], s * 0.3 * (1 - t / e.life), PAPER, t * 2);
        scraps(c, pts[i], t / e.life, color, i + e.seed, s * 0.6, 8);
      }
    } else if (e.id === 'meteor') {
      if (e.phase === 'warn') {
        const k = clamp((t - e.delay + 0.52) / 0.52);
        if (k <= 0) return;
        const rock = { x: p.x + s * 1.6 * (1 - k), y: p.y - s * 2.9 * (1 - k) }, radius = s * (0.24 + k * 0.14) * intensity;
        path(c, [{ x: rock.x + s * 0.9, y: rock.y - s * 1.6 }, { x: rock.x - radius * 0.85, y: rock.y - radius * 0.2 }, { x: rock.x + radius * 0.75, y: rock.y + radius * 0.65 }], true);
        c.fillStyle = '#ed7238'; c.fill(); stroke(c, INK, 2);
        path(c, [{ x: rock.x + s * 0.55, y: rock.y - s }, { x: rock.x - radius * 0.5, y: rock.y }, { x: rock.x + radius * 0.4, y: rock.y + radius * 0.3 }], true); c.fillStyle = '#ffdc82'; c.fill();
        path(c, Array.from({ length: 7 }, (_, i) => { const a = i * TAU / 7, r = radius * (0.8 + noise(i, 33) * 0.3); return { x: rock.x + Math.cos(a) * r, y: rock.y + Math.sin(a) * r }; }), true);
        c.fillStyle = '#674239'; c.fill(); stroke(c, INK, 3);
        path(c, [{ x: rock.x - radius * 0.65, y: rock.y - radius * 0.2 }, rock, { x: rock.x + radius * 0.3, y: rock.y - radius * 0.65 }]); stroke(c, '#ffbd62', 3);
      } else {
        const k = clamp(t / e.life);
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12 + 0.25, reach = s * (0.2 + ease(k * 1.5) * 1.5);
          path(c, [{ x: p.x + Math.cos(a) * reach * 0.4, y: p.y + Math.sin(a) * reach * 0.4 }, { x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach }]); outlined(c, i % 2 ? color : PAPER, 5 * (1 - k));
        }
        for (const q of e.cells) scraps(c, q, k, color, q.x + e.seed, s * 1.2, 11);
        if (t < 0.3) star(c, p, s * 0.9 * (1 - t / 0.3), PAPER, 0.1);
      }
    } else if (e.id === 'light') {
      for (const [i, q] of e.points.entries()) {
        const k = t / e.life;
        c.save(); c.globalAlpha *= 0.27 * (1 - k);
        const g = c.createLinearGradient(q.x, q.y - s * 1.4, q.x, q.y + s * 0.3); g.addColorStop(0, 'rgba(132,223,176,0)'); g.addColorStop(1, color);
        c.fillStyle = g; c.fillRect(q.x - s * 0.26, q.y - s * 1.4, s * 0.52, s * 1.7); c.restore();
        for (let j = 0; j < 3; j++) {
          const a = clamp(k * 1.2 + j * 0.19), pp = { x: q.x + Math.sin(j * 2 + i) * s * 0.3, y: q.y - a * s * 1.1 };
          c.save(); c.globalAlpha *= Math.sin(a * Math.PI); path(c, [{ x: pp.x - 4, y: pp.y }, { x: pp.x + 4, y: pp.y }]); outlined(c, PAPER, 3);
          path(c, [{ x: pp.x, y: pp.y - 4 }, { x: pp.x, y: pp.y + 4 }]); stroke(c, PAPER, 3); c.restore();
        }
        scraps(c, q, k, color, i, s * 0.7, 8);
      }
    } else if (e.id === 'barrier') {
      for (const q of e.points) {
        const r = s * (0.38 + ease(t * 4) * 0.09) * (1 + 0.02 * (rank - 1));
        c.save(); c.globalAlpha *= 0.13; hex(c, q, r, color, true); c.restore();
        hex(c, q, r, color);
        c.save(); c.globalAlpha *= 0.6; hex(c, q, r * 1.13, PAPER, false, Math.PI / 6); c.restore();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + i * TAU / 6;
          star(c, { x: q.x + Math.cos(a) * r, y: q.y + Math.sin(a) * r }, 3.5, PAPER);
        }
        scraps(c, q, t / e.life, color, q.x, s * 0.85, 8, true);
      }
    } else if (e.id === 'shadowstep') {
      const dest = e.destination || p;
      for (const [i, q] of [source, dest].entries()) {
        for (let j = 0; j < 5; j++) {
          const k = t / e.life, a = noise(j, i + 5) * TAU, rr = s * (0.12 + noise(j + 6, 5) * 0.18) * (1 - k);
          c.save(); c.globalAlpha *= (1 - k) * 0.7; circle(c, { x: q.x + Math.cos(a) * s * k * 0.65, y: q.y + Math.sin(a) * s * k * 0.55 }, rr); c.fillStyle = j % 2 ? '#534069' : INK; c.fill(); c.restore();
        }
        scraps(c, q, t / e.life, color, i + e.seed, s * 0.8, 12);
      }
      slash(c, p, s * 0.65 * intensity, -0.7, t / 0.6, color);
      slash(c, p, s * 0.5 * intensity, 0.7, t / 0.5, PAPER);
    } else if (e.id === 'revive') {
      const k = t / e.life;
      scraps(c, p, clamp(t / 0.9), PAPER, e.seed, s * 1.35, 24, true);
      c.save(); c.globalAlpha *= 0.22 * (1 - k);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + t * 0.16;
        path(c, [p, { x: p.x + Math.cos(a - 0.09) * s * 1.6, y: p.y + Math.sin(a - 0.09) * s * 1.6 }, { x: p.x + Math.cos(a + 0.09) * s * 1.6, y: p.y + Math.sin(a + 0.09) * s * 1.6 }], true); c.fillStyle = color; c.fill();
      }
      c.restore();
      if (t > 0.28) {
        c.save(); c.translate(p.x, p.y); c.rotate(-0.5); c.globalAlpha *= clamp((t - 0.28) * 5);
        c.fillStyle = '#f4d481'; c.fillRect(-s * 0.45, -6, s * 0.9, 12); c.strokeStyle = '#9a763b'; c.lineWidth = 1; c.strokeRect(-s * 0.45, -6, s * 0.9, 12);
        for (let i = -2; i <= 2; i++) { path(c, [{ x: i * 9 - 2, y: -4 }, { x: i * 9 + 2, y: 4 }]); stroke(c, PAPER, 1.5); }
        c.restore();
      }
      star(c, { x: p.x, y: p.y - s * (0.5 + k * 0.4) }, 10 * Math.sin(clamp(k * 1.4) * Math.PI), color);
    }
  }
  function event(id, data = {}, seed = 1) {
    if (id === 'u_bishop') { id = 'barrier'; data = { ...data, color: '#f1cc6d' }; }
    if (!profiles[id]) return null;
    const p = profiles[id], source = data.source || { x: 0, y: 0 };
    return { ...p, ...data, id, source, target: data.target || source, points: data.points || [], cells: data.cells || [], star: data.star || 1, size: data.size || 64, seed, t: 0,
      life: id === 'meteor' && data.phase === 'warn' ? data.delay || 1.2 : p.life };
  }
  function render(c, e, t, plane) {
    if (!e || t < 0 || t >= e.life) return;
    c.save(); (plane === 'under' ? drawUnder : drawOver)(c, e, t); c.restore();
  }
  function create(options = {}) {
    const max = options.maxEffects || 48;
    let effects = [], serial = 0;
    return {
      emit(id, data) { const e = event(id, { size: options.cellSize || 64, ...data }, ++serial); if (e) { if (effects.length >= max) effects.shift(); effects.push(e); } return e; },
      step(dt) { for (const e of effects) e.t += dt; effects = effects.filter(e => e.t < e.life); },
      draw(c, plane) { for (const e of effects) render(c, e, e.t, plane); },
      clear() { effects = []; },
      get count() { return effects.length; },
    };
  }
  global.VFX4 = { profiles, event, render, create };
})(window);
