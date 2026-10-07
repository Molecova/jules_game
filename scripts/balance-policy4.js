/* Bounded, visible-information player. No combat simulation or game RNG access. */
(function (g) {
  'use strict';
  const profiles = {
    novice: { rolls: 1, reserve: 0, gear: .8, synergy: 0, noise: .22, level: [0, 5, 6, 7, 8, 8] },
    balanced: { rolls: 3, reserve: 10, gear: 1, synergy: .1, noise: .09, level: [0, 5, 6, 7, 8, 9] },
    synergy: { rolls: 4, reserve: 20, gear: 1.2, synergy: .22, noise: .04, level: [0, 5, 6, 7, 8, 9] },
  };
  function create(catalog, profile, seed) {
    const cfg = profiles[profile]; if (!cfg) throw Error('unknown profile');
    let rng = seed >>> 0;
    const random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
    const def = c => catalog.def[c.kind + ':' + c.id];
    const units = o => [...o.board, ...o.bench.filter(c => c?.kind === 'unit')];
    const cards = o => [...o.bench.filter(Boolean), ...o.board].flatMap(c => c.kind === 'unit' ? [c, ...c.skills, ...(c.item ? [c.item] : [])] : [c]);
    const stock = (o, c) => cards(o).filter(x => x.kind === c.kind && x.id === c.id);
    function synergy(c, lineup) {
      if (!cfg.synergy || lineup.some(u => u.id === c.id)) return 0;
      let bonus = 0;
      for (const t of Object.values(catalog.traits)) {
        if (t.kind === 'job' || t.kind === 'peer' || !t.members.includes(c.id)) continue;
        const n = new Set(lineup.filter(u => t.members.includes(u.id)).map(u => u.id)).size;
        const th = t.kind === 'combo' ? [t.members.length] : t.th;
        if (th.includes(n + 1)) bonus += cfg.synergy;
      }
      return Math.min(.6, bonus);
    }
    function unitValue(c, lineup = []) {
      const d = def(c), k = 2 ** (c.star - 1);
      let val = (d.atk * d.as + d.hp / 38) * k;
      // Visible skill descriptions, not measured encounter outcomes or tier wishlists.
      if (d.ult) val += ((d.ult.power || 0) / Math.max(40, d.ult.mana || 80) * 12 + (d.ult.heal || 0) / 12) * [0, 1, 1.7, 2.8][c.star];
      if (d.ult?.effect === 'summon') val += 45 * k;
      if (['markRandom', 'curse', 'mana'].includes(d.ult?.effect)) val += 20 * k;
      if (d.passive) val *= 1.15;
      val *= 1 + (d.armor || 0) + synergy(c, lineup);
      // Equipment can be transferred; compare bodies and visible synergies before dressing the lineup.
      return val;
    }
    function gearValue(c, u, o) {
      const d = def(c), ud = def(u);
      if (d.cls !== 'any' && d.cls !== ud.cls) return -10000;
      const k = [0, 1, 1.6, 2.5][c.star], s = d.st || {};
      if (c.kind === 'item') {
        let v = 20 + 70 * (s.atk || 0) + 80 * (s.as || 0) + 85 * (s.hp || 0) + 180 * (s.armor || 0) + 90 * (s.spell || 0) + 80 * (s.crit || 0) + 100 * (s.lifesteal || 0) + (s.mana || 0) / 2;
        if (d.fx) v += 16; if (d.act) v += 18;
        if (s.melee && ud.range > 1) v *= .65;
        if (ud.cls === 'mag') v += 35 * (s.spell || 0);
        return v * k;
      }
      let v = 20 + d.t * 7 + Math.min(40, (d.power || 0) / 12);
      if (['shield', 'heal', 'timewarp', 'haste', 'buff', 'fortify'].includes(d.effect)) v += 15;
      if (d.effect === 'transfer') v += u.item?.id === 'restlessbow' ? 25 : -10;
      if (profile !== 'novice' && o?.enemies?.some(e => e.boss)) {
        if (d.stun || d.silence) v += 32;
        if (d.antiheal && o.enemies.some(e => /회복|흡혈|치유|치료|보호막|방패/.test(e.hint))) v += 45;
      }
      if (d.mode === 'facing' && ud.range > 1) v *= .65;
      if (d.effect === 'brace' && ud.range === 1) v *= .75;
      return v * [0, 1, 1.7, 2.6][c.star];
    }
    const carry = c => { const d = def(c); return d.range > 1 && (d.atk * d.as >= 30 || ['dmg', 'smite', 'curse'].includes(d.ult?.effect)); };
    const carryNeed = o => profile === 'novice' ? 0 : Math.max(1, Math.floor((o.capacity + 1) / 3));
    function lineup(o) {
      const left = units(o).slice(), out = [];
      while (left.length && out.length < o.capacity) {
        const needFront = !out.some(c => def(c).range === 1);
        const short = Math.max(0, carryNeed(o) - out.filter(carry).length);
        const pool = short && o.capacity - out.length <= short && left.some(carry) ? left.filter(carry) : left;
        pool.sort((a, b) => (unitValue(b, out) * (needFront && def(b).range === 1 ? 1.55 : 1)) - (unitValue(a, out) * (needFront && def(a).range === 1 ? 1.55 : 1)));
        const next = pool[0]; out.push(next); left.splice(left.indexOf(next), 1);
      }
      return out.map(c => c.uid);
    }
    function buyScore(o, c) {
      const d = def(c), own = stock(o, c), all = units(o), selected = lineup(o).map(id => all.find(u => u.uid === id));
      const copies = own.reduce((n, x) => n + 3 ** (x.star - 1), 0);
      if (copies >= 9) return -1;
      if (c.kind === 'unit') {
        if (own.length) {
          const first = own.reduce((a, b) => unitValue(a) > unitValue(b) ? a : b);
          const good = selected.some(u => u.id === c.id) || selected.length < o.capacity || (profile !== 'novice' && unitValue({ ...c, star: 2 }, selected) > Math.min(...selected.map(u => unitValue(u))) * 1.08);
          if (!good) return -1;
          return (copies % 3 === 2 ? 100 : copies >= 6 ? 64 : 48) / Math.sqrt(d.t);
        }
        if (selected.filter(carry).length < carryNeed(o) && carry(c)) return 75 / Math.sqrt(d.t);
        if (selected.length < o.capacity) return (55 + unitValue(c) / 6) / Math.sqrt(d.t);
        const worst = Math.min(...selected.map(u => unitValue(u, selected.filter(x => x !== u))));
        const delta = unitValue(c, selected) - worst;
        // Keep at most two speculative high-grade upgrade projects.
        if (delta > 5) return (20 + delta / 4) / Math.sqrt(d.t);
        if (profile !== 'novice' && d.t >= 3 && all.length < o.capacity + 2 && o.gold >= 20 && unitValue({ ...c, star: 2 }, selected) > worst * 1.08) return 26 / Math.sqrt(d.t);
        return -1;
      }
      const compatible = selected.filter(u => def(c).cls === 'any' || def(c).cls === def(u).cls);
      if (!compatible.length) return -1;
      const gain = Math.max(...compatible.map(u => {
        const old = c.kind === 'item' ? u.item : u.skills[0];
        return gearValue(c, u, o) - (old ? gearValue(old, u, o) : 0);
      }));
      if (own.length && copies < 9) return (copies % 3 === 2 ? 64 : 18) * cfg.gear / Math.sqrt(d.t);
      return gain > 7 ? gain * cfg.gear / Math.sqrt(d.t) : -1;
    }
    function shop(o) {
      const reserve = o.act === 1 || o.node.k === 'boss' || o.lastHp < .35 ? 0 : cfg.reserve;
      const targetLv = cfg.level[o.act];
      if ((o.round > 1 || o.xp + 4 >= catalog.xp[o.lv]) && o.lv < targetLv && o.gold >= (o.relics.includes('anvil') ? 3 : 4) + reserve && (units(o).length >= o.capacity || o.xp + 4 >= catalog.xp[o.lv])) return { type: 'level' };
      const opts = [];
      for (const [kind, row] of Object.entries(o.shop)) row.forEach((c, i) => {
        if (!c || def(c).t > o.gold) return;
        const score = buyScore(o, c) * (1 + (random() - .5) * cfg.noise);
        if (score > 8 && (o.gold - def(c).t >= reserve || score > 65 || units(o).length < o.capacity)) opts.push({ type: 'buy', kind, i, score });
      });
      opts.sort((a, b) => b.score - a.score); if (opts.length) return opts[0];
      const rollBudget = cfg.rolls + (profile !== 'novice' && o.node.k === 'boss' && o.gold >= 30 ? 4 : 0);
      // Later runs need chip/weapon merges even when every slot is already filled.
      const rotation = o.act >= 3 ? ['unit', 'skill', 'item'] : ['unit', 'unit', selectedGaps(o) ? 'item' : 'skill'];
      if (o.rolls < rollBudget && (o.gold > reserve + 5 || o.freeRolls > 0)) return { type: 'roll', kind: rotation[o.rolls % rotation.length] };
      return { type: 'done' };
    }
    function selectedGaps(o) { return o.board.some(u => !u.item || !u.skills.length); }
    function route(o) {
      const values = { fight: 2, elite: profile === 'novice' ? -.5 : 1.4, treasure: 5, event: 4, camp: 3, shop: 3.5, forge: .8, boss: 0 };
      if (o.lastHp < .35) { values.elite -= 4; values.camp -= 1; }
      const reachable = new Set(o.reachable);
      return o.map.flat().filter(n => reachable.has(n.id)).map(n => ({ id: n.id, score: values[n.k] + (profile === 'synergy' ? Math.max(0, ...n.next.map(id => values[o.map.flat().find(x => x.id === id)?.k] || 0)) * .3 : 0) + random() * .6 })).sort((a, b) => b.score - a.score)[0].id;
    }
    function reward(o, visible) { return visible.map((c, i) => ({ i, score: buyScore(o, c) + def(c).t * 2 })).sort((a, b) => b.score - a.score)[0].i; }
    function relic(o, visible) {
      const early = o.act <= 2;
      const weights = { flag: 95, phoenix: 85, lantern: 80, pauldron: 60, bloodstone: 63, banner: 45, tome: 65, horn: 55, sandglass: 60, crest: 45, victoryhorn: 45, crown: early ? 83 : 40, scale: early ? 80 : 45, glue: early ? 65 : 35, anvil: early ? 55 : 10, bigbag: 25, vault: 5, dice: 35, shard: early ? 35 : 10, goldtooth: early ? 65 : 20 };
      return visible.map((id, i) => ({ i, score: (weights[id] || 22) * (1 + (random() - .5) * cfg.noise) })).sort((a, b) => b.score - a.score)[0].i;
    }
    function choice(o, title, options) {
      const labels = options.map(x => x.text), enabled = options.map((x, i) => !x.disabled ? i : -1).filter(i => i >= 0);
      let desired = 0;
      if (title === '대장간') desired = profile === 'novice' ? 4 : enabled.includes(2) ? 2 : 4;
      if (title === '암시장') desired = labels.findIndex(x => x.includes('둘러보기'));
      if (title === '야영지') desired = o.lv < cfg.level[o.act] ? 0 : 1;
      if (title === '떠돌이 상인') desired = o.gold > 15 ? 0 : 1;
      if (title === '훈련장') desired = o.lv < cfg.level[o.act] ? 0 : 1;
      if (title === '도박꾼') desired = profile === 'novice' && o.gold > 12 ? 0 : 1;
      if (title === '버려진 무기고') desired = o.board.filter(u => !u.item).length >= o.board.filter(u => !u.skills.length).length ? 0 : 1;
      if (title === '길 잃은 용병') desired = o.gold >= 12 ? 1 : 0;
      if (title === '수상한 제단') desired = o.gold >= 8 ? 0 : 1;
      if (title === '신비한 샘') desired = o.lv < cfg.level[o.act] && o.lastHp > .6 ? 0 : 1;
      if (title === '훈련 교관') desired = 0;
      if (title === '폐허의 서고') desired = o.lv < cfg.level[o.act] ? 0 : 1;
      if (title === '쓰러진 기사') desired = 1;
      if (title === '좀도둑') desired = profile === 'novice' ? 0 : 1;
      if (title === '용병 길드 게시판') desired = o.gold >= o.act + 12 ? 0 : 1;
      return enabled.includes(desired) ? desired : enabled[enabled.length - 1];
    }
    return { lineup, shop, route, reward, relic, choice, unitValue, gearValue, profiles: cfg };
  }
  g.BalancePolicy4 = { create, profiles };
  if (typeof module !== 'undefined') module.exports = g.BalancePolicy4;
})(typeof window === 'undefined' ? globalThis : window);
