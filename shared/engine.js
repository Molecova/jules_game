/* 오토체스 시안 공용 엔진
 * - 그리드(사각/헥스), 자동 전투 시뮬레이션, 로스터(보드+벤치, 3합성), 상점 굴림, 캔버스/입력 유틸
 * - 각 시안 페이지는 유닛 데이터, 렌더링, UI, 고유 규칙(hooks)만 정의한다.
 */
(function (global) {
  'use strict';
  const AC = {};

  // ---------- 유틸 ----------
  AC.rand = (a, b) => a + Math.random() * (b - a);
  AC.randi = (a, b) => Math.floor(AC.rand(a, b + 1));
  AC.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  AC.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  AC.lerp = (a, b, t) => a + (b - a) * t;
  AC.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  AC.weighted = (weights) => {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  };
  AC.STAR_MULT = [0, 1, 1.8, 3.24];

  // ---------- 그리드 ----------
  function finishGrid(g) {
    g.cellAt = function (px, py) {
      let best = null, bd = Infinity;
      for (const c of g.cells) {
        const d = (c.x - px) ** 2 + (c.y - py) ** 2;
        if (d < bd) { bd = d; best = c; }
      }
      return bd <= g.hit * g.hit ? best : null;
    };
    g.idx = (c, r) => (c < 0 || r < 0 || c >= g.cols || r >= g.rows ? -1 : r * g.cols + c);
    g.neighbors = g.cells.map((a) => g.cells.filter((b) => b !== a && g.dist(a.i, b.i) === 1).map((b) => b.i));
    return g;
  }

  /** 사각 그리드. diag=true 면 8방향(체비셰프), false 면 4방향(맨해튼) */
  AC.squareGrid = function (cols, rows, size, o = {}) {
    const ox = o.ox || 0, oy = o.oy || 0, diag = o.diag !== false;
    const cells = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        cells.push({ i: r * cols + c, c, r, x: ox + c * size + size / 2, y: oy + r * size + size / 2 });
    const g = { type: 'square', cols, rows, size, cells, ox, oy, w: cols * size, h: rows * size, hit: size * 0.72, diag };
    g.dist = (a, b) => {
      const A = cells[a], B = cells[b];
      const dx = Math.abs(A.c - B.c), dy = Math.abs(A.r - B.r);
      return diag ? Math.max(dx, dy) : dx + dy;
    };
    return finishGrid(g);
  };

  /** 포인티-탑 헥스 그리드 (홀수 행이 오른쪽으로 반 칸 밀림) */
  AC.hexGrid = function (cols, rows, s, o = {}) {
    const ox = o.ox || 0, oy = o.oy || 0, w = Math.sqrt(3) * s;
    const cells = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        cells.push({
          i: r * cols + c, c, r,
          q: c - (r - (r & 1)) / 2,
          x: ox + w / 2 + c * w + (r & 1 ? w / 2 : 0),
          y: oy + s + r * 1.5 * s,
        });
    const g = { type: 'hex', cols, rows, size: s, cells, ox, oy, cw: w, w: cols * w + w / 2, h: (rows - 1) * 1.5 * s + 2 * s, hit: s };
    g.dist = (a, b) => {
      const A = cells[a], B = cells[b];
      const dq = A.q - B.q, dr = A.r - B.r;
      return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    };
    g.hexPath = function (ctx, x, y, s2) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 180 * (60 * k - 30);
        const px = x + s2 * Math.cos(a), py = y + s2 * Math.sin(a);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    return finishGrid(g);
  };

  // ---------- 전투 개체 ----------
  let uidSeq = 0;
  AC.uid = () => ++uidSeq;

  AC.makeEntity = function (def, star, side, cell, extra) {
    const m = AC.STAR_MULT[star];
    const e = {
      id: AC.uid(), def, star, side, cell,
      maxHp: Math.round(def.hp * m), hp: 0,
      atk: def.atk * m, as: def.as || 0.7, range: def.range || 1,
      armor: def.armor || 0, dodge: 0, lifesteal: 0, crit: def.crit || 0.05, spell: 1,
      mana: def.startMana || 0, maxMana: def.mana || 80,
      ability: def.ability || null,
      shield: 0, stun: 0, atkCd: 0.25 + Math.random() * 0.35,
      moving: null, moveTime: def.moveTime || 0.38, dead: false, flash: 0, lunge: 0,
      target: null, px: 0, py: 0, dmgDealt: 0, src: null,
    };
    Object.assign(e, extra || {});
    e.hp = e.maxHp;
    return e;
  };

  // ---------- 전투 시뮬레이션 ----------
  class Combat {
    constructor(grid, units, opts = {}) {
      this.grid = grid;
      this.units = units;
      this.hooks = opts.hooks || {};
      this.maxTime = opts.maxTime || 40;
      this.t = 0;
      this.occ = new Array(grid.cells.length).fill(null);
      this.projectiles = [];
      this.floaters = [];
      this.fx = [];
      this.done = false;
      this.winner = null;
      for (const u of units) {
        this.occ[u.cell] = u;
        u.px = grid.cells[u.cell].x;
        u.py = grid.cells[u.cell].y;
      }
      if (this.hooks.onStart) this.hooks.onStart(this);
    }

    alive(side) { return this.units.filter((u) => !u.dead && (side === undefined || u.side === side)); }
    blocked(cell) { return this.hooks.blocked ? this.hooks.blocked(cell) : false; }

    nearestEnemy(u) {
      let best = null, bd = Infinity;
      for (const v of this.units) {
        if (v.dead || v.side === u.side) continue;
        const d = this.grid.dist(u.cell, v.cell) + Math.random() * 0.01;
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    }

    bfs(u, tgt) {
      const g = this.grid, N = g.cells.length;
      const prev = new Int16Array(N).fill(-2);
      prev[u.cell] = -1;
      const q = [u.cell];
      let head = 0, goal = -1;
      while (head < q.length) {
        const c = q[head++];
        if (c !== u.cell && g.dist(c, tgt.cell) <= u.range) { goal = c; break; }
        for (const n of g.neighbors[c]) {
          if (prev[n] !== -2 || this.occ[n] || this.blocked(n)) continue;
          prev[n] = c;
          q.push(n);
        }
      }
      if (goal < 0) return null;
      let c = goal;
      while (prev[c] !== u.cell) c = prev[c];
      return c;
    }

    pathStep(u) {
      // 가장 가까운 적부터, 도달 가능한 적을 찾는다
      const foes = this.alive(1 - u.side).sort((a, b) => this.grid.dist(u.cell, a.cell) - this.grid.dist(u.cell, b.cell));
      for (const f of foes) {
        const step = this.bfs(u, f);
        if (step !== null) { u.target = f; return step; }
      }
      return null;
    }

    moveTo(u, next) {
      const g = this.grid;
      this.occ[u.cell] = null;
      const from = { x: u.px, y: u.py };
      u.cell = next;
      this.occ[next] = u;
      u.moving = { fx: from.x, fy: from.y, tx: g.cells[next].x, ty: g.cells[next].y, t: 0 };
    }

    teleport(u, cell) {
      this.occ[u.cell] = null;
      u.cell = cell;
      this.occ[cell] = u;
      u.moving = null;
      u.px = this.grid.cells[cell].x;
      u.py = this.grid.cells[cell].y;
    }

    step(dt) {
      if (this.done) return;
      this.t += dt;
      const g = this.grid;
      for (const u of this.units) {
        if (u.dead) continue;
        u.flash = Math.max(0, u.flash - dt);
        u.lunge = Math.max(0, u.lunge - dt);
        if (u.moving) {
          const m = u.moving;
          m.t += dt / u.moveTime;
          const k = Math.min(1, m.t), e = k * k * (3 - 2 * k);
          u.px = AC.lerp(m.fx, m.tx, e);
          u.py = AC.lerp(m.fy, m.ty, e);
          if (k >= 1) u.moving = null;
          else continue;
        }
        if (u.stun > 0) { u.stun -= dt; continue; }
        const asMod = this.hooks.asMod ? this.hooks.asMod(u, this) : 1;
        u.atkCd -= dt * asMod;
        // 도발: 지정된 대상만 노린다
        const forced = u.forcedT > 0 && u.forced && !u.forced.dead ? u.forced : null;
        if (forced) { u.forcedT -= dt; u.target = forced; }
        if (!u.target || u.target.dead) u.target = this.nearestEnemy(u);
        const tgt = u.target;
        if (!tgt) continue;
        if (g.dist(u.cell, tgt.cell) <= u.range) {
          // u.bars 가 있으면 스킬마다 따로 찬 마나로 시전(v4), 없으면 마나 하나
          const bi = u.bars ? u.bars.findIndex((b) => b.mana >= b.max) : -1;
          if (u.ability && (u.bars ? bi >= 0 : u.maxMana > 0 && u.mana >= u.maxMana)) {
            if (u.bars) { u.bars[bi].mana = 0; u.castIdx = bi; } else u.mana = 0;
            this.cast(u, tgt);
            u.atkCd = Math.max(u.atkCd, 0.35);
          } else if (u.atkCd <= 0) {
            this.attack(u, tgt);
            u.atkCd = 1 / u.as;
          }
        } else {
          const near = this.nearestEnemy(u);
          if (!forced && near && g.dist(u.cell, near.cell) <= u.range) { u.target = near; continue; }
          if (u.immobile) { if (near) u.target = near; continue; }
          const fstep = forced ? this.bfs(u, forced) : null;
          const next = fstep !== null ? fstep : this.pathStep(u);
          if (next !== null) this.moveTo(u, next);
        }
      }
      if (this.hooks.onTick) this.hooks.onTick(this, dt);

      // 투사체
      for (const p of this.projectiles) {
        const t = p.tgt;
        const dx = t.px - p.x, dy = t.py - p.y, d = Math.hypot(dx, dy);
        const v = p.speed * dt;
        if (d <= v || t.dead) {
          p.done = true;
          if (!t.dead) this.damage(p.src, t, p.dmg, p.kind, p.crit);
        } else {
          p.x += (dx / d) * v;
          p.y += (dy / d) * v;
        }
      }
      this.projectiles = this.projectiles.filter((p) => !p.done);
      for (const f of this.floaters) { f.t += dt; f.y -= 28 * dt; }
      this.floaters = this.floaters.filter((f) => f.t < 0.9);
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < f.life);

      // 설치물(바리케이드 등)은 승패 판정에서 제외
      const a0 = this.units.filter((u) => !u.dead && u.side === 0 && !u.object).length, a1 = this.alive(1).length;
      const pendingThreat = this.hooks.hasPendingThreats && this.hooks.hasPendingThreats(this);
      if (a0 === 0 || (a1 === 0 && !pendingThreat) || this.t >= this.maxTime) {
        this.done = true;
        this.winner = a1 === 0 && a0 > 0 ? 0 : a0 === 0 && a1 > 0 ? 1 : -1; // -1: 시간초과(무승부)
        if (this.hooks.onEnd) this.hooks.onEnd(this);
      }
    }

    /** 전투 중 유닛 추가(소환) */
    spawn(e) {
      if (this.occ[e.cell]) return false;
      this.units.push(e);
      this.occ[e.cell] = e;
      e.px = this.grid.cells[e.cell].x;
      e.py = this.grid.cells[e.cell].y;
      return true;
    }

    gainMana(u, amt) {
      if (u.bars) { const m = u.manaGain || 1; for (const b of u.bars) b.mana = Math.min(b.max, b.mana + amt * m); return; }
      u.mana = Math.min(u.maxMana, u.mana + amt);
    }

    attack(u, t) {
      if (this.hooks.preAttack && this.hooks.preAttack(u, t, this)) return; // 기본 공격을 다른 행동으로 바꾸는 훅(치유 등)
      this.gainMana(u, u.manaPerHit || 10);
      const crit = Math.random() < u.crit;
      const dmg = u.atk * AC.rand(0.9, 1.1);
      if (u.range > 1) {
        this.projectiles.push({ x: u.px, y: u.py, tgt: t, src: u, dmg, crit, kind: 'atk', speed: 560, color: u.side ? this.hooks.enemyShot || '#e66' : this.hooks.playerShot || '#fd6' });
      } else {
        u.lunge = 0.14;
        u.lungeDir = Math.atan2(t.py - u.py, t.px - u.px);
        this.damage(u, t, dmg, 'atk', crit);
      }
      if (this.hooks.onAttack) this.hooks.onAttack(u, t, this);
    }

    damage(src, t, dmg, kind = 'atk', crit = false) {
      if (t.dead) return 0;
      if (kind === 'atk' && Math.random() < t.dodge) {
        this.float(t.px, t.py - 18, 'MISS', '#bbb');
        if (this.hooks.onDodge) this.hooks.onDodge(t, src, this);
        return 0;
      }
      if (crit) dmg *= (src && src.critDmg) || 1.75;
      if (this.hooks.dmgDealtMod && src) dmg *= this.hooks.dmgDealtMod(src, t, kind, this);
      dmg *= 1 - t.armor;
      if (this.hooks.dmgTakenMod) dmg *= this.hooks.dmgTakenMod(t, this, src, kind);
      dmg = Math.max(1, Math.round(dmg));
      t.dmgTaken = (t.dmgTaken || 0) + dmg;
      if (t.shield > 0) {
        const a = Math.min(t.shield, dmg);
        t.shield -= a;
        dmg = Math.round(dmg - a); // 보호막이 소수여도 피해 숫자는 정수로
      }
      t.hp -= dmg;
      t.flash = 0.12;
      if (this.hooks.onHit) this.hooks.onHit(t, dmg, src, kind, crit, this);
      this.gainMana(t, Math.min(10, (dmg / t.maxHp) * 60));
      if (src) {
        src.dmgDealt += dmg;
        if (src.lifesteal && !src.dead) { const h = Math.min(src.maxHp - src.hp, dmg * src.lifesteal); src.hp += h; src.healDone = (src.healDone || 0) + h; }
      }
      const col = (this.hooks.floatColor && this.hooks.floatColor(kind, crit)) || (kind === 'spell' ? '#c9a2ff' : crit ? '#ffb347' : '#ffffff');
      if (dmg > 0) this.float(t.px + AC.rand(-8, 8), t.py - 16, String(dmg), col, crit || kind === 'spell');
      if (t.hp <= 0) this.kill(t, src);
      return dmg;
    }

    heal(t, amt, src) {
      if (t.dead) return;
      const h = Math.round(Math.min(t.maxHp - t.hp, amt));
      t.hp += h;
      if (src && h > 0) src.healDone = (src.healDone || 0) + h;
      if (h > 0) this.float(t.px, t.py - 16, '+' + h, '#7dffa0');
      if (h > 0 && this.hooks.onHeal) this.hooks.onHeal(t, h, this);
    }

    kill(t, src) {
      t.dead = true;
      t.hp = 0;
      if (this.occ[t.cell] === t) this.occ[t.cell] = null;
      this.ring(t.px, t.py, t.side ? '#ff7a7a' : '#ffe08a', 26, 0.4);
      if (this.hooks.onDeath) this.hooks.onDeath(t, src, this);
    }

    float(x, y, text, color, big) { this.floaters.push({ x, y, text, color, big: !!big, t: 0 }); }
    ring(x, y, color, r, life = 0.45) { this.fx.push({ kind: 'ring', x, y, color, r, life, t: 0 }); }
    beam(x1, y1, x2, y2, color, life = 0.25) { this.fx.push({ kind: 'beam', x: x1, y: y1, x2, y2, color, life, t: 0 }); }

    cast(u, t) {
      if (this.hooks.onCast && this.hooks.onCast(u, t, this)) return;
      const ab = u.ability;
      const P = ab.power * AC.STAR_MULT[u.star] * u.spell;
      const foes = this.alive(1 - u.side), allies = this.alive(u.side);
      const label = ab.name || '';
      if (label) this.float(u.px, u.py - 30, label, '#e9d7ff');
      switch (ab.type) {
        case 'strike':
          this.beam(u.px, u.py, t.px, t.py, '#d4b0ff');
          this.damage(u, t, P, 'spell');
          break;
        case 'aoe': {
          this.ring(t.px, t.py, '#ff9a5a', this.grid.size * 1.6, 0.5);
          for (const f of foes) if (this.grid.dist(f.cell, t.cell) <= (ab.radius || 1)) this.damage(u, f, P, 'spell');
          break;
        }
        case 'heal': {
          const low = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, ab.count || 1);
          for (const a of low) { this.ring(a.px, a.py, '#7dffa0', 22); this.heal(a, P); }
          break;
        }
        case 'shield':
          u.shield += P;
          this.ring(u.px, u.py, '#9fd8ff', 26);
          break;
        case 'volley': {
          const ts = AC.shuffle(foes.slice()).slice(0, ab.count || 3);
          for (const f of ts) this.projectiles.push({ x: u.px, y: u.py, tgt: f, src: u, dmg: P, crit: false, kind: 'spell', speed: 480, color: '#c9a2ff' });
          break;
        }
        case 'stun':
          this.beam(u.px, u.py, t.px, t.py, '#ffe066');
          this.damage(u, t, P, 'spell');
          t.stun = Math.max(t.stun, ab.dur || 1.5);
          this.float(t.px, t.py - 30, '기절', '#ffe066');
          break;
        case 'drain':
          this.beam(u.px, u.py, t.px, t.py, '#ff6b9a');
          this.heal(u, this.damage(u, t, P, 'spell') * 0.6);
          break;
        case 'rally':
          for (const a of allies) if (this.grid.dist(a.cell, u.cell) <= 2) { a.as *= 1.25; this.ring(a.px, a.py, '#ffd36b', 18); }
          break;
        case 'leap': {
          const far = foes.sort((a, b) => this.grid.dist(u.cell, b.cell) - this.grid.dist(u.cell, a.cell))[0];
          if (far) {
            const spot = this.grid.neighbors[far.cell].find((n) => !this.occ[n] && !this.blocked(n));
            if (spot !== undefined) this.teleport(u, spot);
            u.target = far;
            this.damage(u, far, P, 'spell');
          }
          break;
        }
      }
    }
  }
  AC.Combat = Combat;

  // ---------- 로스터(보드+벤치) ----------
  class Roster {
    constructor(benchSize) {
      this.board = new Map(); // cellIndex -> unit
      this.bench = new Array(benchSize).fill(null);
    }
    static unit(def, star = 1) { return { uid: AC.uid(), def, star, items: [] }; }
    all() { return [...this.board.values(), ...this.bench.filter(Boolean)]; }
    boardUnits() { return [...this.board.entries()].map(([cell, u]) => ({ cell, u })); }
    boardCount() { return this.board.size; }
    benchFree() { return this.bench.indexOf(null); }
    locate(u) {
      for (const [cell, v] of this.board) if (v === u) return { where: 'board', cell };
      const i = this.bench.indexOf(u);
      return i >= 0 ? { where: 'bench', i } : null;
    }
    at(loc) { return loc.where === 'board' ? this.board.get(loc.cell) || null : this.bench[loc.i]; }
    set(loc, u) {
      if (loc.where === 'board') { if (u) this.board.set(loc.cell, u); else this.board.delete(loc.cell); }
      else this.bench[loc.i] = u;
    }
    remove(u) { const l = this.locate(u); if (l) this.set(l, null); }
    /** 이동/교체. 성공하면 true. cap: 보드 최대 유닛 수 */
    place(u, dest, cap) {
      const from = this.locate(u);
      if (!from) return false;
      if (from.where === dest.where && (from.cell === dest.cell && from.i === dest.i)) return false;
      const other = this.at(dest);
      if (dest.where === 'board' && from.where === 'bench' && !other && this.boardCount() >= cap) return 'cap';
      this.set(from, other);
      this.set(dest, u);
      return true;
    }
    copies(def, star) { return this.all().filter((u) => u.def === def && u.star === star); }
    canAccept(def) { return this.benchFree() >= 0 || this.copies(def, 1).length >= 2; }
    /** 3개가 모이면 합성. 합성된 유닛 목록 반환 */
    merge() {
      const merged = [];
      let changed = true;
      while (changed) {
        changed = false;
        const groups = new Map();
        for (const u of this.all()) {
          if (u.star >= 3) continue;
          const k = u.def.id + ':' + u.star;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(u);
        }
        for (const list of groups.values()) {
          if (list.length < 3) continue;
          list.sort((a, b) => (this.locate(a).where === 'board' ? 0 : 1) - (this.locate(b).where === 'board' ? 0 : 1));
          const [keep, x, y] = list;
          const items = [...keep.items, ...x.items, ...y.items];
          this.remove(x);
          this.remove(y);
          keep.star++;
          keep.items = items.slice(0, 3);
          merged.push(keep);
          changed = true;
          break;
        }
      }
      return merged;
    }
    /** 같은 유닛 종류 기준 특성 카운트 */
    traitCounts(traitsOf) {
      const seen = new Set(), counts = {};
      for (const u of this.board.values()) {
        if (seen.has(u.def.id)) continue;
        seen.add(u.def.id);
        for (const t of traitsOf(u.def)) counts[t] = (counts[t] || 0) + 1;
      }
      return counts;
    }
  }
  AC.Roster = Roster;
  AC.sellValue = (u) => u.def.cost * 3 ** (u.star - 1) - (u.star > 1 ? 1 : 0);

  /** 레벨별 티어 확률표(odds[level] = [t1,t2,t3,...])로 상점을 굴린다 */
  AC.rollShop = function (pool, odds, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const tier = AC.weighted(odds) + 1;
      const opts = pool.filter((d) => d.cost === tier);
      out.push(opts.length ? AC.pick(opts) : AC.pick(pool));
    }
    return out;
  };

  /** 특성 카운트 → 활성 단계(0이면 비활성) */
  AC.traitTier = (count, thresholds) => thresholds.filter((t) => count >= t).length;

  // ---------- 캔버스/입력 ----------
  AC.setupCanvas = function (canvas, W, H) {
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.aspectRatio = W + ' / ' + H;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.toLogical = (ev) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
    };
    return ctx;
  };

  /** 클릭/드래그 공용 컨트롤러.
   *  pick(pt) → 집을 대상 or null / drop(obj, pt) 드래그 놓기 / click(pt) 단순 클릭 */
  AC.dragController = function (canvas, h) {
    const st = { obj: null, start: null, pt: null, dragging: false };
    canvas.addEventListener('pointerdown', (ev) => {
      const pt = canvas.toLogical(ev);
      st.obj = h.pick(pt);
      st.start = pt;
      st.pt = pt;
      st.dragging = false;
      if (st.obj) canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      const pt = canvas.toLogical(ev);
      st.pt = pt;
      if (h.hover) h.hover(pt);
      if (st.obj && !st.dragging && Math.hypot(pt.x - st.start.x, pt.y - st.start.y) > 8) st.dragging = true;
    });
    canvas.addEventListener('pointerup', (ev) => {
      const pt = canvas.toLogical(ev);
      if (st.obj && st.dragging) h.drop(st.obj, pt, ev);
      else h.click(pt, ev);
      st.obj = null;
      st.dragging = false;
    });
    canvas.addEventListener('pointercancel', () => { st.obj = null; st.dragging = false; });
    return st;
  };

  AC.loop = function (fn) {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // ---------- 공용 렌더링 ----------
  AC.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /** HP/마나/실드 바. style: {hpAlly, hpEnemy, mana, back, w, off, pixel} */
  AC.drawBars = function (ctx, e, style) {
    const w = style.w || 34, x = e.px - w / 2, y = e.py - (style.off || 26);
    const hpH = style.hpH || 4, mH = style.manaH || 2;
    ctx.fillStyle = style.back || 'rgba(0,0,0,.55)';
    ctx.fillRect(x - 1, y - 1, w + 2, hpH + mH + 3);
    const total = Math.max(e.maxHp, e.hp + e.shield);
    ctx.fillStyle = e.side ? style.hpEnemy : style.hpAlly;
    ctx.fillRect(x, y, (w * Math.max(0, e.hp)) / total, hpH);
    if (e.shield > 0) {
      ctx.fillStyle = style.shield || '#e8f4ff';
      ctx.fillRect(x + (w * Math.max(0, e.hp)) / total, y, (w * e.shield) / total, hpH);
    }
    if (style.ticks !== false) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      for (let k = 300; k < total; k += 300) ctx.fillRect(x + (w * k) / total, y, 1, hpH);
    }
    if (e.maxMana > 0 && e.ability) {
      ctx.fillStyle = style.mana || '#6cc7ff';
      ctx.fillRect(x, y + hpH + 1, (w * e.mana) / e.maxMana, mH);
    }
  };

  /** 투사체, 이펙트, 데미지 숫자 */
  AC.drawFx = function (ctx, cb, style = {}) {
    for (const p of cb.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'spell' ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const f of cb.fx) {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.color;
      if (f.kind === 'ring') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'beam') {
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of cb.floaters) {
      ctx.globalAlpha = 1 - Math.max(0, f.t - 0.5) / 0.4;
      ctx.font = (f.big ? 'bold 15px ' : 'bold 12px ') + (style.font || 'sans-serif');
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  };

  /** 근접 공격 시 살짝 튀어나가는 오프셋 */
  AC.lungeOffset = (e) => (e.lunge > 0 ? { x: Math.cos(e.lungeDir) * 6 * (e.lunge / 0.14), y: Math.sin(e.lungeDir) * 6 * (e.lunge / 0.14) } : { x: 0, y: 0 });

  global.AC = AC;
})(window);
