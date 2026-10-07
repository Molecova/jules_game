const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { create, profiles } = require('../scripts/balance-policy4.js');
const c = {}; c.window = c; vm.createContext(c);
for (const f of ['game/data.js', 'v4/data4.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), c);
const catalog = JSON.parse(JSON.stringify({ def: c.V4.DEF, traits: c.V4.TRAITS, xp: c.V4.XPNEED }));
const unit = (id, star = 1) => ({ kind: 'unit', id, star, uid: id + star, item: null, skills: [] });
function obs() {
  return { act: 1, round: 1, gold: 6, lv: 3, xp: 0, capacity: 3, board: [], bench: Array(8).fill(null), relics: [], node: { k: 'fight' }, shop: { unit: [unit('squire'), unit('archer'), unit('apprentice')], item: [], skill: [] }, rolls: 0, freeRolls: 0, lastHp: 1, reachable: ['a', 'b'], map: [[{ id: 'a', k: 'fight', next: [] }, { id: 'b', k: 'treasure', next: [] }]] };
}
for (const name of Object.keys(profiles)) {
  test(name + ': seeded decisions need no hidden state and do not mutate observations', () => {
    const o = obs(), before = JSON.stringify(o);
    for (const key of ['rng', 'battleSeed', 'encounters', 'pending']) Object.defineProperty(o, key, { get() { throw Error('hidden state read: ' + key); } });
    const a = create(catalog, name, 17), b = create(catalog, name, 17);
    for (let i = 0; i < 20; i++) {
      const x = a.shop(o); assert.deepEqual(x, b.shop(o));
      assert.equal(x.type, 'buy'); assert.ok(catalog.def[x.kind + ':' + o.shop[x.kind][x.i].id].t <= o.gold);
    }
    assert.deepEqual(a.lineup(o), []); assert.equal(a.route(o), 'b');
    assert.equal(JSON.stringify(o), before);
  });
  test(name + ': finite thinking budget and no unaffordable action', () => {
    const p = create(catalog, name, 12), o = obs(); o.gold = 0; o.rolls = profiles[name].rolls;
    assert.equal(p.shop(o).type, 'done');
    o.board = [unit('squire', 2), unit('archer'), unit('apprentice')]; o.bench[0] = unit('shieldman', 2);
    const selected = p.lineup(o); assert.equal(selected.length, 3); assert.equal(new Set(selected).size, 3);
    const chip = { kind: 'skill', id: 'cross', star: 1 };
    assert.ok(p.gearValue(chip, o.board[1]) < 0);
    assert.equal(p.choice(o, '훈련 교관', [{ text: '특훈', disabled: true }, { text: '구경', disabled: false }]), 1);
  });
}

test('structured players field a damage dealer even when tank stats look larger', () => {
  const o = obs(); o.board = [unit('shieldman', 2), unit('shieldman'), unit('acolyte', 2)]; o.bench[0] = unit('archer');
  for (const profile of ['balanced', 'synergy']) assert.ok(create(catalog, profile, 44).lineup(o).includes('archer1'));
});
test('first-fight budget does not buy XP that cannot increase deployment', () => {
  const o = obs(); o.gold = 7; o.board = [unit('squire'), unit('archer'), unit('apprentice')];
  for (const profile of Object.keys(profiles)) assert.notEqual(create(catalog, profile, 44).shop(o).type, 'level');
});

test('counter choices use currently visible boss abilities, without predicting the next enemy', () => {
  const p = create(catalog, 'balanced', 23), u = unit('archer'), c = { kind: 'skill', id: 'antiheal', star: 1 };
  const normal = p.gearValue(c, u, { enemies: [{ boss: false, hint: '' }] });
  const shield = p.gearValue(c, u, { enemies: [{ boss: true, hint: '8초마다 자신에게 보호막' }] });
  assert.equal(shield - normal, 45);
  const s = { kind: 'skill', id: 'silence', star: 1 };
  assert.ok(Math.abs(p.gearValue(s, unit('apprentice'), { enemies: [{ boss: true, hint: '' }] }) - p.gearValue(s, unit('apprentice')) - 32) < 1e-9);
});

test('a high-grade merge project can be bought before it is strong enough to replace a starter', () => {
  const o = obs(); Object.assign(o, { act: 5, round: 30, lv: 9, gold: 40 });
  o.board = [unit('shieldman', 3), unit('archer', 3), unit('apprentice', 3)];
  o.shop.unit = [unit('bishop')];
  for (const profile of ['balanced', 'synergy']) {
    const a = create(catalog, profile, 77).shop(o); assert.equal(a.type, 'buy'); assert.equal(a.kind, 'unit'); assert.equal(a.i, 0);
  }
});

test('late-game players seek chip upgrades after equipment slots are filled, with a bounded boss budget', () => {
  const o = obs(); Object.assign(o, { act: 3, round: 23, lv: 9, gold: 80, rolls: 1 });
  o.board = [unit('squire', 3), unit('archer', 3), unit('apprentice', 3)];
  for (const u of o.board) { u.item = { kind: 'item', id: { squire: 'longsword', archer: 'shortbow', apprentice: 'wand' }[u.id], star: 1 }; u.skills = [{ kind: 'skill', id: 'aid', star: 1 }]; }
  o.shop = { unit: [], item: [], skill: [] };
  const p = create(catalog, 'synergy', 44); assert.deepEqual(p.shop(o), { type: 'roll', kind: 'skill' });
  o.node.k = 'boss'; o.rolls = 6; assert.equal(p.shop(o).type, 'roll');
  o.rolls = 8; assert.equal(p.shop(o).type, 'done');
});
