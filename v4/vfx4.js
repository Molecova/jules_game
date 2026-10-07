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
  // Every current definition has a profile; shared drawing families retain id-specific signatures.
  const families = {};
  const assign = (style, ids) => ids.split(' ').forEach(id => { families[id] = style; });
  assign('cross', 'cross bleedcut whirl u_squire u_duelist a_longsword');
  assign('quake', 'bash earth shatter quakeking heavy assassinate u_hammer');
  assign('shadowstep', 'shadowstep charge execution a_quiver');
  assign('barrier', 'wall secondwind manashield aegis a_buckler u_shieldman thornshield iceblessing');
  assign('fortress', 'fortify bulwark u_warden');
  assign('taunt', 'taunt');
  assign('blades', 'bladestorm');
  assign('berserk', 'resolve adrenaline');
  assign('arrow', 'spread rain firearrow anklearrow antiheal u_archer u_arbalest u_ninja a_shortbow');
  assign('pierce', 'u_crossbow u_ranger u_windarcher a_eagleeye');
  assign('light', 'aid healarrow u_acolyte');
  assign('buff', 'bless warcry horn u_scout');
  assign('poison', 'poisoncloud u_venom');
  assign('boomerang', 'boomerang');
  assign('smoke', 'smoke');
  assign('wind', 'windwalk stormeye');
  assign('target', 'marktarget sureshot aimedshot u_cryo');
  assign('root', 'net');
  assign('fire', 'ignite u_pyro u_blademaster');
  assign('ice', 'ice frosttouch frostnova blizzard u_archmage');
  assign('chain', 'spark chain thunder');
  assign('silence', 'silence');
  assign('link', 'lifelink bindchain');
  assign('meteor', 'meteor cataclysm meteorshower');
  assign('explosion', 'explosive');
  assign('clock', 'timewarp');
  assign('sheep', 'polymorph');
  assign('mana', 'manasurge u_monk u_apprentice a_wand');
  assign('drain', 'vampire u_warlock');
  assign('summon', 'u_hunter u_summoner');
  assign('judgement', 'u_bishop u_paladin');
  const colors = { cross: '#79d4ed', quake: '#d5b170', shadowstep: '#b798db', barrier: '#9fd0ff', fortress: '#87a8bc', taunt: '#f5c400', blades: '#bcccdc', berserk: '#dc575f', arrow: '#37896a', pierce: '#ba974e', light: '#7dffa0', buff: '#f5c400', poison: '#7fbf4a', boomerang: '#6cae9c', smoke: '#aaa7b5', wind: '#89cbd1', target: '#f5c400', root: '#84ad69', fire: '#ef6b38', ice: '#7dcfff', chain: '#a282d4', silence: '#ae95d0', link: '#b9b2d1', meteor: '#ef8a43', explosion: '#ef6b38', clock: '#a6b7ed', sheep: '#f4eddb', mana: '#a282d4', drain: '#b85b7e', summon: '#c0af80', judgement: '#f5c400' };
  const signature = id => [...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  const V = global.V4;
  const definitions = V ? [...V.SKILLS, ...V.UNITS.flatMap(u => u.ult ? [u.ult] : []), ...V.ITEMS.flatMap(i => i.act ? [i.act] : [])] : [];
  for (const d of definitions) {
    const style = families[d.id];
    if (!style) throw new Error('Missing visual profile: ' + d.id);
    profiles[d.id] = { style, color: colors[style], life: ['barrier', 'light', 'summon', 'judgement'].includes(style) ? 1.05 : 0.7,
      name: d.name, icon: d.icon, variant: signature(d.id), ultimate: d.kind === 'ult', mode: d.mode, effect: d.effect };
  }
  for (const [id, p] of Object.entries(profiles)) p.style ||= id;
  // Pigment accents distinguish related techniques without consuming randomness.
  for (const [id, color] of Object.entries({ bleedcut:'#ba5870', charge:'#79d4ed', execution:'#bf7bb0', firearrow:'#ef6b38', anklearrow:'#88a96d', antiheal:'#b77588', u_ninja:'#c3b1ed', u_arbalest:'#a4b8c8', thunder:'#cab4ff', spark:'#9fcafa', cataclysm:'#df5445', u_archmage:'#7dcfff', u_acolyte:'#84af62', thornshield:'#c7aa7c', iceblessing:'#b0e4ff', secondwind:'#92dcd5' })) profiles[id].color = color;
  const procStyles = {
    cleave:'cross', rabbitHop:'wind', venomStack:'poison', multiHit:'cross', hookRoot:'root', vampire:'drain', vampireStack:'drain', bloodthirst:'drain', guardHeal:'light', longshot:'target', venomBonus:'poison', burnCrit:'fire', poisonHit:'poison', burnHit:'fire', stormHit:'chain', multiShot:'arrow', ambush:'target', healMace:'light', healer:'light', echo:'mana', hourglass:'clock', lastStand:'barrier', deadeye:'target', spellBurn:'fire', spellSlow:'ice', spellLeech:'drain', abyss:'fire', doubleHit:'cross', burnAdd:'fire', hawkFocus:'summon', focus:'target', headshot:'target', evasive:'wind', storm:'chain',
  };
  for (const [kind, style] of Object.entries(procStyles)) profiles['p_' + kind] = { style, color: colors[style], life: 0.38, proc: true, variant: signature(kind), icon: kind, name: kind };
  profiles.p_lastStand.color = '#f5c400';
  profiles.weapon = { style:'melee', color:'#79d4ed', life:0.26, proc:true };

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
  function flame(c, p, h, w, seed, t, color = '#ef6936') {
    c.save(); c.translate(p.x, p.y);
    const sway = Math.sin(seed + t * 13) * w * 0.2;
    c.beginPath(); c.moveTo(-w / 2, 0);
    c.bezierCurveTo(-w, -h * 0.3, -w * 0.12, -h * 0.6, sway, -h);
    c.bezierCurveTo(w * 0.06, -h * 0.6, w * 0.8, -h * 0.4, w / 2, 0);
    c.quadraticCurveTo(0, h * 0.22, -w / 2, 0);
    c.fillStyle = color; c.fill(); stroke(c, INK, 1.6);
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
    if (e.style === 'meteor') {
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
    if (e.style === 'light' || e.style === 'barrier' || e.style === 'revive') {
      c.save(); c.globalAlpha *= Math.min(1, (e.life - t) * 2);
      rune(c, e.style === 'revive' ? p : source, s * (0.4 + ease(t * 2) * 0.45), color, t);
      for (const q of e.points) rune(c, q, s * 0.43, color, -t);
      c.restore();
    }
    if (e.style === 'fire') {
      c.save(); c.globalAlpha *= 0.25 * (1 - t / e.life);
      for (const q of e.cells) { c.fillStyle = '#ab4927'; c.beginPath(); c.ellipse(q.x, q.y + s * 0.18, s * 0.38, s * 0.17, 0, 0, TAU); c.fill(); }
      c.restore();
    }
    if (e.style === 'shadowstep') {
      c.save(); c.globalAlpha *= 0.7 * (1 - t / e.life);
      path(c, [source, e.destination || p]); c.setLineDash([4, 7]); stroke(c, color, s * 0.16); c.setLineDash([]); c.restore();
    }
  }
  function drawOver(c, e, t) {
    const { size: s, source, target: p, color, star: rank } = e;
    const intensity = 1 + (rank - 1) * 0.14;
    const fade = Math.min(1, (e.life - t) * 3);
    c.globalAlpha *= fade;
    if (e.style === 'cross') {
      const dir = e.dir || { x: 0, y: -1 }, angle = Math.atan2(dir.y, dir.x);
      const center = e.proc ? p : e.mode === 'self' ? source : { x: source.x + dir.x * s, y: source.y + dir.y * s };
      if (e.mode === 'self') {
        for (let i = 0; i < 3; i++) slash(c, center, s * intensity * .75, t * 8 + i * TAU / 3, t / .65, i % 2 ? PAPER : color);
      } else {
        const reach = Math.min(1.8, Math.max(1, e.cells.length / 4));
        slash(c, center, s * intensity * reach, angle - 0.75, t / 0.65, color);
        slash(c, center, s * intensity * 0.85, angle + 0.75, t / 0.52, PAPER);
        if(e.count>=3)slash(c,center,s*.8,angle+1.4,t/.55,color);
      }
      for (const q of e.points) scraps(c, q, t / e.life, color, q.x, s * 0.6, 9);
    } else if (e.style === 'pierce') {
      const end = e.cells.length ? e.cells[e.cells.length - 1] : p;
      const angle = Math.atan2(end.y - source.y, end.x - source.x), head = mix(source, end, 1 + clamp(t * 3) * 0.12);
      c.save(); c.globalAlpha *= Math.pow(1 - t / e.life, 0.6);
      path(c, [source, head]); outlined(c, color, 7 * intensity * (1 - t / e.life) + 1); stroke(c, PAPER, 2);
      c.translate(head.x, head.y); c.rotate(angle);
      path(c, [{ x: 9, y: 0 }, { x: -13, y: -7 }, { x: -8, y: 0 }, { x: -13, y: 7 }], true); c.fillStyle = PAPER; c.fill(); stroke(c, INK, 1.6); c.restore();
      for (const q of e.points) { star(c, q, s * 0.3 * (1 - t / e.life), color, Math.PI / 4); scraps(c, q, t / e.life, color, q.y, s * 0.65, 8); }
    } else if (e.style === 'fire') {
      const k = clamp(t / e.life);
      for (let i = 0; i < e.cells.length; i++) {
        const q = e.cells[i];
        flame(c, { x: q.x, y: q.y + s * 0.26 }, s * (0.6 + noise(i, e.seed) * 0.55) * (1 - k) * intensity, s * 0.55 * (1 - k * 0.6), i, t, e.id==='p_burnAdd' && e.stacks>3 ? '#bd493b' : color);
        scraps(c, q, k, '#ffb653', i + e.seed, s * 0.75, e.cells.length > 8 ? 3 : 7);
      }
      if (t < 0.18) star(c, p, s * 0.8 * (1 - t / 0.18), PAPER, 0.2);
    } else if (e.style === 'chain') {
      const pts = [source, ...e.points];
      for (let i = 1; i < pts.length; i++) {
        c.save(); c.globalAlpha *= 0.6 + 0.4 * Math.abs(Math.sin(t * 27 + i));
        lightning(c, pts[i - 1], pts[i], e.seed + i * 9, t, color, 2.7 * intensity * (1 - t / e.life) + 0.5); c.restore();
        star(c, pts[i], s * 0.3 * (1 - t / e.life), PAPER, t * 2);
        scraps(c, pts[i], t / e.life, color, i + e.seed, s * 0.6, 8);
      }
    } else if (e.style === 'meteor') {
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
        for (const q of e.cells) scraps(c, q, k, color, q.x + e.seed, s * 1.2, e.cells.length > 8 ? 3 : 8);
        if (t < 0.3) star(c, p, s * 0.9 * (1 - t / 0.3), PAPER, 0.1);
      }
    } else if (e.style === 'light') {
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
    } else if (e.style === 'barrier') {
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
    } else if (e.style === 'shadowstep') {
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
    } else if (e.style === 'revive') {
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
  function glyph(c, p, kind, color, r = 8, turn = 0) {
    c.save(); c.translate(p.x, p.y); c.rotate(turn); c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 1.7;
    if (['shield', 'fort', 'fortress', 'lastStand', 'invuln'].includes(kind)) {
      path(c, [{x:-r*.8,y:-r*.7},{x:r*.8,y:-r*.7},{x:r*.7,y:r*.35},{x:0,y:r},{x:-r*.7,y:r*.35}], true); c.fill(); stroke(c, INK, 1.7);
      path(c,[{x:0,y:-r*.45},{x:0,y:r*.5}]);stroke(c,PAPER,2);
    } else if (['heart', 'hot', 'light', 'antiheal', 'drain', 'drop', 'vampire', 'vampireStack', 'bloodthirst', 'spellLeech'].includes(kind)) {
      c.beginPath(); c.moveTo(0,r); c.bezierCurveTo(-r*1.8,-r*.1,-r,-r*1.6,0,-r*.45); c.bezierCurveTo(r,-r*1.6,r*1.8,-r*.1,0,r); c.fill();stroke(c,INK,1.5);
      if(kind==='antiheal'){path(c,[{x:-r*.4,y:-r*.8},{x:r*.2,y:0},{x:-r*.2,y:r*.7}]);stroke(c,PAPER,2.2);}
    } else if (['ice', 'chill', 'spellSlow'].includes(kind)) {
      for(let i=0;i<3;i++){c.save();c.rotate(i*Math.PI/3);path(c,[{x:-r,y:0},{x:r,y:0}]);outlined(c,color,2);for(const x of [-r*.6,r*.6]){path(c,[{x:x-Math.sign(x)*r*.25,y:-r*.3},{x,y:0},{x:x-Math.sign(x)*r*.25,y:r*.3}]);stroke(c,color,1.8);}c.restore();}
    } else if (['target', 'marked', 'sure', 'longshot', 'deadeye', 'ambush', 'eye'].includes(kind)) {
      ring(c,{x:0,y:0},r,color,2);ring(c,{x:0,y:0},r*.45,color,1.5);
      for(let i=0;i<4;i++){const a=i*TAU/4;path(c,[{x:Math.cos(a)*r*.7,y:Math.sin(a)*r*.7},{x:Math.cos(a)*r*1.3,y:Math.sin(a)*r*1.3}]);outlined(c,PAPER,1.4);}
    } else if (['silence','blind','smoke'].includes(kind)) {
      c.beginPath();c.roundRect(-r,-r*.75,r*2,r*1.4,3);c.fill();stroke(c,INK,1.5);
      path(c,[{x:-r*.55,y:-r*.4},{x:r*.55,y:r*.4}]);stroke(c,PAPER,2.5);path(c,[{x:r*.55,y:-r*.4},{x:-r*.55,y:r*.4}]);stroke(c,PAPER,2.5);
    } else if (['clock','hourglass','haste','timewarp'].includes(kind)) {
      ring(c,{x:0,y:0},r,color,2);path(c,[{x:0,y:-r*.65},{x:0,y:0},{x:r*.5,y:r*.25}]);outlined(c,PAPER,1.8);
    } else if (['root','link','reflect','hookRoot','bindchain'].includes(kind)) {
      for(let i=-1;i<=1;i++){c.beginPath();c.ellipse(i*r*.65,0,r*.5,r*.3,-.55,0,TAU);outlined(c,color,2);}
      if(kind==='reflect')for(let i=0;i<4;i++)star(c,{x:Math.cos(i*TAU/4)*r,y:Math.sin(i*TAU/4)*r},3,PAPER);
    } else if (['fire','burn','surge','berserk','burnHit','burnAdd','spellBurn','abyss','burnCrit'].includes(kind)) {
      flame(c,{x:0,y:r*.7},r*2,r*1.4,0,turn,color);
    } else if (['poison','skull','venomStack','poisonHit','venomBonus'].includes(kind)) {
      circle(c,{x:0,y:-r*.2},r*.75);c.fill();stroke(c,INK,1.5);c.fillRect(-r*.5,r*.3,r,r*.5);
      for(const x of [-r*.28,r*.28]){circle(c,{x,y:-r*.2},r*.17);c.fillStyle=INK;c.fill();}
    } else if (['arrow','wind','ww','boomerang','multiShot'].includes(kind)) {
      for(let i=0;i<2;i++){path(c,[{x:-r,y:(i-.5)*r},{x:r,y:(i-.5)*r}]);outlined(c,color,2);}
      path(c,[{x:r*.35,y:-r},{x:r,y:0},{x:r*.35,y:r}]);outlined(c,PAPER,1.6);
    } else if (['slash','whirl','dagger','fist','quake','blades','cleave','multiHit','doubleHit'].includes(kind)) {
      path(c,[{x:-r*.7,y:r},{x:r*.7,y:-r}]);outlined(c,color,4);path(c,[{x:-r*.8,y:r*.25},{x:0,y:r*.75}]);stroke(c,INK,2);
    } else star(c,{x:0,y:0},r,color,Math.PI/4);
    c.restore();
  }
  function drawStamp(c, e, t) {
    if (!e.ultimate || e.wave > 0) return;
    c.save();c.globalAlpha*=0.65*Math.min(1,(e.life-t)*3);
    rune(c,e.source,e.size*(.48+ease(t*4)*.23),e.color,0);
    // Brief paper name strip, kept away from health bars and target silhouettes.
    if(t<.52){const w=Math.min(100,18+(e.name||'').length*10),p=e.source;c.globalAlpha*=Math.min(1,t*12);c.fillStyle=PAPER;
      c.beginPath();c.roundRect(p.x-w/2,p.y-e.size*.9,w,17,3);c.fill();stroke(c,INK,1.6);
      c.fillStyle=INK;c.font='bold 10px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(e.name||'',p.x,p.y-e.size*.9+8.5,w-8);}
    c.restore();
  }
  function drawNovel(c, e, t) {
    const {source:a,target:b,color,size:s}=e,k=clamp(t/e.life),r=s*(.3+.035*(e.star-1)),pts=e.points.length?e.points:[b],variant=(e.variant||0)%5;
    c.save();c.globalAlpha*=Math.min(1,(e.life-t)*4);
    // Identity seal adds a different symbol/number of notches to related families.
    if(!e.proc && e.phase!=='warn' && t<.3 && e.style!=='meteor'){
      const q=pts[0];glyph(c,{x:q.x+s*.3,y:q.y-s*.3},e.icon,e.color,6+e.star,variant*.12);
    }
    if(e.style==='arrow'){
      const n=Math.min(12,pts.length),rain=e.mode==='target';
      for(let i=0;i<n;i++){const q=pts[i],from=rain?{x:q.x+s*.15,y:q.y-s*1.4}:e.phase==='launch'?{x:a.x+(i%3-1)*s*.12,y:a.y}:a,head=mix(from,q,ease(clamp(k-i*.025)));
        c.save();c.translate(head.x,head.y);c.rotate(Math.atan2(q.y-from.y,q.x-from.x));
        path(c,[{x:-s*.36,y:0},{x:s*.16,y:0}]);outlined(c,color,2.5);path(c,[{x:s*.16,y:0},{x:0,y:-5},{x:0,y:5}],true);c.fillStyle=PAPER;c.fill();stroke(c,INK,1.4);c.restore();
        if(k>.45)star(c,q,8*(1-k),color);
      }
      if(e.id==='firearrow')flame(c,b,r*1.5,r,0,t);
      if(e.id==='anklearrow')glyph(c,b,'root',colors.root,r*.8);
      if(e.id==='antiheal')glyph(c,b,'antiheal','#c66f83',r*.8);
    } else if(e.style==='boomerang'){
      const head=mix(a,b,k<.5?ease(k*2):1-ease((k-.5)*2));
      path(c,[a,b]);c.setLineDash([3,6]);stroke(c,color,2);c.setLineDash([]);
      c.save();c.translate(head.x,head.y);c.rotate(t*13);path(c,[{x:-r,y:r*.4},{x:0,y:-r},{x:r,y:r*.4}]);outlined(c,color,5);c.restore();
    } else if(e.style==='light' && (e.proc || e.id==='healarrow')){
      for(const q of pts){const head=mix(a,q,ease(k));path(c,[a,head]);outlined(c,color,2);glyph(c,head,'heart',PAPER,5);}
    } else if(e.style==='explosion'){
      if(e.phase==='warn') {glyph(c,b,'arrow',color,r*.7);ring(c,b,r*(1+.2*Math.sin(t*7)),color,2);glyph(c,{x:b.x+r,y:b.y-r},'clock',PAPER,7);}
      else {ring(c,b,s*(.2+ease(k)*1.1),color,5*(1-k));for(const q of e.cells)scraps(c,q,k,color,e.variant,s*.7,4);star(c,b,r*(1-k),PAPER);}
    } else if(e.style==='ice'){
      for(const q of (e.cells.length?e.cells:pts).slice(0,14)){const grow=Math.sin(Math.PI*k);c.save();c.globalAlpha*=.4;
        path(c,[{x:q.x-r*.6,y:q.y+r},{x:q.x,y:q.y-r*1.6*grow},{x:q.x+r*.6,y:q.y+r}],true);c.fillStyle=color;c.fill();stroke(c,INK,1.5);c.restore();glyph(c,q,'ice',color,r*.65*grow);}
      if(e.mode==='line'){const q=e.cells.at(-1)||b;path(c,[a,q]);outlined(c,PAPER,3*(1-k)+.5);}
    } else if(e.style==='poison'||e.style==='smoke'){
      for(const [i,q] of (e.cells.length?e.cells:pts).slice(0,12).entries()){
        for(let j=0;j<3;j++){const ang=j*TAU/3+variant,rr=r*(.4+noise(i*3+j,e.variant)*.4);
          c.save();c.globalAlpha*=.25*(1-k);circle(c,{x:q.x+Math.cos(ang)*r*k,y:q.y+Math.sin(ang)*r*k},rr);c.fillStyle=color;c.fill();stroke(c,INK,1);c.restore();}
        if(i%3===0)glyph(c,q,e.style==='poison'?'skull':'blind',color,r*.55);
      }
      if(e.stacks){c.fillStyle=INK;c.font='bold 10px sans-serif';c.textAlign='center';c.fillText(String(e.stacks),b.x,b.y-r);}
    } else if(e.style==='target'){
      for(const q of pts){glyph(c,q,'target',color,r*(1+.3*(1-k)));if(e.stacks){c.fillStyle=INK;c.font='bold 9px sans-serif';c.textAlign='center';c.fillText(String(e.stacks),q.x,q.y-r); }if(e.id==='u_cryo'){
        const stars=[{x:q.x-r,y:q.y-r},{x:q.x+r,y:q.y-r*.3},{x:q.x,y:q.y+r}];path(c,stars);outlined(c,color,1.5);for(const p of stars)star(c,p,4,PAPER);}
        if(e.phase==='warn'){c.setLineDash([5,5]);path(c,[a,q]);stroke(c,color,1.5);c.setLineDash([]);}else if(e.id==='aimedshot'){path(c,[a,q]);outlined(c,PAPER,5*(1-k));}}
    } else if(e.style==='root'||e.style==='link'){
      if(e.style==='link'&&pts.length>1){path(c,[pts[0],pts[1]]);outlined(c,color,3);}
      for(const q of pts){for(let i=0;i<3;i++){const y=q.y+(i-1)*r*.7;path(c,[{x:q.x-r,y:y-r*.25},{x:q.x+r,y:y+r*.25}]);outlined(c,color,2.5);}glyph(c,q,'link',PAPER,r*.5);}
    } else if(e.style==='silence'){
      for(const q of pts){path(c,[a,q]);c.setLineDash([2,7]);stroke(c,color,2);c.setLineDash([]);glyph(c,q,'silence',color,r);}
    } else if(e.style==='wind'||e.style==='buff'||e.style==='berserk'||e.style==='blades'){
      for(const q of pts){for(let i=0;i<3;i++){const ang=t*4+i*TAU/3,rr=r*(1.2+.35*i);c.beginPath();c.arc(q.x,q.y,rr,ang,ang+Math.PI*.8);outlined(c,i%2?PAPER:color,2.5);
        if(e.style==='blades')glyph(c,{x:q.x+Math.cos(ang)*rr,y:q.y+Math.sin(ang)*rr},'dagger',color,8,ang);
      }if(e.style==='berserk')for(const x of [-r,r])flame(c,{x:q.x+x,y:q.y+r*.5},r*1.6,r*.55,variant,t);
        if(e.id==='horn')glyph(c,{x:q.x,y:q.y-r},'wind',color,r*.6);}
    } else if(e.style==='fortress'||e.style==='taunt'){
      for(const q of e.style==='taunt'?[a]:pts){glyph(c,q,'shield',color,r);ring(c,q,r*(1.2+ease(k)*.7),color,2);}
      if(e.style==='taunt')for(const q of pts){path(c,[q,a]);c.setLineDash([5,5]);stroke(c,color,1.7);c.setLineDash([]);}
      if(e.id==='bulwark')for(const q of pts)glyph(c,{x:q.x+r,y:q.y},'hot',colors.light,7);
    } else if(e.style==='quake'){
      for(const q of (e.cells.length?e.cells:pts).slice(0,16)){
        for(let i=0;i<3;i++){const ang=i*TAU/3+variant*.3,reach=r*(.5+ease(k)*1.4);
          path(c,[q,{x:q.x+Math.cos(ang-.12)*reach*.6,y:q.y+Math.sin(ang-.12)*reach*.6},{x:q.x+Math.cos(ang)*reach,y:q.y+Math.sin(ang)*reach}]);outlined(c,color,2*(1-k)+.5);}
        if(e.id==='assassinate')glyph(c,q,'fist',color,r);}
      ring(c,b,r*(1+ease(k)*1.6),PAPER,3*(1-k));
    } else if(e.style==='drain'){
      const dest=e.healPoints?.[0]|| (e.id==='vampire'?b:a),sources=e.id==='vampire'?[a]:pts;
      for(const q of sources.slice(0,4)){const head=mix(q,dest,ease(k));path(c,[q,head]);outlined(c,color,3);glyph(c,head,'drop',color,5);}
      if(e.stacks){c.fillStyle=INK;c.font='bold 9px sans-serif';c.textAlign='center';c.fillText(String(Math.round(e.stacks)),b.x,b.y-r);}
    } else if(e.style==='mana'||e.style==='clock'){
      for(const q of pts){const head=mix(a,q,ease(k));path(c,[a,head]);outlined(c,color,2.5);
        glyph(c,q,e.style==='clock'?'clock':'star',color,r*.65,t*2);scraps(c,q,k,color,variant,s*.5,5,true);}
      for(const q of e.enemyPoints||[])glyph(c,q,'clock',colors.ice,r*.65,-t);
      if(e.id==='p_hourglass'){for(let i=0;i<5;i++)glyph(c,{x:a.x+(i-2)*4,y:a.y-r+k*r*2},'star','#f5c400',2);}
      if(e.id==='p_echo'){for(let i=0;i<2;i++){c.save();c.globalAlpha*=.4;glyph(c,{x:a.x+(i+1)*7,y:a.y-(i+1)*5},'star',color,r*.6);c.restore();}}
    } else if(e.style==='summon'){
      for(const q of pts){rune(c,q,r*(1+ease(k)*.4),color,-t);scraps(c,q,k,PAPER,variant,s*.65,8,true);
        if(e.summon==='hawk'||e.id==='p_hawkFocus'||e.id==='u_hunter'){path(c,[{x:q.x-r,y:q.y-r*.2},{x:q.x,y:q.y+r*.25},{x:q.x+r,y:q.y-r*.2}]);outlined(c,PAPER,4);}else hex(c,q,r*.65,color,true,0);}
    } else if(e.style==='judgement'){
      for(const q of pts){path(c,[{x:q.x,y:q.y-s*1.5},q]);outlined(c,color,7*(1-k)+1);glyph(c,q,'cross',PAPER,r);ring(c,q,r*(.5+ease(k)*1.5),color,3*(1-k));}
      for(const q of e.healPoints||[]){glyph(c,q,'heart',colors.light,r*.7);path(c,[a,q]);outlined(c,colors.light,2);}
    } else if(e.style==='sheep'){
      for(const q of pts){sheep(c,q,s*.42);scraps(c,q,k,PAPER,variant,s*.6,8);}
    } else if(e.style==='melee'){
      const w=e.weapon||{},shape=w.weaponShape||w.shape||'sword',mid=mix(a,b,.64),angle=Math.atan2(b.y-a.y,b.x-a.x);
      if(['hammer','mace','shield','tower'].includes(shape)){ring(c,b,s*(.3+ease(k)*.9),w.color||color,3*(1-k));glyph(c,b,shape==='shield'||shape==='tower'?'shield':'quake',w.color||color,s*.25*(1-k));}
      else if(shape==='dagger'){path(c,[a,mix(a,b,ease(k))]);outlined(c,w.color||color,4*(1-k)+1);}
      else{slash(c,mid,s*(shape==='greatsword'?.7:.5),angle-.5,k,w.color||color);if(shape==='twin')slash(c,{x:mid.x+6,y:mid.y-6},s*.45,angle+.5,k,PAPER);}
    }
    c.restore();
  }
  function sheep(c,p,r){
    c.save();c.fillStyle=PAPER;for(let i=0;i<5;i++){const a=i*TAU/5;circle(c,{x:p.x+Math.cos(a)*r*.35,y:p.y+Math.sin(a)*r*.3},r*.48);c.fill();stroke(c,INK,1.5);}
    c.fillStyle='#8c807a';c.beginPath();c.ellipse(p.x+r*.6,p.y,r*.35,r*.5,.2,0,TAU);c.fill();stroke(c,INK,1.5);
    for(const x of [-r*.35,r*.3]){path(c,[{x:p.x+x,y:p.y+r*.45},{x:p.x+x,y:p.y+r*.7}]);stroke(c,INK,3);}circle(c,{x:p.x+r*.75,y:p.y-r*.1},1.5);c.fillStyle=INK;c.fill();c.restore();
  }

  const statuses = {
    root:['#8eb76c','root'], silence:['#b295d4','silence'], chill:['#7dcfff','ice'], antiheal:['#c96e7b','antiheal'], marked:['#f5c400','target'], blind:['#aaa7b5','blind'], link:['#b9b2d1','link'], reflect:['#c7aa7c','reflect'], invuln:['#9fd0ff','invuln'], hot:['#7dffa0','hot'], blades:['#bcccdc','blades'], storm:['#8cccd1','wind'], sure:['#f5c400','sure'], surge:['#a282d4','surge'], ww:['#89cbd1','wind'], fort:['#91a5b3','fort'], haste:['#f5c400','haste'], bless:['#f5c400','star'], burn:['#ef6b38','fire'], poison:['#7fbf4a','skull'], bleed:['#c2697d','drop'], slow:['#7dcfff','ice'], weak:['#aa95be','fist'], vuln:['#e87898','target'],
  };
  const statusRows = Object.entries(statuses);
  const active = value => Array.isArray(value) ? value.some(v=>v.t>0) : typeof value==='number' ? value>0 : value && value.t>0;
  // Draw directly from the simulation's existing status fields; do not age or edit them here.
  function drawStatus(c,u,time,r=26,options={}) {
    const st=u.st||{},p={x:u.px,y:u.py},t=options.reducedMotion?0:time;
    c.save();
    if(active(st.root)){for(let i=0;i<3;i++){const x=p.x-r+i*r;path(c,[{x,y:p.y+r*.65},{x:x+5,y:p.y-r*.6}]);outlined(c,'#8eb76c',2);}}
    if(active(st.invuln)){c.globalAlpha=.16;hex(c,p,r*1.08,'#9fd0ff',true);c.globalAlpha=1;hex(c,p,r*1.08,'#9fd0ff');}
    if(active(st.blind)){c.save();c.globalAlpha=.22;for(let i=0;i<3;i++){circle(c,{x:p.x+(i-1)*r*.45,y:p.y-r*.2},r*.65);c.fillStyle=INK;c.fill();}c.restore();}
    if(active(st.reflect)){for(let i=0;i<6;i++){const a=i*TAU/6;path(c,[{x:p.x+Math.cos(a-.1)*r,y:p.y+Math.sin(a-.1)*r},{x:p.x+Math.cos(a)*r*1.22,y:p.y+Math.sin(a)*r*1.22},{x:p.x+Math.cos(a+.1)*r,y:p.y+Math.sin(a+.1)*r}]);outlined(c,'#c7aa7c',2);}}
    if(active(st.blades)){for(let i=0;i<4;i++){const a=t*1.8+i*TAU/4;glyph(c,{x:p.x+Math.cos(a)*(r+7),y:p.y+Math.sin(a)*(r+7)},'dagger','#bcccdc',6,a);}}
    if(active(st.storm)||active(st.ww)){for(let i=0;i<2;i++){c.beginPath();c.ellipse(p.x,p.y,r*1.18,r*.55,t*2+i*.4,0,Math.PI*1.5);outlined(c,'#89cbd1',1.5);}}
    if(active(st.hot)){for(let i=0;i<2;i++){const a=t+i*Math.PI;glyph(c,{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r},'hot','#7dffa0',4);}}
    if(active(st.surge))glyph(c,{x:p.x-r*.8,y:p.y+r*.5},'surge','#a282d4',6);
    if(u.passive==='frenzy'&&u.hp/u.maxHp<.7){c.save();c.globalAlpha=(1-u.hp/u.maxHp)*.6;for(const dx of [-r*.8,r*.8])flame(c,{x:p.x+dx,y:p.y+r*.5},r*(1-u.hp/u.maxHp),8,dx,t);c.restore();}
    if(options.polymorph && u.stun>0)sheep(c,p,r*.8);
    let i=0;
    for(const [key,[color,icon]] of statusRows){
      if(!active(st[key]))continue;
      const q={x:p.x-r-6-(Math.floor(i/6))*12,y:p.y-r*.65+(i%6)*11};i++;
      circle(c,q,5.2);c.fillStyle=PAPER;c.fill();stroke(c,INK,1);glyph(c,q,icon,color,3.7);
      if(key==='marked'){c.fillStyle=INK;c.font='bold 8px sans-serif';c.textAlign='center';c.fillText(String(st.marked.n),q.x,q.y-6);}
      if(key==='poison'&&st.poison.stacks>1){c.fillStyle=INK;c.font='bold 8px sans-serif';c.textAlign='center';c.fillText(String(st.poison.stacks),q.x,q.y-6);}
    }
    // Permanent mana items need a quiet badge, not a fresh animation every tick.
    if(['manaRegen','sageStone'].includes(u.ifx))glyph(c,{x:p.x+r*.7,y:p.y-r*.7},'star',u.ifx==='sageStone'?'#f5c400':'#a282d4',4);
    c.restore();
  }
  function drawFields(c,cb,grid,options={}) {
    const t=options.reducedMotion?0:cb.t;
    c.save();
    for(const z of cb.zones||[]){if(z.t<=0)continue;c.save();c.globalAlpha=.14;
      for(const i of z.cells){const p=grid.cells[i];if(!p)continue;c.fillStyle=z.color||'#7fbf4a';c.beginPath();c.roundRect(p.x-grid.size*.46,p.y-grid.size*.46,grid.size*.92,grid.size*.92,7);c.fill();stroke(c,INK,1);
        for(let j=0;j<2;j++){const a=t*.6+j*Math.PI+i;circle(c,{x:p.x+Math.cos(a)*grid.size*.16,y:p.y+Math.sin(a)*grid.size*.1},grid.size*.22);c.fill();}}
      c.restore();}
    for(const u of cb.units){const l=u.st?.link,v=l?.other;if(u.dead||!l||l.t<=0||!v||v.dead||u.id>=v.id)continue;
      path(c,[{x:u.px,y:u.py},{x:v.px,y:v.py}]);c.setLineDash([5,5]);outlined(c,'#b9b2d1',2);c.setLineDash([]);
      const d=Math.hypot(v.px-u.px,v.py-u.py),n=Math.min(12,Math.ceil(d/18));
      for(let i=1;i<n;i++)glyph(c,mix({x:u.px,y:u.py},{x:v.px,y:v.py},i/n),'link','#c3cbd6',3);}
    c.restore();
  }

  function event(id, data = {}, seed = 1) {
    if (!profiles[id]) return null;
    const p = profiles[id], source = data.source || { x: 0, y: 0 };
    return { ...p, ...data, id, source, target: data.target || source, points: data.points || [], cells: data.cells || [], star: data.star || 1, size: (data.size || 64) * (p.proc && id !== 'weapon' ? 0.55 : 1), seed, t: 0,
      life: data.phase === 'warn' ? data.delay || 1.2 : p.life };
  }
  function render(c, e, t, plane) {
    if (!e || t < 0 || t >= e.life) return;
    c.save();
    if (plane === 'under') { drawUnder(c, e, t); drawStamp(c, e, t); }
    else { drawOver(c, e, t); drawNovel(c, e, t); }
    c.restore();
  }
  function create(options = {}) {
    const max = Math.max(1, Math.min(48, options.maxEffects || 48)), forms = new Map();
    const drawBudget = Math.max(1, Math.min(max, options.drawBudget || 16));
    let effects = [], serial = 0;
    return {
      emit(id, data = {}) {
        if(id==='polymorph' && data.unitId!=null) { if(forms.size>=max&&!forms.has(data.unitId))forms.delete(forms.keys().next().value); forms.set(data.unitId,data.duration||3); }
        if(options.reducedMotion?.())return null;
        // Coalesce rapid identical procs; casts/warnings always remain separate.
        if(id.startsWith('p_') && effects.some(e=>e.id===id&&e.t<.09&&e.source.x===data.source?.x&&e.source.y===data.source?.y&&e.target.x===data.target?.x&&e.target.y===data.target?.y))return null;
        const e = event(id, { size: options.cellSize || 64, ...data }, ++serial);
        if(e) { if(effects.length>=max)effects.shift(); effects.push(e); } return e;
      },
      step(dt) { for (const e of effects) e.t += dt; effects = effects.filter(e => e.t < e.life); for(const [id,t] of forms) { if(t<=dt)forms.delete(id);else forms.set(id,t-dt); } },
      draw(c, plane) {
        if (effects.length <= drawBudget) { for (const e of effects) render(c, e, e.t, plane); return; }
        // Keep spell warnings/ultimates legible during proc bursts; no simulation work is omitted.
        let drawn = 0;
        for (let priority = 2; priority >= 0 && drawn < drawBudget; priority--) {
          for (let i = effects.length - 1; i >= 0 && drawn < drawBudget; i--) {
            const e = effects[i], rank = e.ultimate || e.phase === 'warn' ? 2 : e.proc ? 0 : 1;
            if (rank === priority) { render(c, e, e.t, plane); drawn++; }
          }
        }
      },
      clear() { effects = []; forms.clear(); },
      hasForm(id) { return forms.has(id); },
      get count() { return effects.length; },
    };
  }
  global.VFX4 = { profiles, event, render, create, statuses, drawStatus, drawFields, glyph };
})(window);
