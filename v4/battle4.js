/* 카드 원정대 v4 — 전투 규칙
 * 별(★)·클래스 전용 아이템·클래스 시너지·유물을 반영해 전투 개체를 만들고, 스킬(격자 패턴)·상태이상·
 * 아이템 효과·보스 패턴을 훅으로 엔진(AC.Combat)에 붙인다. 화면/소리는 env.fx 로 위임한다.
 */
(function (global) {
  'use strict';
  const { MONSTERS } = global.GD;
  const V = global.V4;
  const STAR = [0, 1, 1.8, 3.2];     // 유닛 체력·공격
  const POW = [0, 1, 1.45, 2.1];     // 유닛 별에 따른 스킬 위력
  const SKSTAR = [0, 1, 1.7, 2.6];   // 스킬 칩 별
  const ITSTAR = [0, 1, 1.6, 2.5];   // 아이템 별
  const def = (kind, id) => V.DEF[kind + ':' + id];
  const clsCol = (c) => (V.CLS[c] ? V.CLS[c].col : '#e8436b');

  /** 스킬 칩 ★3: 범위를 한 칸 넓힌다 */
  function expandCells(d, star) {
    if (star < 3 || !d.cells) return d.cells;
    const key = (a) => a.join(',');
    const set = new Map(d.cells.map((c) => [key(c), c]));
    if (d.mode === 'facing' || d.mode === 'targetFacing') {
      const maxF = Math.max(...d.cells.map((c) => c[0]));
      for (const [f, s] of d.cells) if (f === maxF) set.set(key([f + 1, s]), [f + 1, s]);
      for (const [f, s] of d.cells) { if (s === Math.min(...d.cells.map((c) => c[1]))) set.set(key([f, s - 1]), [f, s - 1]); if (s === Math.max(...d.cells.map((c) => c[1]))) set.set(key([f, s + 1]), [f, s + 1]); }
    } else {
      for (const [x, y] of d.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set.set(key([x + dx, y + dy]), [x + dx, y + dy]);
    }
    return [...set.values()];
  }

  /** 카드 → 능력치(시너지·유물 제외). 화면 표시와 전투 생성에 함께 쓴다 */
  function unitStats(card) {
    const d = def('unit', card.id), m = STAR[card.star];
    const s = { hp: d.hp * m, atk: d.atk * m, as: d.as, range: d.range, armor: d.armor || 0, crit: d.crit || 0.05, critDmg: 1.75, dodge: d.dodge || 0,
      lifesteal: 0, spell: 1 + (d.spellBonus || 0), heal: 1, mana: d.startMana || 0, manaPerHit: 12, fx: null };
    if (card.item) {
      const it = def('item', card.item.id), k = ITSTAR[card.item.star], st = it.st;
      if (st.atk) s.atk *= 1 + st.atk * k;
      if (st.as) s.as *= 1 + st.as * k;
      if (st.hp) s.hp *= 1 + st.hp * k;
      if (st.armor) s.armor += st.armor * k;
      if (st.range) s.range += st.range;
      if (st.crit) s.crit += st.crit * k;
      if (st.lifesteal) s.lifesteal += st.lifesteal * k;
      if (st.spell) s.spell *= 1 + st.spell * k;
      if (st.heal) s.heal *= 1 + st.heal * k;
      if (st.mana) s.mana += st.mana * Math.min(k, 1.6);
      if (st.manaPerHit) s.manaPerHit += st.manaPerHit * k;
      s.fx = it.fx; s.fxK = k;
    }
    s.hp = Math.round(s.hp); s.atk = Math.round(s.atk);
    return s;
  }

  function create(env) {
    const { grid, PLAYER_ROW, COLS, ROWS } = env;
    const fx = env.fx;
    const R = () => env.getR();
    const has = (r) => R().relics.includes(r);

    // ---------- 격자 ----------
    function facing(u, t) {
      const a = grid.cells[u.cell], b = t ? grid.cells[t.cell] : null;
      if (!b) return u.side ? [0, 1] : [0, -1];
      const dx = b.c - a.c, dy = b.r - a.r;
      if (Math.abs(dx) > Math.abs(dy)) return [Math.sign(dx), 0];
      if (dy) return [0, Math.sign(dy)];
      return u.side ? [0, 1] : [0, -1];
    }
    function rel(cell, f, s, dir) {
      const a = grid.cells[cell], fx2 = dir[0], fy = dir[1], sx = -fy, sy = fx2;
      return grid.idx(a.c + f * fx2 + s * sx, a.r + f * fy + s * sy);
    }
    const abs = (cell, dx, dy) => { const a = grid.cells[cell]; return grid.idx(a.c + dx, a.r + dy); };
    function skillCells(u, t, d, dir, cells0) {
      const cs = cells0 || d.cells;
      let cells = [];
      switch (d.mode) {
        case 'facing': cells = cs.map(([f, s]) => rel(u.cell, f, s, dir)); break;
        case 'targetFacing': cells = cs.map(([f, s]) => rel(t.cell, f, s, dir)); break;
        case 'self': cells = cs.map(([x, y]) => abs(u.cell, x, y)); break;
        case 'target': cells = cs.map(([x, y]) => abs(t.cell, x, y)); break;
        case 'line': for (let f = 1; f < 12; f++) { const i = rel(u.cell, f, 0, dir); if (i < 0) break; cells.push(i); } break;
        case 'selfOnly': cells = [u.cell]; break;
        case 'single': cells = [t.cell]; break;
      }
      return cells.filter((i) => i >= 0);
    }
    const tiles = (cb, cells, color, life = 0.45) => { for (const i of cells) cb.fx.push({ kind: 'tile', cell: i, color, life, t: 0 }); };
    const freeNear = (cb, cell) => [cell, ...grid.neighbors[cell]].find((n) => !cb.occ[n]);

    // ---------- 시너지(같은 유닛은 한 번만 센다) ----------
    function synergyCounts(cards) {
      const seen = new Set(), counts = { war: 0, arc: 0, mag: 0 };
      for (const c of cards) { if (seen.has(c.id)) continue; seen.add(c.id); counts[def('unit', c.id).cls]++; }
      const tiers = {};
      for (const k in counts) tiers[k] = V.SYN[k].th.filter((t) => counts[k] >= t).length;
      return { counts, tiers };
    }

    // ---------- 전투 개체 ----------
    function baseEntity(stats, side, cell, extra) {
      const e = AC.makeEntity({ hp: stats.hp, atk: stats.atk, as: stats.as, range: stats.range, armor: stats.armor, crit: stats.crit, mana: 80 }, 1, side, cell, extra);
      e.st = {};
      e.dotT = Math.random() * 0.5;
      e.rot = extra && extra.rot != null ? extra.rot : AC.rand(-0.08, 0.08);
      return e;
    }
    const skillMana = (s) => Math.max(30, (s.def.mana || 80) - (s.star - 1) * 8);
    function setupSkills(e, mana) {
      if (e.skills.length) { e.ability = { type: 'skill' }; e.skillIdx = 0; e.maxMana = skillMana(e.skills[0]); e.mana = Math.min(e.maxMana - 1, mana); }
      else { e.ability = null; e.maxMana = 0; e.mana = 0; }
    }
    function wpArt(it) { return { id: 'v4' + it.id, shape: it.shape, cls: V.CLS[it.cls].art, tier: it.t >= 3 ? 3 : it.t }; }
    function loadoutOf(card) {
      return {
        level: 1,
        weapon: card.item ? Object.assign(wpArt(def('item', card.item.id)), { up: card.item.star > 1 }) : null,
        skills: card.skills.map((s) => { const d = def('skill', s.id); return { col: clsCol(d.cls), icon: d.icon || 'star', up: s.star > 1 }; }),
      };
    }

    function makeAlly(card, cell, syn) {
      const d = def('unit', card.id), s = unitStats(card), t = syn.tiers, cls = d.cls;
      const e = baseEntity(s, 0, cell, {
        def: d, card, uidRef: card.uid, cls, artId: d.id, passive: d.passive, star: card.star, lo: loadoutOf(card), rot: card.rot,
        dodge: s.dodge, lifesteal: s.lifesteal, critDmg: s.critDmg, spell: s.spell, healMult: s.heal, manaPerHit: s.manaPerHit,
        thorns: 0, regen: 0, procs: new Set(), pow: POW[card.star], ifx: s.fx, ifxK: s.fxK || 1,
        skills: card.skills.map((x) => { const sd = def('skill', x.id); return { def: sd, star: x.star, cells: expandCells(sd, x.star) }; }),
      });
      e.star = 1; // 엔진 STAR_MULT 를 쓰지 않도록(능력치는 이미 반영됨)
      let mana = s.mana;
      const p = d.passive;
      if (p === 'pierceArmor') e.pierce = true;
      if (s.fx === 'poisonHit') e.procs.add('poisonHit');
      if (s.fx === 'spellSlow') e.procs.add('spellSlow');
      if (s.fx === 'spellBurn') e.procs.add('spellBurn');
      if (s.fx === 'bloodrage') e.procs.add('cleaveHit');
      // 시너지
      if (t.war && cls === 'war') e.maxHp *= t.war >= 2 ? 1.3 : 1.15;
      if (t.war >= 2 && cls === 'war') e.armor += 0.1;
      if (t.war >= 3) e.armor += 0.15;
      if (t.arc && cls === 'arc') { e.as *= [1, 1.2, 1.4, 1.6][t.arc]; if (t.arc >= 3) e.range += 1; }
      if (t.mag) e.spell *= t.mag >= 2 ? 1.35 : 1.15;
      if (t.mag >= 3 && cls === 'mag') mana = Math.max(mana, 30);
      // 유물
      if (cls === 'war' && has('whetstone')) e.atk *= 1.15;
      if (cls === 'arc' && has('feather')) e.as *= 1.15;
      if (cls === 'mag' && has('prism')) e.spell *= 1.2;
      if (has('banner')) e.maxHp *= 1.1;
      if (has('pauldron')) e.armor += 0.08;
      if (has('thornmail')) e.thorns += 0.1;
      if (has('horn')) mana += 20;
      e.armor = Math.min(0.7, e.armor);
      e.maxHp = Math.round(e.maxHp); e.hp = e.maxHp;
      if (p === 'firstStrike') { e.crit0 = e.crit; e.crit = 1; e.firstStrike = true; }
      setupSkills(e, mana);
      return e;
    }

    /** 라운드별 적 강화(원정대가 별·레벨·장비로 강해지는 만큼) */
    function foeMul(d) {
      const r = R(), n = r.round, t = global.__tune || {}, df = V.DIFF[r.diff || 'normal'].foe;
      const role = d.boss ? 'boss' : d.elite ? 'elite' : 'normal';
      const bossK = (role === 'boss' ? [1, t.boss1 || 1.15, t.boss2 || 1, t.boss3 || 0.72][r.act] : 1) * [1, 1, t.a2 || 1.12, t.a3 || 1][r.act] * (role === 'elite' && n <= 5 ? t.earlyElite || 0.85 : 1);
      const hp = ((t.hp0 || 1.2) + (t.hpK || 0.15) * n) * ({ normal: 1, elite: t.eliteHp || 0.82, boss: t.bossHp || 0.95 }[role]) * bossK * df;
      const atk = ((t.atk0 || 1) + (t.atkK || 0.08) * n) * ({ normal: 1, elite: t.eliteAtk || 0.9, boss: t.bossAtk || 0.95 }[role]) * Math.sqrt(bossK) * df;
      return { hp, atk, pow: atk };
    }
    function makeFoe(x) {
      const d = x.def, m = d.object ? { hp: 1, atk: 1, pow: 1 } : foeMul(d), k = x.scale || 1;
      const e = baseEntity({ hp: d.hp * k * m.hp, atk: d.atk * k * m.atk, as: d.as, range: d.range, armor: d.armor || 0, crit: 0.05 }, 1, x.cell, {
        def: d, uidRef: x.uid, artId: d.id, cls: monsterCls(d), rot: x.rot, dodge: d.dodge || 0, lifesteal: d.lifesteal || 0,
        skills: (d.skills || []).map((id) => { const sd = global.GD.SKILLS.find((s) => s.id === id); return { def: sd, star: 1, mana: d.mana, cells: sd.cells }; }),
        pow: m.pow * k, immobile: !!d.immobile, boss: d.boss || null, big: !!d.boss, elite: !!d.elite, manaPerHit: 10, v: d.v,
        procs: new Set(d.proc ? [d.proc] : []), healMult: 1, thorns: 0, regen: 0, critDmg: 1.75, spell: 1,
      });
      if (e.skills.length) { e.ability = { type: 'skill' }; e.skillIdx = 0; e.maxMana = d.mana || 70; e.mana = 0; } else { e.ability = null; e.maxMana = 0; }
      if (e.boss) e.script = { a: 3, b: 2, c: 4, flags: {} };
      return e;
    }
    function makeSummon(id, cell, side, owner) {
      const d = MONSTERS[id];
      const k = owner ? (owner.pow || 1) * (has('whistle') && side === 0 ? 1.5 : 1) : 1;
      const e = baseEntity({ hp: d.hp * k, atk: d.atk * k, as: d.as, range: d.range, armor: d.armor || 0, crit: 0.05 }, side, cell, {
        def: d, artId: d.id, cls: 'melee', summon: true, skills: [], procs: new Set(), healMult: 1, thorns: 0, regen: 0, critDmg: 1.75, pow: k, spell: 1,
      });
      e.ability = null; e.maxMana = 0;
      e.popT = 0.35;
      return e;
    }
    function monsterCls(d) {
      if (['whelp', 'dragon', 'imp', 'salam', 'magmagolem'].includes(d.id)) return 'fire';
      if ((d.skills || []).some((id) => ['fire', 'chain', 'ice', 'light'].includes(id))) return 'mage';
      return d.range > 1 ? 'bow' : 'melee';
    }

    // ---------- 상태이상 ----------
    function dotMult(src, key) {
      if (!src || src.side !== 0) return 1;
      if (key === 'burn' && has('ember')) return 1.6;
      if (key === 'poison' && has('venomgland')) return 1.6;
      if (key === 'bleed' && has('hook')) return 1.6;
      return 1;
    }
    function addStatus(cb, t, key, val, src) {
      if (!t || t.dead || !t.st || t.object) return;
      const st = t.st, pw = src ? src.pow || 1 : 1;
      switch (key) {
        case 'burn': st.burn = { t: val.dur, dps: val.dps * pw * dotMult(src, 'burn'), src }; break;
        case 'poison': { const p = st.poison; const stacks = p && p.t > 0 ? Math.min(3, p.stacks + 1) : 1; st.poison = { t: val.dur, dps: val.dps * pw * dotMult(src, 'poison'), stacks, src }; break; }
        case 'bleed': st.bleed = { t: val.dur, dps: val.dps * pw * dotMult(src, 'bleed'), src }; break;
        case 'slow': st.slow = Math.max(st.slow || 0, val); break;
        case 'weak': st.weak = Math.max(st.weak || 0, val); break;
        case 'vuln': st.vuln = { t: Math.max(st.vuln ? st.vuln.t : 0, val.dur), amt: Math.max(st.vuln ? st.vuln.amt : 0, val.amt) }; break;
        case 'stun': t.stun = Math.max(t.stun, val); break;
      }
    }
    function cleanse(t) { const st = t.st; delete st.burn; delete st.poison; delete st.bleed; delete st.slow; delete st.weak; delete st.vuln; t.stun = 0; }
    const H = (u) => (u && u.healMult) || 1;
    const lowestAlly = (cb, side, needHurt) => cb.alive(side).filter((x) => !x.object && (!needHurt || x.hp < x.maxHp)).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];

    // ---------- 스킬 ----------
    function applySkillHit(cb, u, v, P, d) {
      let amt = P;
      if (d.execute && v.hp / v.maxHp <= 0.5) amt *= d.execute;
      const dealt = cb.damage(u, v, amt, 'spell', !!d.crit);
      if (d.stun) addStatus(cb, v, 'stun', d.stun, u);
      if (d.slow) addStatus(cb, v, 'slow', d.slow, u);
      if (d.weak) addStatus(cb, v, 'weak', d.weak, u);
      if (d.burn) addStatus(cb, v, 'burn', d.burn, u);
      if (d.poison) addStatus(cb, v, 'poison', d.poison, u);
      if (d.bleed) addStatus(cb, v, 'bleed', d.bleed, u);
      if (d.vuln) addStatus(cb, v, 'vuln', d.vuln, u);
      return dealt;
    }
    function leapTo(cb, u, target) {
      const spots = grid.neighbors[target.cell].filter((n) => !cb.occ[n]);
      if (!spots.length) return false;
      const behind = spots.sort((a, b) => (u.side ? grid.cells[a].r - grid.cells[b].r : grid.cells[b].r - grid.cells[a].r))[0];
      cb.ring(u.px, u.py, '#b48cff', 22);
      cb.teleport(u, behind);
      u.target = target;
      cb.ring(u.px, u.py, '#b48cff', 22);
      return true;
    }
    function execSkill(cb, u, t, s, scale = 1) {
      const d = s.def, foe = 1 - u.side, k = SKSTAR[s.star || 1];
      const P = (d.power || 0) * (u.pow || 1) * k * (u.spell || 1) * scale;
      const dir = facing(u, t);
      u.dir = dir;
      const col = u.side ? '#e8436b' : clsCol(d.cls);
      cb.float(u.px, u.py - 38, d.name + (s.star > 1 ? ' ' + '★'.repeat(s.star) : ''), u.side ? '#ffd0da' : '#fffdf7', true);
      const Hm = H(u);
      const cellsOf = () => skillCells(u, t, d, dir, s.cells);
      const allies = (cells) => cells.map((i) => cb.occ[i]).filter((v) => v && v.side === u.side && !v.dead && !v.object);
      switch (d.effect) {
        case 'dmg': {
          if (d.mode === 'lowest' || d.mode === 'leap') {
            const v = cb.alive(foe).filter((x) => !x.object).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (!v) break;
            if (d.mode === 'leap') leapTo(cb, u, v); else cb.beam(u.px, u.py, v.px, v.py, col, 0.35);
            tiles(cb, [v.cell], col);
            applySkillHit(cb, u, v, P, d);
            break;
          }
          if (d.mode === 'chain') {
            let cur = t, amt = P, from = u;
            const hit = new Set();
            for (let n = 0; n < 4 + (s.star >= 3 ? 2 : 0) && cur; n++) {
              hit.add(cur);
              cb.beam(from.px, from.py, cur.px, cur.py, '#b48cff', 0.35);
              tiles(cb, [cur.cell], col);
              applySkillHit(cb, u, cur, amt, d);
              amt *= 0.85; from = cur;
              cur = cb.alive(foe).filter((v) => !hit.has(v)).sort((a, b) => grid.dist(from.cell, a.cell) - grid.dist(from.cell, b.cell))[0];
            }
            break;
          }
          if (d.mode === 'volley') {
            const ts = AC.shuffle(cb.alive(foe).slice());
            const n = (d.count || 3) + (s.star >= 3 ? 2 : 0);
            for (let j = 0; j < n; j++) { const v = ts[j % Math.max(1, ts.length)]; if (v) cb.projectiles.push({ x: u.px, y: u.py, tgt: v, src: u, dmg: P, crit: false, kind: 'spell', speed: 480 + j * 30, color: col }); }
            break;
          }
          const cells = cellsOf();
          tiles(cb, cells, col);
          let dealt = 0;
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) dealt += applySkillHit(cb, u, v, P, d); }
          if (d.drain && dealt) cb.heal(u, dealt * d.drain);
          if (d.mode === 'line' && cells.length) { const last = grid.cells[cells[cells.length - 1]]; cb.beam(u.px, u.py, last.x, last.y, col, 0.3); }
          break;
        }
        case 'lightrain': {
          const cells = cellsOf();
          tiles(cb, cells, '#f5c400');
          for (const i of cells) { const v = cb.occ[i]; if (!v || v.dead) continue; if (v.side === foe) applySkillHit(cb, u, v, P, d); else if (!v.object) cb.heal(v, P * 0.6 * Hm); }
          break;
        }
        case 'tele':
          cb.tele.push({ cells: cellsOf(), t: 0, delay: d.delay || 1.2, dmg: P, side: foe, src: u, color: col, burn: d.burn });
          break;
        case 'heal': {
          if (d.mode === 'lowestAlly') {
            const a = lowestAlly(cb, u.side);
            if (a) { tiles(cb, [a.cell], '#2e9e6b'); if (u.range > 1) cb.beam(u.px, u.py, a.px, a.py, '#7dffa0', 0.3); cb.heal(a, P * Hm); if (d.cleanse) cleanse(a); cb.ring(a.px, a.py, '#7dffa0', 24); }
            break;
          }
          const cells = cellsOf();
          tiles(cb, cells, '#2e9e6b');
          for (const a of allies(cells)) { cb.heal(a, P * Hm); if (d.cleanse) cleanse(a); }
          break;
        }
        case 'shield': {
          const list = d.mode === 'all' ? cb.alive(u.side).filter((x) => !x.object) : allies(cellsOf());
          if (d.mode !== 'all') tiles(cb, cellsOf(), '#6aa8ff');
          for (const a of list) { a.shield += P * Hm; if (d.heal) cb.heal(a, d.heal * Hm); if (d.cleanse) cleanse(a); cb.ring(a.px, a.py, '#9fd0ff', 22); }
          break;
        }
        case 'taunt': {
          const cells = cellsOf();
          tiles(cb, cells, '#f5c400');
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) { v.forced = u; v.forcedT = 3; } }
          u.shield += P;
          cb.ring(u.px, u.py, '#f5c400', 40, 0.6);
          break;
        }
        case 'parry': u.shield += P * Hm; u.st.parry = 4; cb.ring(u.px, u.py, '#c3cbd6', 30); break;
        case 'fortify': u.st.fort = 5; cb.heal(u, P * Hm); cb.ring(u.px, u.py, '#9aa3b2', 30); break;
        case 'buff': {
          const a = cb.alive(u.side).filter((x) => !x.object).sort((x, y) => y.atk - x.atk)[0];
          if (a) { a.atk *= 1.3 + 0.1 * ((s.star || 1) - 1); a.as *= 1.2; cb.ring(a.px, a.py, '#f5c400', 26, 0.6); cb.float(a.px, a.py - 22, '축복', '#f5c400'); }
          break;
        }
        case 'haste': case 'timewarp': {
          const list = d.mode === 'all' ? cb.alive(u.side).filter((x) => !x.object) : allies(cellsOf());
          if (d.mode !== 'all') tiles(cb, cellsOf(), '#f5c400');
          const amt = (d.amt || 1.25) + 0.08 * ((s.star || 1) - 1);
          for (const a of list) { (a.st.haste = a.st.haste || []).push({ t: d.dur || 6, amt }); cb.ring(a.px, a.py, '#f5c400', 18); }
          if (d.effect === 'timewarp') for (const v of cb.alive(foe)) { addStatus(cb, v, 'slow', 3 + (s.star - 1), u); cb.ring(v.px, v.py, '#6aa8ff', 18); }
          break;
        }
        case 'debuff': {
          const cells = cellsOf();
          tiles(cb, cells, '#8a7a9a');
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) addStatus(cb, v, 'weak', (d.weak || 4) + ((s.star || 1) - 1), u); }
          break;
        }
        case 'mana': {
          const cells = cellsOf();
          tiles(cb, cells, '#6ab0e8');
          for (const a of allies(cells)) if (a !== u && a.ability) a.mana = Math.min(a.maxMana, a.mana + (d.power || 30) * k);
          break;
        }
        case 'revive': {
          const dead = cb.units.find((v) => v.dead && v.side === u.side && !v.revived && !v.summon && !v.object);
          if (!dead) { cb.heal(u, 150 * Hm); break; }
          const cell = freeNear(cb, dead.cell);
          if (cell === undefined) break;
          dead.dead = false; dead.revived = true; dead.hp = Math.round(dead.maxHp * Math.min(0.9, 0.5 + 0.15 * ((s.star || 1) - 1))); dead.mana = 0; dead.moving = null; dead.st = {};
          dead.cell = cell; cb.occ[cell] = dead; dead.px = grid.cells[cell].x; dead.py = grid.cells[cell].y; dead.popT = 0.35;
          cb.ring(dead.px, dead.py, '#fff2b0', 34, 0.8);
          cb.float(dead.px, dead.py - 28, '테이프로 붙였다!', '#c48a00', true);
          break;
        }
        case 'heavy':
          tiles(cb, [t.cell], col);
          cb.damage(u, t, u.atk * d.power * k * scale, 'spell');
          break;
      }
    }

    // ---------- 보스 패턴 ----------
    function telegraph(cb, b, cells, delay, dmg, color = '#e8436b', extra) {
      cells = cells.filter((i) => i >= 0);
      if (cells.length) { cb.tele.push(Object.assign({ cells, t: 0, delay, dmg: dmg * foeMul(b.def).atk, side: 0, src: b, color }, extra || {})); fx.play('warn', 0.3); }
    }
    function summonFoe(cb, id, n, rows, scale = 0.6) {
      for (let j = 0; j < n; j++) {
        const free = grid.cells.filter((c) => rows.includes(c.r) && !cb.occ[c.i]);
        if (!free.length) return;
        const e = makeFoe({ def: MONSTERS[id], cell: AC.pick(free).i, scale });
        e.atk *= 0.8; e.summon = true; e.popT = 0.35;
        if (cb.spawn(e)) cb.ring(e.px, e.py, '#e8436b', 26, 0.6);
      }
    }
    function bossTick(cb, b, dt) {
      const s = b.script, f = s.flags;
      s.a -= dt; s.b -= dt; s.c -= dt;
      const foes = cb.alive(0).filter((x) => !x.object);
      if (!foes.length) return;
      const near = foes.slice().sort((x, y) => grid.dist(b.cell, x.cell) - grid.dist(b.cell, y.cell))[0];
      const ratio = b.hp / b.maxHp;
      const say = (t) => cb.float(b.px, b.py - 50, t, '#ffd0da', true);
      const enemyRows = [0, 1, 2].filter((r) => r < PLAYER_ROW);
      if (b.boss === 'gobking') {
        if (s.a <= 0) { s.a = 7; if (cb.alive(1).length < 5) { say('나와라, 녀석들!'); summonFoe(cb, 'goblin', 1, enemyRows); } }
        if (s.b <= 0) {
          s.b = 4.5;
          const dir = facing(b, near), cells = [];
          for (let k = 1; k <= 2; k++) for (let j = -1; j <= 1; j++) cells.push(rel(b.cell, k, j, dir));
          say('내려찍기'); telegraph(cb, b, cells, 1.3, 120);
        }
      } else if (b.boss === 'slimeking') {
        if (ratio < 0.66 && !f.s1) { f.s1 = true; say('말랑…!'); summonFoe(cb, 'slime', 2, enemyRows, 1.1); }
        if (ratio < 0.33 && !f.s2) { f.s2 = true; say('말랑말랑!'); summonFoe(cb, 'slime', 3, enemyRows, 1.1); }
        if (s.b <= 0) {
          s.b = 5;
          const tgt = AC.pick(foes), cells = [tgt.cell, ...grid.neighbors[tgt.cell]];
          say('점프!');
          telegraph(cb, b, cells, 1.4, 150, '#3f9a4f', { onDone: () => { if (b.dead) return; const spot = freeNear(cb, tgt.cell); if (spot !== undefined) { cb.teleport(b, spot); b.popT = 0.35; } } });
        }
      } else if (b.boss === 'lich') {
        if (s.a <= 0) {
          s.a = 5;
          const targets = AC.shuffle(foes.slice()).slice(0, 2).map((v) => v.cell);
          const extra = AC.shuffle(grid.cells.filter((c) => c.r >= PLAYER_ROW && !targets.includes(c.i))).slice(0, 2).map((c) => c.i);
          say('죽음의 저주'); telegraph(cb, b, [...targets, ...extra], 1.5, 110, '#7a4fd0');
        }
        if (s.b <= 0) { s.b = 12; if (cb.alive(1).length < 4) { say('일어나라…'); summonFoe(cb, 'skel', 1, enemyRows); } }
      } else if (b.boss === 'vampire') {
        if (s.a <= 0) {
          s.a = 6;
          say('피의 만찬');
          let total = 0;
          for (const v of foes) { cb.beam(v.px, v.py, b.px, b.py, '#a8323b', 0.5); total += cb.damage(b, v, 55 * foeMul(b.def).atk, 'spell'); }
          cb.heal(b, total * 0.6);
          fx.shake(4);
        }
        if (ratio < 0.5 && !f.bats) { f.bats = true; say('박쥐들아!'); summonFoe(cb, 'bat', 3, enemyRows, 0.8); b.as *= 1.25; }
      } else if (b.boss === 'dragon') {
        if (ratio < 0.7 && !f.w1) { f.w1 = true; say('새끼들아!'); summonFoe(cb, 'whelp', 1, enemyRows); }
        if (ratio <= 0.5 && !f.rage) {
          f.rage = true; b.atk *= 1.3; b.armor = 0.15;
          say('분노!'); cb.ring(b.px, b.py, '#ff4d6d', 90, 1); fx.shake(10);
          env.phase('2페이즈 · 분노');
        }
        if (ratio < 0.35 && !f.w2) { f.w2 = true; summonFoe(cb, 'whelp', 1, enemyRows); }
        if (s.a <= 0) {
          s.a = f.rage ? 5.5 : 7;
          const col = grid.cells[near.cell].c, cells = [];
          for (let r = grid.cells[b.cell].r + 1; r < ROWS; r++) for (let c = col - 1; c <= col + 1; c++) cells.push(grid.idx(c, r));
          say('화염 브레스'); telegraph(cb, b, cells, 1.6, 180, '#e8643b', { burn: { dps: 30, dur: 3 } });
        }
        if (s.b <= 0) { s.b = 6; if (foes.some((v) => grid.dist(v.cell, b.cell) <= 1)) { say('꼬리 휩쓸기'); telegraph(cb, b, grid.neighbors[b.cell], 1.0, 150); } }
        if (f.rage && s.c <= 0) {
          s.c = 6; say('운석 낙하');
          for (let k = 0; k < 2; k++) { const c0 = AC.randi(0, COLS - 2), r0 = AC.randi(PLAYER_ROW, ROWS - 2); telegraph(cb, b, [grid.idx(c0, r0), grid.idx(c0 + 1, r0), grid.idx(c0, r0 + 1), grid.idx(c0 + 1, r0 + 1)], 1.5, 160, '#e8643b'); }
        }
      }
    }

    // ---------- 전투 시작 ----------
    function onStart(cb) {
      cb.tele = cb.tele || [];
      cb.goldBonus = 0;
      for (const u of cb.units.slice()) {
        if (u.side !== 0 || u.dead || u.summon) continue;
        const p = u.passive;
        if (p === 'startShield') u.shield += 220 * u.healMult;
        if (p === 'hawk' || u.ifx === 'hawkFocus') {
          const cell = grid.neighbors[u.cell].find((n) => !cb.occ[n]);
          if (cell !== undefined) cb.spawn(makeSummon('hawk', cell, 0, u));
        }
        if (u.ifx === 'infiltrate') {
          const far = cb.alive(1).sort((a, c) => grid.dist(u.cell, c.cell) - grid.dist(u.cell, a.cell))[0];
          if (far) leapTo(cb, u, far);
        }
        if (u.ifx === 'markAura') for (const n of grid.neighbors[u.cell]) { const a = cb.occ[n]; if (a && a.side === 0 && !a.object) { a.as *= 1 + 0.15 * u.ifxK; } }
        if (p === 'starMark') { const v = AC.pick(cb.alive(1)); if (v) { addStatus(cb, v, 'vuln', { dur: 8, amt: 0.3 }, u); cb.ring(v.px, v.py, '#7a4fd0', 26, 0.8); cb.float(v.px, v.py - 30, '별의 표식', '#e2d0ff'); } }
        if (u.ifx === 'towerGuard') u.tauntT = 0;
      }
      if (has('snowglobe')) for (const v of cb.alive(1)) addStatus(cb, v, 'slow', 3);
    }

    // ---------- 훅 ----------
    function hooks() {
      return {
        playerShot: '#2f6fd6', enemyShot: '#e8436b',
        onStart,
        // 성서: 다친 아군이 있으면 기본 공격 대신 치유
        preAttack: (u, t, cb) => {
          if (u.ifx !== 'healer') return false;
          const a = lowestAlly(cb, u.side, true);
          if (!a || a.hp / a.maxHp > 0.92) return false;
          u.mana = Math.min(u.maxMana, u.mana + (u.manaPerHit || 10));
          cb.beam(u.px, u.py, a.px, a.py, '#7dffa0', 0.25);
          cb.heal(a, u.atk * 1.4 * u.healMult * u.ifxK);
          return true;
        },
        onCast: (u, t, cb) => {
          const s = u.skills[u.skillIdx];
          u.skillIdx = (u.skillIdx + 1) % u.skills.length;
          u.maxMana = u.side ? u.maxMana : skillMana(u.skills[u.skillIdx]);
          execSkill(cb, u, t, s);
          if (u.side === 0) {
            if (u.passive === 'scholar') u.mana = Math.min(u.maxMana, 15);
            if (u.ifx === 'hourglass') for (const n of grid.neighbors[u.cell]) { const a = cb.occ[n]; if (a && a.side === 0 && a.ability) { a.mana = Math.min(a.maxMana, a.mana + 25 * u.ifxK); cb.ring(a.px, a.py, '#6ab0e8', 16); } }
            if (u.ifx === 'echo') { u.casts = (u.casts || 0) + 1; if (u.casts % 2 === 0) { const tt = t.dead ? cb.nearestEnemy(u) : t; if (tt) { cb.float(u.px, u.py - 54, '메아리!', '#e2d0ff', true); execSkill(cb, u, tt, s, 0.7); } } }
          }
          const ef = s.def.effect;
          fx.play(['heal', 'shield', 'buff', 'haste', 'timewarp', 'revive', 'mana', 'fortify', 'parry'].includes(ef) ? 'heal' : s.def.cls === 'mag' || ef === 'tele' ? 'magic' : 'skill', 0.08);
          fx.burst(u.px, u.py, u.side ? '#e8436b' : clsCol(s.def.cls), 6);
          return true;
        },
        asMod: (u, cb) => {
          let m = 1;
          if (u.st.slow > 0) m *= 0.6;
          if (u.st.haste) for (const h of u.st.haste) m *= h.amt;
          if (u.ifx === 'bloodrage' && u.hp / u.maxHp <= 0.5) m *= 1 + 0.4 * Math.min(1.6, u.ifxK);
          if (u.side === 0 && has('drum') && cb.t < 4) m *= 1.4;
          return m;
        },
        dmgDealtMod: (src, t, kind, cb) => {
          let m = 1;
          if (src.st && src.st.weak > 0) m *= 0.7;
          if ((src.passive === 'focus' || src.ifx === 'hawkFocus') && kind === 'atk') m *= 1 + 0.08 * (src.focusN || 0);
          return m;
        },
        dmgTakenMod: (t, cb, src, kind) => {
          let m = 1;
          if (src && src.pierce && kind === 'atk' && t.armor > 0) m /= 1 - t.armor;
          if (t.st.vuln && t.st.vuln.t > 0) m *= 1 + t.st.vuln.amt;
          if (t.st.fort > 0) m *= 0.6;
          if (t.side === 0) for (const n of grid.neighbors[t.cell]) { const w = cb.occ[n]; if (w && w.side === 0 && w.passive === 'guardAura') { m *= 0.9; break; } }
          return m;
        },
        floatColor: (kind) => ({ burn: '#ffb347', poison: '#a8f08a', bleed: '#ff8a8a', thorns: '#e0c49a', splash: '#fffdf7' })[kind] || null,
        onAttack: (u, t, cb) => {
          if (u.range > 1) fx.play('shoot', 0.06);
          if (u.firstStrike) { u.firstStrike = false; u.crit = u.crit0; }
          if (u.passive === 'focus' || u.ifx === 'hawkFocus') { u.focusN = u.lastT === t ? Math.min(5, (u.focusN || 0) + 1) : 0; u.lastT = t; }
          if (u.side !== 0) return;
          u.atkN = (u.atkN || 0) + 1;
          if (u.ifx === 'healMace') { const a = lowestAlly(cb, 0, true); if (a) cb.heal(a, u.atk * 0.6 * u.healMult * u.ifxK); }
          if (u.ifx === 'quiverHeal' && u.atkN % 3 === 0) { const a = lowestAlly(cb, 0, true); if (a) { cb.beam(u.px, u.py, a.px, a.py, '#7dffa0', 0.3); cb.heal(a, u.atk * 2.5 * u.healMult * u.ifxK); } }
          if (u.passive === 'pierce4' && u.atkN % 4 === 0) {
            const dir = facing(u, t), cells = [];
            for (let f = 1; f < 10; f++) { const i = rel(u.cell, f, 0, dir); if (i < 0) break; cells.push(i); }
            tiles(cb, cells, '#2e9e6b', 0.3);
            if (cells.length) { const last = grid.cells[cells[cells.length - 1]]; cb.beam(u.px, u.py, last.x, last.y, '#2e9e6b', 0.3); }
            for (const i of cells) { const v = cb.occ[i]; if (v && v.side === 1) cb.damage(u, v, u.atk * 1.5, 'spell'); }
          }
        },
        onDodge: () => {},
        onHit: (t, dmg, src, kind, crit, cb) => {
          t.hitT = 0.22;
          if (kind === 'atk' || kind === 'spell' || kind === 'splash') {
            fx.play(crit ? 'crit' : 'hit', 0.04);
            fx.burst(t.px, t.py, src && !src.side ? clsCol(src.cls) : '#e8436b', crit ? 7 : 3);
            if (dmg >= 300) fx.shake(3);
          }
          if (t.ifx === 'towerGuard' && t.side === 0 && dmg > 0) for (const n of grid.neighbors[t.cell]) { const a = cb.occ[n]; if (a && a.side === 0 && !a.object) a.shield += dmg * 0.2 * t.ifxK; }
          if (!src || src.dead === undefined) return;
          if (kind === 'atk') {
            const pr = src.procs || new Set();
            if (pr.has('burnHit')) addStatus(cb, t, 'burn', { dps: 25, dur: 3 }, src);
            if (pr.has('poisonHit')) addStatus(cb, t, 'poison', { dps: 30 * (src.ifx === 'poisonHit' ? src.ifxK : 1), dur: 3 }, src);
            if (pr.has('cleaveHit')) for (const n of grid.neighbors[t.cell]) { const v = cb.occ[n]; if (v && v.side !== src.side && v !== t) cb.damage(src, v, dmg * 0.35, 'splash'); }
            if (src.ifx === 'markAura') addStatus(cb, t, 'vuln', { dur: 3, amt: 0.15 * Math.min(2, src.ifxK) }, src);
            if (src.passive === 'execute20' && !t.dead && !t.boss && t.hp / t.maxHp <= 0.2) { cb.float(t.px, t.py - 30, '처형!', '#f5c400', true); cb.kill(t, src); }
            const th = (t.thorns || 0) + (t.st && t.st.parry > 0 ? 0.4 : 0);
            if (th > 0 && src.range <= 1 && !src.dead) cb.damage(t, src, dmg * th, 'thorns');
          }
          if (kind === 'spell') {
            const pr = src.procs || new Set();
            if (pr.has('spellBurn')) addStatus(cb, t, 'burn', { dps: 30 * src.ifxK, dur: 3 }, src);
            if (pr.has('spellSlow')) addStatus(cb, t, 'slow', 2 * Math.min(1.6, src.ifxK), src);
          }
        },
        onHeal: () => fx.play('heal', 0.15),
        onTick: (cb, dt) => {
          for (const u of cb.units) {
            if (u.dead) continue;
            const st = u.st;
            for (const k of ['slow', 'weak', 'fort', 'parry']) if (st[k] > 0) st[k] -= dt;
            if (st.vuln) { st.vuln.t -= dt; if (st.vuln.t <= 0) delete st.vuln; }
            if (st.haste) st.haste = st.haste.filter((h) => (h.t -= dt) > 0);
            if (u.forcedT > 0 && (!u.forced || u.forced.dead)) u.forcedT = 0;
            if (u.ifx === 'towerGuard') {
              u.tauntT -= dt;
              if (u.tauntT <= 0) { u.tauntT = 4; let n = 0; for (const v of cb.alive(1)) if (grid.dist(v.cell, u.cell) <= 2 && !v.boss) { v.forced = u; v.forcedT = 3; n++; } if (n) cb.ring(u.px, u.py, '#f5c400', 40, 0.6); }
            }
            if (u.passive === 'dragonBreath' && !u.breathed && u.hp / u.maxHp <= 0.5) {
              u.breathed = true;
              const t = u.target && !u.target.dead ? u.target : cb.nearestEnemy(u), dir = facing(u, t);
              const cells = [[1, 0], [1, -1], [1, 1], [2, 0], [2, -1], [2, 1]].map(([f, s]) => rel(u.cell, f, s, dir)).filter((i) => i >= 0);
              tiles(cb, cells, '#e8643b', 0.6);
              cb.float(u.px, u.py - 40, '화염 숨결', '#ffd36b', true);
              for (const i of cells) { const v = cb.occ[i]; if (v && v.side === 1) { cb.damage(u, v, u.atk * 3, 'spell'); addStatus(cb, v, 'burn', { dps: 40, dur: 4 }, u); } }
              fx.shake(5);
            }
            u.dotT -= dt;
            if (u.dotT <= 0) {
              u.dotT += 0.5;
              for (const key of ['burn', 'poison', 'bleed']) {
                const s = st[key];
                if (!s) continue;
                s.t -= 0.5;
                const mult = key === 'poison' ? s.stacks : key === 'bleed' && u.moving ? 2 : 1;
                if (!u.dead) cb.damage(s.src && !s.src.dead ? s.src : null, u, s.dps * 0.5 * mult, key);
                if (s.t <= 0) delete st[key];
              }
              if (u.dead) continue;
              if (u.passive === 'healAura') for (const a of cb.units) if (!a.dead && a.side === u.side && !a.object && grid.dist(a.cell, u.cell) <= 1) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.005 * u.healMult);
            }
          }
          for (const tl of cb.tele) {
            tl.t += dt;
            if (tl.t >= tl.delay && !tl.done) {
              tl.done = true;
              tiles(cb, tl.cells, tl.color, 0.5);
              fx.play('boom', 0.1);
              fx.shake(tl.dmg >= 200 ? 8 : 5);
              for (const i of tl.cells) {
                fx.burst(grid.cells[i].x, grid.cells[i].y, tl.color, 2);
                const v = cb.occ[i];
                if (v && v.side === tl.side && !v.dead) { cb.damage(tl.src && !tl.src.dead ? tl.src : null, v, tl.dmg, 'spell'); if (tl.burn) addStatus(cb, v, 'burn', tl.burn, tl.src); }
              }
              if (tl.onDone) tl.onDone();
            }
          }
          cb.tele = cb.tele.filter((tl) => !tl.done);
          for (const bs of cb.units) if (bs.boss && !bs.dead) bossTick(cb, bs, dt);
        },
        onDeath: (t, src, cb) => {
          fx.death(t);
          if (t.side === 1 && src && src.side === 0) {
            if (src.passive === 'bounty' && (cb.bountyN || 0) < 2) { cb.bountyN = (cb.bountyN || 0) + 1; cb.goldBonus += 1; cb.float(t.px, t.py - 34, '+1골드', '#f5c400', true); }
            if (src.passive === 'killHeal') cb.heal(src, src.maxHp * 0.1);
          }
          if (t.boss) { for (const v of cb.alive(1)) cb.kill(v, null); cb.tele = []; }
        },
      };
    }

    return { facing, rel, skillCells, synergyCounts, makeAlly, makeFoe, makeSummon, hooks, loadoutOf, wpArt, unitStats, foePreview: foeMul };
  }

  global.BT4 = { create, unitStats, expandCells, STAR, SKSTAR, ITSTAR };
})(window);
