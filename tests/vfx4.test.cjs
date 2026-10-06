const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const IDS = ['cross', 'ice', 'blizzard', 'chain', 'meteor', 'aegis', 'wall', 'shadowstep'];
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(id, star, enabled) {
  const c = { randomCalls: 0 }; c.window = c; vm.createContext(c);
  vm.runInContext('let seed = 12345; Math.random = () => { randomCalls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };', c);
  for (const file of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/battle4.js', 'v4/vfx4.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c);
  const grid = c.AC.squareGrid(5, 6, 64, { ox: 20, oy: 20 });
  const effects = c.VFX4.create(), events = [];
  const fx = { play() {}, burst() {}, death() {}, shake() {} };
  if (enabled) fx.skill = (skill, data) => { events.push({ id: skill, data: plain(data) }); effects.emit(skill, data); };
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => ({ relics: [], round: 1, act: 1, diff: 'normal' }), fx });
  const ally = (unitId, col, row, skills = []) => api.makeAlly({ id: unitId, uid: `${col}-${row}`, star: 1, skills, item: null, rot: 0 }, grid.idx(col, row), { ttiers: {} });
  const caster = ally(id === 'cross' || id === 'shadowstep' ? 'squire' : 'apprentice', 2, id === 'cross' ? 3 : 4, [{ id, star }]);
  const allies = [caster, ally('squire', 1, 4), ally('archer', 3, 4)];
  const foes = [[2,2], [2,1], [1,2], [3,2], [1,1], [3,1]].map(([col,row], i) => {
    const u = api.makeFoe({ uid: 'foe'+i, def: c.GD.MONSTERS.goblin, cell: grid.idx(col,row), scale: 1, rot: 0 });
    u.hp = u.maxHp = 5000; return u;
  });
  const hooks = api.hooks(), cb = new c.AC.Combat(grid, [...allies, ...foes], { hooks });
  for (const u of allies) u.hp *= 0.45;
  if (id === 'revive') cb.kill(allies[1], null);
  const before = allies.map(u => u.hp);
  caster.skills = [{ def: c.V4.SKILLS.find(d => d.id === id), star, cells: c.BT4.expandCells(c.V4.SKILLS.find(d => d.id === id), star) }];
  caster.castIdx = 0;
  hooks.onCast(caster, foes[0], cb);
  return { c, cb, api, hooks, caster, allies, foes, events, effects, before };
}

function snapshot(f) {
  return plain({ randomCalls: f.c.randomCalls, units: f.cb.units.map(u => ({ cell: u.cell, hp: u.hp, shield: u.shield, dead: !!u.dead,
    revived: !!u.revived, stats: Object.fromEntries(Object.entries(u.st).map(([k, v]) => [k, typeof v === 'number' ? v : { t: v.t, dps: v.dps, stacks: v.stacks }])),
    bars: u.bars, damage: u.dmgDealt, healing: u.healDone })) });
}

for (const id of IDS) for (const star of [1, 3]) {
  test(`${id} ★${star}: effects follow resolved targets without changing combat or RNG`, () => {
    const off = fixture(id, star, false), on = fixture(id, star, true);
    assert.deepEqual(snapshot(on), snapshot(off));
    assert.equal(on.events.filter(e => e.id === id).length, 1);
    const e = on.events.find(e => e.id === id).data;
    assert.equal(e.star, star);
    assert.ok(e.cells.length > 0, 'Resolved cells are provided');
    assert.ok(e.cells.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    if (id === 'chain') assert.equal(e.points.length, star === 3 ? 6 : 4);
    if (id === 'shadowstep') {
      assert.notDeepEqual(e.source, e.destination);
      assert.deepEqual(e.destination, { x: on.caster.px, y: on.caster.py });
      assert.equal(e.target.x, on.foes[0].px);
    }
    if (id === 'aegis') assert.ok(on.allies[1].hp > on.before[1], 'Healing is applied');
    if (id === 'wall') assert.ok(on.allies[1].shield > 0, 'Shield is applied');
    if (id === 'revive') {
      assert.equal(on.allies[1].dead, false);
      assert.deepEqual(e.target, { x: on.allies[1].px, y: on.allies[1].py });
    }
    if (id === 'meteor') {
      assert.equal(e.phase, 'warn');
      on.hooks.onTick(on.cb, 1.19); off.hooks.onTick(off.cb, 1.19);
      assert.equal(on.events.length, 1, 'No early meteor impact');
      assert.equal(on.foes[0].hp, 5000);
      on.hooks.onTick(on.cb, 0.02); off.hooks.onTick(off.cb, 0.02);
      assert.equal(on.events[1].data.phase, 'impact');
      assert.ok(on.foes[0].hp < 5000);
      assert.deepEqual(snapshot(on), snapshot(off));
    }
    const stateBeforeEffects = snapshot(on);
    on.effects.step(3);
    assert.equal(on.effects.count, 0, 'Finished effects are released');
    assert.deepEqual(snapshot(on), stateBeforeEffects);
  });
}

test('burst traffic is bounded; skipped/reset combats leave no effects', () => {
  const f = fixture('blizzard', 1, true);
  for (let i = 0; i < 1000; i++) f.effects.emit('blizzard', f.events[0].data);
  assert.ok(f.effects.count <= 48);
  f.effects.clear();
  assert.equal(f.effects.count, 0);
});
