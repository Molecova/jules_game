const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), plain = x => JSON.parse(JSON.stringify(x));
function world() {
  const c = {}; c.window = c; vm.createContext(c);
  for (const f of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/enemies4.js', 'v4/encounters4.js', 'v4/enemy-combat4.js', 'v4/projectiles4.js', 'v4/battle4.js', 'v4/vfx4.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c);
  return c;
}
function fixture({ item = null, skill = null, star = 1, seed = 17, enabled = true, act = 1 } = {}) {
  const c = world(), grid = c.AC.squareGrid(5, 6, 64), events = [], effects = c.VFX4.create();
  const stream = c.AC.rng(seed); let randomCalls = 0;
  const random = () => { randomCalls++; return stream(); };
  const fx = { play() {}, burst() {}, shake() {}, death() {} };
  if (enabled) {
    fx.skill = (id, data) => { events.push({ id, data: plain(data) }); effects.emit(id, data); };
    fx.proc = (id, data) => { events.push({ id: 'p_' + id, data: plain(data) }); effects.emit('p_' + id, data); };
    fx.attack = data => effects.emit('weapon', data);
  }
  const r = { relics: [], act, round: act * 6, diff: 'normal' };
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => r, random, phase() {}, fx });
  const card = { kind: 'unit', id: item === 'greatnail' || skill === 'brace' ? 'squire' : 'archer', uid: 'new', star: 1, skills: skill ? [{ kind: 'skill', id: skill, star }] : [], item: item ? { kind: 'item', id: item, star } : null, rot: 0 };
  const u = api.makeAlly(card, grid.idx(2, 4), { ttiers: {} });
  const foes = [[2, 3], [1, 3], [3, 3], [0, 0]].map(([col, row], i) => {
    const f = api.makeFoe({ def: c.GD.MONSTERS.goblin, cell: grid.idx(col, row), scale: 1 });
    f.hp = f.maxHp = 100000; f.armor = f.dodge = 0; f.enemy = null;
    return f;
  });
  const hooks = api.hooks(), cb = new c.AC.Combat(grid, [u, ...foes], { hooks, random });
  if (u.chip) u.chip.t = 999;
  const tick = dt => { cb.t += dt; hooks.onTick(cb, dt); effects.step(dt); };
  const castBrace = () => { u.skills = [{ def: c.V4.DEF['skill:brace'], star }]; u.castIdx = 0; hooks.onCast(u, foes[0], cb); };
  return { c, grid, api, u, foes, hooks, cb, events, effects, tick, castBrace, calls: () => randomCalls };
}

for (const star of [1, 2, 3]) {
  test(`대못 ★${star}: 2-second threshold, all damage kinds, instant reset after every movement`, () => {
    const f = fixture({ item: 'greatnail', star }), { u, cb, hooks, grid } = f;
    f.tick(1.99); assert.equal(hooks.dmgDealtMod(u, f.foes[0], 'atk', cb), 1);
    f.tick(.01);
    for (const kind of ['atk', 'spell', 'burn', 'poison', 'bleed', 'splash', 'link', 'thorns', 'transfer']) assert.equal(hooks.dmgDealtMod(u, f.foes[0], kind, cb), [0, 1.3, 1.48, 1.6][star]);
    assert.equal(f.events.filter(e => e.id === 'p_nailAnchor').length, 1);
    f.tick(3); assert.equal(f.events.filter(e => e.id === 'p_nailAnchor').length, 1, 'no per-frame bursts');
    cb.moveTo(u, grid.idx(2, 5)); assert.equal(hooks.dmgDealtMod(u, f.foes[0], 'spell', cb), 1, 'before next tick');
    f.tick(3); assert.equal(u.anchorT, 0, 'travel time does not charge');
    cb.teleport(u, u.cell); f.tick(2); assert.ok(u.anchorT >= 2);
    cb.teleport(u, grid.idx(1, 5)); assert.equal(u.anchorT, 0, 'push/leap/teleport reset');
    // Even a round trip within one frame cannot keep the bonus.
    f.tick(2); cb.teleport(u, grid.idx(2, 5)); cb.teleport(u, grid.idx(1, 5)); assert.equal(u.anchorT, 0);
    assert.equal(f.c.V4.DEF['item:greatnail'].job, 'j_knight');
  });
  test(`버팀목 ★${star}: four exact pulses, no immediate shield, expiry and root`, () => {
    const f = fixture({ skill: 'brace', star }), n = [0, 100, 170, 260][star];
    f.u.maxHp = f.u.hp = 10000; f.castBrace();
    assert.equal(f.u.shield, 0); assert.equal(f.u.st.root, 4); assert.equal(f.hooks.rooted(f.u), true);
    f.tick(.99); assert.equal(f.u.shield, 0);
    f.tick(.01); assert.equal(f.u.shield, n);
    f.tick(2); assert.equal(f.u.shield, n * 3, 'catch up multiple seconds');
    f.tick(1); assert.equal(f.u.shield, n * 4, 'final pulse at 4, not lost at expiry');
    assert.equal(f.u.st.brace, undefined); assert.equal(f.hooks.rooted(f.u), false);
    f.tick(10); assert.equal(f.u.shield, n * 4);
    assert.equal(f.events.filter(e => e.id === 'p_braceShield').length, 4);
    assert.equal(f.c.BT4.chipCd(f.c.V4.DEF['skill:brace'], star), 12 * (1 - .1 * (star - 1)));
  });
  test(`정신없는 활 + 환승 ★${star}: attack stats and one bonus per actual target change`, () => {
    const f = fixture({ item: 'restlessbow', skill: 'transfer', star });
    const bare = f.api.unitStats({ id: 'archer', star: 1 });
    assert.equal(f.u.atk, Math.round(bare.atk * (1 + [0, .5, .8, 1.25][star])));
    assert.equal(f.u.chip, undefined, 'passive has no cooldown cast');
    f.u.pow = 100; f.u.spell = 100; // A percentage of attack, never a spell-power calculation.
    let target = f.foes[0]; const seen = [];
    for (let i = 0; i < 9; i++) {
      const before = target.hp;
      f.cb.attack(f.u, target);
      assert.equal(before - target.hp, i ? Math.round(f.u.atk * [0, 3, 3.6, 4.5][star]) : 0);
      seen.push(target.id);
      assert.notEqual(f.u.target, target); assert.ok(f.grid.dist(f.u.cell, f.u.target.cell) <= f.u.range);
      assert.equal(f.u.target.object, undefined); target = f.u.target;
    }
    assert.equal(f.u.castCount.transfer, 8); assert.equal(f.cb.projectiles.length, 9, 'passive is not a recursive attack');
    assert.equal(f.events.filter(e => e.id === 'transfer').length, 8);
    assert.ok(f.events.filter(e => e.id === 'transfer').every(e => e.data.star === star));
    assert.equal(f.c.V4.DEF['item:restlessbow'].job, 'j_hunter');
  });
}
test('환승 works without its combo weapon; first, repeated and idle targets do not fire', () => {
  const f = fixture({ skill: 'transfer' }), [a, b] = f.foes;
  f.cb.attack(f.u, a); f.cb.attack(f.u, a); assert.equal(f.u.castCount, undefined);
  f.u.target = b; f.tick(.01); f.u.target = a; f.tick(.01); assert.equal(f.u.castCount, undefined);
  f.cb.attack(f.u, b); assert.equal(f.u.castCount.transfer, 1);
  f.cb.attack(f.u, b); assert.equal(f.u.castCount.transfer, 1);
  f.cb.kill(b, f.u); f.cb.attack(f.u, a); assert.equal(f.u.castCount.transfer, 2, 'replacement after death counts');
});
test('정신없는 활 preserves taunt, skips objects/out-of-range/dead enemies and tolerates one remaining enemy', () => {
  const f = fixture({ item: 'restlessbow' }), [a, b, c] = f.foes;
  f.u.target = a; f.u.forced = a; f.u.forcedT = 3; f.cb.attack(f.u, a); assert.equal(f.u.target, a);
  f.u.forcedT = 0; b.object = true; f.cb.kill(c, f.u);
  f.cb.attack(f.u, a); assert.equal(f.u.target, a, 'no eligible alternatives within range');
  assert.ok(!f.events.some(e => e.id === 'p_restlessTarget'));
  b.object = false; f.cb.attack(f.u, a); assert.equal(f.u.target, b);
});
test('버팀목 maintains the existing shield cap, antiheal and non-stacking recasts', () => {
  const f = fixture({ skill: 'brace' }); f.u.maxHp = 600; f.u.hp = 600; f.castBrace();
  f.tick(4); assert.equal(f.u.shield, 300);
  f.u.shield = 0; f.u.st.antiheal = 6; f.castBrace(); f.tick(4); assert.equal(f.u.shield, 0);
  f.u.st.antiheal = 0; f.castBrace(); f.tick(.5); f.castBrace(); f.tick(.5); assert.equal(f.u.shield, 0, 'one timer after refresh');
  f.tick(.5); assert.equal(f.u.shield, 100);
});
test('버팀목 pauses walking immediately, prevents new pathing and charges 대못 while planted', () => {
  const f = fixture({ item: 'greatnail', skill: 'brace' });
  f.cb.moveTo(f.u, f.grid.idx(2, 5)); f.castBrace();
  assert.equal(f.u.moving, null); assert.equal(f.cb.occ[f.u.cell], f.u);
  const cell = f.u.cell; f.u.range = 1;
  for (let i = 0; i < 120; i++) f.cb.step(1 / 60);
  assert.equal(f.u.cell, cell); assert.equal(f.u.anchorT, 2); assert.ok(f.u.shield > 0);
});
function digest(f) {
  return plain({ calls: f.calls(), winner: f.cb.winner, t: f.cb.t,
    units: f.cb.units.map(u => ({ id: u.id, hp: u.hp, shield: u.shield, cell: u.cell, dead: u.dead, atkN: u.atkN, anchorT: u.anchorT, attackTarget: u.attackTargetId, target: u.target?.id, casts: u.castCount })),
    shots: f.cb.projectiles.map(p => ({ src: p.src.id, tgt: p.tgt.id, dmg: p.dmg, x: p.x, y: p.y })) });
}
test('new effects preserve seeded combat and random consumption across all stars and both builds', () => {
  for (const star of [1, 2, 3]) for (const [item, skill] of [['greatnail', 'brace'], ['restlessbow', 'transfer']]) {
    const off = fixture({ item, skill, star, enabled: false }), on = fixture({ item, skill, star });
    for (const f of [off, on]) { f.u.hp = f.u.maxHp = 10000; if (f.u.chip) f.u.chip.t = 0; }
    for (let i = 0; i < 480; i++) { off.cb.step(1 / 60); on.cb.step(1 / 60); assert.deepEqual(digest(on), digest(off)); }
    if (item === 'restlessbow') assert.ok(on.u.castCount.transfer > 0);
    else assert.ok(on.u.castCount.brace > 0);
    on.effects.step(10); assert.equal(on.effects.count, 0);
  }
});

test('both builds trigger in 30 complete fights across five acts', () => {
  const result = [];
  for (const [item, skill] of [['greatnail', 'brace'], ['restlessbow', 'transfer']]) for (let act = 1; act <= 5; act++) for (const seed of [11, 29, 47]) {
    const f = fixture({ item, skill, star: 2, act, seed });
    f.u.hp = f.u.maxHp = 10000; f.u.atk = 120;
    if (f.u.chip) f.u.chip.t = 0;
    for (const e of f.foes) { e.hp = e.maxHp = 600 * act; e.atk = 10 * act; }
    for (let i = 0; i < 5400 && !f.cb.done; i++) f.cb.step(1 / 60);
    assert.equal(f.cb.done, true); assert.ok(f.u.castCount?.[skill] > 0, `${item} act ${act} seed ${seed}`);
    for (const u of f.cb.units) { assert.ok(Number.isFinite(u.hp)); if (!u.dead) assert.equal(f.cb.occ[u.cell], u); }
    result.push({ item, act, seed, winner: f.cb.winner, seconds: +f.cb.t.toFixed(2), activations: f.u.castCount[skill] });
  }
  if (process.env.NEW_WEAPONS_OUTPUT) fs.writeFileSync(process.env.NEW_WEAPONS_OUTPUT, JSON.stringify(result, null, 2));
});
