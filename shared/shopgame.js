/* 상점형 오토체스 공용 흐름 (시안 A·B·C)
 * 준비 → 전투 → 결과 → 다음 라운드. 골드/이자/연승, 경험치/레벨, 상점 굴림/잠금, 구매/판매/3합성,
 * 적 편성 생성, 보드·벤치 드래그 배치를 담당한다. 화면 모양과 고유 규칙은 cfg 로 주입한다.
 *
 * 페이지가 제공해야 하는 DOM id:
 *   hp round gold level xp xpbar traits shop reroll buyxp lock fight speed toast banner info
 *   (선택) timer
 */
(function (global) {
  'use strict';
  const AC = global.AC;
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    startGold: 8, startLevel: 2, maxLevel: 8, playerHp: 100, maxRounds: 15,
    shopSize: 5, rerollCost: 2, xpCost: 4, xpPerRound: 2,
    xpTable: { 1: 2, 2: 4, 3: 6, 4: 10, 5: 18, 6: 28, 7: 40 },
    odds: {
      1: [100, 0, 0, 0], 2: [100, 0, 0, 0], 3: [75, 25, 0, 0], 4: [55, 35, 10, 0],
      5: [40, 40, 18, 2], 6: [28, 40, 27, 5], 7: [20, 35, 35, 10], 8: [15, 30, 38, 17],
    },
    prepTime: null, combatTime: 40, benchSize: 8,
  };

  class ShopGame {
    constructor(cfg) {
      this.cfg = Object.assign({}, DEFAULTS, cfg);
      const c = this.cfg;
      this.canvas = c.canvas;
      this.ctx = AC.setupCanvas(c.canvas, c.W, c.H);
      this.grid = c.grid;
      this.roster = new AC.Roster(c.benchSize);
      this.round = 1;
      this.hp = c.playerHp;
      this.gold = c.startGold;
      this.level = c.startLevel;
      this.xp = 0;
      this.streak = 0;
      this.shop = [];
      this.locked = false;
      this.phase = 'prep';
      this.combat = null;
      this.selected = null;
      this.hoverCell = null;
      this.speed = 1;
      this.enemy = [];
      this.timer = c.prepTime;
      this.time = 0;
      this.bindUI();
      global.__game = this; // 디버그/자동 테스트용
      this.drag = AC.dragController(c.canvas, {
        pick: (pt) => this.pick(pt),
        drop: (u, pt, ev) => this.drop(u, pt, ev),
        click: (pt) => this.click(pt),
        hover: (pt) => { this.hoverPt = pt; },
      });
      if (c.onInit) c.onInit(this);
      this.rollShop(true);
      this.newEnemy();
      if (c.onRoundStart) c.onRoundStart(this);
      this.refresh();
      AC.loop((dt, t) => this.frame(dt, t));
    }

    // ---------- UI ----------
    bindUI() {
      $('reroll').onclick = () => this.reroll();
      $('buyxp').onclick = () => this.buyXp();
      $('lock').onclick = () => { this.locked = !this.locked; this.refresh(); };
      $('fight').onclick = () => this.fight();
      $('speed').onclick = () => { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1; this.refresh(); };
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'd' || e.key === 'D') this.reroll();
        else if (e.key === 'f' || e.key === 'F') this.buyXp();
        else if (e.key === 'e' || e.key === 'E') { if (this.selected) this.sell(this.selected); }
        else if (e.key === ' ') { e.preventDefault(); this.fight(); }
      });
    }

    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.remove('show'), 1600);
    }

    banner(text, kind) {
      const el = $('banner');
      el.textContent = text;
      el.className = 'banner show ' + (kind || '');
      clearTimeout(this._banT);
      this._banT = setTimeout(() => (el.className = 'banner'), 1500);
    }

    refresh() {
      const c = this.cfg;
      $('hp').textContent = Math.max(0, this.hp);
      $('round').textContent = this.round + ' / ' + c.maxRounds;
      $('gold').textContent = this.gold;
      $('level').textContent = this.level;
      const need = c.xpTable[this.level];
      $('xp').textContent = need ? this.xp + ' / ' + need : 'MAX';
      $('xpbar').style.width = need ? (100 * this.xp) / need + '%' : '100%';
      const prep = this.phase === 'prep';
      $('reroll').disabled = !prep;
      $('buyxp').disabled = !prep || !need;
      $('fight').disabled = !prep;
      $('lock').classList.toggle('on', this.locked);
      $('lock').textContent = this.locked ? '잠김' : '잠금';
      $('speed').textContent = '속도 ×' + this.speed;
      const cnt = $('count');
      if (cnt) cnt.textContent = this.roster.boardCount() + ' / ' + this.level;
      this.renderShop();
      this.renderTraits();
      this.renderInfo();
    }

    renderShop() {
      const el = $('shop');
      el.innerHTML = '';
      this.shop.forEach((def, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        if (!def) {
          b.className = 'card sold';
          b.disabled = true;
          b.innerHTML = '<span class="nm">—</span>';
        } else {
          b.className = 'card t' + def.cost;
          b.innerHTML = this.cfg.shopCardHTML(def, this);
          b.disabled = this.phase !== 'prep' && this.phase !== 'combat';
          if (this.gold < def.cost) b.classList.add('poor');
          if (this.roster.copies(def, 1).length >= 2 || this.roster.copies(def, 2).length >= 2) b.classList.add('pair');
          b.onclick = () => this.buy(i);
        }
        el.appendChild(b);
      });
    }

    renderTraits() {
      const c = this.cfg, el = $('traits');
      const counts = this.roster.traitCounts(c.traitsOf);
      const keys = Object.keys(counts).sort((a, b) => {
        const ta = AC.traitTier(counts[a], c.traits[a].th), tb = AC.traitTier(counts[b], c.traits[b].th);
        return tb - ta || counts[b] - counts[a];
      });
      if (!keys.length) { el.innerHTML = '<p class="empty">유닛을 보드에 올리면 시너지가 표시됩니다.</p>'; return; }
      el.innerHTML = keys.map((k) => {
        const t = c.traits[k], n = counts[k], tier = AC.traitTier(n, t.th);
        const steps = t.th.map((x) => `<b class="${n >= x ? 'on' : ''}">${x}</b>`).join('');
        return `<div class="trait ${tier ? 'active' : ''}" title="${t.desc}">
          <span class="tn">${t.name}</span><span class="tc">${n}</span><span class="ts">${steps}</span>
          <span class="td">${t.desc}</span></div>`;
      }).join('');
    }

    renderInfo() {
      const el = $('info'), u = this.selected;
      if (!u) { el.hidden = true; return; }
      el.hidden = false;
      const d = u.def, m = AC.STAR_MULT[u.star];
      el.innerHTML = this.cfg.infoHTML ? this.cfg.infoHTML(u, this) : `
        <div class="ih"><strong>${d.name}</strong> <span class="stars">${'★'.repeat(u.star)}</span></div>
        <div class="it">${this.cfg.traitsOf(d).map((t) => this.cfg.traits[t].name).join(' · ')}</div>
        <dl><dt>체력</dt><dd>${Math.round(d.hp * m)}</dd><dt>공격</dt><dd>${Math.round(d.atk * m)}</dd>
        <dt>공속</dt><dd>${d.as}</dd><dt>사거리</dt><dd>${d.range}</dd></dl>
        <p class="ab"><b>${d.ability.name}</b> ${d.ability.desc}</p>
        <button type="button" class="sellbtn" ${this.canSell(u) ? '' : 'disabled'}>판매 +${AC.sellValue(u)}G</button>`;
      const sb = el.querySelector('.sellbtn');
      if (sb) sb.onclick = () => this.sell(u);
    }

    // ---------- 경제 ----------
    rollShop(force) {
      if (this.locked && !force) return;
      this.shop = AC.rollShop(this.cfg.defs, this.cfg.odds[this.level], this.cfg.shopSize);
    }
    reroll() {
      if (this.phase !== 'prep') return;
      if (this.gold < this.cfg.rerollCost) return this.toast('골드가 부족합니다');
      this.gold -= this.cfg.rerollCost;
      this.rollShop(true);
      this.refresh();
    }
    buyXp() {
      if (this.phase !== 'prep' || !this.cfg.xpTable[this.level]) return;
      if (this.gold < this.cfg.xpCost) return this.toast('골드가 부족합니다');
      this.gold -= this.cfg.xpCost;
      this.addXp(4);
      this.refresh();
    }
    addXp(n) {
      this.xp += n;
      let need;
      while ((need = this.cfg.xpTable[this.level]) && this.xp >= need) {
        this.xp -= need;
        this.level++;
        this.toast('레벨 ' + this.level + ' — 보드에 ' + this.level + '명까지 배치 가능');
      }
      if (this.level >= this.cfg.maxLevel) this.xp = 0;
    }
    buy(i) {
      const def = this.shop[i];
      if (!def) return;
      if (this.phase !== 'prep' && this.phase !== 'combat') return;
      if (this.gold < def.cost) return this.toast('골드가 부족합니다');
      const inCombatMerge = this.phase === 'combat';
      if (!this.roster.canAccept(def)) return this.toast('벤치가 가득 찼습니다');
      if (inCombatMerge && this.roster.benchFree() < 0) return this.toast('벤치가 가득 찼습니다');
      const slot = this.roster.benchFree();
      const u = AC.Roster.unit(def, 1);
      if (slot >= 0) this.roster.bench[slot] = u;
      else this.roster.bench.push(u); // 벤치가 가득 차도 합성될 유닛이면 임시 칸에 넣고 합성 후 정리
      this.gold -= def.cost;
      this.shop[i] = null;
      if (this.phase === 'prep') this.doMerge();
      this.trimBench();
      this.refresh();
    }
    doMerge() {
      const merged = this.roster.merge();
      for (const u of merged) this.toast(u.def.name + ' ' + '★'.repeat(u.star) + ' 합성!');
      if (merged.length && this.cfg.onMerge) this.cfg.onMerge(merged, this);
    }
    trimBench() {
      const b = this.roster.bench;
      while (b.length > this.cfg.benchSize) {
        const k = b.lastIndexOf(null);
        if (k < 0) break;
        b.splice(k, 1);
      }
    }
    canSell(u) {
      const loc = this.roster.locate(u);
      return loc && (this.phase === 'prep' || loc.where === 'bench');
    }
    sell(u) {
      if (!this.canSell(u)) return this.toast('전투 중에는 벤치 유닛만 판매할 수 있습니다');
      this.roster.remove(u);
      this.gold += AC.sellValue(u);
      if (this.cfg.onSell) this.cfg.onSell(u, this);
      if (this.selected === u) this.selected = null;
      this.refresh();
    }

    // ---------- 배치 입력 ----------
    benchAt(pt) {
      const s = this.cfg.benchSlots;
      for (let i = 0; i < s.length; i++) if (Math.abs(pt.x - s[i].x) <= s[i].r && Math.abs(pt.y - s[i].y) <= s[i].r) return i;
      return -1;
    }
    isPlayerCell(cell) { return this.grid.cells[cell].r >= this.cfg.playerRowStart && (!this.cfg.cellAllowed || this.cfg.cellAllowed(cell, this)); }
    destAt(pt) {
      const bi = this.benchAt(pt);
      if (bi >= 0) return { where: 'bench', i: bi };
      if (this.phase !== 'prep') return null;
      const c = this.grid.cellAt(pt.x, pt.y);
      if (c && this.isPlayerCell(c.i)) return { where: 'board', cell: c.i };
      return null;
    }
    unitAt(pt) {
      const bi = this.benchAt(pt);
      if (bi >= 0) return this.roster.bench[bi];
      if (this.phase !== 'prep') return null;
      const c = this.grid.cellAt(pt.x, pt.y);
      return c ? this.roster.board.get(c.i) || null : null;
    }
    pick(pt) { return this.unitAt(pt); }
    overShop(ev) {
      if (!ev) return false;
      const r = $('shop').getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    }
    move(u, dest) {
      const r = this.roster.place(u, dest, this.level);
      if (r === 'cap') this.toast('보드가 가득 찼습니다 (레벨 ' + this.level + ' = ' + this.level + '명)');
      if (r === true && this.phase === 'prep') this.doMerge();
      this.refresh();
      return r === true;
    }
    drop(u, pt, ev) {
      if (this.overShop(ev)) return this.sell(u);
      const dest = this.destAt(pt);
      if (dest) this.move(u, dest);
    }
    click(pt) {
      if (this.cfg.onCanvasClick && this.cfg.onCanvasClick(pt, this)) return this.refresh();
      const u = this.unitAt(pt);
      if (u && u !== this.selected) { this.selected = u; return this.refresh(); }
      if (this.selected && !u) {
        const dest = this.destAt(pt);
        if (dest) { this.move(this.selected, dest); this.selected = null; return this.refresh(); }
      }
      this.selected = null;
      this.refresh();
    }

    // ---------- 적 ----------
    newEnemy() {
      const c = this.cfg;
      this.enemy = c.enemyGen ? c.enemyGen(this.round, this) : this.defaultEnemy(this.round);
    }
    defaultEnemy(r) {
      const c = this.cfg, g = this.grid;
      const count = Math.min(9, 2 + Math.floor((r - 1) / 2));
      const maxTier = r < 4 ? 1 : r < 7 ? 2 : r < 11 ? 3 : 4;
      const pool = c.defs.filter((d) => d.cost <= maxTier);
      const star2 = AC.clamp((r - 4) * 0.1, 0, 0.75), star3 = r >= 13 ? 0.12 : 0;
      const out = [], used = new Set();
      const front = c.playerRowStart - 1;
      for (let k = 0; k < count; k++) {
        const def = AC.pick(pool.filter((d) => d.cost >= Math.max(1, maxTier - 1)).concat(pool));
        const star = Math.random() < star3 ? 3 : Math.random() < star2 ? 2 : 1;
        const rows = def.range <= 1 ? [front, front - 1] : [0, 1, front - 1];
        let cell = -1;
        for (let tries = 0; tries < 40 && cell < 0; tries++) {
          const idx = g.idx(AC.randi(0, g.cols - 1), AC.pick(rows));
          if (idx >= 0 && !used.has(idx) && (!c.cellAllowed || c.cellAllowed(idx, this))) cell = idx;
        }
        if (cell < 0) continue;
        used.add(cell);
        out.push({ def, star, cell });
      }
      return out;
    }

    // ---------- 전투 ----------
    fight() {
      if (this.phase !== 'prep') return;
      const c = this.cfg;
      if (!this.roster.boardCount()) return this.toast('보드에 유닛을 하나 이상 배치하세요');
      this.selected = null;
      const ents = [];
      const mine = this.roster.boardUnits().map(({ cell, u }) => {
        const e = AC.makeEntity(u.def, u.star, 0, cell, { unit: u });
        ents.push(e);
        return e;
      });
      const theirs = this.enemy.map((x) => {
        const e = AC.makeEntity(x.def, x.star, 1, x.cell, { unit: x });
        ents.push(e);
        return e;
      });
      this.applyTraits(mine, this.roster.traitCounts(c.traitsOf));
      this.applyTraits(theirs, this.enemyTraitCounts());
      if (c.prepareEntities) c.prepareEntities(ents, this);
      this.combat = new AC.Combat(this.grid, ents, { hooks: c.combatHooks ? c.combatHooks(this) : {}, maxTime: c.combatTime });
      this.phase = 'combat';
      this.refresh();
    }
    enemyTraitCounts() {
      const seen = new Set(), counts = {};
      for (const x of this.enemy) {
        if (seen.has(x.def.id)) continue;
        seen.add(x.def.id);
        for (const t of this.cfg.traitsOf(x.def)) counts[t] = (counts[t] || 0) + 1;
      }
      return counts;
    }
    applyTraits(ents, counts) {
      const c = this.cfg;
      for (const k in counts) {
        const tier = AC.traitTier(counts[k], c.traits[k].th);
        if (!tier) continue;
        for (const e of ents) c.traits[k].apply(e, tier, c.traitsOf(e.def).includes(k), ents);
      }
    }
    endCombat() {
      const c = this.cfg, cb = this.combat;
      const won = cb.winner === 0;
      let msg;
      if (won) {
        this.streak = this.streak > 0 ? this.streak + 1 : 1;
        msg = '승리';
      } else {
        const surv = cb.alive(1);
        const dmg = c.damage ? c.damage(this.round, surv) : 2 + Math.ceil(this.round / 2) + surv.reduce((s, e) => s + e.star, 0) * 2;
        this.hp -= dmg;
        this.streak = this.streak < 0 ? this.streak - 1 : -1;
        msg = (cb.winner === -1 ? '시간 초과 ' : '패배 ') + '−' + dmg;
      }
      if (c.onCombatEnd) c.onCombatEnd(won, this);
      this.banner(msg, won ? 'win' : 'lose');
      this.phase = 'result';
      this.resultT = 1.6;
      this.refresh();
    }
    nextRound() {
      const c = this.cfg;
      this.combat = null;
      if (this.hp <= 0) return this.gameOver(false);
      if (this.round >= c.maxRounds) return this.gameOver(true);
      this.round++;
      const interest = Math.min(5, Math.floor(this.gold / 10));
      const s = Math.abs(this.streak), streakBonus = s >= 5 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;
      const income = 5 + interest + streakBonus + (this.streak > 0 ? 1 : 0);
      this.gold += income;
      this.addXp(c.xpPerRound);
      this.rollShop(false);
      this.locked = false;
      this.newEnemy();
      this.phase = 'prep';
      this.doMerge();
      this.timer = c.prepTime;
      if (c.onRoundStart) c.onRoundStart(this);
      this.toast(`+${income}G (기본 5 · 이자 ${interest} · 연속 ${streakBonus}${this.streak > 0 ? ' · 승리 1' : ''})`);
      this.refresh();
    }
    gameOver(victory) {
      this.phase = 'over';
      const el = $('banner');
      el.className = 'banner show over ' + (victory ? 'win' : 'lose');
      el.innerHTML = (victory ? '정복 완료' : '탈락') + `<small>${victory ? this.cfg.maxRounds + '라운드 생존 · 남은 체력 ' + this.hp : this.round + '라운드에서 쓰러졌습니다'}</small><button type="button" id="again">다시 하기</button>`;
      $('again').onclick = () => location.reload();
      this.refresh();
    }

    // ---------- 루프/렌더 ----------
    frame(dt, t) {
      this.time = t;
      if (this.phase === 'prep' && this.timer != null) {
        this.timer -= dt;
        const el = $('timer');
        if (el) el.textContent = Math.max(0, Math.ceil(this.timer));
        if (this.timer <= 0) {
          if (this.roster.boardCount()) this.fight();
          else this.autoDeploy();
        }
      }
      if (this.phase === 'combat') {
        let left = dt * this.speed;
        while (left > 0 && !this.combat.done) {
          const s = Math.min(1 / 60, left);
          this.combat.step(s);
          left -= s;
        }
        if (this.combat.done) this.endCombat();
      } else if (this.phase === 'result') {
        if (this.combat) this.combat.step(dt);
        this.resultT -= dt;
        if (this.resultT <= 0) this.nextRound();
      }
      this.draw();
    }
    autoDeploy() {
      // 준비 시간 종료 시 보드가 비어 있으면 벤치에서 자동 배치
      for (let i = 0; i < this.roster.bench.length && this.roster.boardCount() < this.level; i++) {
        const u = this.roster.bench[i];
        if (!u) continue;
        const free = this.grid.cells.find((c) => this.isPlayerCell(c.i) && !this.roster.board.has(c.i));
        if (free) this.roster.place(u, { where: 'board', cell: free.i }, this.level);
      }
      if (this.roster.boardCount()) this.fight();
      else { this.timer = this.cfg.prepTime; this.toast('배치할 유닛이 없습니다. 상점에서 구매하세요'); }
    }

    draw() {
      const c = this.cfg, ctx = this.ctx;
      ctx.clearRect(0, 0, c.W, c.H);
      c.drawBackground(ctx, this);
      const dragging = this.drag.dragging ? this.drag.obj : null;
      const hl = dragging ? this.destAt(this.drag.pt) : null;
      if (c.drawHighlights) c.drawHighlights(ctx, this, hl);

      if (this.combat) {
        const ents = this.combat.units.filter((e) => !e.dead).sort((a, b) => a.py - b.py);
        for (const e of ents) {
          const o = AC.lungeOffset(e);
          c.drawUnit(ctx, e.px + o.x, e.py + o.y, { def: e.def, star: e.star, side: e.side, ent: e, unit: e.unit }, this);
        }
        for (const e of ents) AC.drawBars(ctx, e, c.barStyle);
        AC.drawFx(ctx, this.combat, { font: c.fxFont });
      } else {
        for (const x of this.enemy) {
          const cell = this.grid.cells[x.cell];
          c.drawUnit(ctx, cell.x, cell.y, { def: x.def, star: x.star, side: 1, preview: true, unit: x }, this);
        }
        for (const { cell, u } of this.roster.boardUnits()) {
          if (u === dragging) continue;
          const cl = this.grid.cells[cell];
          c.drawUnit(ctx, cl.x, cl.y, { def: u.def, star: u.star, side: 0, unit: u, selected: u === this.selected }, this);
        }
      }
      this.roster.bench.forEach((u, i) => {
        if (!u || u === dragging) return;
        const s = c.benchSlots[i];
        if (!s) return;
        c.drawUnit(ctx, s.x, s.y, { def: u.def, star: u.star, side: 0, unit: u, bench: true, selected: u === this.selected }, this);
      });
      if (dragging) c.drawUnit(ctx, this.drag.pt.x, this.drag.pt.y, { def: dragging.def, star: dragging.star, side: 0, unit: dragging, lifted: true }, this);
      if (c.drawOverlay) c.drawOverlay(ctx, this);
    }
  }

  AC.ShopGame = ShopGame;
})(window);
