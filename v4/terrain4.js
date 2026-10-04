// 카드 원정대 v4 — 판 칸의 땅 타일(막마다 다섯 가지 땅을 섞어 깐다).
// 칸마다 땅 이름 · 바탕색 · 인쇄 무늬가 다르고, 적 진영은 같은 땅에 붉은 기운을 섞는다.
// 딱지가 앉는 칸 가운데는 비워 두고 무늬는 모서리 쪽에만 옅게 찍는다.
(function (global) {
  'use strict';
  const toRGB = (c) => (c[0] === '#' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c.match(/\d+/g).map(Number));
  const mix = (a, b, t) => { const x = toRGB(a), y = toRGB(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
  const shade = (col, k) => `rgb(${toRGB(col).map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))).join(',')})`;

  // 무늬(원점 기준, 크기 s, 막 색 k)
  const MO = {
    tuft: (c, s, k) => { c.strokeStyle = k.mot; c.lineWidth = 1.4; c.lineCap = 'round'; for (const a of [-0.55, -0.15, 0.25, 0.6]) { c.beginPath(); c.moveTo(a * s * 0.2, 0); c.quadraticCurveTo(a * s * 0.35, -s * 0.25, a * s * 0.6, -s * 0.48); c.stroke(); } },
    flower: (c, s, k) => { c.fillStyle = k.mot2; for (let i = 0; i < 5; i++) { const a = i * 1.257; c.beginPath(); c.ellipse(Math.cos(a) * s * 0.16, Math.sin(a) * s * 0.16, s * 0.12, s * 0.07, a, 0, 7); c.fill(); } c.fillStyle = k.acc; c.beginPath(); c.arc(0, 0, s * 0.08, 0, 7); c.fill(); },
    leaf: (c, s, k) => { c.fillStyle = k.mot; c.beginPath(); c.ellipse(0, 0, s * 0.28, s * 0.12, 0.6, 0, 7); c.fill(); c.strokeStyle = k.leafVein; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-s * 0.22, -s * 0.15); c.lineTo(s * 0.22, s * 0.15); c.stroke(); },
    pebble: (c, s, k) => { c.fillStyle = k.peb; for (const [x, y, r] of [[0, 0, 0.16], [0.24, 0.1, 0.1], [-0.2, 0.12, 0.08]]) { c.beginPath(); c.ellipse(x * s, y * s, r * s, r * s * 0.7, 0, 0, 7); c.fill(); } },
    print: (c, s, k) => { c.fillStyle = k.peb; for (const [x, y] of [[-0.12, 0.15], [0.1, -0.12]]) { c.beginPath(); c.ellipse(x * s, y * s, s * 0.06, s * 0.1, 0.3, 0, 7); c.fill(); for (let t = 0; t < 3; t++) { c.beginPath(); c.arc(x * s + (t - 1) * s * 0.05, y * s - s * 0.13, s * 0.025, 0, 7); c.fill(); } } },
    puddle: (c, s) => { c.fillStyle = 'rgba(110,160,210,.55)'; c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.24, 0.2, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.ellipse(-s * 0.08, -s * 0.06, s * 0.18, s * 0.06, 0.2, Math.PI, Math.PI * 1.7); c.stroke(); },
    crack: (c, s, k) => { c.strokeStyle = k.crack; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-s * 0.45, -s * 0.05); c.lineTo(-s * 0.2, s * 0.08); c.lineTo(0, -s * 0.1); c.lineTo(s * 0.2, s * 0.06); c.lineTo(s * 0.45, -s * 0.04); c.moveTo(0, -s * 0.1); c.lineTo(s * 0.06, -s * 0.32); c.stroke(); },
    grave: (c, s, k) => { c.fillStyle = k.mot2; c.beginPath(); c.moveTo(-s * 0.16, s * 0.22); c.lineTo(-s * 0.16, -s * 0.08); c.arc(0, -s * 0.08, s * 0.16, Math.PI, 0); c.lineTo(s * 0.16, s * 0.22); c.closePath(); c.fill(); c.strokeStyle = k.mot; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -s * 0.12); c.lineTo(0, s * 0.08); c.moveTo(-s * 0.07, -s * 0.04); c.lineTo(s * 0.07, -s * 0.04); c.stroke(); },
    bone: (c, s, k) => { c.strokeStyle = k.bone; c.lineWidth = s * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 0.25, 0); c.lineTo(s * 0.25, 0); c.stroke(); c.fillStyle = k.bone; for (const x of [-0.27, 0.27]) for (const y of [-0.06, 0.06]) { c.beginPath(); c.arc(x * s, y * s, s * 0.06, 0, 7); c.fill(); } },
    lava: (c, s, k) => { c.save(); c.strokeStyle = k.mot; c.shadowColor = k.acc; c.shadowBlur = 6; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-s * 0.45, -s * 0.1); c.lineTo(-s * 0.15, s * 0.05); c.lineTo(s * 0.05, -s * 0.15); c.lineTo(s * 0.45, s * 0.08); c.stroke(); c.restore(); },
    ember: (c, s, k) => { c.fillStyle = k.acc; for (const [x, y] of [[0, 0], [0.2, -0.15], [-0.18, 0.12]]) { c.beginPath(); c.arc(x * s, y * s, s * 0.045, 0, 7); c.fill(); } },
    flake: (c, s, k) => { c.strokeStyle = k.mot; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI / 3); c.beginPath(); c.moveTo(-s * 0.3, 0); c.lineTo(s * 0.3, 0); for (const d of [-0.18, 0.18]) { c.moveTo(d * s, 0); c.lineTo(d * s + Math.sign(d) * s * 0.07, -s * 0.07); c.moveTo(d * s, 0); c.lineTo(d * s + Math.sign(d) * s * 0.07, s * 0.07); } c.stroke(); c.restore(); } },
    shine: (c, s) => { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 0.35, s * 0.2); c.lineTo(-s * 0.05, -s * 0.15); c.moveTo(-s * 0.15, s * 0.3); c.lineTo(s * 0.12, -s * 0.02); c.stroke(); },
    drift: (c, s) => { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.moveTo(-s * 0.5, s * 0.2); c.quadraticCurveTo(-s * 0.2, -s * 0.15, 0, s * 0.05); c.quadraticCurveTo(s * 0.2, -s * 0.2, s * 0.5, s * 0.2); c.closePath(); c.fill(); },
    rune: (c, s, k) => { c.strokeStyle = k.mot; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, s * 0.24, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-s * 0.12, -s * 0.1); c.lineTo(0, s * 0.13); c.lineTo(s * 0.12, -s * 0.1); c.moveTo(-s * 0.08, 0); c.lineTo(s * 0.08, 0); c.stroke(); },
    spark: (c, s, k) => { c.fillStyle = k.mot2; c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.05 : s * 0.18, a = (i * Math.PI) / 4; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); },
    eye: (c, s, k) => { c.fillStyle = k.acc; c.beginPath(); c.ellipse(0, 0, s * 0.22, s * 0.1, 0, 0, 7); c.fill(); c.fillStyle = k.mot; c.beginPath(); c.arc(0, 0, s * 0.07, 0, 7); c.fill(); },
    void: (c, s, k) => { c.fillStyle = '#2a1a3a'; c.beginPath(); c.moveTo(-s * 0.4, 0); c.lineTo(-s * 0.1, -s * 0.08); c.lineTo(0, -s * 0.02); c.lineTo(s * 0.12, -s * 0.1); c.lineTo(s * 0.4, 0); c.lineTo(s * 0.1, s * 0.07); c.lineTo(-s * 0.05, s * 0.02); c.closePath(); c.fill(); c.fillStyle = k.acc; c.beginPath(); c.arc(s * 0.02, -s * 0.01, 1.2, 0, 7); c.fill(); },
  };
  // 크게 한가운데 쪽에 찍는 무늬(웅덩이·눈더미 등)
  const BIG = new Set(['puddle', 'drift', 'void', 'shine']);
  // 막 색
  const K = {
    1: { mot: '#5f8a45', mot2: '#e8a0b8', acc: '#f5d36a', peb: '#b8a888', bone: '#efe6d2', crack: '#7a6a4a', leafVein: '#8db86a' },
    2: { mot: '#6e687e', mot2: '#a8a2b4', acc: '#c9c3d2', peb: '#9a94a6', bone: '#f2ede2', crack: '#6e687e', leafVein: '#a8a2b4' },
    3: { mot: '#e8641b', mot2: '#5a2a1a', acc: '#ffb347', peb: '#6a3a2a', bone: '#f2e0cc', crack: '#5a2a1a', leafVein: '#5a2a1a' },
    4: { mot: '#ffffff', mot2: '#bcd8f0', acc: '#e8f6ff', peb: '#9cb4c8', bone: '#ffffff', crack: '#8aa8c4', leafVein: '#bcd8f0' },
    5: { mot: '#8a5ac0', mot2: '#c79cf0', acc: '#f0d8ff', peb: '#6a5080', bone: '#e8e0f0', crack: '#6a5080', leafVein: '#c79cf0' },
  };
  // 막마다 땅 다섯 가지: [이름, 바탕색, 무늬들, 나올 비율]
  const SETS = {
    1: [['풀밭', '#cfe3b4', ['tuft', 'tuft'], 38], ['꽃밭', '#d6e6b0', ['flower', 'flower', 'tuft'], 18], ['흙길', '#e2d4ae', ['pebble', 'print'], 16], ['덤불', '#b4d08c', ['leaf', 'leaf', 'leaf'], 16], ['웅덩이', '#cfe3b4', ['puddle'], 12]],
    2: [['돌바닥', '#d6d9e2', ['crack'], 38], ['깨진 돌', '#cbced8', ['crack', 'pebble'], 18], ['무덤 흙', '#d2cbc4', ['grave'], 16], ['뼈 무더기', '#d9d6d6', ['bone', 'bone'], 16], ['이끼', '#c6d0c6', ['tuft'], 12]],
    3: [['현무암', '#d8c2a6', ['pebble'], 38], ['용암 틈', '#e8c09a', ['lava'], 18], ['잿더미', '#cbbcae', ['ember', 'pebble'], 16], ['유황', '#ead8a0', ['ember'], 16], ['흑요석', '#c0aa96', ['crack'], 12]],
    4: [['눈밭', '#eef4fa', ['flake'], 38], ['빙판', '#d8eaf8', ['shine'], 18], ['눈더미', '#f4f8fc', ['drift'], 16], ['바위', '#d4dee8', ['pebble'], 16], ['서리꽃', '#e4eef8', ['flake', 'flake'], 12]],
    5: [['보라 석판', '#dad2e6', ['rune'], 38], ['룬 판', '#d2c6e2', ['rune', 'spark'], 18], ['공허 틈', '#cbbfdb', ['void'], 16], ['수정', '#e2d8ee', ['spark', 'spark'], 16], ['눈 무늬', '#d4cae0', ['eye'], 12]],
  };
  function pick(set, R) { const tot = set.reduce((a, t) => a + t[3], 0); let v = R() * tot; for (const t of set) { v -= t[3]; if (v < 0) return t; } return set[0]; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  /** 칸 하나를 그린다. foeCol: 적 진영이면 섞을 붉은 기운 색, checker: 체크무늬 어둡게 */
  function drawTile(c, act, px, py, s, foeCol, checker, R) {
    const set = SETS[act] || SETS[1], k = K[act] || K[1], T = pick(set, R);
    let col = T[1]; if (foeCol) col = mix(col, foeCol, 0.55); if (checker) col = shade(col, -0.04);
    c.fillStyle = col; rr(c, px, py, s, s, 7); c.fill();
    const g = c.createLinearGradient(px, py, px + s, py + s); g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.14)');
    c.fillStyle = g; rr(c, px, py, s, s, 7); c.fill();
    c.save(); rr(c, px, py, s, s, 7); c.clip(); c.globalAlpha = foeCol ? 0.55 : 0.7;
    const spots = [[0.25, 0.25], [0.75, 0.3], [0.3, 0.76], [0.74, 0.74]].sort(() => R() - 0.5);
    T[2].forEach((m, i) => {
      const [dx, dy] = spots[i % 4], big = BIG.has(m), sz = (big ? 30 : 20 + R() * 4) * s / 58;
      c.save(); c.translate(px + (big ? 0.5 + (dx - 0.5) * 0.4 : dx) * s, py + (big ? 0.5 + (dy - 0.5) * 0.9 : dy) * s); c.rotate(big ? 0 : (R() - 0.5) * 0.8); MO[m](c, sz, k); c.restore();
    });
    c.restore();
    c.strokeStyle = 'rgba(35,42,59,.35)'; c.lineWidth = 1.2; rr(c, px + 0.5, py + 0.5, s - 1, s - 1, 7); c.stroke();
    return T[0];
  }
  global.TERRAIN4 = { drawTile, SETS };
})(window);
