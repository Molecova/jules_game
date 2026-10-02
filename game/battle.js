/* 카드 원정대 — 전투 규칙
 * 유닛·몬스터 전투 개체 만들기(레벨·무기·시너지·유물·난이도), 상태이상, 고유 능력, 무기 효과,
 * 스킬 실행(격자 패턴), 전술 카드 효과, 보스 패턴. 화면/소리는 env.fx 로 위임한다.
 */
(function (global) {
  'use strict';
  const { CLASSES, SYNERGY, byKind, MONSTERS, ACTS, DIFFICULTY } = global.GD;
  const AROUND8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  const LEVEL_MULT = (lvl) => 1 + 0.18 * ((lvl || 1) - 1);
  const XP_TABLE = [0, 0, 4, 10, 18, 28]; // 레벨 n 이 되기 위한 누적 경험치
  const MAX_LEVEL = 5;
  const upMul = (w, v) => (w.up ? v * 1.5 : v);

  /** 장비를 반영한 유닛 능력치(시너지·유물 제외) — 화면 표시와 전투 생성에 함께 쓴다 */
  function unitStats(u) {
    const d = byKind.unit[u.id], m = LEVEL_MULT(u.level);
    const s = { hp: d.hp * m, atk: d.atk * m, as: d.as, range: d.range, armor: d.armor || 0, crit: d.crit || 0.05, critDmg: 1.75, dodge: d.dodge || 0,
      lifesteal: d.lifesteal || 0, spell: 1, heal: 1, mana: d.startMana || 0, manaPerHit: d.manaPerHit || 12, thorns: 0, regen: 0, procs: [] };
    const wp = u.weapon ? byKind.weapon[u.weapon.id] : null;
    if (wp) {
      const w = { up: u.weapon.up }, st = wp.stats;
      if (st.atk) s.atk *= 1 + upMul(w, st.atk);
      if (st.as) s.as *= 1 + upMul(w, st.as);
      if (st.hp) s.hp *= 1 + upMul(w, st.hp);
      if (st.armor) s.armor += upMul(w, st.armor);
      if (st.range) s.range += st.range;
      if (st.crit) s.crit += upMul(w, st.crit);
      if (st.critDmg) s.critDmg += upMul(w, st.critDmg);
      if (st.dodge) s.dodge += upMul(w, st.dodge);
      if (st.lifesteal) s.lifesteal += upMul(w, st.lifesteal);
      if (st.spell) s.spell *= 1 + upMul(w, st.spell);
      if (st.heal) s.heal *= 1 + upMul(w, st.heal);
      if (st.mana) s.mana += upMul(w, st.mana);
      if (st.manaPerHit) s.manaPerHit += upMul(w, st.manaPerHit);
      if (st.thorns) s.thorns += upMul(w, st.thorns);
      if (st.regen) s.regen += upMul(w, st.regen);
      if (st.proc) s.procs.push(st.proc);
    }
    s.hp = Math.round(s.hp);
    return s;
  }

  function create(env) {
    const { grid, PLAYER_ROW, COLS, ROWS } = env;
    const fx = env.fx;
    const R = () => env.getR();
    const B = () => env.getB();
    const has = (r) => R().has(r);

    // ---------- 격자 도우미 ----------
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
    function skillCells(u, t, d, dir) {
      let cells = [];
      switch (d.mode) {
        case 'facing': cells = d.cells.map(([f, s]) => rel(u.cell, f, s, dir)); break;
        case 'targetFacing': cells = d.cells.map(([f, s]) => rel(t.cell, f, s, dir)); break;
        case 'self': cells = d.cells.map(([x, y]) => abs(u.cell, x, y)); break;
        case 'target': cells = d.cells.map(([x, y]) => abs(t.cell, x, y)); break;
        case 'line': for (let f = 1; f < 12; f++) { const i = rel(u.cell, f, 0, dir); if (i < 0) break; cells.push(i); } break;
        case 'selfOnly': cells = [u.cell]; break;
        case 'single': cells = [t.cell]; break;
      }
      return cells.filter((i) => i >= 0);
    }
    const tiles = (cb, cells, color, life = 0.45) => { for (const i of cells) cb.fx.push({ kind: 'tile', cell: i, color, life, t: 0 }); };
    const freeNear = (cb, cell) => [cell, ...grid.neighbors[cell]].find((n) => !cb.occ[n]);

    // ---------- 시너지 ----------
    function synergyCounts(units) {
      const seen = new Set(), counts = {};
      for (const u of units) {
        const d = byKind.unit[u.id];
        if (!d || seen.has(d.id)) continue;
        seen.add(d.id);
        counts[d.cls] = (counts[d.cls] || 0) + 1;
      }
      const tiers = {};
      for (const k in counts) tiers[k] = SYNERGY[k] ? SYNERGY[k].th.filter((t) => counts[k] >= t).length : 0;
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
    function setupSkills(e, mana) {
      if (e.skills.length) {
        e.ability = { type: 'skill' };
        e.skillIdx = 0;
        e.maxMana = skillMana(e.skills[0]);
        e.mana = Math.min(e.maxMana - 1, mana);
      } else { e.ability = null; e.maxMana = 0; e.mana = 0; }
    }
    const skillMana = (s) => (s.mana || s.def.mana) - (s.up ? 10 : 0);

    function loadoutOf(u) {
      return {
        level: u.level,
        weapon: u.weapon ? Object.assign({}, byKind.weapon[u.weapon.id], { up: u.weapon.up }) : null,
        skills: u.skills.map((s) => { const d = byKind.skill[s.id]; return { col: CLASSES[d.cls].color, icon: d.icon, up: s.up }; }),
      };
    }

    function makeAlly(u, cell, syn) {
      const d = byKind.unit[u.id], s = unitStats(u), t = syn.tiers;
      const e = baseEntity(s, 0, cell, {
        def: d, unit: u, uidRef: u.uid, cls: d.cls, artId: d.id, passive: d.passive, level: u.level, lo: loadoutOf(u), rot: u.rot,
        dodge: s.dodge, lifesteal: s.lifesteal, critDmg: s.critDmg, spell: s.spell, healMult: s.heal, manaPerHit: s.manaPerHit,
        thorns: s.thorns, regen: s.regen, procs: new Set(s.procs), pow: LEVEL_MULT(u.level),
        skills: u.skills.map((x) => ({ def: byKind.skill[x.id], up: x.up })),
      });
      let mana = s.mana;
      // 고유 능력
      const p = d.passive;
      if (p === 'poisonHit') e.procs.add('poisonHit');
      if (p === 'burnHit') e.procs.add('burnHit');
      if (p === 'chillHit') e.procs.add('chillHit');
      if (p === 'stunHit') { e.procs.add('stunHit'); e.stunChance = 0.15; }
      if (p === 'pierceArmor') e.pierce = true;
      if (p === 'quickMind') e.manaPerHit *= 1.5;
      if (p === 'blessedHands') e.healMult *= 1.3;
      if (p === 'undying') e.undying = true;
      if (s.procs.includes('stunHit')) e.stunChance = Math.max(e.stunChance || 0, 0.12);
      // 시너지
      if (t.sword && d.cls === 'sword') e.atk *= t.sword >= 2 ? 1.35 : 1.15;
      if (t.sword >= 2 && d.cls === 'sword') e.killMana = 30;
      if (t.guard && d.cls === 'guard') e.armor += 0.15;
      if (t.guard >= 2) { e.armor += 0.1; if (d.cls === 'guard') e.shield += 300; }
      if (t.bow && d.cls === 'bow') { e.as *= t.bow >= 2 ? 1.4 : 1.2; if (t.bow >= 2) e.range += 1; }
      if (t.mage) { e.spell *= t.mage >= 2 ? 1.45 : 1.2; if (t.mage >= 2) mana += 20; }
      if (t.holy) { e.healMult *= t.holy >= 2 ? 1.5 : 1.25; if (t.holy >= 2) e.maxHp *= 1.1; }
      if (t.rogue && d.cls === 'rogue') { e.crit += t.rogue >= 2 ? 0.3 : 0.15; if (t.rogue >= 2) e.critDmg = Math.max(e.critDmg, 2.2); }
      // 유물
      if (d.cls === 'sword' && has('whetstone')) e.atk *= 1.2;
      if (d.cls === 'guard' && has('shieldoil')) e.armor += 0.12;
      if (d.cls === 'bow' && has('feather')) e.as *= 1.2;
      if (d.cls === 'mage' && has('prism')) mana = Math.max(mana, 30);
      if (d.cls === 'holy' && has('holywater')) e.healMult *= 1.25;
      if (d.cls === 'rogue' && has('nightshade')) e.crit += 0.1;
      if (has('banner')) e.maxHp *= 1.1;
      if (has('pauldron')) e.armor += 0.08;
      if (has('thornmail')) e.thorns += 0.1;
      if (has('horn')) mana += 20;
      if (has('tome')) mana = Math.max(mana, 25);
      e.armor = Math.min(0.7, e.armor);
      e.maxHp = Math.round(e.maxHp); e.hp = e.maxHp;
      if (p === 'firstStrike') { e.crit0 = e.crit; e.crit = 1; e.firstStrike = true; }
      setupSkills(e, mana);
      return e;
    }
    function foeScale() { return DIFFICULTY[R().difficulty || 'normal'].foe; }
    // 막·적 종류별 강화 배율 (원정대가 레벨·장비·시너지로 강해지는 만큼 적도 강해진다)
    function actMul(d) {
      const A = ACTS[R().act], t = global.__tune || {};
      const role = d.boss ? 'boss' : d.elite ? 'elite' : 'normal';
      const hp = (t.hp || A.foeHp) * (t[role + 'Hp'] || A[role + 'Hp'] || 1);
      const atk = (t.atk || A.foeAtk) * (t[role + 'Atk'] || A[role + 'Atk'] || 1);
      return { hp, atk };
    }
    function makeFoe(x) {
      const d = x.def, k = (x.scale || 1) * (d.summon || d.object ? 1 : foeScale()), am = d.object ? { hp: 1, atk: 1 } : actMul(d);
      const e = baseEntity({ hp: d.hp * k * am.hp, atk: d.atk * k * am.atk, as: d.as, range: d.range, armor: d.armor || 0, crit: 0.05 }, 1, x.cell, {
        def: d, uidRef: x.uid, artId: d.id, cls: monsterCls(d), rot: x.rot, dodge: d.dodge || 0, lifesteal: d.lifesteal || 0,
        skills: d.skills.map((id) => ({ def: byKind.skill[id], up: false, mana: d.mana })), pmult: ACTS[R().act].pmult * k, pow: ACTS[R().act].pmult * k,
        immobile: !!d.immobile, boss: d.boss || null, big: !!d.boss, elite: !!d.elite, manaPerHit: 10, v: d.v, procs: new Set(d.proc ? [d.proc] : []),
        healMult: 1, thorns: 0, regen: 0, critDmg: 1.75,
      });
      setupSkills(e, 0);
      if (e.boss) e.script = { a: 3, b: 2, c: 4, flags: {} };
      return e;
    }
    // 아군 측 소환물·설치물
    function makeSummon(id, cell, side, owner) {
      const d = MONSTERS[id];
      const k = owner ? (owner.pow || 1) * (has('whistle') && side === 0 ? 1.5 : 1) : 1;
      const e = baseEntity({ hp: d.hp * (d.object ? 1 : k), atk: d.atk * k, as: d.as, range: d.range, armor: d.armor || 0, crit: 0.05 }, side, cell, {
        def: d, artId: d.id, cls: 'melee', summon: true, object: !!d.object, immobile: !!d.object, skills: [], procs: new Set(), healMult: 1, thorns: 0, regen: 0, critDmg: 1.75, pow: k,
      });
      setupSkills(e, 0);
      e.popT = 0.35;
      return e;
    }
    function monsterCls(d) {
      if (['whelp', 'dragon', 'imp', 'salam', 'magmagolem'].includes(d.id)) return 'fire';
      if (d.skills.some((id) => byKind.skill[id] && byKind.skill[id].cls === 'mage')) return 'mage';
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
    function healAmt(src) { return (src && src.healMult) || 1; }

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
    function execSkill(cb, u, t, s) {
      const d = s.def, foe = 1 - u.side;
      const P = d.power * (u.side ? 1 : u.pow || 1) * (s.up ? 1.4 : 1) * u.spell * (u.side ? u.pmult : 1);
      const dir = facing(u, t);
      u.dir = dir;
      const col = u.side ? '#e8436b' : CLASSES[d.cls].color;
      cb.float(u.px, u.py - 38, d.name, u.side ? '#ffd0da' : '#fffdf7', true);
      const H = healAmt(u);
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
            for (let k = 0; k < 4 && cur; k++) {
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
            for (let k = 0; k < (d.count || 3); k++) { const v = ts[k % Math.max(1, ts.length)]; if (v) cb.projectiles.push({ x: u.px, y: u.py, tgt: v, src: u, dmg: P, crit: false, kind: 'spell', speed: 480 + k * 30, color: col }); }
            break;
          }
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, col);
          let dealt = 0;
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) dealt += applySkillHit(cb, u, v, P, d); }
          if (d.drain && dealt) cb.heal(u, dealt * d.drain);
          if (d.mode === 'line' && cells.length) { const last = grid.cells[cells[cells.length - 1]]; cb.beam(u.px, u.py, last.x, last.y, col, 0.3); }
          break;
        }
        case 'tele':
          cb.tele.push({ cells: skillCells(u, t, d, dir), t: 0, delay: d.delay || 1.2, dmg: P, side: foe, src: u, color: col, burn: d.burn });
          break;
        case 'heal': {
          if (d.mode === 'lowestAlly') {
            const a = cb.alive(u.side).filter((x) => !x.object).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
            if (a) { tiles(cb, [a.cell], '#2e9e6b'); cb.heal(a, P * H); if (d.cleanse) cleanse(a); cb.ring(a.px, a.py, '#7dffa0', 24); }
            break;
          }
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, '#2e9e6b');
          for (const a of allies(cells)) { cb.heal(a, P * H); if (d.cleanse) cleanse(a); }
          break;
        }
        case 'shield': {
          const list = d.mode === 'all' ? cb.alive(u.side).filter((x) => !x.object) : allies(skillCells(u, t, d, dir));
          if (d.mode !== 'all') tiles(cb, skillCells(u, t, d, dir), '#6aa8ff');
          for (const a of list) { a.shield += P * H; if (d.heal) cb.heal(a, d.heal * H); if (d.cleanse) cleanse(a); cb.ring(a.px, a.py, '#9fd0ff', 22); }
          break;
        }
        case 'taunt': {
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, '#f5c400');
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) { v.forced = u; v.forcedT = 3; } }
          u.shield += P;
          cb.ring(u.px, u.py, '#f5c400', 40, 0.6);
          break;
        }
        case 'parry': u.shield += P * H; u.st.parry = 4; cb.ring(u.px, u.py, '#c3cbd6', 30); break;
        case 'fortify': u.st.fort = 5; cb.heal(u, P * H); cb.ring(u.px, u.py, '#9aa3b2', 30); break;
        case 'buff': {
          const a = cb.alive(u.side).filter((x) => !x.object).sort((x, y) => y.atk - x.atk)[0];
          if (a) { a.atk *= s.up ? 1.4 : 1.3; a.as *= 1.2; cb.ring(a.px, a.py, '#f5c400', 26, 0.6); cb.float(a.px, a.py - 22, '축복', '#f5c400'); }
          break;
        }
        case 'haste': {
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, '#f5c400');
          for (const a of allies(cells)) { (a.st.haste = a.st.haste || []).push({ t: d.dur || 6, amt: (d.amt || 1.25) + (s.up ? 0.1 : 0) }); cb.ring(a.px, a.py, '#f5c400', 18); }
          break;
        }
        case 'debuff': {
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, '#8a7a9a');
          for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) addStatus(cb, v, 'weak', d.weak + (s.up ? 2 : 0), u); }
          break;
        }
        case 'mana': {
          const cells = skillCells(u, t, d, dir);
          tiles(cb, cells, '#6ab0e8');
          for (const a of allies(cells)) if (a !== u && a.ability) a.mana = Math.min(a.maxMana, a.mana + P * (s.up ? 1.4 : 1));
          break;
        }
        case 'revive': {
          const dead = cb.units.find((v) => v.dead && v.side === u.side && !v.revived && !v.summon && !v.object);
          if (!dead) { cb.heal(u, 150 * H); break; }
          const cell = freeNear(cb, dead.cell);
          if (cell === undefined) break;
          dead.dead = false; dead.revived = true; dead.hp = Math.round(dead.maxHp * (s.up ? 0.7 : d.power)); dead.mana = 0; dead.moving = null; dead.st = {};
          dead.cell = cell; cb.occ[cell] = dead; dead.px = grid.cells[cell].x; dead.py = grid.cells[cell].y; dead.popT = 0.35;
          cb.ring(dead.px, dead.py, '#fff2b0', 34, 0.8);
          cb.float(dead.px, dead.py - 28, '테이프로 붙였다!', '#c48a00', true);
          break;
        }
        case 'heavy':
          tiles(cb, [t.cell], col);
          cb.damage(u, t, u.atk * d.power * (s.up ? 1.4 : 1), 'spell');
          break;
      }
    }

    // ---------- 보스 패턴 ----------
    function telegraph(cb, b, cells, delay, dmg, color = '#e8436b', extra) {
      cells = cells.filter((i) => i >= 0);
      if (cells.length) { cb.tele.push(Object.assign({ cells, t: 0, delay, dmg: dmg * foeScale() * actMul(b.def).atk, side: 0, src: b, color }, extra || {})); fx.play('warn', 0.3); }
    }
    function summonFoe(cb, id, n, rows, scale = 0.6) {
      for (let k = 0; k < n; k++) {
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
      if (b.boss === 'gobking') {
        if (s.a <= 0) { s.a = 7; if (cb.alive(1).length < 5) { say('나와라, 녀석들!'); summonFoe(cb, 'goblin', 1, [0, 1, 2]); } }
        if (s.b <= 0) {
          s.b = 4.5;
          const dir = facing(b, near), cells = [];
          for (let k = 1; k <= 2; k++) for (let j = -1; j <= 1; j++) cells.push(rel(b.cell, k, j, dir));
          say('내려찍기'); telegraph(cb, b, cells, 1.3, 120);
        }
      } else if (b.boss === 'slimeking') {
        if (ratio < 0.66 && !f.s1) { f.s1 = true; say('말랑…!'); summonFoe(cb, 'slime', 2, [1, 2, 3], 1.1); }
        if (ratio < 0.33 && !f.s2) { f.s2 = true; say('말랑말랑!'); summonFoe(cb, 'slime', 3, [1, 2, 3], 1.1); }
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
        if (s.b <= 0) { s.b = 12; if (cb.alive(1).length < 4) { say('일어나라…'); summonFoe(cb, 'skel', 1, [1, 2, 3]); } }
      } else if (b.boss === 'vampire') {
        if (s.a <= 0) {
          s.a = 6;
          say('피의 만찬');
          let total = 0;
          for (const v of foes) { cb.beam(v.px, v.py, b.px, b.py, '#a8323b', 0.5); total += cb.damage(b, v, 55 * foeScale() * actMul(b.def).atk, 'spell'); }
          cb.heal(b, total * 0.6);
          fx.shake(4);
        }
        if (ratio < 0.5 && !f.bats) { f.bats = true; say('박쥐들아!'); summonFoe(cb, 'bat', 3, [1, 2, 3], 0.8); b.as *= 1.25; }
      } else if (b.boss === 'dragon') {
        if (ratio < 0.7 && !f.w1) { f.w1 = true; say('새끼들아!'); summonFoe(cb, 'whelp', 1, [1, 2, 3]); }
        if (ratio <= 0.5 && !f.rage) {
          f.rage = true; b.atk *= 1.3; b.armor = 0.15;
          say('분노!'); cb.ring(b.px, b.py, '#ff4d6d', 90, 1); fx.shake(10);
          B().phaseText = '2페이즈 · 분노';
        }
        if (ratio < 0.35 && !f.w2) { f.w2 = true; summonFoe(cb, 'whelp', 1, [1, 2, 3]); }
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

    // ---------- 전투 시작 처리: 고유 능력·전술 카드·유물 ----------
    function onStart(cb) {
      const b = B();
      cb.tele = cb.tele || [];
      for (const u of cb.units.slice()) {
        if (u.side !== 0 || u.dead) continue;
        const p = u.passive;
        if (p === 'startShield') u.shield += 220 * u.healMult;
        if (p === 'aegisAura') for (const n of [u.cell, ...grid.neighbors[u.cell]]) { const a = cb.occ[n]; if (a && a.side === 0 && !a.object) a.shield += 200 * u.healMult; }
        if (p === 'guardian') for (const v of cb.alive(1)) if (grid.dist(v.cell, u.cell) <= 2) { v.forced = u; v.forcedT = 4; }
        if (p === 'hawk' || p === 'golem') {
          const cell = grid.neighbors[u.cell].find((n) => !cb.occ[n]);
          if (cell !== undefined) cb.spawn(makeSummon(p === 'hawk' ? 'hawk' : 'stonegolem', cell, 0, u));
        }
        if (p === 'infiltrate') {
          const far = cb.alive(1).sort((a, c) => grid.dist(u.cell, c.cell) - grid.dist(u.cell, a.cell))[0];
          if (far) leapTo(cb, u, far);
        }
      }
      // 전술 카드
      const byUid = new Map(cb.units.filter((u) => u.uidRef).map((u) => [u.uidRef, u]));
      for (const t of b.tactics) {
        const id = t.card.id, tgt = t.target != null ? byUid.get(t.target) : null, cells3 = (c) => [c, ...grid.neighbors[c]];
        if (id === 'bandage' && tgt) tgt.shield += 300;
        else if (id === 'manapotion' && tgt && tgt.ability) tgt.mana = tgt.maxMana;
        else if (id === 'focus' && tgt) { tgt.atk *= 1.4; tgt.as *= 1.2; }
        else if (id === 'charge') b.chargeT = 6;
        else if (id === 'warcry') for (const a of cb.alive(0)) a.atk *= 1.15;
        else if (id === 'oath') for (const a of cb.alive(0)) if (!a.object) a.shield += 150;
        else if (id === 'holywater') for (const a of cb.alive(0)) a.st.regen = { t: 10, pct: 0.02 };
        else if (id === 'counter') for (const a of cb.alive(0)) a.thorns += 0.2;
        else if (id === 'voodoo' && tgt) addStatus(cb, tgt, 'vuln', { dur: 8, amt: 0.35 });
        else if (id === 'net' && tgt) tgt.stun = Math.max(tgt.stun, 3);
        else if (id === 'molotov') { const cs = [t.cell, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => abs(t.cell, x, y))].filter((i) => i >= 0); tiles(cb, cs, '#e8643b', 0.8); for (const i of cs) { const v = cb.occ[i]; if (v && v.side === 1) { cb.damage(null, v, 180, 'spell'); addStatus(cb, v, 'burn', { dps: 30, dur: 4 }); } } fx.play('boom'); }
        else if (id === 'caltrops') for (const i of cells3(t.cell)) { const v = cb.occ[i]; tiles(cb, [i], '#8a93a3', 0.8); if (v && v.side === 1) { addStatus(cb, v, 'slow', 6); addStatus(cb, v, 'bleed', { dps: 35, dur: 6 }); } }
        else if (id === 'poisoncloud') for (const i of cells3(t.cell)) { const v = cb.occ[i]; tiles(cb, [i], '#5fa043', 0.9); if (v && v.side === 1) addStatus(cb, v, 'poison', { dps: 45, dur: 8 }); }
        else if (id === 'bomb') cb.tele.push({ cells: cells3(t.cell), t: 0, delay: 1.5, dmg: 400, side: 1, src: null, color: '#2b2f3f' });
        else if (id === 'smokescreen') for (const i of cells3(t.cell)) { const a = cb.occ[i]; tiles(cb, [i], '#c9cfd8', 0.9); if (a && a.side === 0) a.st.dodgeUp = { t: 6, amt: 0.3 }; }
      }
      if (has('snowglobe')) for (const v of cb.alive(1)) addStatus(cb, v, 'slow', 3);
      if (has('drum')) b.drumT = 4;
    }

    // ---------- 훅 ----------
    function hooks() {
      const b = B();
      return {
        playerShot: '#2f6fd6', enemyShot: '#e8436b',
        onStart,
        onCast: (u, t, cb) => {
          const s = u.skills[u.skillIdx];
          u.skillIdx = (u.skillIdx + 1) % u.skills.length;
          u.maxMana = skillMana(u.skills[u.skillIdx]);
          execSkill(cb, u, t, s);
          const ef = s.def.effect;
          fx.play(['heal', 'shield', 'buff', 'haste', 'revive', 'mana', 'fortify', 'parry'].includes(ef) ? 'heal' : s.def.cls === 'mage' || ef === 'tele' ? 'magic' : 'skill', 0.08);
          fx.burst(u.px, u.py, u.side ? '#e8436b' : CLASSES[s.def.cls].color, 6);
          return true;
        },
        asMod: (u, cb) => {
          let m = 1;
          if (u.st.slow > 0) m *= 0.6;
          if (u.st.haste) for (const h of u.st.haste) m *= h.amt;
          if (u.passive === 'frenzy') m *= 1 + (1 - u.hp / u.maxHp);
          if (u.side === 0 && b.chargeT && cb.t < b.chargeT) m *= 1.25;
          if (u.side === 0 && b.drumT && cb.t < b.drumT) m *= 1.4;
          return m;
        },
        dmgDealtMod: (src, t, kind, cb) => {
          let m = 1;
          if (src.st && src.st.weak > 0) m *= 0.7;
          if (src.passive === 'execute' && t.hp / t.maxHp <= 0.3) m *= 1.5;
          if (src.passive === 'comrade' && kind === 'atk') m *= 1 + 0.06 * grid.neighbors[src.cell].filter((n) => cb.occ[n] && cb.occ[n].side === src.side && !cb.occ[n].object).length;
          if (src.passive === 'focus' && kind === 'atk') m *= 1 + 0.08 * (src.focusN || 0);
          return m;
        },
        dmgTakenMod: (t, cb, src, kind) => {
          let m = 1;
          if (src && src.pierce && kind === 'atk' && t.armor > 0) m /= 1 - t.armor;
          if (t.st.vuln && t.st.vuln.t > 0) m *= 1 + t.st.vuln.amt;
          if (t.st.fort > 0) m *= 0.6;
          if (t.passive === 'chivalry' && t.hp / t.maxHp <= 0.5) m *= 0.8;
          return m;
        },
        floatColor: (kind, crit) => ({ burn: '#ffb347', poison: '#a8f08a', bleed: '#ff8a8a', thorns: '#e0c49a', splash: '#fffdf7' })[kind] || null,
        onAttack: (u, t, cb) => {
          if (u.range > 1) fx.play('shoot', 0.06);
          if (u.firstStrike) { u.firstStrike = false; u.crit = u.crit0; }
          if (u.passive === 'focus') { u.focusN = u.lastT === t ? Math.min(5, (u.focusN || 0) + 1) : 0; u.lastT = t; }
          if (u.passive === 'cleave') {
            u.atkN = (u.atkN || 0) + 1;
            if (u.atkN % 3 === 0) {
              tiles(cb, grid.neighbors[t.cell], '#2f6fd6', 0.3);
              for (const n of grid.neighbors[t.cell]) { const v = cb.occ[n]; if (v && v.side !== u.side) cb.damage(u, v, u.atk * 0.6, 'splash'); }
            }
          }
        },
        onDodge: (t) => { if (t.passive === 'evasion' && t.ability) t.mana = Math.min(t.maxMana, t.mana + 15); },
        onHit: (t, dmg, src, kind, crit, cb) => {
          t.hitT = 0.22;
          if (kind === 'atk' || kind === 'spell' || kind === 'splash') {
            fx.play(crit ? 'crit' : 'hit', 0.04);
            fx.burst(t.px, t.py, src && !src.side ? (CLASSES[src.cls] ? CLASSES[src.cls].color : '#2f6fd6') : '#e8436b', crit ? 7 : 3);
            if (dmg >= 260) fx.shake(3);
          }
          if (!src || src.dead === undefined) return;
          if (kind === 'atk') {
            const pr = src.procs || new Set();
            if (pr.has('burnHit')) addStatus(cb, t, 'burn', { dps: 25, dur: 3 }, src);
            if (pr.has('poisonHit')) addStatus(cb, t, 'poison', { dps: 30, dur: 3 }, src);
            if (pr.has('chillHit') && Math.random() < 0.3) addStatus(cb, t, 'slow', 2, src);
            if (pr.has('stunHit') && Math.random() < (src.stunChance || 0.12)) { addStatus(cb, t, 'stun', 0.8, src); cb.float(t.px, t.py - 30, '강타!', '#f5c400'); }
            if (pr.has('cleaveHit')) for (const n of grid.neighbors[t.cell]) { const v = cb.occ[n]; if (v && v.side !== src.side && v !== t) cb.damage(src, v, dmg * 0.35, 'splash'); }
            const th = (t.thorns || 0) + (t.st.parry > 0 ? 0.4 : 0);
            if (th > 0 && src.range <= 1 && !src.dead) cb.damage(t, src, dmg * th, 'thorns');
          }
          if (kind === 'spell') {
            const pr = src.procs || new Set();
            if (pr.has('spellBurn')) addStatus(cb, t, 'burn', { dps: 30, dur: 3 }, src);
            if (pr.has('spellSlow')) addStatus(cb, t, 'slow', 2, src);
            if (src.passive === 'spellLeech' && !src.dead) src.hp = Math.min(src.maxHp, src.hp + dmg * 0.2);
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
            if (st.dodgeUp) { if (!st.dodgeUp.on) { u.dodge += st.dodgeUp.amt; st.dodgeUp.on = true; } st.dodgeUp.t -= dt; if (st.dodgeUp.t <= 0) { u.dodge -= st.dodgeUp.amt; delete st.dodgeUp; } }
            if (u.forcedT > 0 && (!u.forced || u.forced.dead)) u.forcedT = 0;
            // 0.5초마다 지속 피해·재생
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
              let regen = u.regen || 0;
              if (st.regen) { regen += st.regen.pct; st.regen.t -= 0.5; if (st.regen.t <= 0) delete st.regen; }
              if (u.passive === 'meditate') regen += 0.015;
              if (regen > 0) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen * 0.5);
              if (u.passive === 'manaFlow' && u.ability) u.mana = Math.min(u.maxMana, u.mana + 2.5);
              if (u.passive === 'healAura' || u.passive === 'greatAura') {
                const rad = u.passive === 'greatAura' ? 2 : 1, pct = u.passive === 'greatAura' ? 0.015 : 0.01;
                for (const a of cb.units) if (!a.dead && a.side === u.side && !a.object && grid.dist(a.cell, u.cell) <= rad) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * pct * 0.5 * u.healMult);
              }
            }
          }
          // 덫
          for (const tr of b.traps) {
            if (tr.done) continue;
            const v = cb.occ[tr.cell];
            if (v && v.side === 1) { tr.done = true; addStatus(cb, v, 'stun', 2); cb.damage(null, v, 200, 'spell'); cb.float(v.px, v.py - 30, '덫!', '#f5c400', true); fx.play('crit'); fx.shake(3); }
          }
          // 예고 장판
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
          if (t.undying && !t.usedUndying) {
            t.usedUndying = true;
            t.dead = false; t.hp = Math.round(t.maxHp * 0.35);
            if (!cb.occ[t.cell]) cb.occ[t.cell] = t; else { const c = freeNear(cb, t.cell); if (c !== undefined) { t.cell = c; cb.occ[c] = t; t.px = grid.cells[c].x; t.py = grid.cells[c].y; } }
            cb.float(t.px, t.py - 30, '불굴!', '#f5c400', true); cb.ring(t.px, t.py, '#f5c400', 36, 0.7);
            return;
          }
          fx.death(t);
          if (t.side === 1) {
            R().stats.kills++;
            if (src && src.passive === 'bounty') { b.goldBonus = (b.goldBonus || 0) + 2; cb.float(t.px, t.py - 34, '+2G', '#f5c400', true); }
            if (src && src.killMana && src.ability) src.mana = Math.min(src.maxMana, src.mana + src.killMana);
          }
          if (t.boss) { for (const v of cb.alive(1)) cb.kill(v, null); cb.tele = []; }
        },
      };
    }

    return { facing, rel, skillCells, synergyCounts, makeAlly, makeFoe, makeSummon, hooks, loadoutOf, monsterCls };
  }

  global.BT = { create, unitStats, LEVEL_MULT, XP_TABLE, MAX_LEVEL };
})(window);
