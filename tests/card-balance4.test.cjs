const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
function world() {
  const c = {}; c.window = c; vm.createContext(c);
  for (const f of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/balance4.js', 'v4/enemies4.js', 'v4/battle4.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'), c);
  return c;
}
function fixture(hostStar = 1, skillStar = 1, itemStar = 1, skill = 'ignite', item = 'firestaff', host = 'apprentice') {
  const c = world(), grid = c.AC.squareGrid(5, 6, 64), fx = { play() {}, burst() {}, death() {}, shake() {} };
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => ({ relics: [], act: 1, round: 5, diff: 'normal' }), random: () => .5, phase() {}, fx });
  const card = { id: host, star: hostStar, uid: 'host', skills: [], item: item ? { id: item, star: itemStar } : null };
  const u = api.makeAlly(card, 17, { ttiers: {} }), friend = api.makeAlly({ ...card, uid: 'friend', item: null }, 18, { ttiers: {} });
  const t = api.makeFoe({ def: c.GD.MONSTERS.goblin, cell: 12, scale: 1 });
  for (const a of [u, friend, t]) a.maxHp = a.hp = 100000;
  const hooks = api.hooks(), cb = new c.AC.Combat(grid, [u, friend, t], { hooks, random: () => .5 });
  const d = c.V4.DEF['skill:' + skill];
  function cast(sd = d, star = skillStar) { u.skills = [{ def: sd, star, cells: c.BT4.expandCells(sd, star) }]; u.castIdx = 0; hooks.onCast(u, t, cb); }
  return { c, api, u, friend, t, cb, hooks, d, cast, tick(dt) { cb.t += dt; hooks.onTick(cb, dt); } };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const hostStar of [1, 2, 3]) for (const skillStar of [1, 2, 3]) {
  test(`host ★${hostStar}, chip ★${skillStar}: direct/delayed/zone DoT and healing scale once, with every weapon star`, () => {
    for (const itemStar of [1, 2, 3]) {
      for (const [id, kind] of [['ignite', 'burn'], ['meteor', 'burn'], ['poisoncloud', 'poison']]) {
        const f = fixture(hostStar, skillStar, itemStar, id, id === 'poisoncloud' ? 'restlessbow' : 'firestaff', id === 'poisoncloud' ? 'archer' : 'apprentice');
        f.cast(); if (id === 'meteor') f.tick(1.21); if (id === 'poisoncloud') f.tick(.5);
        assert.ok(f.t.st[kind]); close(f.t.st[kind].dps, f.d[kind].dps * f.u.pow * f.c.BT4.SKSTAR[skillStar] * f.u.spell);
      }
      const f = fixture(hostStar, skillStar, itemStar, 'aegis'); f.u.hp = f.friend.hp = 1000; f.cast();
      const factor = f.u.pow * f.c.BT4.SKSTAR[skillStar] * f.u.spell;
      assert.equal(f.friend.hp - 1000, Math.round(f.d.heal * factor));
      assert.equal(f.friend.shield, Math.round(f.d.power * factor));
      const blades = fixture(hostStar, skillStar, itemStar, 'bladestorm', 'greatsword', 'squire');
      blades.cast(); blades.tick(.5);
      close(blades.t.st.bleed.dps, blades.d.power * blades.u.pow * blades.c.BT4.SKSTAR[skillStar] * blades.u.spell);
    }
  });
}
for (const star of [1, 2, 3]) {
  test(`weapon ★${star}: active uses the weapon multiplier and hawk/focus upgrades are real`, () => {
    const f = fixture(2, 1, star, 'ignite', 'shortbow', 'archer');
    f.cast(f.c.V4.DEF['item:shortbow'].act, star);
    assert.equal(f.cb.projectiles.length, star === 3 ? 4 : 2);
    close(f.cb.projectiles[0].dmg, 90 * f.u.pow * f.c.BT4.ITSTAR[star]);
    const h = fixture(2, 1, star, 'ignite', 'whistle', 'archer');
    const hawk = h.cb.units.find(u => u.summonId === 'hawk'); assert.ok(hawk);
    close(hawk.atk, h.c.GD.MONSTERS.hawk.atk * h.u.pow * h.c.BT4.ITSTAR[star]);
    h.u.focusN = 5;
    close(h.hooks.dmgDealtMod(h.u, h.t, 'atk', h.cb), 1 + .25 * Math.min(1.6, h.c.BT4.ITSTAR[star]));
  });
  test(`chip ★${star}: utility growth changes real state and never heals the resolve HP cost`, () => {
    const f = fixture(2, star, 1, 'resolve', null, 'squire'); f.cast();
    assert.equal(f.u.hp, Math.round(f.u.maxHp * [.4, .45, .5][star - 1]));
    f.u.hp = 1000; f.cast(); assert.equal(f.u.hp, 1000);
    const m = fixture(2, star, 1, 'marktarget', null, 'archer'); m.cast(); assert.equal(m.t.st.marked.n, star + 2);
    const w = fixture(2, star, 1, 'windwalk', null, 'archer'); w.cast(); close(w.u.st.ww.t, 3 + .5 * (star - 1));
    const inv = fixture(2, star, 1, 'iceblessing'); inv.friend.hp = 1000; inv.cast(); close(inv.friend.st.invuln, 3 + .25 * (star - 1));
    const guard = fixture(star, 1, 1, 'resolve', null, 'warden'); guard.cast(guard.c.V4.DEF['unit:warden'].ult, 1); close(guard.u.st.fortRed, .3 + .05 * (star - 1));
  });
}
test('every unit, chip and weapon is evaluated at all stars; input definitions remain immutable', () => {
  const c = world(), B = c.BT4, before = JSON.stringify(c.V4.DEF);
  assert.equal(c.V4.UNITS.length + c.V4.SKILLS.length + c.V4.ITEMS.length, 129);
  for (const u of c.V4.UNITS) for (const star of [1, 2, 3]) {
    const s = B.unitStats({ id: u.id, star }); assert.equal(s.hp, u.hp * B.STAR[star]); assert.equal(s.atk, u.atk * B.STAR[star]);
    for (const it of c.V4.ITEMS.filter(x => x.cls === u.cls)) for (const itemStar of [1, 2, 3]) {
      const equipped = B.unitStats({ id: u.id, star, item: { id: it.id, star: itemStar } });
      for (const k of ['hp', 'atk', 'as', 'armor', 'spell', 'heal']) assert.ok(Number.isFinite(equipped[k]), `${u.id}/${it.id}/${star}/${itemStar}/${k}`);
    }
  }
  for (const s of c.V4.SKILLS) for (const star of [1, 2, 3]) { assert.ok(s.passive || B.chipCd(s, star) > 0); B.skillDef(s, star); B.expandCells(s, star); }
  assert.equal(JSON.stringify(c.V4.DEF), before);
});
test('the editable balance sheet includes every unit, skill and weapon and matches the shipped patch', () => {
  const sheet = require('../scripts/balance-sheet.cjs'), V = sheet.load(true);
  const parsed = sheet.parse(fs.readFileSync(path.resolve(__dirname, '../docs/balance-sheet.csv'), 'utf8'));
  const header = parsed.shift(), rows = sheet.rows(V);
  assert.equal(parsed.length, 129); assert.equal(rows.length, 129);
  const idCol = header.indexOf('id'), kindCol = header.indexOf('구분');
  for (const row of parsed) {
    const expected = rows.find(x => x.id === row[idCol] && x.kind === row[kindCol]); assert.ok(expected);
    for (const [label, key] of sheet.COLS) {
      const value = row[header.indexOf(label)] || '', actual = expected[key] == null ? '' : String(expected[key]);
      assert.equal(value, actual, expected.id + '/' + key);
    }
  }
});
