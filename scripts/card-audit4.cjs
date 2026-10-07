#!/usr/bin/env node
/* Controlled card diagnostics, not a human win-rate estimate. Full-run validation remains balance-run.cjs. */
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), cp = require('node:child_process'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), ref = process.env.CARD_REF;
const files = ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/balance4.js', 'v4/enemies4.js', 'v4/encounters4.js', 'v4/enemy-combat4.js', 'v4/projectiles4.js', 'v4/battle4.js'];
const c = {}; c.window = c; vm.createContext(c); const sourceHashes = {};
for (const f of files) {
  const source = ref ? cp.execFileSync('git', ['show', ref + ':' + f], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, f), 'utf8');
  sourceHashes[f] = crypto.createHash('sha256').update(source).digest('hex'); vm.runInContext(source, c, { filename: f });
}
const V = c.V4, B = c.BT4, grid = c.AC.squareGrid(5, 6, 64), carriers = { war: 'squire', arc: 'archer', mag: 'apprentice', any: 'squire' };
const card = (id, star, skill, item) => ({ kind: 'unit', id, uid: 'audit-' + id, star, skills: skill ? [{ kind: 'skill', ...skill }] : [], item: item ? { kind: 'item', ...item } : null, rot: 0 });
const finite = obj => { for (const k of ['hp', 'atk', 'as', 'armor']) if (!Number.isFinite(obj[k])) throw Error('nonfinite ' + k); };
const snapshots = { units: [], skills: [], items: [] };
for (const d of V.UNITS) for (const star of [1, 2, 3]) {
  const st = B.unitStats(card(d.id, star)); finite(st);
  snapshots.units.push({ id: d.id, name: d.name, tier: d.t, star, costCopies: d.t * 3 ** (star - 1), stats: st, ultScale: B.POW[star], ult: d.ult || null });
}
for (const d of V.SKILLS) for (const hostStar of [1, 2, 3]) for (const star of [1, 2, 3]) {
  snapshots.skills.push({ id: d.id, name: d.name, tier: d.t, hostStar, star, costCopies: d.t * 3 ** (star - 1), power: (d.power || 0) * B.POW[hostStar] * B.SKSTAR[star], cd: d.passive ? null : B.chipCd(d, star), cells: B.expandCells(d, star), definition: B.skillDef ? B.skillDef(d, star) : d });
}
for (const d of V.ITEMS) for (const hostStar of [1, 2, 3]) for (const star of [1, 2, 3]) {
  const host = carriers[d.cls], stats = B.unitStats(card(host, hostStar, null, { id: d.id, star })); finite(stats);
  snapshots.items.push({ id: d.id, name: d.name, tier: d.t, host, hostStar, star, costCopies: d.t * 3 ** (star - 1), obtainableByNormalMerge: !d.special || star === 1, stats, definition: d });
}
const rows = [], bare = new Map(), seedCount = Number(process.env.CARD_SEEDS || 3);
function fight(id, hostStar, kind, gearStar, scenario, seed) {
  const d = V.DEF[kind + ':' + id], host = kind === 'unit' ? id : carriers[d.cls];
  const act = [0, 1, 2, 4][hostStar], floor = scenario === 'boss' ? 8 : 5;
  const r = { act, round: (act - 1) * 9 + floor + 1, diff: 'normal', relics: [], node: { id: 'audit-' + scenario, f: floor }, map: { boss: c.GD.ACTS[act].bosses[0] }, encounters: { version: 1, seed, used: {}, history: [], nodes: {} } };
  const rng = c.AC.rng(seed), fx = { play() {}, burst() {}, shake() {}, death() {}, skill() {}, proc() {} };
  const api = B.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => r, random: rng, phase() {}, fx });
  const friends = ['squire', 'shieldman', 'archer', 'apprentice', 'acolyte'].filter(x => x !== host).slice(0, 3);
  const army = [card(host, hostStar, kind === 'skill' ? { id, star: gearStar } : null, kind === 'item' ? { id, star: gearStar } : null), ...friends.map(x => card(x, hostStar))];
  const syn = api.synergyCounts(army), occupied = new Set();
  const allies = army.map((u, i) => { const range = B.unitStats(u).range, y = range === 1 ? 3 : 4, x = [2, 1, 3, 0][i]; let cell = grid.idx(x, y); if (occupied.has(cell)) cell = grid.idx(x, 5); occupied.add(cell); return api.makeAlly(u, cell, syn); });
  const enemies = c.ENCOUNTERS4.generate(r, scenario === 'boss' ? 'boss' : 'fight', grid).map(e => api.makeFoe({ ...e, def: c.GD.MONSTERS[e.id] }));
  const cb = new c.AC.Combat(grid, [...allies, ...enemies], { hooks: api.hooks(), random: rng, maxTime: 45 });
  while (!cb.done) cb.step(1 / 60);
  const team = cb.units.filter(u => u.side === 0 && !u.object), value = k => team.reduce((n, u) => n + (u[k] || 0), 0);
  return { winner: cb.winner, kill: cb.winner === 0, timeout: cb.winner === -1, time: cb.t, damage: value('dmgDealt'), healing: value('healDone'), shield: value('shieldDone'), hp: allies.reduce((n, u) => n + Math.max(0, u.hp) / u.maxHp, 0) / allies.length, hostCasts: allies[0].castCount || {}, enemies: enemies.map(e => e.def.id) };
}
for (const kind of ['unit', 'skill', 'item']) for (const d of V[kind === 'unit' ? 'UNITS' : kind === 'skill' ? 'SKILLS' : 'ITEMS']) {
  for (const hostStar of [1, 2, 3]) for (const star of kind === 'unit' ? [hostStar] : [1, 2, 3]) for (const scenario of ['wave', 'boss']) for (let i = 0; i < seedCount; i++) {
    const seed = 65000001 + i * 7919, host = kind === 'unit' ? d.id : carriers[d.cls];
    const key = [host, hostStar, scenario, seed].join('/');
    if (!bare.has(key)) bare.set(key, fight(host, hostStar, 'unit', hostStar, scenario, seed));
    const result = kind === 'unit' ? bare.get(key) : fight(d.id, hostStar, kind, star, scenario, seed);
    const base = bare.get(key);
    rows.push({ kind, id: d.id, hostStar, star, scenario, seed, obtainableByNormalMerge: !d.special || star === 1, ...result, damageDelta: result.damage - base.damage, sustainDelta: result.healing + result.shield - base.healing - base.shield });
  }
}
const data = { reference: ref || null, sourceHashes, seedCount, stars: { unit: B.STAR, unitSkill: B.POW, chip: B.SKSTAR, item: B.ITSTAR }, snapshots, rows };
const out = path.resolve(process.env.CARD_OUT || '/tmp/card-audit4.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(data));
console.log(JSON.stringify({ out, fights: rows.length, snapshotRows: Object.values(snapshots).reduce((n, xs) => n + xs.length, 0), uniqueCards: V.UNITS.length + V.SKILLS.length + V.ITEMS.length }));
