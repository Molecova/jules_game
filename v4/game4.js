/* 카드 원정대 v4 — 원정·상점·창고·합성·지도·전투 화면 */
(function () {
  'use strict';
  const GD = window.GD, V = window.V4, ART = window.ART, SFX = window.SFX;
  const { MONSTERS, ACTS, BOSS_INFO } = GD;
  const { CLS, SYN, TRAITS, UNITS, SKILLS, ITEMS, DEF, ODDS, XPNEED, POOL_N, MAXT, RELICS, NODE, STARTS, DIFF } = V;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const def = (c) => DEF[c.kind + ':' + c.id];
  const POOL = { unit: UNITS, skill: SKILLS, item: ITEMS };
  const TABNAME = { unit: '유닛', skill: '스킬', item: '아이템' };
  const KINDNAME = { unit: '유닛', skill: '스킬', item: '아이템' };
  const SAVE_KEY = 'card-expedition-v4';
  const TIERNAME = ['', '흰색', '녹색', '파랑', '보라', '노랑'];
  const starTxt = (n) => (n > 1 ? '★'.repeat(n) : '');
  const copies = (star) => Math.pow(3, star - 1);
  const price = (c) => def(c).t * copies(c.star) - (c.star > 1 ? 1 : 0);
  const keyOf = (kind, id) => kind + ':' + id;

  // =====================================================================
  // 원정 상태
  // =====================================================================
  let R = null, B = null, uidN = 1;
  const mk = (kind, id, star = 1) => { const c = { uid: 'c' + Date.now().toString(36) + (uidN++), kind, id, star }; if (kind === 'unit') { c.skills = []; c.item = null; c.rot = AC.rand(-0.08, 0.08); } return c; };
  const has = (r) => R && R.relics.includes(r);
  const benchSize = () => V.BENCH + (has('bigbag') ? 2 : 0);
  const deployMax = () => R.lv + (has('flag') ? 1 : 0);
  const skillSlots = (u) => def(u).slots || 2;

  function newRun(startId, diff) {
    const S = STARTS.find((s) => s.id === startId) || STARTS[0];
    R = {
      v: 4, diff, act: 1, round: 0, gold: 5, lv: 3, xp: 0, streak: 0, relics: DIFF[diff].phoenix ? ['phoenix'] : [],
      board: [], bench: Array(V.BENCH).fill(null), shop: { unit: [], skill: [], item: [] }, locked: { unit: false, skill: false, item: false },
      pool: {}, map: null, pos: null, path: [], node: null, freeRolls: 0, oddsBonus: 0, enemies: [], mode: 'map',
      stats: { wins: 0, battles: 0, merges: 0, goldEarned: 0, kills: 0, time: 0, elites: 0, bosses: 0 },
    };
    for (const d of [...UNITS, ...SKILLS, ...ITEMS]) R.pool[keyOf(d.kind, d.id)] = POOL_N[d.t];
    const spots = [[1, 3], [3, 3], [2, 5]];
    S.units.forEach(([id, sk, it], i) => {
      const u = mk('unit', id); take(u);
      u.skills = sk.map((s) => take(mk('skill', s)));
      if (it) u.item = take(mk('item', it));
      const d = DEF['unit:' + id];
      const [x, y] = d.range > 1 ? [[1, 5], [3, 5], [2, 5]][i % 3] : spots[i];
      u.x = x; u.y = y;
      if (R.board.some((b) => b.x === x && b.y === y)) { u.x = [0, 4, 2][i]; }
      R.board.push(u);
    });
    R.map = genMap(1);
    rollAll(true);
  }
  function take(c) { R.pool[keyOf(c.kind, c.id)] = Math.max(0, (R.pool[keyOf(c.kind, c.id)] || 0) - 1); return c; }
  function giveBack(c) { R.pool[keyOf(c.kind, c.id)] = (R.pool[keyOf(c.kind, c.id)] || 0) + copies(c.star); }

  // =====================================================================
  // 지도
  // =====================================================================
  function genMap(act) {
    const floors = [];
    for (let f = 0; f < 5; f++) {
      const n = 2 + rnd(2), xs = n === 2 ? [0.3, 0.7] : [0.18, 0.5, 0.82];
      floors.push(xs.map((x, i) => ({ id: `${act}-${f}-${i}`, f, x: x + AC.rand(-0.04, 0.04), k: null, next: [] })));
    }
    floors.push([{ id: `${act}-5-0`, f: 5, x: 0.5, k: 'boss', next: [] }]);
    for (let f = 0; f < 5; f++) {
      const a = floors[f], b = floors[f + 1];
      for (const n of a) {
        const s = b.slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x));
        n.next.push(s[0].id);
        if (s[1] && Math.abs(s[1].x - n.x) < 0.42 && Math.random() < 0.55) n.next.push(s[1].id);
      }
      for (const m of b) if (!a.some((n) => n.next.includes(m.id))) a.slice().sort((p, q) => Math.abs(p.x - m.x) - Math.abs(q.x - m.x))[0].next.push(m.id);
    }
    const W = { fight: 46, elite: 14, event: 12, camp: 9, forge: 8, shop: 8, treasure: 5 };
    for (let f = 0; f < 5; f++) for (const n of floors[f]) {
      if (f === 0) { n.k = 'fight'; continue; }
      const keys = Object.keys(W).filter((k) => !(k === 'elite' && f < 2));
      n.k = keys[AC.weighted(keys.map((k) => W[k]))];
    }
    const mids = floors.slice(1, 5).flat();
    if (!mids.some((n) => n.k === 'elite')) pick(floors.slice(2, 5).flat()).k = 'elite';
    if (!mids.some((n) => n.k === 'shop')) pick(mids.filter((n) => n.k !== 'elite')).k = 'shop';
    for (let f = 1; f < 5; f++) if (!floors[f].some((n) => n.k === 'fight' || n.k === 'elite')) pick(floors[f]).k = 'fight';
    return { act, floors, boss: pick(ACTS[act].bosses) };
  }
  const allNodes = () => R.map.floors.flat();
  const nodeById = (id) => allNodes().find((n) => n.id === id);
  function reachable() {
    if (!R.pos) return R.map.floors[0].map((n) => n.id);
    const n = nodeById(R.pos);
    return n ? n.next : [];
  }

  // =====================================================================
  // 상점 · 창고 · 합성
  // =====================================================================
  function oddsLv() { return Math.min(9, R.lv + (R.oddsBonus || 0) + (has('dice') ? 1 : 0)); }
  function rollTier(kind) {
    const o = ODDS[oddsLv()];
    const t = AC.weighted(o) + 1;
    return Math.min(t, MAXT[kind]);
  }
  function rollCard(kind, tier) {
    for (let t = tier; t >= 1; t--) {
      const cand = POOL[kind].filter((d) => d.t === t && R.pool[keyOf(kind, d.id)] > 0);
      if (cand.length) return mk(kind, cand[AC.weighted(cand.map((d) => R.pool[keyOf(kind, d.id)]))].id);
    }
    return null;
  }
  function rollRow(kind) { R.shop[kind] = Array.from({ length: 5 }, () => rollCard(kind, rollTier(kind))); }
  function rollAll(force) { for (const k of ['unit', 'skill', 'item']) if (force || !R.locked[k]) rollRow(k); R.locked = { unit: false, skill: false, item: false }; }

  const allUnits = () => [...R.board, ...R.bench.filter((c) => c && c.kind === 'unit')];
  function locs(kind, id, star) {
    const L = [];
    if (kind === 'unit') R.board.forEach((u) => { if (u.id === id && u.star === star) L.push({ w: 'board', c: u }); });
    else for (const u of allUnits()) {
      if (kind === 'skill') u.skills.forEach((c) => { if (c.id === id && c.star === star) L.push({ w: 'eq', c, u }); });
      if (kind === 'item' && u.item && u.item.id === id && u.item.star === star) L.push({ w: 'eq', c: u.item, u });
    }
    R.bench.forEach((c, i) => { if (c && c.kind === kind && c.id === id && c.star === star) L.push({ w: 'bench', c, i }); });
    return L;
  }
  const owned = (kind, id) => locs(kind, id, 1).length;
  function removeLoc(l) {
    if (l.w === 'board') R.board = R.board.filter((u) => u !== l.c);
    else if (l.w === 'bench') R.bench[l.i] = null;
    else if (l.c.kind === 'skill') l.u.skills = l.u.skills.filter((c) => c !== l.c);
    else l.u.item = null;
  }
  function fixBench() { const n = benchSize(); R.bench = R.bench.filter((c, i) => i < n || c); while (R.bench.length > n) { const i = R.bench.indexOf(null); if (i < 0) break; R.bench.splice(i, 1); } while (R.bench.length < n) R.bench.push(null); }
  function toBench(c) {
    const i = R.bench.indexOf(null);
    if (i < 0 || i >= benchSize()) { R.gold += price(c); giveBack(c); toast(`창고가 가득 차서 ${def(c).name} 판매(+${price(c)}골드)`); return false; }
    R.bench[i] = c; return true;
  }
  function tryMerge(kind, id, star, quiet) {
    if (star >= 3) return;
    const L = locs(kind, id, star);
    if (L.length < 3) return;
    const [keep, ...rest] = L.slice(0, 3);
    const back = [];
    for (const l of rest) { removeLoc(l); if (kind === 'unit') { back.push(...l.c.skills); if (l.c.item) back.push(l.c.item); } }
    keep.c.star++;
    fixBench();
    R.stats.merges++;
    if (has('glue')) R.gold += 2;
    if (!quiet) fxMerge(keep);
    for (const c of back) toBench(c);
    for (const c of back) tryMerge(c.kind, c.id, c.star, quiet);
    tryMerge(kind, id, star + 1, quiet);
  }
  function gain(c, quiet) {
    // 상점 밖에서 얻은 카드(보상·이벤트): 합성 가능하면 창고가 차 있어도 받는다
    const free = R.bench.indexOf(null);
    if (free < 0 && owned(c.kind, c.id) < 2) { R.gold += price(c); giveBack(c); toast(`창고가 가득 차서 ${def(c).name}을(를) 골드로 받았어요`); return; }
    if (free >= 0) R.bench[free] = c; else R.bench.push(c);
    tryMerge(c.kind, c.id, 1, quiet);
    fixBench();
  }
  function buy(i, quiet, kind = ui.tab) {
    const c = R.shop[kind][i]; if (!c) return false;
    const p = def(c).t;
    if (R.gold < p) { if (!quiet) toast('골드가 모자라요'); return false; }
    const free = R.bench.indexOf(null);
    if (free < 0 && owned(c.kind, c.id) < 2) { if (!quiet) toast('창고가 가득 찼어요. 팔거나 배치하세요'); return false; }
    R.gold -= p; R.shop[kind][i] = null; ui.sel = null;
    take(c);
    if (free >= 0) R.bench[free] = c; else R.bench.push(c);
    if (!quiet) SFX.play('coin');
    tryMerge(c.kind, c.id, 1, quiet);
    fixBench();
    if (!quiet) renderPlay();
    return true;
  }
  function sellCard(c, from, i) {
    const g = price(c);
    if (from === 'bench') R.bench[i] = null; else R.board = R.board.filter((u) => u !== c);
    giveBack(c);
    if (c.kind === 'unit') { [...c.skills, c.item].filter(Boolean).forEach(toBench); }
    R.gold += g;
    return g;
  }
  function reroll(quiet, kind = ui.tab) {
    const free = R.freeRolls > 0;
    if (!free && R.gold < 1) { if (!quiet) toast('골드가 모자라요'); return false; }
    if (free) R.freeRolls--; else R.gold -= 1;
    rollRow(kind); R.locked[kind] = false;
    if (!quiet) { SFX.play('card'); renderPlay(); }
    return true;
  }
  function addXp(n) {
    R.xp += n;
    let up = false;
    while (R.lv < 8 && R.xp >= XPNEED[R.lv]) { R.xp -= XPNEED[R.lv]; R.lv++; up = true; }
    if (R.lv >= 8) R.xp = 0;
    return up;
  }
  function levelUp(quiet) {
    if (R.lv >= 8) { if (!quiet) toast('최대 레벨'); return false; }
    if (R.gold < 4) { if (!quiet) toast('골드가 모자라요'); return false; }
    R.gold -= 4;
    if (addXp(4) && !quiet) { toast(`원정대 Lv${R.lv} · 출전 ${deployMax()}명`); SFX.play('win'); }
    if (!quiet) renderPlay();
    return true;
  }
  const canEquip = (chip, u) => { const d = def(chip); return d.cls === 'any' || d.cls === def(u).cls; };
  function equip(chip, benchI, u, quiet) {
    if (!canEquip(chip, u)) { if (!quiet) toast(`${CLS[def(chip).cls].name} 전용이에요`); return false; }
    R.bench[benchI] = null;
    if (chip.kind === 'skill') {
      if (u.skills.length < skillSlots(u)) u.skills.push(chip);
      else { const old = u.skills[u.skills.length - 1]; u.skills[u.skills.length - 1] = chip; R.bench[benchI] = old; }
    } else { const old = u.item; u.item = chip; if (old) R.bench[benchI] = old; }
    if (!quiet) { SFX.play('attach'); fxStampAtUnit(u, '장착'); }
    return true;
  }
  function unequip(u, slot) {
    const c = slot === 'item' ? u.item : u.skills[slot];
    if (!c) return;
    const i = R.bench.indexOf(null);
    if (i < 0) return toast('창고에 빈칸이 없어요');
    if (slot === 'item') u.item = null; else u.skills.splice(slot, 1);
    R.bench[i] = c; SFX.play('card');
  }

  // =====================================================================
  // 노드 진행
  // =====================================================================
  function income() {
    const intMax = 5 + (has('vault') ? 2 : 0);
    const interest = Math.min(intMax, Math.floor(R.gold / 10));
    const st = R.streak >= 8 ? 3 : R.streak >= 5 ? 2 : R.streak >= 3 ? 1 : 0;
    return { base: 5, interest, streak: st, total: 5 + interest + st };
  }
  function enterNode(n, quiet) {
    R.round++;
    R.node = { id: n.id, k: n.k, f: n.f };
    R.oddsBonus = n.k === 'shop' ? 1 : 0;
    R.freeRolls = (has('scale') ? 1 : 0) + (n.k === 'shop' ? 3 : 0);
    let inc = null;
    if (R.round > 1) { inc = income(); R.gold += inc.total; R.stats.goldEarned += inc.total; addXp(2); }
    rollAll(R.round === 1);
    R.enemies = ['fight', 'elite', 'boss'].includes(n.k) ? genEnemies(n.k) : [];
    R.mode = R.enemies.length ? 'fight' : 'rest';
    if (quiet) return inc;
    ui.sel = null; ui.tab = 'unit'; ui.showFoe = false;
    showPlay();
    if (inc) toast(`라운드 ${R.round}: 수입 +${inc.total}골드 (기본 5 · 이자 ${inc.interest}${inc.streak ? ' · 연승 ' + inc.streak : ''})`);
    else toast('상점 카드를 탭해 정보를 보고 구매 버튼으로 사세요. 딱지를 탭하면 능력치와 장비가 보입니다');
    if (n.k === 'camp') openCamp(); else if (n.k === 'event') openEvent(); else if (n.k === 'forge') openForge(); else if (n.k === 'treasure') openTreasure();
    else if (n.k === 'shop') toast('암시장: 상점 등급 확률 +1, 다시 뽑기 3번 무료');
    return inc;
  }
  function finishNode() {
    const n = R.node;
    R.pos = n.id; R.path.push(n.id); R.lastNode = n; R.node = null; R.enemies = []; R.mode = 'map';
    if (n.k === 'boss') {
      if (R.act >= 3) return victory();
      R.act++; R.map = genMap(R.act); R.pos = null; R.path = [];
      ui.actIntro = true;
    }
    showMap();
  }

  // ---------- 적 편성 ----------
  const CS = 64, COLS = 5, ROWS = 6, PLAYER_ROW = 3, M = 8;
  const W = CS * COLS + M * 2, H = CS * ROWS + M * 2;
  const grid = AC.squareGrid(COLS, ROWS, CS, { ox: M, oy: M, diag: true });
  function genEnemies(kind) {
    const A = ACTS[R.act], out = [], used = new Set(R.board.map((u) => grid.idx(u.x, u.y)));
    const t = window.__tune || {};
    const put = (id, rows, col) => {
      const d = MONSTERS[id];
      for (let k = 0; k < 60; k++) {
        const cell = grid.idx(col != null && k === 0 ? col : AC.randi(0, COLS - 1), AC.pick(rows));
        if (!used.has(cell)) { used.add(cell); out.push({ uid: 'e' + (uidN++), def: d, cell, scale: 1, rot: AC.rand(-0.09, 0.09) }); return; }
      }
    };
    const rowsFor = (d) => (d.range > 1 ? [0] : [1, 2]);
    if (kind === 'boss') {
      const boss = MONSTERS[R.map.boss];
      put(boss.id, [1], 2);
      const adds = { gobking: ['goblin', 'goblin'], slimeking: ['slime', 'slime'], lich: ['skel', 'skelarch'], vampire: ['bat', 'bat', 'cultist'], dragon: ['imp', 'imp', 'salam'] }[boss.boss];
      for (const id of adds) put(id, rowsFor(MONSTERS[id]));
    } else if (kind === 'elite') {
      for (const id of AC.pick(A.elites)) put(id, rowsFor(MONSTERS[id]));
      const extra = Math.floor((R.round - 3) / 4);
      for (let k = 0; k < extra; k++) { const id = AC.pick(A.normal.filter((x) => MONSTERS[x].v <= 1.5)); put(id, rowsFor(MONSTERS[id])); }
    } else {
      let budget = (t.b0 || 2.2) + (t.bK || 0.3) * R.round;
      while (budget > 0.4 && out.length < 9) {
        const opts = A.normal.filter((id) => MONSTERS[id].v <= budget + 0.5);
        if (!opts.length) break;
        const id = AC.pick(opts);
        budget -= MONSTERS[id].v;
        put(id, rowsFor(MONSTERS[id]));
      }
    }
    return out.map((x) => ({ uid: x.uid, id: x.def.id, cell: x.cell, scale: x.scale, rot: x.rot }));
  }

  // =====================================================================
  // 전투
  // =====================================================================
  const battleApi = BT4.create({
    grid, PLAYER_ROW, COLS, ROWS, getR: () => R,
    phase: (t) => { if (B) B.phaseText = t; },
    fx: { play: (n, g) => { if (B && !B.sim) SFX.play(n, g); }, shake: (n) => shake(n), burst: (x, y, c, n) => burst(x, y, c, n), death: (t) => onTokenDeath(t) },
  });
  function buildCombat() {
    const syn = battleApi.synergyCounts(R.board);
    const ents = R.board.map((c) => battleApi.makeAlly(c, grid.idx(c.x, c.y), syn));
    for (const x of R.enemies) ents.push(battleApi.makeFoe({ uid: x.uid, def: MONSTERS[x.id], cell: x.cell, scale: x.scale, rot: x.rot }));
    const cb = new AC.Combat(grid, ents, { hooks: battleApi.hooks(), maxTime: R.node && R.node.k === 'boss' ? 150 : 80 });
    cb.tele = cb.tele || [];
    return cb;
  }
  function judge(cb) {
    if (cb.winner !== -1) return cb.winner === 0;
    const ratio = (s) => { const us = cb.units.filter((u) => u.side === s && !u.summon && !u.object); return us.reduce((a, u) => a + Math.max(0, u.hp) / u.maxHp, 0) / Math.max(1, us.length); };
    return ratio(0) > ratio(1);
  }
  function simFight() {
    B = { sim: true, vfx: newVfx() };
    const cb = buildCombat();
    B.combat = cb;
    while (!cb.done) cb.step(1 / 30);
    const won = judge(cb);
    const r = { won, gold: cb.goldBonus || 0, t: cb.t };
    B = null;
    return r;
  }
  function startCombat() {
    if (!R.board.length) return toast('딱지를 하나 이상 보드에 놓으세요');
    if (R.board.length > deployMax()) return toast(`출전은 ${deployMax()}명까지예요`);
    ui.sel = null;
    B = { sim: false, vfx: newVfx(), speed: ui.speed || 1, phase: 'combat', phaseText: '' };
    B.combat = buildCombat();
    R.stats.battles++;
    const boss = B.combat.units.find((u) => u.boss);
    bannerStamp(boss ? boss.def.name : R.node.k === 'elite' ? '정예 출현!' : '전투 개시!');
    SFX.play(boss ? 'boss' : 'start');
    renderPlay();
  }
  function endCombat() {
    const cb = B.combat, won = judge(cb);
    B.phase = 'result'; B.won = won;
    const kind = R.node.k;
    if (won) {
      const g = 1 + (has('goldtooth') ? 2 : 0) + (cb.goldBonus || 0) + (kind === 'elite' ? 2 : kind === 'boss' ? 4 : 0) + [0, 1, 2][battleApi.synergyCounts(R.board).ttiers.company || 0];
      R.gold += g; R.stats.goldEarned += g; R.stats.wins++; R.streak++;
      if (kind === 'elite') R.stats.elites++;
      if (kind === 'boss') R.stats.bosses++;
      B.reward = g;
      bannerStamp(kind === 'boss' ? '보스 처치!' : '승리!', 'win');
      SFX.play('win');
    } else {
      R.streak = 0;
      B.phoenix = has('phoenix');
      bannerStamp('패배', 'lose');
      SFX.play('lose');
    }
    R.stats.kills += cb.units.filter((u) => u.side === 1 && u.dead && !u.summon).length;
    renderPlay();
  }
  function afterCombat() {
    const won = B.won, kind = R.node.k;
    B = null;
    $('bstamp').className = 'bstamp';
    if (!won) {
      if (has('phoenix')) { R.relics.splice(R.relics.indexOf('phoenix'), 1); toast('불사조 깃털이 타올라 원정이 이어집니다'); return finishNode(); }
      return gameOver();
    }
    if (kind === 'elite') return pickReward('정예 전리품', '한 등급 높은 카드 하나를 고르세요', eliteChoices(), finishNode);
    if (kind === 'boss') return relicPick('보스 전리품', () => pickReward('보스 전리품', '강력한 유닛 하나를 고르세요', bossUnits(), finishNode));
    finishNode();
  }
  function eliteChoices() {
    const top = Math.min(5, R.act + 1 + (R.lv >= 6 ? 1 : 0));
    return ['unit', 'skill', 'item'].map((k) => { const c = rollCard(k, Math.min(MAXT[k], top)); return c; }).filter(Boolean);
  }
  function bossUnits() {
    const t = R.act === 1 ? 4 : 5;
    const cand = AC.shuffle(UNITS.filter((d) => d.t >= t - (R.act === 1 ? 0 : 1) && R.pool[keyOf('unit', d.id)] > 0)).slice(0, 3);
    return cand.map((d) => mk('unit', d.id));
  }

  // =====================================================================
  // 화면 공통
  // =====================================================================
  const ui = { tab: 'unit', sel: null, speed: 1, screen: 'title' };
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); }
  function stampAt(x, y, txt, cls = '') { const ph = $('phone'), el = document.createElement('div'); el.className = 'stamp ' + cls; el.textContent = txt; el.style.left = x + 'px'; el.style.top = y + 'px'; ph.appendChild(el); setTimeout(() => el.remove(), 1200); }
  const phoneRect = () => $('phone').getBoundingClientRect();
  function cellScreen(x, y) { const r = $('cv').getBoundingClientRect(), p = phoneRect(), k = r.width / W; const c = grid.cells[grid.idx(x, y)]; return [r.left - p.left + c.x * k, r.top - p.top + (c.y - viewY()) * k]; }
  function fxStampAtUnit(u, txt) {
    if (R.board.includes(u)) { const [x, y] = cellScreen(u.x, u.y); stampAt(x, y, txt); return; }
    const i = R.bench.indexOf(u), el = $('bench').children[i];
    if (el) { const r = el.getBoundingClientRect(), p = phoneRect(); stampAt(r.left - p.left + r.width / 2, r.top - p.top, txt); }
  }
  function fxMerge(l) {
    SFX.play('place');
    setTimeout(() => {
      const txt = '★'.repeat(l.c.star) + ' 합성!';
      if (l.w === 'board') fxStampAtUnit(l.c, txt);
      else if (l.w === 'eq') fxStampAtUnit(l.u, txt);
      else { const el = $('bench').children[l.i]; if (el) { const r = el.getBoundingClientRect(), p = phoneRect(); stampAt(r.left - p.left + r.width / 2, r.top - p.top - 4, txt); } }
      toast(`${def(l.c).name} ${'★'.repeat(l.c.star)} 합성`);
    }, 40);
  }
  function bannerStamp(text, cls = '') {
    const b = $('bstamp'); b.textContent = text; b.className = 'bstamp'; void b.offsetWidth; b.className = 'bstamp show ' + cls;
    clearTimeout(bannerStamp.t); if (!cls) bannerStamp.t = setTimeout(() => { b.className = 'bstamp'; }, 1200);
  }
  function show(screen) {
    ui.screen = screen;
    $('phone').dataset.act = R ? R.act : '';
    for (const s of ['title', 'map', 'play', 'over']) $('scr-' + s).hidden = s !== screen;
    $('hud').hidden = !(screen === 'map' || screen === 'play');
    closeSheet();
  }
  function renderHud() {
    if (!R) return;
    $('gold').textContent = R.gold;
    $('gold').hidden = ui.screen === 'play';
    const intMax = 5 + (has('vault') ? 2 : 0);
    $('sgold').textContent = R.gold; $('sint').textContent = `다음 이자 +${Math.min(intMax, Math.floor(R.gold / 10))}`;
    if (ui.lastGold != null && ui.lastGold !== R.gold) { const g = $('sgold').parentNode; g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
    ui.lastGold = R.gold;
    $('lvB').textContent = 'Lv' + R.lv;
    $('xpT').textContent = R.lv < 8 ? `${R.xp}/${XPNEED[R.lv]}` : 'MAX';
    $('xpBar').style.width = R.lv < 8 ? (100 * R.xp / XPNEED[R.lv]) + '%' : '100%';
    const n = R.node, A = ACTS[R.act];
    if (ui.screen === 'map') { $('hWhere').textContent = `${R.act}막 ${A.name}`; $('hSub').textContent = `라운드 ${R.round} 완료 · 연승 ${R.streak}`; }
    else if (n) { $('hWhere').textContent = `${R.act}막 · ${n.f === 5 ? '보스' : n.f + 1 + '층'} ${NODE[n.k].name}`; $('hSub').textContent = B && B.phase !== 'prep' ? '자동 전투' : `라운드 ${R.round} · 연승 ${R.streak}`; }
  }

  // ---------- 이미지 ----------
  function imgOf(c, px = 96) {
    const d = def(c);
    if (c.kind === 'unit') return ART.discURL(d.id, 0, d.cls, c.skills ? battleApi.loadoutOf(c) : null, px);
    if (c.kind === 'skill') return ART.chipURL(CLS[d.cls].col, d.icon || 'star', c.star > 1, Math.round(px * 0.6));
    return ART.weaponURL(battleApi.wpArt(d), c.star > 1, Math.round(px * 0.6));
  }
  function patternGrid(d, star = 1) {
    const g = Array.from({ length: 25 }, () => '');
    const set = (x, y, v) => { if (x >= 0 && x < 5 && y >= 0 && y < 5) g[y * 5 + x] = v; };
    const hc = ['heal', 'shield', 'haste', 'buff', 'revive', 'mana', 'parry', 'fortify', 'timewarp'].includes(d.effect) ? 'ally' : d.effect === 'taunt' ? 'warn' : d.effect === 'debuff' ? 'debuff' : 'hit';
    const cells = BT4.expandCells(d, star) || d.cells;
    switch (d.mode) {
      case 'facing': set(2, 4, 'me'); for (const [f, s] of cells) set(2 + s, 4 - f, hc); break;
      case 'line': set(2, 4, 'me'); for (let y = 0; y < 4; y++) set(2, y, hc); break;
      case 'targetFacing': set(2, 4, 'me'); for (const [f, s] of cells) set(2 + s, 2 - f, hc); set(2, 2, hc + ' tg'); break;
      case 'self': for (const [x, y] of cells) set(2 + x, 2 + y, hc); set(2, 2, cells.some(([x, y]) => !x && !y) ? hc + ' me' : 'me'); break;
      case 'target': for (const [x, y] of cells) set(2 + x, 2 + y, hc); set(2, 2, hc + ' tg'); break;
      case 'chain': set(2, 4, 'me'); [[2, 2], [3, 1], [1, 1], [2, 0]].forEach(([x, y]) => set(x, y, hc)); set(2, 2, hc + ' tg'); break;
      case 'volley': set(2, 4, 'me'); [[0, 0], [3, 1], [1, 2], [4, 0], [2, 1]].forEach(([x, y]) => set(x, y, hc)); break;
      case 'lowest': set(2, 4, 'me'); set(3, 0, hc + ' tg'); break;
      case 'leap': set(2, 4, 'me'); set(3, 0, hc + ' tg'); set(3, 1, 'me ghost'); break;
      case 'single': set(2, 4, 'me'); set(2, 2, hc + ' tg'); break;
      case 'selfOnly': set(2, 2, 'ally me'); break;
      case 'ally': case 'lowestAlly': set(2, 2, 'me'); set(1, 3, 'ally'); break;
      case 'dead': set(2, 2, 'me'); set(3, 3, 'ally tg'); break;
      case 'all': set(2, 2, 'me'); [[0, 1], [4, 3], [1, 4], [3, 0], [4, 1]].forEach(([x, y]) => set(x, y, 'ally')); break;
    }
    return '<div class="pat" aria-hidden="true">' + g.map((v) => `<i class="${v}"></i>`).join('') + '</div>';
  }
  function synHTML(cards) {
    const sc = battleApi.synergyCounts(cards);
    const cls = Object.keys(SYN).map((k) => { const th = SYN[k].th, act = th.filter((t) => sc.counts[k] >= t).length, nx = th.find((t) => sc.counts[k] < t);
      return `<button class="pill${act ? ' on' : ''}" data-syn="${k}" style="--c:${CLS[k].col}"><i>${CLS[k].short}</i>${CLS[k].name} ${sc.counts[k]}<small>/${nx || th[th.length - 1]}</small></button>`; });
    const trKeys = Object.keys(TRAITS).filter((k) => sc.tcounts[k] > 0).sort((a, b) => sc.tcounts[b] - sc.tcounts[a]);
    const trPill = (k) => {
      const T = TRAITS[k], on = sc.ttiers[k] > 0, need = T.kind === 'combo' ? T.members.length : (T.th.find((t) => sc.tcounts[k] < t) || T.th[T.th.length - 1]);
      return `<button class="pill tr${on ? ' on' : ''}" data-tr="${k}" style="--c:${T.col}"><i>${T.short}</i>${T.name} ${sc.tcounts[k]}<small>/${need}</small></button>`;
    };
    // 켜진 특성 → 클래스 → 아직 모자란 특성 순
    return `<button class="pill all" data-allsyn>시너지</button>` + [...trKeys.filter((k) => sc.ttiers[k] > 0).map(trPill), ...cls, ...trKeys.filter((k) => !sc.ttiers[k]).map(trPill)].join('');
  }
  // 시너지 전체 목록(도감·시트 공용). cards 가 있으면 진행도와 보유 표시
  function synList(cards) {
    const sc = cards ? battleApi.synergyCounts(cards) : null;
    const owned = cards ? new Set(allUnits().map((u) => u.id)) : null;
    const block = (key, name, col, short, kindTxt, lines, members, tier, n, need) => {
      const ms = members.map((id) => { const d = DEF['unit:' + id]; const st = !cards ? '' : cards.some((c) => c.id === id) ? 'on' : owned.has(id) ? 'own' : 'off';
        return `<span class="sm ${st}"><img src="${ART.tokenURL(id, 0, d.cls)}" alt=""><small>${d.name}</small></span>`; }).join('');
      return `<div class="cx synrow"><div><b><span class="sico" style="--c:${col}">${short}</span>${name}</b> <small class="tg">${kindTxt}${cards ? ` · ${n}/${need}` : ''}</small>
        ${lines.map((l, i) => `<small class="${cards && tier > i ? 'act' : ''}">${l}</small>`).join('')}<div class="sms">${ms}</div></div></div>`;
    };
    let out = '';
    for (const [k, T] of Object.entries(TRAITS)) {
      const lines = T.kind === 'combo' ? T.desc : T.desc.map((d, i) => `(${T.th[i]}) ${d}`);
      out += block(k, T.name, T.col, T.short, T.kind === 'combo' ? '특별 조합 · 전원 필요' : '기본 · ' + T.th.join('/') + '명', lines, T.members, sc ? sc.ttiers[k] : 0, sc ? sc.tcounts[k] : 0, T.kind === 'combo' ? T.members.length : (sc ? T.th.find((x) => sc.tcounts[k] < x) || T.th[T.th.length - 1] : T.th[0]));
    }
    for (const [k, S] of Object.entries(SYN)) {
      out += block(k, CLS[k].name, CLS[k].col, CLS[k].short, '클래스 · ' + S.th.join('/') + '명', S.desc.map((d, i) => `(${S.th[i]}) ${d}`), UNITS.filter((u) => u.cls === k).map((u) => u.id), sc ? sc.tiers[k] : 0, sc ? sc.counts[k] : 0, sc ? S.th.find((x) => sc.counts[k] < x) || S.th[S.th.length - 1] : S.th[0]);
    }
    return out;
  }
  function openSynSheet() {
    openSheet(`<span class="eyebrow">시너지 · 출전한 딱지 기준(같은 유닛은 한 번만 셈)</span><h2>시너지 전체</h2><div class="synlist">${synList(R.board)}</div><button class="btn" data-close>닫기</button>`);
    $('sheetIn').onclick = (e) => { if (e.target.closest('[data-close]')) closeSheet(); };
  }


  // =====================================================================
  // 지도 화면
  // =====================================================================
  let mapPick = null;
  function nodeIcon(k, px = 64) {
    const key = 'n' + k + px; if (nodeIcon[key]) return nodeIcon[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const r = px * 0.4, x = px / 2, y = px / 2 - 2;
    c.fillStyle = '#232a3b'; c.beginPath(); c.arc(x + 1.5, y + 4, r, 0, 7); c.fill();
    c.fillStyle = NODE[k].col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#232a3b'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r - 4, 0, 7); c.stroke();
    c.save(); c.translate(x, y); ART.icon(c, NODE[k].icon, r * 0.62); c.restore();
    return (nodeIcon[key] = cv.toDataURL());
  }
  function showMap() {
    show('map');
    save();
    const rc = reachable();
    if (!mapPick || !rc.includes(mapPick)) mapPick = rc[0];
    renderMap();
    if (ui.actIntro) { ui.actIntro = false; const p = phoneRect(); stampAt(p.width / 2, p.height * 0.4, `${R.act}막 · ${ACTS[R.act].name}`, 'act'); SFX.play('boss'); }
  }
  function renderMap() {
    if (ui.screen !== 'map') return;
    renderHud();
    const rc = reachable(), sel = nodeById(mapPick);
    const bossNote = sel && sel.k === 'boss' ? ` ${MONSTERS[R.map.boss].name}: ${BOSS_INFO[R.map.boss] || ''}` : '';
    $('mapinfo').innerHTML = sel ? `<b>${sel.f === 5 ? '보스' : sel.f + 1 + '층'} · ${NODE[sel.k].name}</b><p>${NODE[sel.k].info}${esc(bossNote)}</p>
      <div class="party">${R.board.map((u) => `<img src="${imgOf(u, 64)}" alt="${def(u).name}">`).join('')}<span class="deploy">출전 ${R.board.length}/${deployMax()} · 창고 ${R.bench.filter(Boolean).length}/${benchSize()} · 유물 ${R.relics.length}</span></div>` : '';
    $('legend').innerHTML = ['fight', 'elite', 'shop', 'forge', 'camp', 'event', 'treasure'].map((k) => `<span><img src="${nodeIcon(k, 32)}" alt="">${NODE[k].name}</span>`).join('');
    const box = $('mapbox'), Wd = box.clientWidth, Hd = box.clientHeight;
    const pos = (n) => [n.x * Wd, 42 + (5 - n.f) * ((Hd - 72) / 5)];
    box.querySelectorAll('.node,.floor').forEach((el) => el.remove());
    const pathSet = new Set(R.path);
    let svg = '';
    for (const fl of R.map.floors) for (const n of fl) for (const nid of n.next) {
      const m = nodeById(nid), [x1, y1] = pos(n), [x2, y2] = pos(m);
      const on = pathSet.has(n.id) && pathSet.has(m.id), nx = n.id === R.pos && rc.includes(m.id);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? '#2f6fd6' : '#232a3b'}" stroke-width="${on ? 4 : 2}" stroke-dasharray="${on ? '' : nx ? '7 4' : '3 5'}" opacity="${on || nx ? 1 : 0.45}"/>`;
    }
    $('mapsvg').innerHTML = svg;
    for (const fl of R.map.floors) {
      const f = fl[0].f, flEl = document.createElement('span'); flEl.className = 'floor'; flEl.style.top = pos(fl[0])[1] + 'px'; flEl.textContent = f === 5 ? '보스' : `${f + 1}층`; box.appendChild(flEl);
      for (const n of fl) {
        const b = document.createElement('button'), [x, y] = pos(n);
        const done = pathSet.has(n.id), here = n.id === R.pos, next = rc.includes(n.id);
        b.className = 'node' + (n.k === 'boss' ? ' boss' : '') + (done && !here ? ' done' : '') + (next ? ' next' : '') + (mapPick === n.id ? ' pick' : '');
        b.style.left = x + 'px'; b.style.top = y + 'px';
        b.innerHTML = `<img src="${nodeIcon(n.k, n.k === 'boss' ? 96 : 64)}" alt="">${here ? '<span class="here">현재</span>' : ''}`;
        b.setAttribute('aria-label', `${f === 5 ? '보스' : f + 1 + '층'} ${NODE[n.k].name}${next ? ', 갈 수 있음' : ''}`);
        b.onclick = () => { if (next) { mapPick = n.id; SFX.play('click'); renderMap(); } else toast(done ? '이미 지나온 곳' : '아직 갈 수 없는 곳'); };
        box.appendChild(b);
      }
    }
  }
  $('mapGo').onclick = () => { const n = nodeById(mapPick); if (n && reachable().includes(n.id)) { SFX.play('step'); enterNode(n); } };

  // =====================================================================
  // 준비 · 전투 화면
  // =====================================================================
  const CORDER = ['war', 'arc', 'mag', 'any'];
  function showPlay() { $('bstamp').className = 'bstamp'; show('play'); fitBoard(); renderPlay(); }
  function renderPlay() {
    if (ui.screen !== 'play') return;
    renderHud();
    const combat = !!B;
    $('prepUI').hidden = combat; $('bpanel').hidden = !combat; $('foebox').hidden = !combat;
    $('syn').innerHTML = synHTML(R.board);
    if (combat) { renderBattlePanel(); fitBoard(); return; }
    renderPrep();
    fitBoard();
  }
  function renderPrep() {
    const s = ui.sel;
    $('benchN').innerHTML = `${R.bench.filter(Boolean).length}/${benchSize()}</b> · 출전 <b>${R.board.length}/${deployMax()}`;
    $('benchHint').textContent = !s ? '탭해서 고르기' : s.from === 'shop' ? '구매 버튼으로 삽니다' : s.c.kind === 'unit' ? '보드 칸을 탭하면 배치·이동' : `${CLS[def(s.c).cls].name === '공용' ? '아무' : CLS[def(s.c).cls].name} 딱지를 탭해 장착`;
    $('bench').style.gridTemplateColumns = `repeat(${benchSize()}, minmax(0,1fr))`;
    $('bench').innerHTML = R.bench.map((c, i) => {
      if (!c) return `<button class="slot${s && (s.from === 'board' || (s.from === 'bench' && s.i !== i)) ? ' drop' : ''}" data-b="${i}" aria-label="빈 칸"></button>`;
      const can = s && s.from === 'bench' && s.c.kind !== 'unit' && c.kind === 'unit' && canEquip(s.c, c);
      return `<button class="slot${s && s.c === c ? (drag.on ? ' dragsrc' : ' sel') : ''}${can ? ' can' : ''}" data-b="${i}" aria-label="${def(c).name}${starTxt(c.star)}"><img src="${imgOf(c, 80)}" alt=""><span class="stars${c.star > 2 ? ' s3' : ''}">${starTxt(c.star)}</span></button>`;
    }).join('');
    for (const k of ['unit', 'skill', 'item']) {
      const ready = R.shop[k].some((c) => c && owned(c.kind, c.id) >= 2);
      document.querySelector(`[data-lbl="${k}"]`).classList.toggle('ready', ready);
      const lk = document.querySelector(`[data-lock="${k}"]`); lk.classList.toggle('on', R.locked[k]); lk.textContent = R.locked[k] ? '잠김' : '잠금';
      document.querySelector(`[data-cost="${k}"]`).textContent = R.freeRolls > 0 ? '무료' : '1';
    }
    const fb = $('foeBtn'); fb.hidden = R.mode !== 'fight'; fb.classList.toggle('on', !!ui.showFoe); fb.textContent = ui.showFoe ? '상점 보기' : '적 필드 보기';
    const unitSheet = !!s && s.from !== 'shop' && s.c.kind === 'unit' && !drag.on;
    if (!s || s.c !== ui.infoFor) { ui.openInfo = null; ui.infoFor = s ? s.c : null; }
    const showDetail = !!s && s.from !== 'shop' && s.c.kind !== 'unit' && !drag.on, peek = !!s && s.from === 'shop';
    $('detail').hidden = !showDetail;
    $('peek').hidden = !peek; $('usheet').hidden = !unitSheet;
    if (showDetail) renderDetail(s, $('detail'));
    if (unitSheet) { renderUnitSheet(s); $('usheet').style.top = $('syn').offsetTop + 'px'; }
    if (peek) { renderDetail(s, $('peek')); $('peek').style.bottom = ($('scr-play').clientHeight - $('shop').offsetTop + 6) + 'px'; }
    for (const k of ['unit', 'skill', 'item']) document.querySelector(`[data-row="${k}"]`).innerHTML = R.shop[k].map((c, i) => {
      if (!c) return `<div class="card sold" aria-hidden="true"></div>`;
      const d = def(c), n = owned(c.kind, c.id);
      return `<button class="card k-${c.kind} tier${d.t}${n >= 2 ? ' ready' : ''}${s && s.c === c ? ' sel' : ''}" data-s="${i}" data-k="${k}" style="--tc:var(--t${d.t});--cc:${CLS[d.cls].col}" aria-label="${d.name} ${d.t}골드">
        <span class="cost">${d.t}</span><span class="cl">${CLS[d.cls].short}</span>
        <img src="${imgOf(c, 84)}" alt="">${c.kind === 'unit' ? `<span class="trs">${d.traits.map((t) => `<i style="--c:${TRAITS[t].col}">${TRAITS[t].short}</i>`).join('')}</span>` : ''}<b>${d.name}</b>${n ? `<span class="own">${n >= 2 ? '★2 합성' : '보유 ' + n}</span>` : ''}</button>`;
    }).join('');
    $('lvBtn').innerHTML = R.lv >= 8 ? '최대 레벨' : `레벨업 <small>4골드 · 경험치 +4</small>`;
    $('goBtn').textContent = R.mode === 'fight' ? (R.node.k === 'boss' ? '보스 전투' : '전투 시작') : '지도로';
  }
  function renderDetail(s, el) {
    const c = s.c, d = def(c), shop = s.from === 'shop';
    let body = '';
    if (c.kind === 'unit') {
      const st = BT4.unitStats(c), slots = skillSlots(c);
      const sl = shop ? '' : `<div class="slots">${Array.from({ length: slots }, (_, k) => c.skills[k] ? `<button class="es f" data-un="${k}" aria-label="${def(c.skills[k]).name} 빼기"><img src="${imgOf(c.skills[k], 56)}" alt=""></button>` : `<span class="es"><small>스킬</small></span>`).join('')}${c.item ? `<button class="es f" data-un="item" aria-label="${def(c.item).name} 빼기"><img src="${imgOf(c.item, 56)}" alt=""></button>` : `<span class="es"><small>아이템</small></span>`}</div>`;
      const eq = shop ? '' : [...c.skills.map((x) => def(x).name + starTxt(x.star)), c.item ? def(c.item).name + starTxt(c.item.star) : null].filter(Boolean).join(' · ');
      body = `<p>${d.trait}<br><span class="meta">체력 ${st.hp} · 공격 ${st.atk} · 사거리 ${st.range}${eq ? ' · ' + esc(eq) : ''}</span>${shop ? '' : '<br><span class="hint">칩을 탭하면 창고로 빠집니다</span>'}</p>${sl}`;
    } else if (c.kind === 'skill') {
      body = `<p>${d.desc}<br><span class="meta">마나 ${d.mana || 60} · ★2 위력 ×1.7 · ★3 ×2.6, 범위 확장</span>${shop ? '' : `<br><span class="hint">${CLS[d.cls].name === '공용' ? '아무' : CLS[d.cls].name} 딱지를 탭해 장착</span>`}</p>${patternGrid(d, c.star)}`;
    } else {
      body = `<p>${d.desc}<br><span class="meta">끼우면 ${d.feel} · ★2 수치 ×1.6 · ★3 ×2.5</span>${shop ? '' : `<br><span class="hint">${CLS[d.cls].name} 딱지를 탭해 장착</span>`}</p>`;
    }
    const n = owned(c.kind, c.id);
    const btns = shop
      ? `<button class="btn pri" data-act="buy" ${R.gold < d.t ? 'disabled' : ''}>구매 · ${d.t}골드${n >= 2 ? ' → ★2' : ''}</button><button class="btn" data-act="close">닫기</button>`
      : `<button class="btn warn" data-act="sell">판매 +${price(c)}골드</button><button class="btn" data-act="close">닫기</button>`;
    el.innerHTML = `<button class="xbtn" data-act="close" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button><div class="dh"><img src="${imgOf(c, 104)}" alt=""><div class="tt"><b>${d.name} <em>${starTxt(c.star)}</em></b><div class="meta">${CLS[d.cls].name} ${KINDNAME[c.kind]} · ${d.t}등급(${TIERNAME[d.t]})${c.kind === 'unit' ? ' · ' + d.traits.map((t) => TRAITS[t].name).join(' · ') : ''}${shop && n ? ` · 보유 ${n}장` : ''}</div></div></div>
      <div class="ddesc">${body}</div><div class="dbtn">${btns}</div>`;
  }

  // ---------- 유닛 상세: 장착 장비·스킬 수치·능력치를 한 화면에 ----------
  const pct = (v) => Math.round(v * 100);
  const FXTEXT = {
    infiltrate: () => '전투 시작 시 적 뒤로 도약',
    healMace: (e, k) => `공격마다 가장 다친 아군 <em>${Math.round(e.atk * 0.6 * e.healMult * k)}</em> 회복`,
    bloodrage: () => '주변 적에게 35% 튐, 체력 50% 이하 공속 +40%',
    towerGuard: () => '4초마다 주변 적 도발, 맞으면 주변 아군 보호막',
    poisonHit: (e, k) => `공격 시 중독(초당 <em>${Math.round(30 * k)}</em>, 최대 3중첩)`,
    quiverHeal: (e, k) => `3타마다 치유 화살 <em>${Math.round(e.atk * 2.5 * e.healMult * k)}</em>`,
    hawkFocus: () => '사냥매 소환, 같은 적을 계속 쏘면 피해 증가',
    markAura: (e, k) => `맞힌 적 받는 피해 <em>+${Math.round(15 * Math.min(2, k))}%</em>, 주변 아군 공속 <em>+${Math.round(15 * k)}%</em>`,
    spellSlow: () => '스킬에 맞은 적 둔화',
    spellBurn: (e, k) => `스킬에 맞은 적 화상(초당 <em>${Math.round(30 * k)}</em>)`,
    healer: (e, k) => `다친 아군이 있으면 기본 공격 대신 <em>${Math.round(e.atk * 1.4 * e.healMult * k)}</em> 치유`,
    hourglass: (e, k) => `스킬 사용 시 주변 아군 마나 <em>+${Math.round(25 * k)}</em>`,
    echo: () => '2번 시전마다 한 번 더(위력 70%)',
  };
  function itemText(it, star, e) {
    const k = BT4.ITSTAR[star], st = it.st, parts = [];
    if (st.atk) parts.push(`공격력 <em>+${pct(st.atk * k)}%</em>`);
    if (st.as) parts.push(`공속 <em>+${pct(st.as * k)}%</em>`);
    if (st.hp) parts.push(`체력 <em>+${pct(st.hp * k)}%</em>`);
    if (st.armor) parts.push(`받는 피해 <em>−${pct(st.armor * k)}%</em>`);
    if (st.range) parts.push(`사거리 <em>+${st.range}</em>`);
    if (st.crit) parts.push(`치명 <em>+${pct(st.crit * k)}%</em>`);
    if (st.lifesteal) parts.push(`흡혈 <em>${pct(st.lifesteal * k)}%</em>`);
    if (st.spell) parts.push(`스킬 위력 <em>+${pct(st.spell * k)}%</em>`);
    if (st.heal) parts.push(`치유 <em>+${pct(st.heal * k)}%</em>`);
    if (st.mana) parts.push(`시작 마나 <em>+${Math.round(st.mana * Math.min(k, 1.6))}</em>`);
    if (st.manaPerHit) parts.push(`공격당 마나 <em>+${Math.round(st.manaPerHit * k)}</em>`);
    if (it.fx && FXTEXT[it.fx]) parts.push(FXTEXT[it.fx](e, k));
    return parts.join(' · ');
  }
  function skillText(sd, star, e) {
    const k = BT4.SKSTAR[star], P = Math.round((sd.power || 0) * e.pow * k * e.spell), H = e.healMult, pw = e.pow;
    const ex = [];
    if (sd.stun) ex.push(`기절 ${sd.stun}초`);
    if (sd.slow) ex.push(`둔화 ${sd.slow}초`);
    if (sd.burn) ex.push(`화상 초당 ${Math.round(sd.burn.dps * pw)}`);
    if (sd.bleed) ex.push(`출혈 초당 ${Math.round(sd.bleed.dps * pw)}`);
    if (sd.poison) ex.push(`중독 초당 ${Math.round(sd.poison.dps * pw)}`);
    if (sd.vuln) ex.push(`받는 피해 +${pct(sd.vuln.amt)}% ${sd.vuln.dur}초`);
    if (sd.crit) ex.push('확정 치명');
    if (sd.drain) ex.push(`피해의 ${pct(sd.drain)}% 흡수`);
    if (sd.cleanse) ex.push('해로운 효과 제거');
    let main = '';
    switch (sd.effect) {
      case 'dmg': main = `피해 <em>${P}</em>${sd.mode === 'volley' ? ` × ${(sd.count || 3) + (star >= 3 ? 2 : 0)}발` : sd.mode === 'chain' ? ` · ${4 + (star >= 3 ? 2 : 0)}번 튐` : ''}`; break;
      case 'tele': main = `1.2초 뒤 피해 <em>${P}</em>`; break;
      case 'lightrain': main = `피해 <em>${P}</em> · 아군 회복 <em>${Math.round(P * 0.6 * H)}</em>`; break;
      case 'heal': main = `회복 <em>${Math.round(P * H)}</em>`; break;
      case 'shield': main = `보호막 <em>${Math.round(P * H)}</em>`; break;
      case 'taunt': main = `3초 도발 · 보호막 <em>${P}</em>`; break;
      case 'buff': main = `공격력 <em>+${30 + 10 * (star - 1)}%</em> · 공속 +20%`; break;
      case 'haste': case 'timewarp': main = `공속 <em>+${Math.round(((sd.amt || 1.25) + 0.08 * (star - 1) - 1) * 100)}%</em> ${sd.dur || 6}초${sd.effect === 'timewarp' ? ` · 적 둔화 ${3 + star - 1}초` : ''}`; break;
      case 'debuff': main = `적 약화(피해 −30%) <em>${(sd.weak || 4) + (star - 1)}초</em>`; break;
      case 'mana': main = `주변 아군 마나 <em>+${Math.round((sd.power || 30) * k)}</em>`; break;
      case 'revive': main = `쓰러진 아군을 체력 <em>${pct(Math.min(0.9, 0.5 + 0.15 * (star - 1)))}%</em>로 부활`; break;
      case 'heavy': main = `피해 <em>${Math.round(e.atk * sd.power * k)}</em>`; break;
      default: main = sd.desc;
    }
    return main + (ex.length ? ' · ' + ex.join(' · ') : '');
  }
  function renderUnitSheet(s) {
    const c = s.c, d = def(c), onBoard = R.board.includes(c);
    const e = battleApi.makeAlly(c, grid.idx(c.x || 0, c.y || PLAYER_ROW), battleApi.synergyCounts(onBoard ? R.board : [...R.board, c]));
    const m = BT4.STAR[c.star];
    const stat = (label, v, base, fmt = (x) => x) => `<div><small>${label}</small><b class="${v > base + 1e-6 ? 'up' : ''}">${fmt(v)}</b></div>`;
    const dps = Math.round(e.atk * e.as);
    const stats = [
      stat('체력', e.maxHp, Math.round(d.hp * m)),
      stat('공격력', Math.round(e.atk), Math.round(d.atk * m)),
      stat('공격 속도', e.as, d.as, (x) => x.toFixed(2) + '/초'),
      stat('사거리', e.range, d.range, (x) => x + '칸'),
      stat('받는 피해', e.armor, d.armor || 0, (x) => '−' + pct(x) + '%'),
      stat('치명타', e.crit, d.crit || 0.05, (x) => pct(Math.min(1, x)) + '%'),
      stat('스킬 위력', e.spell * e.pow, POWBASE(c), (x) => pct(x) + '%'),
      stat('초당 피해', dps, Math.round(d.atk * m * d.as)),
    ].join('');
    const slots = skillSlots(c), cls = CLS[d.cls].name;
    let rows = '';
    for (let k = 0; k < slots; k++) {
      const x = c.skills[k];
      if (!x) { rows += `<div class="urow empty"><span>빈 스킬 칸 · 창고에서 ${cls} 스킬(또는 공용)을 탭한 뒤 이 딱지를 탭</span></div>`; continue; }
      const sd = def(x);
      const open = ui.openInfo === 's' + k;
      rows += `<div class="urow${open ? ' open' : ''}" data-info="s${k}" role="button" tabindex="0" aria-expanded="${open}"><img src="${imgOf(x, 60)}" alt=""><span><b>${sd.name}${starTxt(x.star)}</b> <small class="meta">마나 ${Math.max(20, Math.round(Math.max(30, (sd.mana || 80) - (x.star - 1) * 8) * (e.manaCost || 1)))}</small><br>${skillText(sd, x.star, e)}${open ? `<span class="uinfo">${esc(sd.desc)}<br><span class="meta">${CLS[sd.cls].name} 스킬 · ${sd.t}등급 · ★2 위력 ×1.7 · ★3 ×2.6, 범위 확장</span></span>` : ''}</span>${patternGrid(sd, x.star)}<button class="x" data-un="${k}" aria-label="${sd.name} 빼기">빼기</button></div>`;
    }
    if (c.item) { const it = def(c.item), open = ui.openInfo === 'item'; rows += `<div class="urow${open ? ' open' : ''}" data-info="item" role="button" tabindex="0" aria-expanded="${open}"><img src="${imgOf(c.item, 60)}" alt=""><span><b>${it.name}${starTxt(c.item.star)}</b> <small class="meta">${it.feel}</small><br>${itemText(it, c.item.star, e)}${open ? `<span class="uinfo">${esc(it.desc)}<br><span class="meta">${CLS[it.cls].name} 아이템 · ${it.t}등급 · ★2 수치 ×1.6 · ★3 ×2.5</span></span>` : ''}</span><button class="x" data-un="item" aria-label="${it.name} 빼기">빼기</button></div>`; }
    else rows += `<div class="urow empty"><span>빈 아이템 칸 · 창고에서 ${cls} 아이템을 탭한 뒤 이 딱지를 탭</span></div>`;
    $('usheet').innerHTML = `<button class="xbtn" data-act="close" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button><div class="uh"><img src="${imgOf(c, 108)}" alt=""><div class="tt"><b>${d.name} <em>${starTxt(c.star)}</em></b> <span class="meta">${cls} · ${d.t}등급 · ${d.traits.map((t) => TRAITS[t].name).join(' · ')}${onBoard ? ' · 출전 중' : ' · 창고'}</span><p>${d.trait}</p><p class="meta">▲ 장비·시너지·유물로 오른 값 · 칸을 탭하면 설명</p></div></div>
      <div class="ustats">${stats}</div>
      ${rows}
      <div class="dbtn">${onBoard ? '<button class="btn" data-act="tobench">창고로</button>' : ''}<button class="btn warn" data-act="sell">판매 +${price(c)}골드</button></div>`;
  }
  const POWBASE = (c) => [0, 1, 1.45, 2.1][c.star] * (1 + (def(c).spellBonus || 0));

  function renderBattlePanel() {
    const cb = B.combat;
    const al = cb.units.filter((u) => u.side === 0 && !u.summon && !u.object);
    const fo = cb.units.filter((u) => u.side === 1 && !u.summon);
    const boss = fo.find((u) => u.boss);
    $('foeN').textContent = `${fo.filter((u) => !u.dead).length}/${fo.length}`;
    $('foeNote').textContent = boss ? `${boss.def.name}${B.phaseText ? ' · ' + B.phaseText : ''}` : R.node.k === 'elite' ? '정예 · 지면 원정 끝' : '지면 원정 끝';
    $('foeRoster').innerHTML = fo.slice(0, 10).map((u) => `<div class="fo${u.dead ? ' dead' : ''}${u.boss ? ' boss' : ''}"><img src="${ART.tokenURL(u.artId, 1, u.boss ? 'boss' : '')}" alt=""><span class="bar"><i style="width:${Math.max(0, 100 * u.hp / u.maxHp)}%"></i></span></div>`).join('');
    $('foeRoster').style.gridTemplateColumns = `repeat(${Math.max(5, Math.min(10, fo.length))}, minmax(0,1fr))`;
    $('roster').style.gridTemplateColumns = `repeat(${al.length > 4 ? 4 : 2}, minmax(0,1fr))`;
    $('roster').innerHTML = al.map((u) => `<div class="rs${u.dead ? ' dead' : ''}"><img src="${imgOf(u.card, 60)}" alt=""><div><b>${u.def.name}${starTxt(u.card.star)}</b><span class="bar"><i style="width:${Math.max(0, 100 * u.hp / u.maxHp)}%"></i></span><span class="bar mp"><i style="width:${u.maxMana ? Math.min(100, 100 * u.mana / u.maxMana) : 0}%"></i></span></div></div>`).join('');
    const res = B.phase === 'result';
    $('spdBtn').hidden = res; $('skipBtn').hidden = res;
    $('spdBtn').textContent = '배속 ×' + B.speed;
    $('resBtn').hidden = !res;
    if (res) $('resBtn').textContent = B.won ? `승리 +${B.reward}골드 · 계속` : B.phoenix ? '불사조 깃털로 버티기' : '원정 기록 보기';
    $('resBtn').className = 'btn ' + (B.won || B.phoenix ? 'pri' : 'warn');
  }

  // ---------- 입력 ----------
  function tapBench(i) {
    const c = R.bench[i], s = ui.sel;
    if (s && s.from === 'board' && !c) { R.board = R.board.filter((u) => u !== s.c); R.bench[i] = s.c; ui.sel = null; SFX.play('card'); return renderPlay(); }
    if (s && s.from === 'bench' && s.c.kind !== 'unit' && c && c.kind === 'unit') { equip(s.c, s.i, c); ui.sel = null; return renderPlay(); }
    if (s && s.from === 'bench' && !c) { R.bench[s.i] = null; R.bench[i] = s.c; ui.sel = null; return renderPlay(); }
    if (!c) { ui.sel = null; return renderPlay(); }
    ui.sel = s && s.c === c ? null : { from: 'bench', i, c };
    SFX.play('click');
    renderPlay();
  }
  function tapCell(x, y, fromDrag) {
    const s = ui.sel, u = R.board.find((b) => b.x === x && b.y === y);
    if (!fromDrag && u && s && s.c.kind === 'unit' && s.c !== u) { ui.sel = { from: 'board', c: u }; SFX.play('click'); return renderPlay(); }
    if (y < PLAYER_ROW) { const e = R.enemies.find((q) => q.cell === grid.idx(x, y)); if (e) { const m = MONSTERS[e.id]; toast(`${m.name} · 체력 약 ${Math.round(m.hp * battleApi.foePreview(m).hp)} · ${m.range > 1 ? '원거리' : '근접'}`); } ui.sel = null; return renderPlay(); }
    if (s && s.from === 'bench' && s.c.kind !== 'unit') { if (u) { equip(s.c, s.i, u); ui.sel = null; } else ui.sel = null; return renderPlay(); }
    if (s && s.from === 'bench' && s.c.kind === 'unit') {
      if (u) { R.board = R.board.filter((b) => b !== u); R.bench[s.i] = u; }
      else if (R.board.length >= deployMax()) return toast(`출전은 ${deployMax()}명까지. 레벨업하면 늘어요`);
      else R.bench[s.i] = null;
      s.c.x = x; s.c.y = y; R.board.push(s.c); ui.sel = null; SFX.play('place');
      tryMerge('unit', s.c.id, s.c.star);
      return renderPlay();
    }
    if (s && s.from === 'board' && u !== s.c) {
      if (u) { u.x = s.c.x; u.y = s.c.y; }
      s.c.x = x; s.c.y = y; ui.sel = null; SFX.play('place'); return renderPlay();
    }
    ui.sel = u ? (s && s.c === u ? null : { from: 'board', c: u }) : null;
    if (u) SFX.play('click');
    renderPlay();
  }
  $('bench').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b && !B && performance.now() - drag.endT > 250) tapBench(+b.dataset.b); });
  $('srows').addEventListener('click', (e) => {
    if (B) return;
    const r = e.target.closest('[data-roll]'), l = e.target.closest('[data-lock]');
    if (r) { ui.sel = null; return reroll(false, r.dataset.roll); }
    if (l) { const k = l.dataset.lock; R.locked[k] = !R.locked[k]; toast(R.locked[k] ? `${TABNAME[k]} 줄 잠금: 다음 라운드에도 그대로` : '잠금 해제'); return renderPlay(); }
    const b = e.target.closest('[data-s]'); if (!b) return;
    const k = b.dataset.k, i = +b.dataset.s, c = R.shop[k][i];
    if (ui.sel && ui.sel.c === c) { ui.sel = null; renderPlay(); return; }
    ui.sel = { from: 'shop', i, c, kind: k }; ui.peekT = performance.now(); SFX.play('card'); renderPlay();
  });
  $('foeBtn').onclick = () => { ui.showFoe = !ui.showFoe; ui.sel = null; SFX.play('card'); renderPlay(); };
  const onDetail = (e) => {
    const b = e.target.closest('[data-act],[data-un],[data-info]'); if (!b) return;
    if (b.dataset.un != null) { const u = ui.sel.c, k = b.dataset.un; unequip(u, k === 'item' ? 'item' : +k); ui.openInfo = null; return renderPlay(); }
    if (b.dataset.info != null) { ui.openInfo = ui.openInfo === b.dataset.info ? null : b.dataset.info; SFX.play('click'); return renderPlay(); }
    if (b.dataset.act === 'noop') return;
    const a = b.dataset.act;
    if (a === 'buy') { if (performance.now() - (ui.peekT || 0) < 350) return; buy(ui.sel.i, false, ui.sel.kind); }
    else if (a === 'tobench') { const i = R.bench.indexOf(null); if (i < 0) return toast('창고에 빈칸이 없어요'); R.board = R.board.filter((u) => u !== ui.sel.c); R.bench[i] = ui.sel.c; ui.sel = null; SFX.play('card'); renderPlay(); }
    else if (a === 'sell') { const s = ui.sel, g = sellCard(s.c, s.from, s.i); ui.sel = null; SFX.play('coin'); toast(`${def(s.c).name} 판매 +${g}골드`); renderPlay(); }
    else { ui.sel = null; renderPlay(); }
  };
  $('detail').addEventListener('click', onDetail); $('peek').addEventListener('click', onDetail); $('usheet').addEventListener('click', onDetail);
  $('gbox').onclick = () => { const inc = income(); toast(`골드 ${R.gold} · 다음 라운드 수입 약 +${inc.total + 1} (기본 5 · 이자 ${inc.interest} · 연승 ${inc.streak} · 승리 1). 10골드마다 이자 +1, 최대 ${5 + (has('vault') ? 2 : 0)}`); };
  $('lvBtn').onclick = () => levelUp();
  $('goBtn').onclick = () => { if (R.mode === 'fight') startCombat(); else { ui.sel = null; finishNode(); } };
  $('spdBtn').onclick = () => { if (!B) return; B.speed = B.speed === 1 ? 2 : B.speed === 2 ? 3 : 1; ui.speed = B.speed; renderBattlePanel(); };
  $('skipBtn').onclick = () => { if (!B || B.phase !== 'combat') return; const cb = B.combat; B.skipping = true; while (!cb.done) cb.step(1 / 30); B.skipping = false; B.vfx = newVfx(); };
  $('resBtn').onclick = () => { if (B && B.phase === 'result') afterCombat(); };
  // ---------- 전투 기록: 입힌 피해 · 받은 피해 · 회복/보호막 ----------
  let statSort = 'dmg';
  function openStats() {
    if (!B || !B.combat) return;
    const cb = B.combat;
    const rows = cb.units.filter((u) => u.side === 0 && !u.object).map((u) => ({ u, dmg: Math.round(u.dmgDealt || 0), taken: Math.round(u.dmgTaken || 0), heal: Math.round((u.healDone || 0) + (u.shieldDone || 0)) }));
    rows.sort((a, b) => b[statSort] - a[statSort]);
    const mx = { dmg: 1, taken: 1, heal: 1 };
    for (const r of rows) for (const k in mx) mx[k] = Math.max(mx[k], r[k]);
    const top = rows.reduce((a, b) => (b.dmg > a.dmg ? b : a), rows[0]);
    const col = { dmg: '#e8436b', taken: '#8a8f99', heal: '#2e9e6b' };
    const head = [['dmg', '입힌 피해'], ['taken', '받은 피해'], ['heal', '회복·보호막']].map(([k, n]) => `<button class="h${statSort === k ? ' on' : ''}" data-sort="${k}">${n}</button>`).join('');
    const body = rows.map((r) => {
      const u = r.u, img = u.card ? imgOf(u.card, 60) : ART.tokenURL(u.artId, 0);
      const name = (u.def.name || '') + (u.card ? starTxt(u.card.star) : '');
      return `<img class="${u.dead ? 'dead' : ''}" src="${img}" alt=""><div class="nm${u.dead ? ' dead' : ''}">${esc(name)}${r === top && r.dmg > 0 ? '<span class="mvp">MVP</span>' : ''}<small>${u.summon ? '소환물' : u.dead ? '찢어짐' : '생존'}</small></div>` +
        ['dmg', 'taken', 'heal'].map((k) => `<div class="v" style="--c:${col[k]}">${r[k]}<i style="width:${Math.round(100 * r[k] / mx[k])}%"></i></div>`).join('');
    }).join('');
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    openSheet(`<span class="eyebrow">전투 기록 · ${cb.done ? '전투 끝' : Math.floor(cb.t) + '초째, 일시 정지'}</span><h2>누가 얼마나 했나</h2>
      <div class="stats"><span></span><span class="h">딱지</span>${head}${body}</div>
      <p class="meta" style="margin:0">합계 · 입힌 피해 ${sum('dmg')} · 받은 피해 ${sum('taken')} · 회복·보호막 ${sum('heal')}. 머리글을 탭하면 그 순서로 정렬</p>
      <button class="btn" data-close>닫기</button>`);
    $('sheetIn').onclick = (e) => {
      const b = e.target.closest('[data-sort]'); if (b) { statSort = b.dataset.sort; return openStats(); }
      if (e.target.closest('[data-close]')) closeSheet();
    };
  }
  $('statBtn').onclick = openStats;

  $('syn').addEventListener('click', (e) => {
    if (e.target.closest('[data-allsyn]')) return openSynSheet();
    const t = e.target.closest('[data-tr]');
    if (t) { const T = TRAITS[t.dataset.tr]; return toast(`${T.name}(${T.members.map((m) => DEF['unit:' + m].name).join('·')}): ${T.kind === 'combo' ? T.desc[0] : T.th.map((n, i) => n + '명 ' + T.desc[i]).join(' → ')}`); }
    const b = e.target.closest('[data-syn]'); if (!b) return; const k = b.dataset.syn; toast(`${CLS[k].name} ${SYN[k].th.join('/')}: ${SYN[k].desc.join(' → ')}`);
  });

  // =====================================================================
  // 보드 캔버스
  // =====================================================================
  const canvas = $('cv'), ctx = canvas.getContext('2d');
  let kScale = 1, DPR = Math.min(2, window.devicePixelRatio || 1);
  // 상점 단계: 내 진영 세 줄만 보여 준다(적 필드 보기 버튼으로 전체)
  const mineOnly = () => !B && ui.screen === 'play' && R && !ui.showFoe;
  const viewY = () => (mineOnly() ? CS * PLAYER_ROW : 0);
  const viewH = () => (mineOnly() ? CS * (ROWS - PLAYER_ROW) + M * 2 : H);
  function fitBoard() {
    const wrap = $('boardwrap'), scr = $('scr-play');
    scr.classList.toggle('prep', !B && !ui.showFoe);
    scr.classList.toggle('foeview', !B && !!ui.showFoe);
    const vh = viewH();
    if (mineOnly()) {
      const w = wrap.getBoundingClientRect().width;
      if (!w) return;
      kScale = Math.max(0.4, Math.min((w - 24) / W, (scr.clientHeight * (scr.clientHeight < 640 ? 0.3 : 0.36)) / vh));
      wrap.style.height = Math.round(vh * kScale + 6) + 'px';
    } else {
      wrap.style.height = '';
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      kScale = Math.max(0.4, Math.min((r.width - 24) / W, (r.height - 4) / vh));
    }
    canvas.style.width = Math.round(W * kScale) + 'px'; canvas.style.height = Math.round(vh * kScale) + 'px';
    canvas.width = Math.round(W * kScale * DPR); canvas.height = Math.round(vh * kScale * DPR);
    draw();
  }
  function cellFromPoint(x, y) { const r = canvas.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null; return grid.cellAt((x - r.left) / kScale, (y - r.top) / kScale + viewY()); }
  canvas.addEventListener('pointerdown', (e) => {
    if (B || ui.screen !== 'play') return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (!c) return;
    const u = R.board.find((b) => b.x === c.c && b.y === c.r);
    dragBegin(e, canvas, u ? { from: 'board', c: u } : null, () => tapCell(c.c, c.r));
  });
  // ---------- 드래그: 창고·보드의 딱지와 창고의 칩을 끌어다 놓기 ----------
  const drag = { start: null, on: false, src: null, tap: null, ghost: null, endT: 0 };
  function dragBegin(e, el, src, tap) {
    drag.start = { x: e.clientX, y: e.clientY, id: e.pointerId }; drag.src = src; drag.tap = tap; drag.on = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }
  $('bench').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-b]'); if (!b || B) return;
    const i = +b.dataset.b, c = R.bench[i];
    if (c) dragBegin(e, b, { from: 'bench', i, c }, null);
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag.start || e.pointerId !== drag.start.id) return;
    if (!drag.on) {
      if (!drag.src || Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) < 10) return;
      drag.on = true;
      ui.sel = Object.assign({}, drag.src);
      const g = document.createElement('img'); g.className = 'dragghost'; g.src = imgOf(drag.src.c, 96); g.alt = '';
      $('phone').appendChild(g); drag.ghost = g;
      SFX.play('card');
      renderPlay();
    }
    const p = phoneRect();
    drag.ghost.style.left = (e.clientX - p.left) + 'px'; drag.ghost.style.top = (e.clientY - p.top) + 'px';
    const over = document.elementFromPoint(e.clientX, e.clientY), slot = over && over.closest('[data-b]');
    document.querySelectorAll('.slot.over').forEach((x) => x !== slot && x.classList.remove('over'));
    if (slot) slot.classList.add('over');
    drag.hover = cellFromPoint(e.clientX, e.clientY);
  });
  function dragEnd(e, cancel) {
    if (!drag.start || (e && e.pointerId !== drag.start.id)) return;
    const was = drag.on, tap = drag.tap;
    drag.start = null; drag.on = false; drag.hover = null;
    if (drag.ghost) { drag.ghost.remove(); drag.ghost = null; }
    document.querySelectorAll('.slot.over').forEach((x) => x.classList.remove('over'));
    if (!was) { if (tap && !cancel) tap(); return; }
    drag.endT = performance.now();
    if (cancel) { ui.sel = null; return renderPlay(); }
    dropAt(e.clientX, e.clientY);
  }
  window.addEventListener('pointerup', (e) => dragEnd(e, false));
  window.addEventListener('pointercancel', (e) => dragEnd(e, true));
  function dropAt(x, y) {
    const s = ui.sel; if (!s) return renderPlay();
    const cell = cellFromPoint(x, y);
    if (cell) {
      if (s.from === 'board' && s.c.x === cell.c && s.c.y === cell.r) { ui.sel = null; return renderPlay(); }
      if (cell.r < PLAYER_ROW) { ui.sel = null; toast('아래쪽 세 줄(내 진영)에만 놓을 수 있어요'); return renderPlay(); }
      if (s.c.kind !== 'unit' && !R.board.some((b) => b.x === cell.c && b.y === cell.r)) { ui.sel = null; return renderPlay(); }
      tapCell(cell.c, cell.r, true);
      if (ui.sel === s) { ui.sel = null; renderPlay(); }
      return;
    }
    const over = document.elementFromPoint(x, y), slot = over && over.closest('[data-b]');
    if (slot) {
      const i = +slot.dataset.b, t = R.bench[i];
      if (s.from === 'bench' && s.i === i) { ui.sel = null; return renderPlay(); }
      if (t && t.kind === 'unit' && s.c.kind !== 'unit') return tapBench(i);
      if (t && s.from === 'bench') { R.bench[s.i] = t; R.bench[i] = s.c; ui.sel = null; SFX.play('card'); return renderPlay(); }
      if (t && s.from === 'board' && t.kind === 'unit') { R.board = R.board.filter((b) => b !== s.c); t.x = s.c.x; t.y = s.c.y; R.board.push(t); R.bench[i] = s.c; ui.sel = null; SFX.play('place'); tryMerge('unit', t.id, t.star); return renderPlay(); }
      if (!t) return tapBench(i);
    }
    ui.sel = null; renderPlay();
  }

  const INK = '#232a3b';
  const boardCache = {};
  // 막마다 다른 판: 1막 풀밭(나무 테), 2막 돌바닥(금 간 석판), 3막 화산(용암 틈)
  const ACT_LOOK = {
    1: { ground: '#5f8a4a', frame: '#7a5530', frameHi: '#a77a4a', mine: ['#dcebc8', '#cfe2b8'], foe: ['#e8dcc0', '#dfcfae'], line: '#232a3b', deco: 'grass' },
    2: { ground: '#4a4658', frame: '#3b3848', frameHi: '#6b6780', mine: ['#d5d9e4', '#c8cddb'], foe: ['#ddd0dc', '#cfc0cf'], line: '#232a3b', deco: 'stone' },
    3: { ground: '#2b2220', frame: '#1c1514', frameHi: '#5a2a1c', mine: ['#ecd3b0', '#e2c49c'], foe: ['#e0a88a', '#d6967a'], line: '#ffd36b', deco: 'lava' },
  };
  function boardBg(act) {
    if (boardCache[act]) return boardCache[act];
    const L = ACT_LOOK[act] || ACT_LOOK[1];
    const cv = document.createElement('canvas');
    cv.width = W * 2; cv.height = H * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    let seed = act * 9301 + 49297; const rr = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    // 테두리(판 받침)
    c.fillStyle = L.frame; c.fillRect(0, 0, W, H);
    c.strokeStyle = L.frameHi; c.lineWidth = 2; c.strokeRect(2, 2, W - 4, H - 4);
    if (L.deco === 'grass') for (let k = 0; k < 40; k++) { const y = rr() * H; c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y); c.lineTo(M, y + 2); c.moveTo(W - M, y); c.lineTo(W, y + 2); c.stroke(); }
    // 바닥(칸 사이 틈)
    c.fillStyle = L.ground; c.fillRect(M, M, CS * COLS, CS * ROWS);
    if (L.deco === 'lava') {
      c.save(); c.shadowColor = '#ff6a1a'; c.shadowBlur = 8; c.strokeStyle = '#ff8a2a'; c.lineWidth = 3;
      for (let r = 0; r <= ROWS; r++) { c.beginPath(); c.moveTo(M, M + r * CS); c.lineTo(M + COLS * CS, M + r * CS); c.stroke(); }
      for (let q = 0; q <= COLS; q++) { c.beginPath(); c.moveTo(M + q * CS, M); c.lineTo(M + q * CS, M + ROWS * CS); c.stroke(); }
      c.restore();
    }
    for (const cell of grid.cells) {
      const mine = cell.r >= PLAYER_ROW, x = cell.x - CS / 2 + 2, y = cell.y - CS / 2 + 2, s = CS - 4;
      c.fillStyle = (mine ? L.mine : L.foe)[(cell.r + cell.c) % 2];
      c.fillRect(x, y, s, s);
      c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip();
      if (L.deco === 'grass') {
        // 풀잎·작은 꽃
        for (let k = 0; k < 9; k++) { const gx = x + rr() * s, gy = y + 6 + rr() * (s - 8); c.strokeStyle = mine ? 'rgba(70,120,50,.35)' : 'rgba(120,100,50,.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 5); c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 4); c.stroke(); }
        if (rr() < 0.35) { const fx = x + 8 + rr() * (s - 16), fy = y + 8 + rr() * (s - 16); c.fillStyle = rr() < 0.5 ? '#fff6c8' : '#ffd0da'; for (let a = 0; a < 5; a++) { c.beginPath(); c.arc(fx + Math.cos(a * 1.26) * 2.2, fy + Math.sin(a * 1.26) * 2.2, 1.6, 0, 7); c.fill(); } c.fillStyle = '#f5c400'; c.beginPath(); c.arc(fx, fy, 1.2, 0, 7); c.fill(); }
      } else if (L.deco === 'stone') {
        // 석판 모서리 음영 + 금
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, s, 3); c.fillRect(x, y, 3, s);
        c.fillStyle = 'rgba(35,42,59,.18)'; c.fillRect(x, y + s - 3, s, 3); c.fillRect(x + s - 3, y, 3, s);
        if (rr() < 0.6) { c.strokeStyle = 'rgba(35,42,59,.35)'; c.lineWidth = 1; c.beginPath(); let px = x + rr() * s, py = y + rr() * s; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rr() - 0.5) * 18; py += (rr() - 0.5) * 18; c.lineTo(px, py); } c.stroke(); }
        if (rr() < 0.15) { c.fillStyle = 'rgba(80,110,70,.35)'; c.beginPath(); c.arc(x + rr() * s, y + s - 4, 5, 0, 7); c.fill(); }
      } else {
        // 그을린 자국과 불씨
        const g = c.createRadialGradient(x + s / 2, y + s / 2, 4, x + s / 2, y + s / 2, s * 0.75); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(80,30,10,.28)'); c.fillStyle = g; c.fillRect(x, y, s, s);
        if (rr() < 0.5) { c.strokeStyle = 'rgba(90,40,20,.45)'; c.lineWidth = 1.2; c.beginPath(); let px = x + rr() * s, py = y + rr() * s; c.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (rr() - 0.5) * 16; py += (rr() - 0.5) * 16; c.lineTo(px, py); } c.stroke(); }
        for (let k = 0; k < 2; k++) if (rr() < 0.5) { c.fillStyle = 'rgba(255,140,40,.55)'; c.beginPath(); c.arc(x + rr() * s, y + rr() * s, 1.2, 0, 7); c.fill(); }
      }
      c.restore();
    }
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(M, M, CS * COLS, CS * ROWS);
    c.strokeStyle = L.line; c.lineWidth = 3; c.setLineDash([10, 6]);
    c.beginPath(); c.moveTo(M, M + CS * PLAYER_ROW); c.lineTo(M + CS * COLS, M + CS * PLAYER_ROW); c.stroke(); c.setLineDash([]);
    boardCache[act] = cv;
    return cv;
  }
  const tokenR = (kind) => (kind === 'boss' ? 31 : kind === 'elite' ? 27 : 23);
  const kindOf = (e) => (e.boss ? 'boss' : e.elite ? 'elite' : '');
  const clsOfArt = (id) => (DEF['unit:' + id] ? DEF['unit:' + id].cls : '');
  const sprite = (artId, side, kind) => ART.token(artId, side, tokenR(kind), 2, kind || (side === 0 ? clsOfArt(artId) : ''));
  const STATUS_MARK = { burn: ['#e8643b', 'fire'], poison: ['#5fa043', 'skull'], bleed: ['#c0392b', 'drop'], slow: ['#6aa8ff', 'ice'], weak: ['#8a7a9a', 'fist'], vuln: ['#e8436b', 'target'] };

  function starPips(x, y, r, star) {
    if (star < 2) return;
    ctx.save();
    ctx.lineWidth = Math.max(2.5, r * 0.13); ctx.strokeStyle = star > 2 ? '#f5c400' : '#c9d1dc';
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < star; k++) {
      const sx = x + (k - (star - 1) / 2) * r * 0.42, sy = y - r * 1.02, sr = r * 0.24;
      ART.star(ctx, sx, sy, sr); ctx.fillStyle = '#f5c400'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
  }
  function drawUnit(x, y, o) {
    const r = tokenR(o.kind), spr = sprite(o.artId, o.side, o.kind);
    let sq = 0, jx = 0;
    if (o.popT > 0) { const t = 1 - o.popT / 0.35; sq = 0.2 * Math.sin(t * Math.PI * 2) * (1 - t); }
    if (o.hitT > 0) { const k = o.hitT / 0.22; jx = (Math.random() - 0.5) * 5 * k; sq = Math.max(sq, 0.1 * k); }
    if (o.glow) { ctx.save(); ctx.strokeStyle = o.glow; ctx.lineWidth = 3; ctx.setLineDash(o.dash ? [5, 4] : []); ctx.lineDashOffset = -performance.now() / 50; ctx.beginPath(); ctx.arc(x, y + 2, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    ART.drawToken(ctx, spr, x + jx, y, r, { rot: o.rot || 0, flash: o.flash || 0, squash: sq, lift: o.lift || 0, alpha: o.alpha });
    const ty = y - (o.lift || 0);
    if (o.lo) ART.drawLoadout(ctx, x + jx, ty, r, o.lo);
    if (o.star) starPips(x + jx, ty, r, o.star);
    if (o.kind === 'boss') {
      ctx.fillStyle = '#f5c400'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 13, ty - r + 3); ctx.lineTo(x - 13, ty - r - 10); ctx.lineTo(x - 6, ty - r - 3); ctx.lineTo(x, ty - r - 13); ctx.lineTo(x + 6, ty - r - 3); ctx.lineTo(x + 13, ty - r - 10); ctx.lineTo(x + 13, ty - r + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (o.marks && o.marks.length) o.marks.forEach(([col, ic], i) => {
      const mx = x - r - 3, my = ty - r * 0.55 + i * 11;
      ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(mx, my); ART.icon(ctx, ic, 3.6); ctx.restore();
    });
    if (o.stun) {
      const t = performance.now() / 300;
      for (let k = 0; k < 3; k++) { const a = t + (k * Math.PI * 2) / 3; ART.star(ctx, x + Math.cos(a) * r * 0.8, ty - r - 4 + Math.sin(a) * 4, 4); ctx.fillStyle = '#f5c400'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (o.taunt) { ctx.fillStyle = '#f5c400'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + r * 0.85, ty - r * 0.85, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x + r * 0.85, ty - r * 0.85 + 1); }
  }
  function unitOpts(e) {
    const kind = kindOf(e), hop = e.moving ? Math.sin(Math.min(1, e.moving.t) * Math.PI) : 0;
    const marks = [];
    for (const k of ['burn', 'poison', 'bleed', 'slow', 'weak', 'vuln']) { const v = e.st && e.st[k]; if (v && (typeof v === 'number' ? v > 0 : true)) marks.push(STATUS_MARK[k]); }
    return { artId: e.artId, side: e.side, kind, flash: e.flash, hitT: e.hitT, popT: e.popT, rot: (e.rot || 0) + hop * 0.12, lift: hop * 5, stun: e.stun > 0, taunt: e.forcedT > 0, lo: e.lo, star: e.card ? e.card.star : 0, marks };
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawBar(e) {
    if (e.object && e.hp >= e.maxHp) return;
    const r = tokenR(kindOf(e)), w = r * 2 + 4, x = e.px - w / 2, y = e.py + r + 6;
    const total = Math.max(e.maxHp, e.hp + e.shield), hpW = (w * Math.max(0, e.hp)) / total;
    ctx.fillStyle = INK; roundRect(x - 1.5, y - 1.5, w + 3, 9, 3); ctx.fill();
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = e.side ? '#e8436b' : '#2e9e6b'; ctx.fillRect(x, y, hpW, 6);
    if (e.shield > 0) { ctx.fillStyle = '#bfe0ff'; ctx.fillRect(x + hpW, y, (w * e.shield) / total, 6); }
    if (e.ability && e.maxMana > 0) { ctx.fillStyle = INK; ctx.fillRect(x - 1, y + 7.5, w + 2, 4); ctx.fillStyle = '#2f6fd6'; ctx.fillRect(x, y + 8.3, (w * Math.min(e.mana, e.maxMana)) / e.maxMana, 2.4); }
  }
  const SHOT = { mag: ['#b48cff', '#efe2ff'], mage: ['#b48cff', '#efe2ff'], fire: ['#e8643b', '#ffd36b'] };
  function drawProjectiles(cb) {
    for (const p of cb.projectiles) {
      const ang = Math.atan2(p.tgt.py - p.y, p.tgt.px - p.x), style = p.src && (SHOT[p.src.cls] || (p.kind === 'spell' && p.src.cls !== 'arc' && p.src.cls !== 'bow' ? SHOT.mag : null));
      if (style) {
        ctx.fillStyle = style[0]; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'spell' ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = style[1]; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.fillStyle = '#c3cbd6'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -3.5); ctx.lineTo(2, 3.5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = p.src && p.src.side ? '#e8436b' : '#2e9e6b'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -4); ctx.lineTo(-10, 0); ctx.lineTo(-17, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  function drawEffects(cb) {
    for (const f of cb.fx) {
      const k = f.t / f.life;
      if (f.kind === 'ring') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      else if (f.kind === 'beam') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = INK; ctx.lineWidth = 7 * (1 - k) + 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.lineWidth = 5 * (1 - k) + 1; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawFloaters(cb) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of cb.floaters) {
      const a = 1 - Math.max(0, f.t - 0.55) / 0.35, sc = f.t < 0.12 ? 1.6 - f.t * 5 : 1;
      const col = f.color === '#ffffff' ? '#fffdf7' : f.color === '#ffb347' ? '#f5c400' : f.color === '#c9a2ff' ? '#e2d0ff' : f.color === '#7dffa0' ? '#9cf0b4' : f.color;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.x, f.y); ctx.scale(sc, sc);
      ctx.font = `${f.big ? 16 : 14}px 'Black Han Sans', sans-serif`;
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = col; ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
  function drawTele(cb) {
    const now = performance.now();
    for (const tl of cb.tele) {
      const k = Math.min(1, tl.t / tl.delay);
      for (const i of tl.cells) {
        const c = grid.cells[i], x = c.x - CS / 2 + 3, y = c.y - CS / 2 + 3, s = CS - 6;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
        ctx.globalAlpha = 0.18 + 0.08 * Math.sin(now / 70); ctx.fillStyle = tl.color; ctx.fillRect(x, y, s, s);
        ctx.globalAlpha = 0.6; ctx.fillRect(x, y + s - s * k, s, s * k);
        ctx.restore();
        ctx.strokeStyle = tl.color; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, s, s);
      }
    }
  }
  function fillCell(i, color, alpha, inset = 3) {
    const c = grid.cells[i];
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.fillRect(c.x - CS / 2 + inset, c.y - CS / 2 + inset, CS - inset * 2, CS - inset * 2);
    ctx.globalAlpha = 1;
  }
  const newVfx = () => ({ debris: [], parts: [], pieces: [], shake: 0 });
  function burst(x, y, col, n) {
    if (!B || B.sim || B.skipping) return;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120;
      B.vfx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, s: 2.5 + Math.random() * 3, col: Math.random() < 0.35 ? '#fffdf7' : col, t: 0, life: 0.5 + Math.random() * 0.3 });
    }
  }
  function shake(n) { if (B && !B.sim && !B.skipping) B.vfx.shake = Math.min(14, Math.max(B.vfx.shake, n)); }
  function onTokenDeath(t) {
    if (!B || B.sim || B.skipping) return;
    const kind = kindOf(t);
    B.vfx.debris.push(ART.makeTear(sprite(t.artId, t.side, kind), t.px, t.py, tokenR(kind), t.rot || 0));
    burst(t.px, t.py, t.side ? '#e8436b' : '#2f6fd6', 8);
    if (t.lo) {
      const r = tokenR(kind);
      t.lo.skills.forEach((s, i) => B.vfx.pieces.push({ kind: 'chip', s, x: t.px + (i ? 0.5 : -0.5) * r, y: t.py + r * 0.6, vx: (i ? 1 : -1) * AC.rand(40, 90), vy: -AC.rand(120, 180), rot: 0, vr: AC.rand(-8, 8), t: 0, r: r * 0.34 }));
      if (t.lo.weapon) B.vfx.pieces.push({ kind: 'weapon', w: t.lo.weapon, x: t.px + r * 0.78, y: t.py - r * 0.5, vx: AC.rand(30, 80), vy: -AC.rand(150, 200), rot: 0.55, vr: AC.rand(-10, 10), t: 0, r: r * 0.62 });
    }
    SFX.play('tear', 0.05);
    shake(t.boss ? 14 : 2.5);
  }
  function stepVfx(dt) {
    const v = B.vfx;
    v.debris = v.debris.filter((d) => ART.stepTear(d, dt));
    for (const p of v.parts) { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.rot += p.vr * dt; }
    v.parts = v.parts.filter((p) => p.t < p.life);
    for (const p of v.pieces) { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    v.pieces = v.pieces.filter((p) => p.t < 1.1);
    v.shake = Math.max(0, v.shake - dt * 30);
    for (const u of B.combat.units) { if (u.hitT > 0) u.hitT -= dt; if (u.popT > 0) u.popT -= dt; }
  }
  function drawVfx() {
    for (const d of B.vfx.debris) ART.drawTear(ctx, d);
    for (const p of B.vfx.pieces) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, p.t - 0.7) / 0.4);
      if (p.kind === 'chip') { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ART.drawChip(ctx, 0, 0, p.r, p.s.col, p.s.icon, p.s.up); }
      else ART.drawWeapon(ctx, p.x, p.y, p.r, p.w, p.rot, p.w.up);
      ctx.restore();
    }
    for (const p of B.vfx.parts) {
      ctx.save(); ctx.globalAlpha = 1 - p.t / p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.65);
      ctx.restore();
    }
  }
  function draw() {
    if (ui.screen !== 'play' || !R) return;
    const k = kScale * DPR, vy = viewY();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -vy);
    if (B && B.vfx.shake > 0.2) ctx.translate((Math.random() - 0.5) * B.vfx.shake, (Math.random() - 0.5) * B.vfx.shake);
    ctx.drawImage(boardBg(R.act), 0, 0, W, H);
    const now = performance.now();
    if (B && B.combat) {
      const cb = B.combat;
      drawTele(cb);
      for (const f of cb.fx) if (f.kind === 'tile') fillCell(f.cell, f.color, 0.6 * (1 - f.t / f.life), 2);
      const alive = cb.units.filter((u) => !u.dead).sort((a, b) => a.py - b.py);
      for (const e of alive) { const o = AC.lungeOffset ? AC.lungeOffset(e) : { x: 0, y: 0 }; drawUnit(e.px + o.x, e.py + o.y, unitOpts(e)); }
      drawVfx();
      for (const e of alive) drawBar(e);
      drawProjectiles(cb); drawEffects(cb); drawFloaters(cb);
    } else {
      const s = ui.sel;
      if (s && s.c.kind === 'unit' && s.from !== 'shop') {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 200);
        for (const c of grid.cells) if (c.r >= PLAYER_ROW && !R.board.some((u) => grid.idx(u.x, u.y) === c.i)) { ctx.fillStyle = '#2f6fd6'; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (drag.on && drag.hover) { const ok = drag.hover.r >= PLAYER_ROW; fillCell(drag.hover.i, ok ? '#2f6fd6' : '#e8436b', 0.28); }
      const items = [
        ...R.enemies.map((x) => { const c = grid.cells[x.cell], d = MONSTERS[x.id]; return { y: c.y, f: () => drawUnit(c.x, c.y, { artId: x.id, side: 1, kind: d.boss ? 'boss' : d.elite ? 'elite' : '', rot: x.rot || 0, alpha: 0.92 }) }; }),
        ...R.board.map((u) => { const c = grid.cells[grid.idx(u.x, u.y)]; const selU = s && s.c === u, can = s && s.from === 'bench' && s.c.kind !== 'unit' && canEquip(s.c, u);
          if (selU && drag.on) return { y: c.y, f: () => drawUnit(c.x, c.y, { artId: u.id, side: 0, rot: u.rot || 0, lo: battleApi.loadoutOf(u), star: u.star, alpha: 0.3 }) };
          return { y: c.y, f: () => drawUnit(c.x, c.y, { artId: u.id, side: 0, rot: u.rot || 0, lo: battleApi.loadoutOf(u), star: u.star, lift: selU ? 4 + Math.sin(now / 160) * 1.5 : 0, glow: selU ? '#f5c400' : can ? '#2f6fd6' : null, dash: can }) }; }),
      ].sort((a, b) => a.y - b.y);
      for (const it of items) it.f();
      if (vy) { const L = ACT_LOOK[R.act] || ACT_LOOK[1]; ctx.fillStyle = L.frame; ctx.fillRect(0, vy, W, M); ctx.fillStyle = INK; ctx.fillRect(M, vy + M - 1.5, CS * COLS, 3); }
      if (!R.enemies.length && R.mode === 'rest' && !vy) { ctx.fillStyle = 'rgba(35,42,59,.55)'; ctx.font = "15px 'Black Han Sans', sans-serif"; ctx.textAlign = 'center'; ctx.fillText(R.node ? NODE[R.node.k].name + ' · 전투 없음' : '', W / 2, M + CS * 1.5); }
    }
    ctx.restore();
  }
  let last = performance.now(), panelT = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (R) R.stats.time += ui.screen === 'play' || ui.screen === 'map' ? dt : 0;
    if (B && B.combat && !B.sim) {
      if (B.phase === 'combat' && $('sheet').hidden) {
        let left = dt * B.speed;
        while (left > 0 && !B.combat.done) { const s = Math.min(1 / 60, left); B.combat.step(s); left -= s; }
        if (B.combat.done) endCombat();
        panelT += dt; if (panelT > 0.2) { panelT = 0; renderBattlePanel(); }
      }
      stepVfx(dt);
    }
    if (ui.screen === 'play') draw();
    requestAnimationFrame(loop);
  }

  // =====================================================================
  // 선택 창(보상·이벤트·노드)
  // =====================================================================
  function openSheet(html) { $('sheetIn').innerHTML = html; $('sheet').hidden = false; }
  function closeSheet() { $('sheet').hidden = true; }
  function cardTile(c, i) {
    const d = def(c);
    return `<button class="pickcard k-${c.kind} tier${d.t}" data-pick="${i}" style="--tc:var(--t${d.t});--cc:${CLS[d.cls].col}"><span class="cost">${d.t}</span><img src="${imgOf(c, 90)}" alt=""><b>${d.name}</b><small>${CLS[d.cls].name} ${KINDNAME[c.kind]}</small><span class="pd">${esc(c.kind === 'unit' ? d.trait : d.desc)}</span></button>`;
  }
  function pickReward(title, sub, cards, done) {
    if (!cards.length) return done();
    openSheet(`<span class="eyebrow">${title}</span><h2>${sub}</h2><div class="picks">${cards.map(cardTile).join('')}</div><button class="btn" data-skip>건너뛰기 (+2골드)</button>`);
    $('sheetIn').onclick = (e) => {
      const b = e.target.closest('[data-pick],[data-skip]'); if (!b) return;
      if (b.dataset.skip != null) R.gold += 2;
      else { const c = cards[+b.dataset.pick]; take(c); gain(c); SFX.play('card'); }
      closeSheet(); done();
    };
  }
  function relicPick(title, done) {
    const pool = Object.keys(RELICS).filter((k) => !R.relics.includes(k) && !(k === 'phoenix' && R.relics.includes('phoenix')));
    const opts = AC.shuffle(pool).slice(0, 3);
    openSheet(`<span class="eyebrow">${title}</span><h2>유물 하나를 고르세요</h2><div class="relics">${opts.map((k, i) => `<button class="relic" data-r="${i}"><b>${RELICS[k].name}</b><span>${RELICS[k].desc}</span></button>`).join('')}</div>`);
    $('sheetIn').onclick = (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      const k = opts[+b.dataset.r]; R.relics.push(k); if (k === 'bigbag') fixBench(); SFX.play('coin'); toast(`유물: ${RELICS[k].name}`);
      closeSheet(); done();
    };
  }
  function choice(title, text, opts) {
    openSheet(`<span class="eyebrow">${title}</span><h2>${text}</h2><div class="relics">${opts.map((o, i) => `<button class="relic" data-o="${i}" ${o.disabled ? 'disabled' : ''}><b>${o.label}</b><span>${o.desc || ''}</span></button>`).join('')}</div>`);
    $('sheetIn').onclick = (e) => { const b = e.target.closest('[data-o]'); if (!b || b.disabled) return; closeSheet(); opts[+b.dataset.o].go(); renderPlay(); };
  }
  function openCamp() {
    choice('야영지', '모닥불 앞에서 쉬어 갑니다', [
      { label: '훈련', desc: '경험치 +6', go: () => { if (addXp(6)) toast(`원정대 Lv${R.lv}`); } },
      { label: '정비', desc: '골드 +6', go: () => { R.gold += 6; } },
    ]);
  }
  function openTreasure() { relicPick('보물', () => renderPlay()); }
  function openForge() {
    const dupes = R.bench.map((c, i) => [c, i]).filter(([c]) => c && c.kind !== 'unit' && c.star === 1);
    const items = R.bench.map((c, i) => [c, i]).filter(([c]) => c && c.kind === 'item');
    const opts = [];
    opts.push({ label: '복제', desc: dupes.length ? '창고의 ★1 스킬·아이템 하나를 그대로 하나 더' : '창고에 ★1 스킬·아이템이 없어요', disabled: !dupes.length, go: () => pickFromBench('복제할 카드', dupes, (c) => { const n = mk(c.kind, c.id); take(n); gain(n); toast(`${def(c).name} 복제`); }) });
    opts.push({ label: '개조', desc: items.length ? '아이템 하나를 같은 등급의 다른 클래스 아이템으로' : '창고에 아이템이 없어요', disabled: !items.length, go: () => pickFromBench('개조할 아이템', items, (c, i) => {
      const d = def(c), cand = ITEMS.filter((x) => x.t === d.t && x.cls !== d.cls);
      const n = pick(cand); giveBack({ kind: 'item', id: c.id, star: 1 }); c.id = n.id; take(c); R.bench[i] = c; toast(`${d.name} → ${n.name}`); tryMerge('item', c.id, c.star);
    }) });
    opts.push({ label: '고철 팔기', desc: '골드 +4', go: () => { R.gold += 4; } });
    choice('대장간', '망치 소리가 울립니다', opts);
  }
  function pickFromBench(title, list, fn) {
    openSheet(`<span class="eyebrow">대장간</span><h2>${title}</h2><div class="picks">${list.map(([c], i) => cardTile(c, i)).join('')}</div>`);
    $('sheetIn').onclick = (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; const [c, i] = list[+b.dataset.pick]; closeSheet(); fn(c, i); SFX.play('attach'); renderPlay(); };
  }
  const EVENTS = [
    () => choice('떠돌이 상인', '“좋은 물건 있소. 3골드만 내시오.”', [
      { label: '산다 (3골드)', desc: '무작위 2등급 카드 1장', disabled: R.gold < 3, go: () => { R.gold -= 3; const c = rollCard(pick(['unit', 'skill', 'item']), 2); if (c) { take(c); gain(c); toast(`${def(c).name} 획득`); } } },
      { label: '지나간다', go: () => {} },
    ]),
    () => choice('훈련장', '허수아비가 줄지어 서 있습니다', [
      { label: '훈련한다', desc: '경험치 +4', go: () => { if (addXp(4)) toast(`원정대 Lv${R.lv}`); } },
      { label: '허수아비를 판다', desc: '골드 +3', go: () => { R.gold += 3; } },
    ]),
    () => choice('도박꾼', '“동전 던지기 한 판 어떻소?”', [
      { label: '4골드 건다', desc: '반반 확률로 10골드', disabled: R.gold < 4, go: () => { R.gold -= 4; if (Math.random() < 0.5) { R.gold += 10; toast('이겼다! +10골드'); SFX.play('coin'); } else toast('졌다…'); } },
      { label: '거절한다', go: () => {} },
    ]),
    () => choice('버려진 무기고', '녹슨 상자 두 개가 있습니다', [
      { label: '왼쪽 상자', desc: '무작위 아이템', go: () => { const c = rollCard('item', Math.min(4, R.act + 1)); if (c) { take(c); gain(c); toast(`${def(c).name} 획득`); } } },
      { label: '오른쪽 상자', desc: '무작위 스킬 칩', go: () => { const c = rollCard('skill', Math.min(3, R.act + 1)); if (c) { take(c); gain(c); toast(`${def(c).name} 획득`); } } },
    ]),
    () => choice('길 잃은 용병', '“밥만 주면 따라가겠소.”', [
      { label: '데려간다', desc: '무작위 1등급 유닛', go: () => { const c = rollCard('unit', 1); if (c) { take(c); gain(c); toast(`${def(c).name} 합류`); } } },
      { label: '돈을 주고 실력자를 구한다 (4골드)', desc: '무작위 3등급 유닛', disabled: R.gold < 4, go: () => { R.gold -= 4; const c = rollCard('unit', 3); if (c) { take(c); gain(c); toast(`${def(c).name} 합류`); } } },
    ]),
    () => choice('수상한 제단', '제단이 무언가를 바라는 듯합니다', [
      { label: '피를 바친다', desc: '골드 −5, 유물 1개', disabled: R.gold < 5, go: () => { R.gold -= 5; relicPick('수상한 제단', () => renderPlay()); } },
      { label: '그냥 떠난다', go: () => {} },
    ]),
  ];
  function openEvent() { pick(EVENTS)(); }

  // =====================================================================
  // 타이틀 · 출정 · 게임 오버 · 저장
  // =====================================================================
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(R)); } catch (e) { /* 저장 불가 */ } }
  function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }
  function title() {
    R = null; B = null;
    show('title');
    const s = loadSave();
    $('contBtn').hidden = !s;
    if (s) $('contBtn').innerHTML = `이어하기 <small>${s.act}막 · 라운드 ${s.round} · Lv${s.lv}</small>`;
    const fan = $('fan');
    if (!fan.children.length) {
      [['squire', 0, ''], ['archer', 0, ''], ['dragon', 1, 'boss'], ['apprentice', 0, ''], ['goblin', 1, '']].forEach(([id, side, kind], i) => {
        const img = document.createElement('img'); img.className = 'ftok t' + i; img.src = ART.tokenURL(id, side, kind || (side === 0 ? clsOfArt(id) : '')); img.alt = ''; fan.appendChild(img);
      });
    }
  }
  function setupRun() {
    let st = 'order', diff = 'normal';
    const render = () => {
      openSheet(`<span class="eyebrow">출정 준비</span><h2>어떤 부대로 떠날까요?</h2>
        <div class="starts">${STARTS.map((S) => `<button class="startopt${S.id === st ? ' on' : ''}" data-st="${S.id}"><span class="discs">${S.units.map(([id, sk, it]) => `<img src="${ART.discURL(id, 0, DEF['unit:' + id].cls, { level: 1, weapon: it ? battleApi.wpArt(DEF['item:' + it]) : null, skills: sk.map((x) => ({ col: CLS[DEF['skill:' + x].cls].col, icon: DEF['skill:' + x].icon })) }, 80)}" alt="">`).join('')}</span><b>${S.name}</b><small>${S.desc}</small></button>`).join('')}</div>
        <div class="diffs">${Object.entries(DIFF).map(([k, D]) => `<button class="diff${k === diff ? ' on' : ''}" data-df="${k}"><b>${D.name}</b><small>${D.desc}</small></button>`).join('')}</div>
        <div class="dbtn"><button class="btn" data-x>돌아가기</button><button class="btn go" data-go>출정!</button></div>`);
      $('sheetIn').onclick = (e) => {
        const a = e.target.closest('[data-st]'), b = e.target.closest('[data-df]');
        if (a) { st = a.dataset.st; return render(); }
        if (b) { diff = b.dataset.df; return render(); }
        if (e.target.closest('[data-x]')) return closeSheet();
        if (e.target.closest('[data-go]')) { clearSave(); newRun(st, diff); SFX.play('start'); showMap(); toast('지도에서 다음 칸을 고르고 출발하세요'); }
      };
    };
    render();
  }
  function endScreen(win) {
    clearSave();
    show('over');
    const n = R.node || R.lastNode || {};
    $('overStamp').textContent = win ? '흑룡 토벌!' : '원정 실패';
    $('overStamp').className = 'bigstamp' + (win ? ' win' : '');
    $('overText').textContent = win ? '아자르가 쓰러지고 화산이 잠잠해졌습니다. 원정대의 이름이 노래로 남을 것입니다.'
      : `${R.act}막 ${ACTS[R.act].name}${n.k ? ', ' + NODE[n.k].name : ''}에서 쓰러졌습니다.${R.diff === 'normal' ? ' 불사조 깃털 유물이 있으면 한 번은 버틸 수 있습니다.' : ''}`;
    const m = Math.floor(R.stats.time / 60);
    $('overRec').innerHTML = [['도달', `${R.act}막 · ${n.f === 5 ? '보스' : (n.f || 0) + 1 + '층'}`], ['라운드', `${R.round} / 18`], ['합성', `${R.stats.merges}번`], ['번 골드', R.stats.goldEarned], ['전투 승리', `${R.stats.wins} / ${R.stats.battles}`], ['플레이', `${m}분`]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('overTeam').innerHTML = R.board.map((u) => `<img src="${imgOf(u, 80)}" alt="${def(u).name}">`).join('') + R.relics.map((k) => `<span class="rpill">${RELICS[k].name}</span>`).join('');
    ui.tearUnit = R.board[0] ? R.board[0].id : 'squire';
    ui.tearT = 99;
  }
  function gameOver() { SFX.play('lose'); endScreen(false); }
  function victory() { SFX.play('win'); endScreen(true); }
  (function tearLoop() {
    if (ui.screen === 'over') {
      const cv = $('tearCv'), c = cv.getContext('2d');
      if (!ui.tear || ui.tearT > 2.6) { ui.tear = ART.makeTear(ART.token(ui.tearUnit || 'squire', 0, 60, 2, clsOfArt(ui.tearUnit || 'squire')), 180, 120, 60, 0); ui.tear.life = 1.6; ui.tearT = 0; }
      ui.tearT += 1 / 60; ART.stepTear(ui.tear, 1 / 60);
      c.clearRect(0, 0, 360, 300);
      if ($('overStamp').classList.contains('win')) ART.drawToken(c, ART.token('dragon', 1, 60, 2, 'boss'), 180, 130, 60, { rot: 0.3, dim: true });
      else if (ui.tearT < 0.35) ART.drawToken(c, ART.token(ui.tearUnit || 'squire', 0, 60, 2, clsOfArt(ui.tearUnit || 'squire')), 180, 120, 60, { lift: 6 * Math.sin(ui.tearT * 30) });
      else ART.drawTear(c, ui.tear);
    }
    requestAnimationFrame(tearLoop);
  })();

  // ---------- 메뉴 · 도감 ----------
  function openMenu() {
    const inRun = !!R;
    openSheet(`<span class="eyebrow">메뉴</span><h2>카드 원정대</h2><div class="relics">
      ${inRun ? `<button class="relic" data-m="relics"><b>유물 ${R.relics.length}개</b><span>${R.relics.map((k) => RELICS[k].name).join(', ') || '아직 없음'}</span></button>` : ''}
      <button class="relic" data-m="codex"><b>도감</b><span>유닛 · 스킬 · 아이템 · 유물</span></button>
      <button class="relic" data-m="help"><b>규칙</b><span>상점 · 합성 · 레벨 · 수입</span></button>
      <button class="relic" data-m="sound"><b>소리 ${SFX.muted ? '꺼짐' : '켬'}</b><span>탭해서 바꾸기</span></button>
      ${inRun ? '<button class="relic" data-m="quit"><b>타이틀로</b><span>지도 화면 기준으로 저장됩니다</span></button>' : ''}
    </div><button class="btn" data-m="close">닫기</button>`);
    $('sheetIn').onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = b.dataset.m;
      if (m === 'close' || m === 'relics') return closeSheet();
      if (m === 'codex') { closeSheet(); return openCodex(); }
      if (m === 'help') return openSheet(`<span class="eyebrow">규칙</span><h2>한 라운드</h2><div class="help">
        <p><b>상점 단계</b> 칸에 들어가면 내 진영과 상점 세 줄이 보입니다. 적 배치는 ‘적 필드 보기’로 확인하고, 전투 시작을 누르면 전투 단계로 넘어갑니다.</p>
        <p><b>상점</b> 유닛·스킬·아이템이 5장씩. 카드를 탭하면 정보가 뜨고, 구매 버튼을 눌러야 삽니다. 딱지를 탭하면 능력치·스킬 수치·장비를 한눈에 봅니다. 줄마다 1골드로 다시 뽑기, 잠그면 다음 라운드에도 유지.</p>
        <p><b>등급</b> 카드 바탕색이 등급입니다: 1 흰색 · 2 녹색 · 3 파랑 · 4 보라 · 5 노랑. 딱지 테두리 색은 클래스(전사 파랑 · 궁수 초록 · 마법사 보라).</p>
        <p><b>시너지</b> 딱지마다 클래스 1개 + 특성 2개. 같은 특성 딱지가 정해진 수만큼 출전하면(기본 시너지) 또는 지정된 조합이 모두 출전하면(특별 조합) 효과가 켜집니다. 시너지 줄의 ‘시너지’ 버튼으로 전체 목록을 봅니다.</p>
        <p><b>합성</b> 같은 카드 3장 → ★2, ★2 3장 → ★3. 보드·창고·장착된 칩까지 모두 셉니다.</p>
        <p><b>장착</b> 유닛마다 스킬 2개 + 아이템 1개. 같은 클래스만(공용 스킬은 누구나). 아이템에 따라 역할이 바뀝니다.</p>
        <p><b>레벨</b> 원정대 레벨 = 출전 인원. 라운드마다 경험치 +2, 4골드로 +4. 레벨이 오르면 높은 등급 카드가 잘 나옵니다.</p>
        <p><b>수입</b> 라운드마다 5 + 이자(10골드당 1, 최대 5) + 연승 보너스. 이기면 +1.</p>
        <p><b>패배</b> 한 번 지면 원정이 끝납니다.</p></div><button class="btn" data-m="close">닫기</button>`);
      if (m === 'sound') { SFX.setMuted(!SFX.muted); return openMenu(); }
      if (m === 'quit') { closeSheet(); if (R && ui.screen === 'map') save(); return title(); }
    };
  }
  function openCodex() {
    let tab = 'unit';
    const render = () => {
      let list = '';
      if (tab === 'relic') list = Object.entries(RELICS).map(([k, r]) => `<div class="cx"><div><b>${r.name}</b><small>${r.desc}</small></div></div>`).join('');
      else if (tab === 'syn') list = synList(null);
      else list = POOL[tab].slice().sort((a, b) => (CORDER.indexOf(a.cls) - CORDER.indexOf(b.cls)) || a.t - b.t).map((d) => {
        const c = mk(tab, d.id);
        const extra = tab === 'unit' ? `체력 ${d.hp} · 공격 ${d.atk} · 사거리 ${d.range}<br>${d.trait}<br>시너지: ${d.traits.map((k) => TRAITS[k].name).join(' · ')}` : tab === 'skill' ? d.desc : `${d.desc}<br><i>${d.feel}</i>`;
        return `<div class="cx k-${tab} tier${d.t}" style="--tc:var(--t${d.t})"><img src="${imgOf(c, 64)}" alt=""><div><b>${d.name}</b> <small class="tg" style="--cc:${CLS[d.cls].col}">${CLS[d.cls].name} · ${d.t}등급</small><small>${extra}</small></div>${tab === 'skill' ? patternGrid(d) : ''}</div>`;
      }).join('');
      $('codexList').innerHTML = list;
      document.querySelectorAll('[data-cx]').forEach((b) => b.classList.toggle('on', b.dataset.cx === tab));
    };
    $('codex').hidden = false;
    $('codex').onclick = (e) => { const b = e.target.closest('[data-cx]'); if (b) { tab = b.dataset.cx; render(); } if (e.target.closest('[data-cxclose]')) $('codex').hidden = true; };
    render();
  }
  document.querySelectorAll('[data-menu]').forEach((b) => (b.onclick = openMenu));
  $('newBtn').onclick = setupRun;
  $('contBtn').onclick = () => { const s = loadSave(); if (!s) return; R = s; fixBench(); showMap(); };
  $('codexBtn').onclick = openCodex;
  $('overNew').onclick = () => { title(); setupRun(); };
  $('overTitle').onclick = title;
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet') && ui.screen === 'title') closeSheet(); });
  document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.closest('#row') && !b.closest('#bench')) SFX.play('click', 0.05); });
  new ResizeObserver(() => { if (ui.screen === 'play') { fitBoard(); renderPrepPeek(); } if (ui.screen === 'map') renderMap(); }).observe($('phone'));
  function renderPrepPeek() { if (!B && ui.sel && ui.sel.from === 'shop') $('peek').style.bottom = ($('scr-play').clientHeight - $('shop').offsetTop + 6) + 'px'; }
  

  title();
  requestAnimationFrame(loop);

  // 테스트·밸런스용 진입점
  window.__g = {
    get R() { return R; }, set R(v) { R = v; }, ui, newRun, enterNode, finishNode, reachable, nodeById, buy, reroll, levelUp, equip, sellCard, tryMerge, owned, simFight,
    renderPlay, openCodex, openMenu, buildCombat, deployMax, benchSize, def, canEquip, rollCard, gain, take, startCombat, afterCombat, showMap, grid, genEnemies, battleApi, genMap, fixBench, addXp, eliteChoices, bossUnits,
  };
})();
