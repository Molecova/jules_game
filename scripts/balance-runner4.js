/* Controller only: uses real game actions; the policy receives a whitelisted copy. */
(function (g) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const freeze = x => { if (x && typeof x === 'object') { Object.freeze(x); Object.values(x).forEach(freeze); } return x; };
  const assert = (ok, why) => { if (!ok) throw Error('legal-play invariant: ' + why); };
  function run(seed, profile, difficulty = 'normal') {
    const game = g.__g, V = g.V4;
    assert(V.DIFF.normal.foeHp === 1 && V.DIFF.normal.foeAtk === 1, 'neutral normal difficulty');
    for (const d of Object.values(V.DIFF)) assert(Number.isFinite(d.foeHp) && d.foeHp > 0 && Number.isFinite(d.foeAtk) && d.foeAtk > 0, 'difficulty coefficients');
    for (const k of ['fight', 'elite', 'boss', 'shop', 'camp', 'event', 'treasure', 'forge']) assert(typeof V.NODE[k].name === 'string', 'node metadata ' + k);
    const originalCrypto = crypto.getRandomValues;
    crypto.getRandomValues = array => { array[0] = seed >>> 0; return array; };
    try { game.newRun(difficulty); } finally { crypto.getRandomValues = originalCrypto; }
    game.showMap();
    const policy = BalancePolicy4.create(freeze(clone({ def: V.DEF, traits: V.TRAITS, xp: V.XPNEED })), profile, seed ^ 0x9e3779b9);
    const started = performance.now();
    const result = { seed, profile, difficulty, won: false, nodes: [], actions: [], fights: [], legalChecks: 0, combatMs: 0 };
    let lastHp = 1, rolls = 0, shoppedRound = -1;
    const observation = () => freeze(clone({
      act: game.R.act, round: game.R.round, lv: game.R.lv, xp: game.R.xp, gold: game.R.gold,
      capacity: game.deployMax(), benchCapacity: game.benchSize(), board: game.R.board,
      bench: game.R.bench, shop: game.R.shop, relics: game.R.relics,
      node: game.R.node, map: game.R.map.floors, reachable: game.reachable(),
      enemies: game.R.enemies.map(e => ({ id: e.id, cell: e.cell, boss: !!GD.MONSTERS[e.id].boss, hint: GD.BOSS_INFO[e.id] || GD.MONSTERS[e.id].desc || '' })),
      freeRolls: game.R.freeRolls, rolls, lastHp,
    }));
    function check() {
      const r = game.R, all = [...r.board, ...r.bench.filter(Boolean)].flatMap(c => c.kind === 'unit' ? [c, ...c.skills, ...(c.item ? [c.item] : [])] : [c]);
      assert(r.gold >= 0, 'negative gold'); assert(r.board.length <= game.deployMax(), 'deployment cap');
      assert(new Set(all.map(c => c.uid)).size === all.length, 'duplicate ownership');
      assert(new Set(r.board.map(c => c.x + ',' + c.y)).size === r.board.length, 'overlapping cells');
      for (const u of r.board) {
        assert(u.x >= 0 && u.x < 5 && u.y >= 3 && u.y < 6, 'player territory');
        assert(u.skills.length <= 1, 'skill slot cap');
        for (const c of [...u.skills, ...(u.item ? [u.item] : [])]) assert(game.canEquip(c, u), 'class restriction');
      }
      for (const d of [...V.UNITS, ...V.SKILLS, ...V.ITEMS]) {
        const n = all.filter(c => c.kind === d.kind && c.id === d.id).reduce((s, c) => s + 3 ** (c.star - 1), 0);
        assert(n + r.pool[d.kind + ':' + d.id] === (d.special ? 1 : V.POOL_N[d.t]), 'pool conservation ' + d.id);
      }
      result.legalChecks++;
    }
    function action(type, fn, detail = {}) {
      const before = game.R.gold;
      const ok = fn();
      result.actions.push({ round: game.R.round, type, ...detail, goldDelta: game.R.gold - before });
      check(); return ok;
    }
    function arrange() {
      const selected = policy.lineup(observation()), r = game.R;
      for (const uid of selected) {
        if (r.board.some(c => c.uid === uid)) continue;
        const i = r.bench.findIndex(c => c?.uid === uid); assert(i >= 0, 'owned deployment');
        const out = r.board.find(c => !selected.includes(c.uid));
        let spot = out ? [out.x, out.y] : null;
        if (!spot) for (let y = 3; y < 6 && !spot; y++) for (let x = 0; x < 5 && !spot; x++) if (!r.board.some(c => c.x === x && c.y === y)) spot = [x, y];
        game.ui.sel = null; game.tapBench(i, true); game.tapCell(...spot, true, true);
      }
      // A human-scale greedy formation: tanks in front, ranged units spread across columns.
      const us = r.board.slice().sort((a, b) => game.def(a).range - game.def(b).range || policy.unitValue(b) - policy.unitValue(a));
      const used = new Set(), cols = [1, 3, 0, 4, 2];
      for (const u of us) {
        const d = game.def(u), melee = d.range === 1 || game.def(u.item || { kind: 'item', id: 'shortbow' }).st?.melee;
        const rows = melee ? [3, 4, 5] : d.range >= 4 ? [5, 4, 3] : [4, 5, 3];
        const spots = rows.flatMap(y => cols.map(x => [x, y]));
        const spot = spots.find(([x, y]) => !used.has(x + ',' + y)); used.add(spot.join(','));
        if (u.x !== spot[0] || u.y !== spot[1]) { game.ui.sel = { from: 'board', c: u }; game.tapCell(...spot, true, true); }
      }
      game.ui.sel = null;
      // Reclaim useful loadouts from retired units through the actual Remove action.
      for (const old of r.bench.filter(c => c?.kind === 'unit')) {
        for (const slot of ['item', 0]) {
          const c = slot === 'item' ? old.item : old.skills[0]; if (!c) continue;
          const o = observation();
          if (r.board.some(u => {
            const current = c.kind === 'item' ? u.item : u.skills[0];
            return policy.gearValue(c, u, o) > (current ? policy.gearValue(current, u, o) : 0) + 2;
          })) action('unequip', () => game.unequip(old, slot), { id: c.id, unit: old.id });
        }
      }
      for (let n = 0; n < 24; n++) {
        let best = null; const gearObservation = observation();
        for (let i = 0; i < r.bench.length; i++) {
          const c = r.bench[i]; if (!c || c.kind === 'unit') continue;
          for (const u of r.board) {
            const old = c.kind === 'item' ? u.item : u.skills[0];
            const gain = policy.gearValue(c, u, gearObservation) - (old ? policy.gearValue(old, u, gearObservation) : 0);
            if (gain > 2 && (!best || gain > best.gain)) best = { i, c, u, gain };
          }
        }
        if (!best) break;
        action('equip', () => game.equip(best.c, best.i, best.u, true), { id: best.c.id, unit: best.u.id });
      }
      check();
    }
    function cleanBench() {
      const r = game.R;
      if (r.bench.filter(Boolean).length < game.benchSize() - 1) return;
      const selected = new Set(policy.lineup(observation()));
      const candidates = r.bench.map((c, i) => ({ c, i })).filter(({ c }) => c && !selected.has(c.uid));
      candidates.sort((a, b) => {
        const value = c => c.kind === 'unit' ? policy.unitValue(c) * (r.board.some(u => u.id === c.id) ? 4 : 1) : Math.max(0, ...r.board.map(u => policy.gearValue(c, u))) * 1.5;
        return value(a.c) - value(b.c);
      });
      if (candidates.length) { const { c, i } = candidates[0]; action('sell', () => game.sellCard(c, 'bench', i), { id: c.id, kind: c.kind, star: c.star }); }
    }
    function shop() {
      if (shoppedRound === game.R.round) { arrange(); return; }
      shoppedRound = game.R.round; rolls = 0; arrange(); cleanBench();
      for (let n = 0; n < 40; n++) {
        const a = policy.shop(observation());
        if (a.type === 'done') break;
        if (a.type === 'level') action('level', () => game.levelUp(true));
        else if (a.type === 'roll') { action('roll', () => game.reroll(true, a.kind), { kind: a.kind }); rolls++; }
        else if (a.type === 'buy') {
          const c = game.R.shop[a.kind][a.i];
          const bought = action('buy', () => game.buy(a.i, true, a.kind), { kind: a.kind, id: c.id });
          if (!bought) { cleanBench(); if (game.R.bench.filter(Boolean).length >= game.benchSize()) break; }
        }
        arrange(); cleanBench();
      }
      game.renderPlay();
    }
    function sheet() {
      const box = document.getElementById('sheetIn'), r = game.R, o = observation();
      let buttons = [...box.querySelectorAll('[data-r]')];
      if (buttons.length) return action('relic', () => buttons[policy.relic(o, clone(r.pending.options))].click());
      buttons = [...box.querySelectorAll('[data-pick]')];
      if (buttons.length) {
        const visible = r.pending?.type === 'reward' ? clone(r.pending.cards) : buttons.map(b => {
          // Forge list is visible. Match UID through displayed card name, without peeking at the forge's random output.
          const name = b.querySelector('b').textContent;
          return clone(r.bench.find(c => c && game.def(c).name === name));
        });
        return action('reward', () => buttons[policy.reward(o, visible)].click());
      }
      buttons = [...box.querySelectorAll('[data-o]')];
      if (buttons.length) {
        const title = box.querySelector('.eyebrow').textContent;
        const visible = buttons.map(b => ({ text: b.textContent, disabled: b.disabled }));
        return action('choice', () => buttons[policy.choice(o, title, visible)].click(), { title });
      }
      throw Error('unknown sheet ' + box.textContent);
    }
    for (let step = 0; step < 45 && game.ui.screen !== 'over'; step++) {
      assert(game.R.mode === 'map', 'node boundary');
      const nodeId = policy.route(observation()); assert(game.reachable().includes(nodeId), 'reachable route');
      const node = game.nodeById(nodeId); rolls = 0;
      action('route', () => game.enterNode(node), { node: node.id, kind: node.k });
      result.nodes.push({ act: game.R.act, round: game.R.round, kind: node.k, id: node.id });
      for (let guard = 0; guard < 15 && game.ui.screen !== 'map' && game.ui.screen !== 'over'; guard++) {
        if (!document.getElementById('sheet').hidden) { sheet(); continue; }
        shop();
        if (game.R.mode === 'fight') {
          assert(game.R.board.length > 0, 'nonempty army');
          const army = clone(game.R.board), gold = game.R.gold, lv = game.R.lv, relics = clone(game.R.relics);
          game.startCombat(); const battle = game.B;
          const finiteBattle = () => { for (const u of battle.combat.units) {
            assert(Number.isFinite(u.hp) && Number.isFinite(u.maxHp) && u.maxHp > 0, 'finite HP ' + u.def.id);
            assert(Number.isFinite(u.atk) && u.atk >= 0 && Number.isFinite(u.as), 'finite attack ' + u.def.id);
          } };
          finiteBattle();
          battle.sim = true; const combatStarted = performance.now();
          try { while (!battle.combat.done) battle.combat.step(1 / 60); } finally { battle.sim = false; }
          finiteBattle(); result.combatMs += performance.now() - combatStarted;
          game.endCombat();
          const cb = battle.combat, allies = cb.units.filter(u => u.side === 0 && !u.summon && !u.object);
          lastHp = allies.reduce((n, u) => n + Math.max(0, u.hp) / u.maxHp, 0) / allies.length;
          result.fights.push({ act: game.R.act, round: game.R.round, kind: game.R.node.k, ambush: game.R.node.ambush || null, encounter: game.R.encounter?.name, enemies: game.R.enemies.map(e => e.id), won: battle.won, timeout: cb.winner === -1, time: cb.t, hp: lastHp, lv, gold, relics, army, damage: allies.map(u => ({ id: u.def.id, dmg: Math.round(u.dmgDealt || 0), heal: Math.round((u.healDone || 0) + (u.shieldDone || 0)) })) });
          check(); game.afterCombat();
        } else action('finish', () => document.getElementById('goBtn').click());
      }
      assert(['map', 'over'].includes(game.ui.screen), 'node resolved');
    }
    result.won = document.getElementById('overStamp').textContent === '원정 완수!';
    result.act = game.R.act; result.round = game.R.round; result.finalGold = game.R.gold; result.stats = clone(game.R.stats);
    result.totalMs = performance.now() - started; check(); return result;
  }
  g.BalanceRunner4 = { run };
})(window);
