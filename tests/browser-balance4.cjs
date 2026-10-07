// The balance runner uses the real controller, and resolves each battle exactly once.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  try {
    await p.goto('http://127.0.0.1:8000/v4/');
    await p.evaluate(() => { localStorage.clear(); SFX.setMuted(true); });
    for (const file of ['balance-policy4.js', 'balance-runner4.js']) await p.addScriptTag({ path: path.resolve(__dirname, '../scripts', file) });
    const parity = await p.evaluate(() => {
      const seed = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 123; return a; };
      __g.newRun('normal'); crypto.getRandomValues = seed;
      __g.enterNode(__g.nodeById(__g.reachable()[0]));
      for (let i = 0; i < 5; i++) if (__g.R.shop.unit[i] && __g.def(__g.R.shop.unit[i]).t === 1 && __g.R.board.length < 3) __g.buy(i, true, 'unit');
      const simulated = __g.simFight();
      __g.startCombat(); const b = __g.B; b.sim = true;
      while (!b.combat.done) b.combat.step(1 / 60); b.sim = false; __g.endCombat();
      const us = b.combat.units.filter(u => u.side === 0 && !u.summon && !u.object);
      return { expected: simulated, actual: { won: b.won, t: b.combat.t, hpLeft: us.reduce((n, u) => n + Math.max(0, u.hp), 0) / us.reduce((n, u) => n + u.maxHp, 0) }, battles: __g.R.stats.battles };
    });
    assert.equal(parity.actual.won, parity.expected.won); assert.equal(parity.actual.t, parity.expected.t);
    assert.ok(Math.abs(parity.actual.hpLeft - parity.expected.hpLeft) < 1e-10); assert.equal(parity.battles, 1);
    const normalized = r => ({ won: r.won, round: r.round, act: r.act, actions: r.actions, fights: r.fights.map(f => ({ round: f.round, enemies: f.enemies, won: f.won, hp: f.hp, time: f.time, gold: f.gold, lv: f.lv, army: f.army.map(u => ({ id: u.id, star: u.star, x: u.x, y: u.y, item: u.item?.id, skill: u.skills[0]?.id })) })) });
    const a = await p.evaluate(() => BalanceRunner4.run(413, 'balanced'));
    const b = await p.evaluate(() => BalanceRunner4.run(413, 'balanced'));
    assert.deepEqual(normalized(a), normalized(b)); assert.ok(a.legalChecks > a.fights.length);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS legal purchases/merges/equipment/economy/pool/deployment; deterministic full run; real combat parity; 360×640; console errors 0');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
