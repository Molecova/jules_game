const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function fixture() {
  const c = {}; c.window = c; vm.createContext(c);
  for (const f of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/balance4.js', 'v4/enemies4.js', 'v4/battle4.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f });
  }
  const grid = c.AC.squareGrid(5, 6, 64), r = { act: 1, round: 5, diff: 'normal', relics: [] };
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => r, fx: {}, random: () => .5 });
  const foe = (id, scale = 1, elite = false) => api.makeFoe({ def: c.GD.MONSTERS[id], cell: grid.idx(2, 1), scale, elite });
  return { c, r, api, foe };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('normal generates enemies with neutral difficulty; player stats are independent of difficulty', () => {
  const { c, r, api, foe } = fixture(), u = foe('goblin');
  assert.equal(u.maxHp, 1782); // Original mid-act strength, with the old normal boost absorbed into the base.
  close(u.atk, 74.34); close(u.pow, 1.77);
  const card = { id: 'squire', uid: 'test', star: 3, skills: [], item: null };
  const ally = () => api.makeAlly(card, 17, { ttiers: {} });
  const base = ally();
  for (const diff of Object.keys(c.V4.DIFF)) {
    r.diff = diff;
    const a = ally(); assert.equal(a.maxHp, base.maxHp); assert.equal(a.atk, base.atk); assert.equal(a.armor, base.armor);
  }
});

test('hard and hell scale regular, elite, boss and reduced-size enemies by 1.5 and 2 at every act position', () => {
  const { c, r, foe } = fixture();
  for (let act = 1; act <= 5; act++) {
    r.act = act;
    const ids = new Set([...c.GD.ACTS[act].normal, ...Object.keys(c.V4.FOE.elite).filter(id => c.GD.MONSTERS[id].act === act), ...c.GD.ACTS[act].bosses]);
    for (const floor of [1, 5, 9]) for (const id of ids) for (const scale of [1, .6]) {
      r.round = (act - 1) * c.V4.ACT_LEN + floor; r.diff = 'normal';
      const base = foe(id, scale, !!c.V4.FOE.elite[id]);
      for (const [diff, k] of [['hard', 1.5], ['hell', 2]]) {
        r.diff = diff;
        const u = foe(id, scale, !!c.V4.FOE.elite[id]);
        assert.ok(Math.abs(u.maxHp - base.maxHp * k) <= 1.5, `${act}/${floor}/${id}/${scale}/${diff} HP rounding`);
        close(u.atk, base.atk * k); close(u.pow, base.pow * k);
      }
    }
  }
});

test('existing normal runs and unknown difficulty fallback use the new boss baseline', () => {
  const { r, foe } = fixture(); r.act = 5; r.round = 45;
  const boss = foe('abysslord'); assert.equal(boss.maxHp, 350077); assert.equal(Math.round(boss.atk), 7708);
  r.diff = 'unknown'; const fallback = foe('abysslord');
  assert.equal(fallback.maxHp, boss.maxHp); assert.equal(fallback.atk, boss.atk); assert.equal(fallback.pow, boss.pow);
});

test('normalizing difficulty preserves pre-change final stats for every enemy, act position and difficulty', () => {
  const legacy = require('./fixtures/difficulty-before-normalization.json');
  const current = fixture(), before = fixture();
  before.c.V4.DIFF = legacy.diff; before.c.V4.FOE = legacy.foe;
  for (const id of Object.keys(current.c.GD.MONSTERS)) {
    const d = current.c.GD.MONSTERS[id]; if (d.object) continue;
    const acts = d.act >= 1 && d.act <= 5 ? [d.act] : [1, 2, 3, 4, 5];
    for (const act of acts) for (let floor = 1; floor <= 9; floor++) {
      for (const diff of ['normal', 'hard', 'hell']) for (const scale of [1, .45, .55, .6, .7, .8, 1.1]) for (const elite of [false, true]) {
        for (const f of [current, before]) Object.assign(f.r, { act, round: (act - 1) * 9 + floor, diff });
        const a = current.foe(id, scale, elite), b = before.foe(id, scale, elite), label = `${id}/${act}/${floor}/${diff}/${scale}/${elite}`;
        assert.equal(a.maxHp, b.maxHp, label + ' HP');
        assert.equal(Math.round(a.atk), Math.round(b.atk), label + ' displayed attack');
        assert.equal(a.atk, b.atk, label + ' exact attack');
        assert.equal(a.pow, b.pow, label + ' exact skill power');
        assert.equal(a.armor, b.armor); assert.equal(a.as, b.as);
      }
    }
  }
});
