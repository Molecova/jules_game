/* 카드 원정대 — 아트: 종이 딱지 토큰, 초상화, 찢어지는 사망 효과
 * 초상화는 100×100 좌표계에 캔버스 도형으로 그린다(리소 인쇄풍: 납작한 색 + 남색 잉크 외곽선 + 망점).
 * 토큰은 (id, 진영, 크기)별로 한 번만 오프스크린 캔버스에 구워 두고 매 프레임 drawImage 한다.
 */
(function (global) {
  'use strict';
  const INK = '#232a3b';
  const SKIN = '#f3cda4', STEEL = '#c3cbd6', GOLD = '#f5c400', WOOD = '#9a6a3a', WHITE = '#fffdf7';

  // ---------- 기본 도형 ----------
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  function ink(c, w = 3) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }
  function fs(c, fill, w = 3) { c.fillStyle = fill; c.fill(); ink(c, w); c.stroke(); }
  function line(c, pts, w = 3, col = INK) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }

  // 망점 배경(아래로 갈수록 진해짐)
  function bg(c, col, dot = 'rgba(255,255,255,.2)') {
    c.fillStyle = col; c.fillRect(0, 0, 100, 100);
    c.fillStyle = dot;
    for (let y = 3; y < 100; y += 6) for (let x = ((y / 6) % 2) * 3 + 2; x < 100; x += 6) { circ(c, x, y, 0.5 + (y / 100) * 1.7); c.fill(); }
  }
  function shoulders(c, col, trim) {
    c.beginPath(); c.moveTo(12, 102); c.quadraticCurveTo(14, 71, 50, 69); c.quadraticCurveTo(86, 71, 88, 102); c.closePath(); fs(c, col);
    if (trim) line(c, [[40, 71], [50, 82], [60, 71]], 3, trim);
  }
  function head(c, skin = SKIN, x = 50, y = 48, r = 18) { circ(c, x, y, r); fs(c, skin); }
  function face(c, o = {}) {
    const y = o.y || 50, eyes = o.eyes || 'dot', mouth = o.mouth || 'smile', ec = o.eyeColor || INK;
    if (eyes === 'dot' || eyes === 'angry') { c.fillStyle = ec; circ(c, 43, y, 2.5); c.fill(); circ(c, 57, y, 2.5); c.fill(); }
    if (eyes === 'angry') { line(c, [[38, y - 7], [46, y - 4]], 2.5); line(c, [[62, y - 7], [54, y - 4]], 2.5); }
    if (eyes === 'glow') { c.save(); c.shadowColor = ec; c.shadowBlur = 6; c.fillStyle = ec; ell(c, 43, y, 3.4, 2.4); c.fill(); ell(c, 57, y, 3.4, 2.4); c.fill(); c.restore(); }
    if (eyes === 'happy') { line(c, [[40, y + 1], [43, y - 2], [46, y + 1]], 2.5); line(c, [[54, y + 1], [57, y - 2], [60, y + 1]], 2.5); }
    if (eyes === 'hollow') { c.fillStyle = INK; ell(c, 43, y, 4, 4.5); c.fill(); ell(c, 57, y, 4, 4.5); c.fill(); }
    if (mouth === 'smile') { c.beginPath(); c.arc(50, y + 5, 5, 0.2 * Math.PI, 0.8 * Math.PI); ink(c, 2.5); c.stroke(); }
    if (mouth === 'flat') line(c, [[46, y + 9], [54, y + 9]], 2.5);
    if (mouth === 'grin') { rr(c, 42, y + 6, 16, 6, 2); fs(c, WHITE, 2); line(c, [[46, y + 6], [46, y + 12]], 1.5); line(c, [[50, y + 6], [50, y + 12]], 1.5); line(c, [[54, y + 6], [54, y + 12]], 1.5); }
    if (mouth === 'fang') { c.beginPath(); c.arc(50, y + 5, 6, 0.15 * Math.PI, 0.85 * Math.PI); ink(c, 2.5); c.stroke(); poly(c, [[45, y + 9], [47, y + 13], [48.5, y + 9.8]]); fs(c, WHITE, 1.5); poly(c, [[55, y + 9], [53, y + 13], [51.5, y + 9.8]]); fs(c, WHITE, 1.5); }
    if (mouth === 'o') { ell(c, 50, y + 9, 3, 3.5); fs(c, '#7a2b3b', 2); }
    if (o.blush !== false && mouth !== 'none') { c.fillStyle = 'rgba(232,67,107,.35)'; circ(c, 38, y + 6, 3.2); c.fill(); circ(c, 62, y + 6, 3.2); c.fill(); }
  }
  function beard(c, col, long) {
    c.beginPath(); c.moveTo(34, 52); c.quadraticCurveTo(36, long ? 86 : 70, 50, long ? 92 : 72); c.quadraticCurveTo(64, long ? 86 : 70, 66, 52);
    c.quadraticCurveTo(58, 62, 50, 60); c.quadraticCurveTo(42, 62, 34, 52); c.closePath(); fs(c, col);
  }
  // ---------- 머리 장식 ----------
  function kettle(c, col = STEEL) {
    c.beginPath(); c.arc(50, 43, 20, Math.PI, 0); c.closePath(); fs(c, col);
    ell(c, 50, 43, 27, 5); fs(c, col);
    line(c, [[50, 24], [50, 38]], 2, 'rgba(35,42,59,.5)');
  }
  function greathelm(c, col = STEEL, plume) {
    if (plume) { c.beginPath(); c.moveTo(48, 30); c.quadraticCurveTo(58, 2, 82, 10); c.quadraticCurveTo(68, 16, 58, 30); c.closePath(); fs(c, plume); }
    rr(c, 31, 27, 38, 42, 15); fs(c, col);
    c.fillStyle = INK; rr(c, 36, 44, 28, 5, 2); c.fill();
    line(c, [[50, 51], [50, 64]], 2.5);
    c.fillStyle = INK; for (const y of [55, 60]) { circ(c, 44, y, 1.2); c.fill(); circ(c, 56, y, 1.2); c.fill(); }
  }
  function horns(c, col = WHITE) {
    c.beginPath(); c.moveTo(34, 38); c.quadraticCurveTo(16, 32, 18, 12); c.quadraticCurveTo(26, 26, 38, 30); c.closePath(); fs(c, col);
    c.beginPath(); c.moveTo(66, 38); c.quadraticCurveTo(84, 32, 82, 12); c.quadraticCurveTo(74, 26, 62, 30); c.closePath(); fs(c, col);
  }
  function hood(c, col, faceCol = SKIN, dark) {
    c.beginPath(); c.moveTo(50, 14); c.quadraticCurveTo(82, 22, 78, 60); c.quadraticCurveTo(76, 78, 50, 80); c.quadraticCurveTo(24, 78, 22, 60); c.quadraticCurveTo(18, 22, 50, 14); c.closePath(); fs(c, col);
    ell(c, 50, 52, 15, 17); fs(c, dark ? '#1b1f2c' : faceCol);
  }
  function hoodRim(c, col) { c.beginPath(); c.arc(50, 53, 17, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = col; c.lineWidth = 6; c.stroke(); c.beginPath(); c.arc(50, 53, 20, Math.PI * 1.08, Math.PI * 1.92); ink(c, 2.5); c.stroke(); }
  function wizard(c, col, band = GOLD, stars) {
    c.beginPath(); c.moveTo(28, 38); c.quadraticCurveTo(46, 30, 60, 2); c.quadraticCurveTo(66, 22, 72, 38); c.closePath(); fs(c, col);
    ell(c, 50, 38, 30, 6); fs(c, col);
    c.beginPath(); c.moveTo(31, 34); c.quadraticCurveTo(50, 30, 70, 34); c.strokeStyle = band; c.lineWidth = 4; c.stroke();
    if (stars) { c.fillStyle = GOLD; star(c, 56, 18, 4); c.fill(); star(c, 47, 27, 2.5); c.fill(); }
  }
  function star(c, x, y, r) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr2 = k % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); } poly(c, p); }
  function mitre(c, col = WHITE, trim = GOLD) {
    c.beginPath(); c.moveTo(34, 38); c.quadraticCurveTo(32, 16, 50, 6); c.quadraticCurveTo(68, 16, 66, 38); c.closePath(); fs(c, col);
    line(c, [[50, 14], [50, 34]], 4, trim); line(c, [[43, 22], [57, 22]], 4, trim);
    ell(c, 50, 38, 17, 3.5); fs(c, trim, 2);
  }
  function crown(c, col = GOLD, y = 30) {
    poly(c, [[32, y + 6], [32, y - 8], [40, y - 1], [50, y - 12], [60, y - 1], [68, y - 8], [68, y + 6]]); fs(c, col);
    c.fillStyle = '#e8436b'; circ(c, 50, y - 1, 2.6); c.fill(); c.fillStyle = '#2f6fd6'; circ(c, 39, y + 2, 2); c.fill(); circ(c, 61, y + 2, 2); c.fill();
  }
  function brimhat(c, col) { ell(c, 50, 36, 31, 6); fs(c, col); rr(c, 36, 18, 28, 19, 6); fs(c, col); line(c, [[37, 31], [63, 31]], 3, '#5d3b1e'); }
  function wildHair(c, col) { poly(c, [[30, 46], [26, 30], [36, 34], [36, 20], [46, 28], [50, 14], [56, 27], [66, 18], [65, 33], [76, 30], [70, 46], [50, 36]]); fs(c, col); }
  function ears(c, col, big) {
    const s = big ? 1.3 : 1;
    poly(c, [[33, 46], [33 - 22 * s, 36], [35, 56]]); fs(c, col);
    poly(c, [[67, 46], [67 + 22 * s, 36], [65, 56]]); fs(c, col);
  }
  // ---------- 소품 ----------
  function blade(c, x, y, ang, len, w = 7, col = STEEL, guard = true) {
    c.save(); c.translate(x, y); c.rotate(ang);
    poly(c, [[-w / 2, 0], [-w / 2, -len], [0, -len - w], [w / 2, -len], [w / 2, 0]]); fs(c, col, 2.5);
    line(c, [[0, -4], [0, -len + 2]], 1.5, 'rgba(255,255,255,.7)');
    if (guard) { rr(c, -w * 1.4, -1, w * 2.8, 4, 2); fs(c, GOLD, 2); rr(c, -2.5, 3, 5, 10, 2); fs(c, WOOD, 2); circ(c, 0, 15, 3); fs(c, GOLD, 2); }
    c.restore();
  }
  function axe(c, x, y, ang) {
    c.save(); c.translate(x, y); c.rotate(ang);
    rr(c, -2.5, -38, 5, 50, 2); fs(c, WOOD, 2.5);
    c.beginPath(); c.moveTo(2, -36); c.quadraticCurveTo(22, -42, 20, -22); c.quadraticCurveTo(14, -26, 2, -22); c.closePath(); fs(c, STEEL, 2.5);
    c.beginPath(); c.moveTo(-2, -36); c.quadraticCurveTo(-22, -42, -20, -22); c.quadraticCurveTo(-14, -26, -2, -22); c.closePath(); fs(c, STEEL, 2.5);
    c.restore();
  }
  function hammer(c, x, y, ang, col = GOLD) {
    c.save(); c.translate(x, y); c.rotate(ang);
    rr(c, -2.5, -34, 5, 46, 2); fs(c, WOOD, 2.5); rr(c, -12, -44, 24, 13, 3); fs(c, col, 2.5);
    c.restore();
  }
  function bow(c, x, y, h = 30, col = WOOD) {
    c.beginPath(); c.arc(x - h * 0.55, y, h, -Math.PI / 3.2, Math.PI / 3.2); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = col; c.lineWidth = 4; c.stroke();
    const a = Math.PI / 3.2, x1 = x - h * 0.55 + Math.cos(a) * h, y1 = y - Math.sin(a) * h, y2 = y + Math.sin(a) * h;
    line(c, [[x1, y1], [x1, y2]], 1.5);
  }
  function arrowProp(c, x, y, ang) { c.save(); c.translate(x, y); c.rotate(ang); line(c, [[0, 0], [0, -30]], 2.5); poly(c, [[-4, -28], [0, -36], [4, -28]]); fs(c, STEEL, 1.5); poly(c, [[-4, 0], [0, -6], [4, 0], [0, 3]]); fs(c, '#e8436b', 1.5); c.restore(); }
  function crossbow(c, x, y) {
    rr(c, x - 3, y - 6, 6, 26, 2); fs(c, WOOD, 2.5);
    c.beginPath(); c.moveTo(x - 20, y + 2); c.quadraticCurveTo(x, y - 12, x + 20, y + 2); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = STEEL; c.lineWidth = 3; c.stroke();
    line(c, [[x - 20, y + 2], [x + 20, y + 2]], 1.2);
    arrowProp(c, x, y + 6, 0);
  }
  function staff(c, x, y1, y2, orb, glow = true) {
    line(c, [[x, y1], [x, y2]], 7); line(c, [[x, y1], [x, y2]], 4, WOOD);
    c.save(); if (glow) { c.shadowColor = orb; c.shadowBlur = 10; } circ(c, x, y2 - 6, 7); c.fillStyle = orb; c.fill(); c.restore(); circ(c, x, y2 - 6, 7); ink(c, 2.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, x - 2, y2 - 8, 2); c.fill();
  }
  function shield(c, x, y, r, col, emblem) {
    c.beginPath(); c.moveTo(x - r, y - r * 0.9); c.lineTo(x + r, y - r * 0.9); c.lineTo(x + r, y); c.quadraticCurveTo(x + r * 0.9, y + r, x, y + r * 1.25); c.quadraticCurveTo(x - r * 0.9, y + r, x - r, y); c.closePath(); fs(c, col);
    if (emblem === 'cross') { line(c, [[x, y - r * 0.6], [x, y + r * 0.8]], 4, GOLD); line(c, [[x - r * 0.55, y - r * 0.1], [x + r * 0.55, y - r * 0.1]], 4, GOLD); }
    if (emblem === 'band') { line(c, [[x - r * 0.9, y - r * 0.5], [x + r * 0.9, y + r * 0.4]], 5, WHITE); }
  }
  function flame(c, x, y, s, col = '#e8643b', inner = GOLD) {
    const f = (sc, fill) => { c.beginPath(); c.moveTo(x, y - 18 * sc); c.quadraticCurveTo(x + 12 * sc, y - 4 * sc, x + 8 * sc, y + 6 * sc); c.quadraticCurveTo(x, y + 12 * sc, x - 8 * sc, y + 6 * sc); c.quadraticCurveTo(x - 12 * sc, y - 4 * sc, x, y - 18 * sc); c.closePath(); fill(); };
    f(s, () => fs(c, col, 2.5)); f(s * 0.55, () => { c.fillStyle = inner; c.fill(); });
  }
  function dagger(c, x, y, ang) { blade(c, x, y, ang, 16, 6, STEEL, true); }
  function club(c, x, y, ang) { c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(-3, 10); c.lineTo(-7, -30); c.quadraticCurveTo(0, -42, 7, -30); c.lineTo(3, 10); c.closePath(); fs(c, WOOD, 2.5); c.fillStyle = INK; circ(c, -2, -24, 1.4); c.fill(); circ(c, 2, -16, 1.4); c.fill(); c.restore(); }
  function spear(c, x, y, ang) { c.save(); c.translate(x, y); c.rotate(ang); line(c, [[0, 14], [0, -38]], 6); line(c, [[0, 14], [0, -38]], 3, WOOD); poly(c, [[-5, -36], [0, -50], [5, -36]]); fs(c, STEEL, 2); c.restore(); }
  function book(c, x, y) { rr(c, x - 11, y - 8, 22, 16, 2); fs(c, '#8a2b3b', 2.5); line(c, [[x, y - 8], [x, y + 8]], 2); line(c, [[x - 6, y - 2], [x - 2, y - 2]], 1.5, GOLD); }

  // ---------- 특수 머리(괴물) ----------
  function goblinHead(c, skin = '#7fae4a') { ears(c, skin, true); head(c, skin, 50, 50, 17); c.beginPath(); c.moveTo(48, 52); c.quadraticCurveTo(50, 60, 54, 56); ink(c, 2); c.stroke(); }
  function wolfHead(c, col = '#8a8f9a', dark) {
    poly(c, [[30, 42], [26, 14], [44, 32]]); fs(c, col); poly(c, [[70, 42], [74, 14], [56, 32]]); fs(c, col);
    c.beginPath(); c.moveTo(28, 44); c.quadraticCurveTo(30, 26, 50, 26); c.quadraticCurveTo(70, 26, 72, 44); c.quadraticCurveTo(74, 62, 50, 76); c.quadraticCurveTo(26, 62, 28, 44); c.closePath(); fs(c, col);
    ell(c, 50, 62, 11, 9); fs(c, dark ? '#c9c4b8' : '#e8e3d6');
    ell(c, 50, 56, 4.5, 3); fs(c, INK, 1);
    c.fillStyle = dark ? '#ff5d5d' : GOLD; ell(c, 41, 46, 3.5, 2.6, 0.3); c.fill(); ink(c, 2); c.stroke(); ell(c, 59, 46, 3.5, 2.6, -0.3); c.fill(); c.stroke();
    c.fillStyle = INK; circ(c, 41, 46, 1.3); c.fill(); circ(c, 59, 46, 1.3); c.fill();
    line(c, [[44, 67], [50, 70], [56, 67]], 2);
    poly(c, [[46, 68], [47.5, 73], [49, 69]]); fs(c, WHITE, 1.2); poly(c, [[54, 68], [52.5, 73], [51, 69]]); fs(c, WHITE, 1.2);
  }
  function slime(c, col = '#5fbf6a') {
    c.beginPath(); c.moveTo(16, 82); c.quadraticCurveTo(14, 60, 30, 46); c.quadraticCurveTo(46, 22, 52, 24); c.quadraticCurveTo(60, 26, 70, 44); c.quadraticCurveTo(88, 60, 84, 82); c.quadraticCurveTo(50, 92, 16, 82); c.closePath(); fs(c, col);
    c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, 40, 42, 5, 8, 0.5); c.fill();
    face(c, { y: 60, eyes: 'dot', mouth: 'smile' });
  }
  function mushroom(c) {
    rr(c, 36, 50, 28, 34, 10); fs(c, '#efe4cf');
    face(c, { y: 62, eyes: 'angry', mouth: 'flat' });
    c.beginPath(); c.moveTo(14, 52); c.quadraticCurveTo(14, 16, 50, 14); c.quadraticCurveTo(86, 16, 86, 52); c.quadraticCurveTo(50, 44, 14, 52); c.closePath(); fs(c, '#c0392b');
    c.fillStyle = WHITE; for (const [x, y, r] of [[34, 30, 5], [52, 24, 6], [68, 34, 4.5], [44, 42, 3]]) { circ(c, x, y, r); c.fill(); }
    c.save(); c.globalAlpha = 0.5; c.fillStyle = '#b48cff'; for (const [x, y] of [[20, 70], [80, 66], [26, 86], [76, 84]]) { circ(c, x, y, 3); c.fill(); } c.restore();
  }
  function skull(c, col = '#efe9dc', eyeGlow) {
    circ(c, 50, 44, 21); fs(c, col);
    rr(c, 38, 56, 24, 14, 5); fs(c, col);
    if (eyeGlow) face(c, { y: 44, eyes: 'glow', eyeColor: eyeGlow, mouth: 'none', blush: false });
    else { c.fillStyle = INK; ell(c, 42, 45, 5.5, 6); c.fill(); ell(c, 58, 45, 5.5, 6); c.fill(); }
    poly(c, [[50, 51], [47, 57], [53, 57]]); c.fillStyle = INK; c.fill();
    for (const x of [44, 50, 56]) line(c, [[x, 61], [x, 69]], 1.8);
  }
  function ghost(c, col = '#5a5f8a') {
    c.beginPath(); c.moveTo(22, 90); c.lineTo(22, 46); c.quadraticCurveTo(22, 16, 50, 16); c.quadraticCurveTo(78, 16, 78, 46); c.lineTo(78, 90);
    for (let k = 0; k < 4; k++) c.quadraticCurveTo(78 - k * 14 - 7, 80, 78 - (k + 1) * 14, 90);
    c.closePath(); fs(c, col);
    face(c, { y: 44, eyes: 'glow', eyeColor: '#bde2ff', mouth: 'o', blush: false });
  }
  function dragonHead(c, col, hornCol = '#efe4cf', eye = GOLD, big) {
    poly(c, [[32, 34], [14, big ? 4 : 12], [38, 26]]); fs(c, hornCol); poly(c, [[68, 34], [86, big ? 4 : 12], [62, 26]]); fs(c, hornCol);
    c.beginPath(); c.moveTo(26, 46); c.quadraticCurveTo(28, 22, 50, 22); c.quadraticCurveTo(72, 22, 74, 46); c.lineTo(68, 72); c.quadraticCurveTo(50, 86, 32, 72); c.closePath(); fs(c, col);
    ell(c, 50, 70, 13, 9); fs(c, col);
    c.fillStyle = INK; ell(c, 45, 68, 1.6, 2.4); c.fill(); ell(c, 55, 68, 1.6, 2.4); c.fill();
    c.save(); c.shadowColor = eye; c.shadowBlur = 8; c.fillStyle = eye;
    poly(c, [[34, 44], [46, 46], [36, 50]]); c.fill(); poly(c, [[66, 44], [54, 46], [64, 50]]); c.fill(); c.restore();
    line(c, [[40, 79], [50, 82], [60, 79]], 2);
    poly(c, [[43, 79], [45, 85], [47, 80]]); fs(c, WHITE, 1.2); poly(c, [[57, 79], [55, 85], [53, 80]]); fs(c, WHITE, 1.2);
    for (const x of [42, 50, 58]) { poly(c, [[x - 3, 24], [x, 16], [x + 3, 24]]); fs(c, hornCol, 1.5); }
  }
  function lizardHead(c, col) {
    poly(c, [[28, 40], [14, 30], [24, 52]]); fs(c, '#e8643b'); poly(c, [[72, 40], [86, 30], [76, 52]]); fs(c, '#e8643b');
    ell(c, 50, 50, 21, 26); fs(c, col);
    c.fillStyle = GOLD; ell(c, 38, 42, 5, 4); c.fill(); ink(c, 2); c.stroke(); ell(c, 62, 42, 5, 4); c.fill(); c.stroke();
    line(c, [[38, 39], [38, 45]], 2); line(c, [[62, 39], [62, 45]], 2);
    line(c, [[40, 64], [50, 67], [60, 64]], 2.5);
    c.fillStyle = INK; circ(c, 46, 56, 1.2); c.fill(); circ(c, 54, 56, 1.2); c.fill();
  }
  function impHead(c) {
    poly(c, [[36, 36], [30, 16], [44, 30]]); fs(c, '#232a3b'); poly(c, [[64, 36], [70, 16], [56, 30]]); fs(c, '#232a3b');
    ears(c, '#e8643b'); head(c, '#e8643b', 50, 50, 18);
    face(c, { y: 50, eyes: 'angry', mouth: 'fang', blush: false });
  }

  // ---------- 초상화 정의 ----------
  const BLUE = '#2f6fd6', GREEN = '#2e9e6b', PURPLE = '#7a4fd0', HOLY = '#c48a00', PINK = '#e8436b';
  const PORTRAITS = {
    // 아군
    squire: (c) => { bg(c, '#7fa6e8'); blade(c, 74, 92, 0.25, 50); shoulders(c, BLUE, GOLD); head(c); face(c, {}); kettle(c); },
    knight: (c) => { bg(c, '#7fa6e8'); shoulders(c, '#5b6475'); greathelm(c, STEEL, PINK); shield(c, 30, 76, 15, BLUE, 'band'); },
    berserker: (c) => { bg(c, '#e58a8a'); axe(c, 76, 90, 0.35); shoulders(c, '#8a5a3a'); wildHair(c, '#d9572b'); head(c); face(c, { eyes: 'angry', mouth: 'grin' }); beard(c, '#d9572b'); horns(c); },
    archer: (c) => { bg(c, '#8fd1ad'); bow(c, 80, 62, 30); shoulders(c, GREEN); hood(c, GREEN); face(c, { y: 54, mouth: 'smile' }); hoodRim(c, GREEN); },
    crossbow: (c) => { bg(c, '#8fd1ad'); shoulders(c, '#6b5a3a'); head(c); face(c, { eyes: 'angry', mouth: 'flat' }); brimhat(c, '#8a6a3a'); crossbow(c, 50, 78); },
    ranger: (c) => { bg(c, '#5f9e7f'); bow(c, 82, 58, 34, '#5d3b1e'); arrowProp(c, 24, 90, -0.3); shoulders(c, '#2f5e46'); hood(c, '#2f5e46', SKIN, true); face(c, { y: 52, eyes: 'glow', eyeColor: '#bdf5c8', mouth: 'none', blush: false }); hoodRim(c, '#2f5e46'); },
    apprentice: (c) => { bg(c, '#b9a2ec'); shoulders(c, PURPLE, GOLD); head(c); face(c, { eyes: 'happy' }); wizard(c, PURPLE, GOLD); c.save(); c.translate(78, 74); c.rotate(0.4); line(c, [[0, 18], [0, -8]], 4, WOOD); c.fillStyle = GOLD; star(c, 0, -12, 6); c.fill(); ink(c, 2); c.stroke(); c.restore(); },
    warlock: (c) => { bg(c, '#5a3f8a', 'rgba(255,255,255,.12)'); shoulders(c, '#2b2340'); hood(c, '#3b2b5a', SKIN, true); face(c, { y: 52, eyes: 'glow', eyeColor: '#d68bff', mouth: 'none', blush: false }); hoodRim(c, '#3b2b5a'); flame(c, 76, 80, 0.9, '#b04fd0', '#f3d0ff'); },
    archmage: (c) => { bg(c, '#9a7ae0'); staff(c, 80, 98, 22, '#6ae0ff'); shoulders(c, '#4b2f8a', GOLD); head(c); face(c, { eyes: 'dot', mouth: 'none' }); beard(c, '#f4f0e6', true); wizard(c, '#4b2f8a', GOLD, true); },
    cleric: (c) => { bg(c, '#f0d58a'); shoulders(c, WHITE, GOLD); head(c); face(c, { eyes: 'happy' }); mitre(c); book(c, 28, 84); },
    paladin: (c) => { bg(c, '#f0d58a'); hammer(c, 78, 94, 0.3); shoulders(c, '#c3cbd6', GOLD); greathelm(c, '#e9edf2', GOLD); line(c, [[50, 30], [50, 42]], 3, GOLD); shield(c, 28, 76, 14, HOLY, 'cross'); },
    // 1막
    slime: (c) => { bg(c, '#cfe9c0'); slime(c); },
    goblin: (c) => { bg(c, '#d7c48a'); dagger(c, 76, 90, 0.4); shoulders(c, '#7a5a2e'); goblinHead(c); face(c, { eyes: 'angry', mouth: 'fang', blush: false }); },
    gobarcher: (c) => { bg(c, '#d7c48a'); bow(c, 80, 60, 28); shoulders(c, '#5d6b2e'); goblinHead(c, '#93b55a'); face(c, { eyes: 'angry', mouth: 'flat', blush: false }); c.beginPath(); c.arc(50, 44, 20, Math.PI, 0); c.closePath(); fs(c, '#5d6b2e'); },
    wolf: (c) => { bg(c, '#c9d1dc'); wolfHead(c); },
    shroom: (c) => { bg(c, '#d9c8ea'); mushroom(c); },
    ogre: (c) => { bg(c, '#e0c49a'); club(c, 80, 92, 0.35); shoulders(c, '#7a5a3a'); ell(c, 50, 50, 25, 22); fs(c, '#b08a5a'); face(c, { y: 46, eyes: 'angry', mouth: 'flat', blush: false }); poly(c, [[40, 58], [42, 50], [44, 58]]); fs(c, WHITE, 1.5); poly(c, [[60, 58], [58, 50], [56, 58]]); fs(c, WHITE, 1.5); line(c, [[30, 34], [44, 38]], 4); line(c, [[70, 34], [56, 38]], 4); },
    alpha: (c) => { bg(c, '#9aa3b2'); wolfHead(c, '#4b5160', true); line(c, [[56, 34], [64, 50]], 2.5, '#e8436b'); for (const x of [30, 40, 60, 70]) { poly(c, [[x - 4, 84], [x, 74], [x + 4, 84]]); fs(c, STEEL, 1.5); } },
    gobking: (c) => { bg(c, '#e8c26a'); c.beginPath(); c.moveTo(10, 102); c.quadraticCurveTo(14, 66, 50, 66); c.quadraticCurveTo(86, 66, 90, 102); c.closePath(); fs(c, '#a8323b'); shoulders(c, '#6b4a1e', GOLD); goblinHead(c, '#6f9a3a'); face(c, { eyes: 'angry', mouth: 'grin', blush: false }); crown(c, GOLD, 30); },
    // 2막
    skel: (c) => { bg(c, '#c9c3b2'); blade(c, 76, 94, 0.35, 44, 7, '#a39d8a'); shoulders(c, '#6b6f78'); skull(c); line(c, [[50, 71], [50, 100]], 3); for (const y of [78, 86, 94]) line(c, [[40, y], [60, y]], 2.5); },
    skelarch: (c) => { bg(c, '#c9c3b2'); bow(c, 80, 60, 28, '#6b5a3a'); shoulders(c, '#6b6f78'); skull(c); c.beginPath(); c.arc(50, 40, 22, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = '#5d3b1e'; c.lineWidth = 7; c.stroke(); },
    ghoul: (c) => { bg(c, '#a8b8a0'); shoulders(c, '#4b5a48'); head(c, '#9fb39a', 50, 48, 19); face(c, { eyes: 'hollow', mouth: 'none', blush: false }); line(c, [[42, 60], [58, 60]], 2.5); for (const x of [44, 48, 52, 56]) line(c, [[x, 57], [x, 63]], 1.5); line(c, [[36, 36], [44, 40]], 2); },
    wraith: (c) => { bg(c, '#8a8fb8', 'rgba(255,255,255,.14)'); ghost(c); },
    necro: (c) => { bg(c, '#6b5a8a', 'rgba(255,255,255,.12)'); staff(c, 80, 98, 26, '#9bff8a'); skull(c, '#efe9dc'); shoulders(c, '#2b2340'); hood(c, '#4b3b6b', '#d9cfe6'); face(c, { y: 54, eyes: 'glow', eyeColor: '#9bff8a', mouth: 'none', blush: false }); hoodRim(c, '#4b3b6b'); },
    dknight: (c) => { bg(c, '#6b6f78', 'rgba(255,255,255,.12)'); blade(c, 78, 96, 0.3, 52, 9, '#3b4250'); shoulders(c, '#2b2f3f'); horns(c, '#2b2f3f'); rr(c, 31, 27, 38, 42, 15); fs(c, '#3b4250'); c.save(); c.shadowColor = '#ff4d6d'; c.shadowBlur = 8; c.fillStyle = '#ff4d6d'; rr(c, 36, 44, 28, 5, 2); c.fill(); c.restore(); },
    gargoyle: (c) => { bg(c, '#b8bcc4'); c.beginPath(); c.moveTo(50, 60); c.lineTo(6, 26); c.lineTo(14, 52); c.lineTo(4, 56); c.lineTo(20, 74); c.closePath(); fs(c, '#6b6f78'); c.beginPath(); c.moveTo(50, 60); c.lineTo(94, 26); c.lineTo(86, 52); c.lineTo(96, 56); c.lineTo(80, 74); c.closePath(); fs(c, '#6b6f78'); shoulders(c, '#8a8f99'); horns(c, '#5b6070'); head(c, '#9aa0aa', 50, 50, 19); face(c, { eyes: 'glow', eyeColor: GOLD, mouth: 'fang', blush: false }); },
    lich: (c) => { bg(c, '#3b4f8a', 'rgba(255,255,255,.12)'); staff(c, 82, 98, 20, '#6ae0ff'); shoulders(c, '#2b2340', GOLD); hood(c, '#1f2a4a', '#efe9dc'); skull(c, '#efe9dc', '#6ae0ff'); crown(c, GOLD, 26); },
    // 3막
    imp: (c) => { bg(c, '#f2b48a'); flame(c, 80, 80, 0.7); shoulders(c, '#8a2b2b'); impHead(c); },
    lizard: (c) => { bg(c, '#a8d1b4'); spear(c, 80, 92, 0.15); shoulders(c, '#5d6b2e'); lizardHead(c, '#4f9a6a'); },
    salam: (c) => { bg(c, '#f2b48a'); flame(c, 24, 82, 0.8); flame(c, 78, 82, 0.8); shoulders(c, '#8a3b2b'); lizardHead(c, '#e8643b'); },
    whelp: (c) => { bg(c, '#e8a0a8'); shoulders(c, '#6b1f2b'); dragonHead(c, '#a8323b', '#efe4cf', GOLD); },
    dragonkin: (c) => { bg(c, '#e0a890'); blade(c, 78, 96, 0.3, 50, 8); shoulders(c, '#5d3b2b', GOLD); dragonHead(c, '#7a3b2b', '#efe4cf', '#ffd36b'); kettle(c, '#c3cbd6'); },
    giant: (c) => { bg(c, '#f2b48a'); shoulders(c, '#8a3b1e'); flame(c, 50, 30, 1.6, '#e8643b', GOLD); ell(c, 50, 54, 24, 21); fs(c, '#d9572b'); face(c, { y: 52, eyes: 'glow', eyeColor: '#fff2b0', mouth: 'grin', blush: false }); },
    dragon: (c) => { bg(c, '#5a3b4a', 'rgba(255,255,255,.1)'); flame(c, 18, 84, 0.8); flame(c, 82, 84, 0.8); dragonHead(c, '#2b2f3f', '#c9c4b8', '#ff8a3b', true); },
  };

  // ---------- 딱지 토큰 굽기 ----------
  const cache = new Map();
  const portraitCache = new Map();
  function portrait(id, px = 128) {
    const key = id + '|' + px;
    if (portraitCache.has(key)) return portraitCache.get(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.scale(px / 100, px / 100);
    (PORTRAITS[id] || PORTRAITS.slime)(c);
    portraitCache.set(key, cv);
    return cv;
  }
  // 결정적 난수(토큰마다 같은 질감)
  function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

  const RIM = { 0: ['#2f6fd6', '#1f4fa8'], 1: ['#e8436b', '#b02a4c'], boss: ['#232a3b', '#111522'] };
  /** 딱지 스프라이트. 반지름 r(논리 px)의 2배 크기 캔버스를 scale 배율로 굽는다. */
  function token(id, side, r, scale = 2, kind) {
    const key = [id, side, r, scale, kind || ''].join('|');
    if (cache.has(key)) return cache.get(key);
    const S = Math.ceil(r * 2 * scale), cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.scale(scale, scale);
    c.translate(r, r);
    const [rim, rimD] = RIM[kind === 'boss' ? 'boss' : side];
    const rnd = seeded(key);
    // 테두리 원판
    circ(c, 0, 0, r - 1); c.fillStyle = rim; c.fill();
    // 인쇄된 테두리 무늬
    const n = Math.round(r * 1.25);
    c.fillStyle = kind === 'boss' ? GOLD : 'rgba(255,253,247,.85)';
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      c.save(); c.rotate(a); c.translate(0, -(r - r * 0.11));
      if (kind === 'elite' || kind === 'boss') star(c, 0, 0, r * 0.06); else rr(c, -r * 0.022, -r * 0.045, r * 0.044, r * 0.09, 1);
      c.fill(); c.restore();
    }
    // 그림 면
    const ir = r * 0.78;
    c.save(); circ(c, 0, 0, ir); c.clip();
    c.drawImage(portrait(id, Math.ceil(ir * 2 * scale)), -ir, -ir, ir * 2, ir * 2);
    // 종이 결
    for (let k = 0; k < r * 6; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(35,42,59,.07)' : 'rgba(255,255,255,.12)'; c.fillRect((rnd() * 2 - 1) * ir, (rnd() * 2 - 1) * ir, 0.8, 0.8); }
    // 살짝 비친 광택
    const g = c.createLinearGradient(-ir, -ir, ir, ir);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(35,42,59,.12)');
    c.fillStyle = g; c.fillRect(-ir, -ir, ir * 2, ir * 2);
    c.restore();
    circ(c, 0, 0, ir); c.strokeStyle = WHITE; c.lineWidth = Math.max(1.5, r * 0.06); c.stroke();
    circ(c, 0, 0, ir + r * 0.03); ink(c, 1.2); c.stroke();
    circ(c, 0, 0, r - 1); ink(c, Math.max(2, r * 0.09)); c.stroke();
    cv.rimDark = rimD;
    cache.set(key, cv);
    return cv;
  }

  /** 보드 위에 딱지 그리기: 두께(옆면), 그림자, 기울기, 들림, 찌그러짐, 번쩍임 */
  function drawToken(ctx, spr, x, y, r, o = {}) {
    const lift = o.lift || 0, thick = Math.max(2.5, r * 0.15), sq = o.squash || 0;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = 'rgba(35,42,59,.24)';
    ell(ctx, x + 2 + lift * 0.4, y + thick + 2 + lift * 0.9, r * (1 + lift * 0.01), r * (0.98 + lift * 0.01)); ctx.fill();
    ctx.translate(x, y - lift);
    ctx.scale(1 + sq, 1 - sq);
    // 옆면(두께)
    circ(ctx, 0, thick, r - 1); ctx.fillStyle = spr.rimDark || INK; ctx.fill(); ink(ctx, Math.max(1.6, r * 0.08)); ctx.stroke();
    ctx.rotate(o.rot || 0);
    ctx.drawImage(spr, -r, -r, r * 2, r * 2);
    if (o.flash > 0) { circ(ctx, 0, 0, r - 1); ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, o.flash * 6)})`; ctx.fill(); }
    if (o.dim) { circ(ctx, 0, 0, r - 1); ctx.fillStyle = 'rgba(35,42,59,.35)'; ctx.fill(); }
    ctx.restore();
  }

  // ---------- 찢어짐 ----------
  /** 사망 시 반으로 찢어지는 조각 효과 생성 */
  function makeTear(spr, x, y, r, rot = 0) {
    const theta = (Math.random() - 0.5) * 0.9;
    const pts = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const t = -1.25 + (2.5 * i) / (N - 1);
      pts.push([(i === 0 || i === N - 1 ? 0 : (Math.random() - 0.5) * 0.22), t]);
    }
    const scraps = [];
    for (let k = 0; k < 9; k++) {
      const p = pts[1 + Math.floor(Math.random() * (N - 2))];
      scraps.push({ x: p[0] * r, y: p[1] * r * 0.8, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, s: 2 + Math.random() * 3, col: Math.random() < 0.5 ? WHITE : '#d9cfb8' });
    }
    return { spr, x, y, r, rot, theta, pts, t: 0, life: 1.15, dir: Math.random() < 0.5 ? 1 : -1, scraps };
  }
  function stepTear(d, dt) {
    d.t += dt;
    for (const s of d.scraps) { s.vy += 260 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; }
    return d.t < d.life;
  }
  function drawTear(ctx, d) {
    const { spr, r, theta, pts } = d, t = d.t, k = Math.min(1, t / 0.18), e = 1 - Math.pow(1 - Math.min(1, t / d.life), 2);
    const alpha = 1 - Math.max(0, (t - d.life * 0.55) / (d.life * 0.45));
    const thick = Math.max(2.5, r * 0.15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    for (const s of [-1, 1]) {
      // 찢어진 직후 살짝 벌어졌다가, 양쪽으로 떨어져 나간다
      const sep = r * (0.06 * k + 0.9 * e), fall = r * 1.6 * e * e, spin = s * (0.15 * k + 0.9 * e) * (s === d.dir ? 1.2 : 0.8);
      ctx.save();
      ctx.translate(Math.cos(theta) * sep * s, Math.sin(theta) * sep * s + fall);
      ctx.rotate(spin);
      ctx.rotate(theta);
      // 이 쪽 절반 영역
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * r, py * r) : ctx.moveTo(px * r, py * r)));
      ctx.lineTo(s * r * 1.4, r * 1.3); ctx.lineTo(s * r * 1.4, -r * 1.3); ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.rotate(-theta);
      circ(ctx, 0, thick, r - 1); ctx.fillStyle = spr.rimDark || INK; ctx.fill();
      ctx.drawImage(spr, -r, -r, r * 2, r * 2);
      ctx.restore();
      // 찢긴 단면: 하얀 종이 섬유
      ctx.save(); circ(ctx, 0, 0, r - 1); ctx.clip();
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * r + s * 0.8, py * r) : ctx.moveTo(px * r + s * 0.8, py * r)));
      ctx.strokeStyle = WHITE; ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.setLineDash([r * 0.12, r * 0.05]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      ctx.restore();
    }
    for (const s of d.scraps) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = s.col; ctx.fillRect(-s.s / 2, -s.s / 2, s.s, s.s * 0.7); ctx.restore(); }
    ctx.restore();
  }

  /** 카드·지도용 초상화 data URL (원형 딱지) */
  const urlCache = new Map();
  function tokenURL(id, side = 0, kind) {
    const key = id + side + (kind || '');
    if (urlCache.has(key)) return urlCache.get(key);
    const url = token(id, side, 44, 2, kind).toDataURL();
    urlCache.set(key, url);
    return url;
  }

  global.ART = { PORTRAITS, portrait, token, drawToken, makeTear, stepTear, drawTear, tokenURL, star };
})(window);
