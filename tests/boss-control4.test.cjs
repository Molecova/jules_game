const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture(id) {
  const c = {}; c.window = c; vm.createContext(c);
  for (const f of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/enemies4.js', 'v4/enemy-combat4.js', 'v4/battle4.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'), c);
  const grid = c.AC.squareGrid(5, 6, 64), r = { act: c.GD.MONSTERS[id].act, round: c.GD.MONSTERS[id].act * 9, diff: 'normal', relics: [] };
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => r, random: () => .5, fx: { play() {}, burst() {}, death() {}, shake() {} } });
  const boss = api.makeFoe({ def: c.GD.MONSTERS[id], cell: grid.idx(2, 2) });
  const ally = api.makeAlly({ id: 'squire', star: 3, skills: [], item: null }, grid.idx(2, 3), { ttiers: {} });
  const h = api.hooks(), cb = new c.AC.Combat(grid, [ally, boss], { hooks: h, random: () => .5 });
  return { c, boss, ally, cb, tick: dt => { cb.t += dt; h.onTick(cb, dt); } };
}
for (const id of ['gobking', 'slimeking', 'lich', 'vampire', 'dragon', 'surt', 'icequeen', 'yetiking', 'abysslord', 'fallenking']) {
  for (const status of ['stun', 'silence']) test(id + ': ' + status + ' blocks patterns without freezing cooldowns', () => {
    const f = fixture(id), b = f.boss;
    b.script.a = b.script.b = b.script.c = 0;
    const count = f.cb.units.length, hp = f.ally.hp, shield = b.shield;
    if (status === 'stun') b.stun = 2; else b.st.silence = 2;
    f.tick(.1); assert.equal(f.cb.tele.length, 0); assert.equal(f.cb.units.length, count);
    assert.equal(f.ally.hp, hp); assert.equal(b.shield, shield); assert.ok(b.script.b < 0);
    b.stun = 0; b.st.silence = 0; f.tick(.1);
    assert.ok(b.script.a > 0 || b.script.b > 0, 'pattern resumes as soon as control expires');
  });
}
test('interrupt cancels an announced boss strike and its completion callback; root and slow do not', () => {
  for (const status of ['stun', 'silence', 'root', 'slow']) {
    const f = fixture('abysslord'); f.boss.script.a = f.boss.script.b = f.boss.script.c = 999;
    let fired = 0; const hp = f.ally.hp;
    f.cb.tele.push({ src: f.boss, cells: [f.ally.cell], side: 0, t: 0, delay: .5, dmg: 100, onDone: () => fired++ });
    if (status === 'stun') f.boss.stun = 1; else f.boss.st[status] = 1;
    f.tick(.1); f.boss.stun = 0; f.boss.st[status] = 0; f.tick(.6);
    const interrupted = ['stun', 'silence'].includes(status);
    assert.equal(fired, interrupted ? 0 : 1); assert.equal(f.cb.tele.length, 0);
    if (interrupted) assert.equal(f.ally.hp, hp); else assert.ok(f.ally.hp < hp);
  }
});
test('already-launched non-boss delayed attacks are unaffected by this boss fix', () => {
  const f = fixture('abysslord'); f.boss.script.a = f.boss.script.b = f.boss.script.c = 999;
  const hp = f.ally.hp, source = { ...f.boss, boss: null, dead: true, stun: 2 };
  f.cb.tele.push({ src: source, cells: [f.ally.cell], side: 0, t: 0, delay: .1, dmg: 100 });
  f.tick(.2); assert.ok(f.ally.hp < hp);
});
