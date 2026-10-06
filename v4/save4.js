/* Versioned run storage. Parse into a detached, validated state before exposing it to the game. */
(function (global) {
  'use strict';
  const VERSION = 1;
  const object = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const int = (x, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x >= min && x <= max;
  function normalize(input) {
    try {
      const s = JSON.parse(JSON.stringify(input)), V = global.V4, M = global.GD.MONSTERS;
      const require = (ok) => { if (!ok) throw new Error('Invalid save'); };
      require(object(s) && s.v === 4 && (s.saveVersion == null || s.saveVersion === VERSION));
      require(int(s.act, 1, 5) && int(s.round, 0, 30) && int(s.lv, 3, 9) && int(s.gold, 0) && int(s.xp, 0));
      require(['map', 'fight', 'rest', 'result', 'reward'].includes(s.mode));
      require(Array.isArray(s.relics) && s.relics.every(k => typeof k === 'string'));
      s.relics = [...new Set(s.relics.filter(k => Object.hasOwn(V.RELICS, k)))];
      require(object(s.pool) && Object.values(s.pool).every(n => int(n, 0)));
      require(Array.isArray(s.board) && s.board.length <= 15 && Array.isArray(s.bench) && s.bench.length <= 200);
      const ids = new Set();
      const card = (c, own = false) => {
        require(object(c) && ['unit', 'skill', 'item'].includes(c.kind) && typeof c.id === 'string' && !!V.DEF[c.kind + ':' + c.id]);
        require(int(c.star, 1, 3) && typeof c.uid === 'string' && c.uid.length > 0);
        if (own) { require(!ids.has(c.uid)); ids.add(c.uid); }
        if (c.kind === 'unit') {
          require(Array.isArray(c.skills));
          // Migrate removed equipment; unknown units cannot safely remain on the board.
          c.skills = c.skills.filter(x => x && V.DEF['skill:' + x.id]);
          require(c.skills.length <= 3);
          for (const x of c.skills) { require(x.kind === 'skill'); card(x, own); }
          if (c.item && !V.DEF['item:' + c.item.id]) c.item = null;
          if (c.item) { require(c.item.kind === 'item'); card(c.item, own); }
        }
        if (c.rot != null) require(Number.isFinite(c.rot));
        return c;
      };
      const cells = new Set();
      for (const c of s.board) {
        card(c, true); require(c.kind === 'unit' && int(c.x, 0, 4) && int(c.y, 3, 5));
        const cell = c.x + ',' + c.y; require(!cells.has(cell)); cells.add(cell);
      }
      s.bench = s.bench.map(c => c && !V.DEF[c.kind + ':' + c.id] ? null : c);
      for (const c of s.bench) if (c) card(c, true);
      require(object(s.shop));
      for (const k of ['unit', 'skill', 'item']) {
        require(Array.isArray(s.shop[k]) && s.shop[k].length <= 5);
        s.shop[k] = s.shop[k].map(c => c && !V.DEF[c.kind + ':' + c.id] ? null : c);
        for (const c of s.shop[k]) if (c) { card(c); require(c.kind === k); }
      }
      require(object(s.map) && Array.isArray(s.map.floors) && s.map.floors.length === 6 && !!M[s.map.boss]?.boss);
      const nodes = new Set();
      s.map.floors.forEach((floor, f) => {
        require(Array.isArray(floor) && floor.length > 0 && floor.length <= 3);
        for (const n of floor) {
          require(object(n) && typeof n.id === 'string' && !nodes.has(n.id) && n.f === f && Number.isFinite(n.x));
          require(Object.hasOwn(V.NODE, n.k) && Array.isArray(n.next)); nodes.add(n.id);
        }
      });
      for (const n of s.map.floors.flat()) require(n.next.every(id => nodes.has(id)));
      require((s.pos == null || nodes.has(s.pos)) && Array.isArray(s.path) && s.path.every(id => nodes.has(id)));
      if (s.node) {
        require(object(s.node) && nodes.has(s.node.id) && Object.hasOwn(V.NODE, s.node.k) && int(s.node.f, 0, 5));
        require(!s.node.ambush || ['camp', 'mimic', 'knight', true].includes(s.node.ambush));
        if (s.node.ambush === true) s.node.ambush = 'camp';
      }
      require(s.mode === 'map' ? !s.node : !!s.node);
      require(Array.isArray(s.enemies) && s.enemies.length <= 30);
      const foeCells = new Set();
      for (const e of s.enemies) {
        require(object(e) && !!M[e.id] && int(e.cell, 0, 14) && !foeCells.has(e.cell)); foeCells.add(e.cell);
        require(e.scale == null || Number.isFinite(e.scale) && e.scale > 0);
      }
      require(s.mode !== 'fight' || s.enemies.length > 0);
      require(object(s.stats));
      for (const k of ['wins', 'battles', 'merges', 'goldEarned', 'kills', 'time', 'elites', 'bosses']) {
        if (s.stats[k] == null) s.stats[k] = 0;
        require(Number.isFinite(s.stats[k]) && s.stats[k] >= 0);
      }
      if (s.diff === 'easy') s.diff = 'normal';
      if (!V.DIFF[s.diff]) s.diff = 'normal';
      s.locked = Object.fromEntries(['unit', 'skill', 'item'].map(k => [k, !!s.locked?.[k]]));
      for (const k of ['freeRolls', 'oddsBonus']) { if (s[k] == null) s[k] = 0; require(int(s[k], 0)); }
      if (s.nextHp != null) require(Number.isFinite(s.nextHp) && s.nextHp > 0 && s.nextHp <= 1);
      for (const k of ['rng', 'battleSeed']) if (s[k] != null) require(int(s[k], 0, 0xffffffff));
      if (s.rng == null) s.rng = global.ENCOUNTERS4.hash(JSON.stringify(s.map) + ':' + s.round);
      if (s.battleSeed == null) s.battleSeed = global.ENCOUNTERS4.hash(s.rng + ':' + (s.node?.id || 'map'));
      if (s.result) { require(object(s.result) && typeof s.result.won === 'boolean' && int(s.result.reward, 0)); }
      require((s.mode === 'result') === !!s.result);
      const pending = (p, depth = 0) => {
        require(object(p) && depth < 2);
        if (p.type === 'event') require(int(p.index, 0, 11));
        else if (p.type === 'forge') { require(['menu', 'duplicate', 'temper', 'fuse1', 'fuse2', 'remodel'].includes(p.stage)); if (p.stage === 'fuse2') require(typeof p.first === 'string'); }
        else if (p.type === 'shop') require(p.offer === null || V.DEF['item:' + p.offer]?.special);
        else if (p.type === 'relic') {
          require(typeof p.title === 'string' && Array.isArray(p.options) && p.options.length <= 3 && p.options.every(k => Object.hasOwn(V.RELICS, k)));
          if (p.next) { require(p.next.type === 'reward'); pending(p.next, depth + 1); }
        } else if (p.type === 'reward') {
          require(typeof p.title === 'string' && typeof p.sub === 'string' && Array.isArray(p.cards) && p.cards.length <= 3);
          for (const c of p.cards) card(c);
        } else require(p.type === 'camp');
      };
      if (s.pending) { require(s.node && !s.result); pending(s.pending); }
      require(s.mode !== 'reward' || !!s.pending);
      // Cached encounters are optional. Reject malformed caches instead of executing them.
      if (s.encounters) {
        require(object(s.encounters) && s.encounters.version === 1 && int(s.encounters.seed, 0, 0xffffffff));
        require(object(s.encounters.used) && Object.values(s.encounters.used).every(xs => Array.isArray(xs) && xs.every(x => typeof x === 'string')));
        require(Array.isArray(s.encounters.history) && s.encounters.history.every(x => typeof x === 'string') && object(s.encounters.nodes));
        for (const v of Object.values(s.encounters.nodes)) {
          require(object(v) && object(v.info) && typeof v.info.name === 'string' && Array.isArray(v.enemies));
          require(v.enemies.every(e => object(e) && !!M[e.id] && int(e.cell, 0, 14) && Number.isFinite(e.scale) && e.scale > 0));
        }
      }
      // Old forge saves could miscount starred copies. Reconstruct the unreserved pool.
      const owned = {};
      for (const c of [...s.board, ...s.bench].filter(Boolean)) {
        for (const x of [c, ...(c.skills || []), c.item].filter(Boolean)) {
          const k = x.kind + ':' + x.id; owned[k] = (owned[k] || 0) + 3 ** (x.star - 1);
        }
      }
      for (const d of [...V.UNITS, ...V.SKILLS, ...V.ITEMS]) {
        const k = d.kind + ':' + d.id; s.pool[k] = Math.max(0, (d.special ? 1 : V.POOL_N[d.t]) - (owned[k] || 0));
      }
      s.saveVersion = VERSION;
      return s;
    } catch (_) { return null; }
  }
  function create(storage, key) {
    const backup = key + ':backup';
    const parse = (raw) => { try { return raw ? normalize(JSON.parse(raw)) : null; } catch (_) { return null; } };
    return {
      read() {
        try {
          const raw = storage.getItem(key), run = parse(raw);
          if (run) return { run, status: 'ok' };
          const older = storage.getItem(backup), recovered = parse(older);
          return { run: recovered, status: recovered ? 'recovered' : raw || older ? 'invalid' : 'empty' };
        } catch (_) { return { run: null, status: 'unavailable' }; }
      },
      write(run) {
        try {
          const raw = JSON.stringify({ ...run, saveVersion: VERSION });
          // A rejected state must not replace either good snapshot.
          if (!parse(raw)) return false;
          const previous = storage.getItem(key);
          if (previous !== raw && parse(previous)) storage.setItem(backup, previous);
          storage.setItem(key, raw); return true;
        } catch (_) { return false; }
      },
      clear() { try { storage.removeItem(key); storage.removeItem(backup); return true; } catch (_) { return false; } },
    };
  }
  global.SAVE4 = { normalize, create, VERSION };
})(window);
