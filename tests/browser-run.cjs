// Progression/reload regression, not a balance test: a boosted party isolates state transitions.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = process.env.BUGFIX_OUTPUT || '/tmp/jules-bugfixes';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [], visited = [], fights = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  try {
    await p.goto('http://127.0.0.1:8000/v4/');
    await p.evaluate(() => {
      localStorage.clear(); SFX.setMuted(true); __g.newRun('normal');
      __g.R.rng = 412; __g.R.lv = 9; __g.R.gold = 200;
      __g.R.encounters.seed = 412; __g.R.map = __g.genMap(1);
      __g.R.board = ['squire', 'shieldman', 'warden', 'paladin', 'blademaster', 'ninja', 'archmage', 'warlock', 'bishop'].map((id, i) => ({
        kind: 'unit', id, uid: 'full' + i, star: 3,
        skills: [{ kind: 'skill', id: i < 5 ? 'cross' : i === 5 ? 'boomerang' : 'meteor', uid: 'sk' + i, star: 3 }],
        item: null, x: i % 5, y: i < 5 ? 3 : 5,
      }));
      __g.showMap();
    });
    for (let step = 0; step < 45; step++) {
      // Every map boundary goes through the actual Continue control.
      await p.reload(); await p.locator('#contBtn').click();
      assert.equal(await p.locator('#saveNotice').isVisible(), false);
      const node = await p.evaluate(() => {
        const ns = __g.reachable().map(__g.nodeById);
        return ns.find(n => n.k === 'fight') || ns[0];
      });
      assert.ok(node); visited.push(node.id);
      await p.evaluate(n => __g.enterNode(n), node);
      for (let guard = 0; guard < 12; guard++) {
        const state = await p.evaluate(() => ({ screen: __g.ui.screen, sheet: !document.getElementById('sheet').hidden, fight: __g.R.mode === 'fight' }));
        if (['map', 'over'].includes(state.screen)) break;
        if (state.sheet) {
          const choice = p.locator('#sheet [data-o]:not([disabled])');
          if (await choice.count()) await choice.last().click();
          else {
            const pick = p.locator('#sheet [data-r], #sheet [data-pick]');
            assert.ok(await pick.count(), 'unhandled selection'); await pick.first().click();
          }
        } else if (state.fight) {
          await p.locator('#goBtn').click();
          // This verifies progression, not the current patch's unit/skill balance.
          await p.evaluate(() => { for (const u of __g.B.combat.units) if (u.side === 0) { u.maxHp *= 20; u.hp = u.maxHp; u.atk *= 5; } __g.skipCombat(); });
          await p.locator('#resBtn').waitFor({ state: 'visible' });
          const fight = await p.evaluate(() => ({ act: __g.R.act, round: __g.R.round, kind: __g.R.node.k, won: __g.B.won }));
          assert.equal(fight.won, true, JSON.stringify(fight)); fights.push(fight);
          // A confirmed outcome must resume into its reward or ending without replay.
          await p.reload(); await p.locator('#contBtn').click();
        } else await p.locator('#goBtn').click();
      }
      assert.ok(await p.evaluate(() => ['map', 'over'].includes(__g.ui.screen)), 'node did not resolve');
      if (await p.evaluate(() => __g.ui.screen === 'over')) break;
    }
    const ending = await p.evaluate(() => ({ text: document.getElementById('overStamp').textContent, act: __g.R.act, round: __g.R.round, screen: __g.ui.screen, saved: localStorage.getItem('card-expedition-v4'), backup: localStorage.getItem('card-expedition-v4:backup'), best: JSON.parse(localStorage.getItem('cardExpeditionV4Best')) }));
    assert.equal(visited.length, 45); assert.equal(ending.text, '원정 완수!');
    assert.equal(ending.round, 45); assert.equal(ending.act, 5); assert.equal(ending.screen, 'over');
    assert.equal(ending.saved, null); assert.equal(ending.backup, null);
    assert.equal(ending.best.runs, 1); assert.equal(fights.filter(f => f.kind === 'boss').length, 5);
    assert.deepEqual(errors, []);
    await p.screenshot({ path: path.join(out, 'run-complete.png') });
    fs.writeFileSync(path.join(out, 'run-complete.json'), JSON.stringify({ visited, fights, ending, errors }, null, 2));
    console.log('PASS all 5 acts, 45 nodes, 5 bosses, map/result reloads, one clear record, deleted save/backup; JavaScript exceptions 0');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
