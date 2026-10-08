// Static server: python3 -m http.server 8001 --directory <repo>
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const url = process.env.GAME_URL || 'http://127.0.0.1:8001/v4/';
const out = process.env.TABLETOP_OUTPUT || path.resolve(__dirname, '../docs/tabletop-evidence');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [], summary = { viewports: [], themes: [] };
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }));
  const cell = (x, y) => page.evaluate(({ x, y }) => { const p = __g.grid.cells[__g.grid.idx(x, y)]; return __g.tabletop.screen(p.x, p.y); }, { x, y });
  const drag = async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400); };
  try {
    await page.goto(url); await page.waitForFunction(() => window.__g?.tabletop?.active);
    await page.evaluate(() => { localStorage.clear(); SFX.setMuted(true); const old = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => { a[0] = 123; crypto.getRandomValues = old; return a; }; });
    await page.locator('#newBtn').click(); await page.locator('[data-go]').click();
    await page.locator('.node.next').first().click({ force: true }); await page.locator('#mapGo').click();
    for (const cls of ['war', 'arc', 'mag']) {
      const index = await page.evaluate(cls => __g.R.shop.unit.findIndex(c => c && __g.def(c).cls === cls && __g.def(c).t === 1), cls);
      assert.ok(index >= 0); await page.locator(`#scards [data-s="${index}"]`).click();
      await page.waitForTimeout(400); await page.locator('#peek [data-act="buy"]').click();
    }
    assert.equal(await page.evaluate(() => __g.R.board.length), 3);
    assert.equal(await page.evaluate(() => __g.R.gold), 3);
    await page.locator('#rollBtn').click();
    const rng = await page.evaluate(() => __g.R.rng);
    await page.waitForTimeout(600); assert.equal(await page.evaluate(() => __g.R.rng), rng, 'rendering must not consume gameplay RNG');
    for (const [width, height] of [[390, 844], [360, 640], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(500);
      const result = await page.evaluate(() => {
        const failures = [];
        for (const c of __g.grid.cells) { const s = __g.tabletop.screen(c.x, c.y), p = __g.tabletop.point(s.x, s.y); if (!p || __g.grid.cellAt(p.x, p.y)?.i !== c.i) failures.push(c.i); }
        const go = document.getElementById('goBtn').getBoundingClientRect();
        return { failures, overflow: document.documentElement.scrollWidth > innerWidth, buttonInside: go.top >= 0 && go.bottom <= innerHeight, diagnostics: __g.tabletop.diagnostics() };
      });
      assert.deepEqual(result.failures, []); assert.equal(result.overflow, false); assert.equal(result.buttonInside, true);
      summary.viewports.push({ width, height, ...result });
      await page.screenshot({ path: path.join(out, `prep-${width}x${height}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
    const card = await page.evaluate(() => ({ ...__g.R.board[0] }));
    await drag(await cell(card.x, card.y), await cell(0, 4));
    assert.deepEqual(await page.evaluate(uid => { const u = __g.R.board.find(c => c.uid === uid); return [u.x, u.y]; }, card.uid), [0, 4]);
    // Moving into the actual bench and dragging back uses the existing DOM handlers.
    const slot = await page.locator('#bench [data-b="0"]').boundingBox();
    await drag(await cell(0, 4), { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 });
    assert.equal(await page.evaluate(() => __g.R.bench[0]?.uid), card.uid);
    await drag({ x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }, await cell(0, 4));
    assert.equal(await page.evaluate(uid => __g.R.board.some(u => u.uid === uid && u.x === 0 && u.y === 4), card.uid), true);
    console.log('PASS 3 viewports, all 30 projected cells, real purchases and board↔bench drag, visual RNG isolation');
    // Preview only the five art themes. This is not a fabricated full-run clear.
    for (let act = 1; act <= 5; act++) {
      await page.evaluate(act => { __g.R.act = act; __g.renderPlay(); }, act); await page.waitForTimeout(400);
      const d = await page.evaluate(() => __g.tabletop.diagnostics()); assert.equal(d.act, act);
      assert.ok(d.materials.source.startsWith('ambientCG'), 'all local PBR maps loaded');
      assert.ok(d.triangles < 100000 && d.drawCalls < 150 && d.textureBudgetMiB <= 32);
      for (const p of d.environment.decorations) {
        assert.ok(p.x + p.radius <= 96 || p.x - p.radius >= 416 || p.y + p.radius <= 22 || p.y - p.radius >= 406, 'scenery stays outside all playable squares');
      }
      summary.themes.push(d); await page.screenshot({ path: path.join(out, `theme-act-${act}.png`) });
    }
    // Warm all five themes, then repeat 1→5 twenty times; GPU object counts must plateau.
    const memory = [];
    for (let cycle = 0; cycle <= 20; cycle++) {
      for (let act = 1; act <= 5; act++) {
        const previous = await page.evaluate(() => __g.tabletop.diagnostics().draws);
        await page.evaluate(act => { __g.R.act = act; __g.renderPlay(); }, act);
        await page.waitForFunction(n => __g.tabletop.diagnostics().draws > n, previous);
      }
      const d = await page.evaluate(() => __g.tabletop.diagnostics());
      memory.push({ cycle, textures: d.textures, geometries: d.geometries, programs: d.programs, textureBudgetMiB: d.textureBudgetMiB });
    }
    for (const m of memory.slice(1)) assert.deepEqual({ ...m, cycle: 0 }, memory[0], 'resource counts must stop growing after warm-up');
    summary.memory = memory;
    console.log('PASS scenery outside the grid, rendering budgets, twenty full 1→5 resource cycles');
    await page.evaluate(() => { __g.R.act = 1; __g.renderPlay(); });
    const simulated = await page.evaluate(() => __g.simFight());
    await page.locator('#goBtn').click(); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, 'combat-390x844.png') });
    await page.evaluate(() => __g.skipCombat()); await page.locator('#resBtn').waitFor({ state: 'visible', timeout: 60000 });
    const actual = await page.evaluate(() => ({ won: __g.B.won, t: __g.B.combat.t, battles: __g.R.stats.battles }));
    assert.equal(actual.won, simulated.won); assert.equal(actual.t, simulated.t); assert.equal(actual.battles, 1);
    await page.reload(); await page.waitForFunction(() => window.__g?.tabletop?.active); await page.locator('#contBtn').click();
    assert.equal(await page.evaluate(() => __g.R.stats.battles), 1);
    console.log('PASS five board themes, live 3D battle equals simulation, confirmed result resume');
    await page.goto(url + '?quality=low'); await page.waitForFunction(() => window.__g?.tabletop?.active); await page.locator('#contBtn').click();
    await page.waitForTimeout(400);
    summary.low = await page.evaluate(() => __g.tabletop.diagnostics());
    assert.equal(summary.low.quality, 'low'); assert.ok(summary.low.textureBudgetMiB < summary.themes[0].textureBudgetMiB);
    await page.screenshot({ path: path.join(out, 'low-390x844.png') });
    // Visual load fixture, not a legal expedition or a fabricated victory.
    await page.evaluate(() => {
      __g.R.mode = 'fight'; __g.R.act = 5; __g.R.lv = 9;
      __g.R.board = [0,3,6,9,12,15,18,21,24].map((n, i) => ({ kind:'unit', id:V4.UNITS[n].id, uid:'visual'+i, star:3, skills:[], item:null, x:i%5, y:3+Math.floor(i/5) }));
      const original = __g.R.enemies;
      __g.R.enemies = Array.from({length:12}, (_, i) => ({ ...original[i%original.length], uid:'visual-foe'+i, cell:__g.grid.idx(i%5, Math.floor(i/5)) }));
      __g.renderPlay();
    });
    await page.waitForTimeout(400);
    summary.stress = await page.evaluate(() => __g.tabletop.diagnostics());
    assert.equal(summary.stress.tokens, 21); assert.ok(summary.stress.triangles < 100000 && summary.stress.drawCalls < 150 && summary.stress.textureBudgetMiB <= 32);
    await page.screenshot({ path: path.join(out, 'visual-stress-21-tokens.png') });
    console.log('PASS low quality and 21-token visual fixture within rendering budgets');
    const pbrRequests = [];
    const onRequest = r => { if (r.url().includes('/assets/tabletop/')) pbrRequests.push(r.url()); };
    page.on('request', onRequest);
    await page.goto(url + '?view=2d'); await page.waitForFunction(() => window.TABLETOP4);
    assert.equal(await page.evaluate(() => __g.tabletop), null);
    await page.locator('#contBtn').click(); assert.equal(await page.locator('#cv').evaluate(el => getComputedStyle(el).opacity), '1');
    page.off('request', onRequest); assert.deepEqual(pbrRequests, [], '2D fallback skips PBR downloads');
    console.log('PASS explicit 2D fallback');
    await page.goto(url); await page.waitForFunction(() => window.__g?.tabletop?.active); await page.locator('#contBtn').click();
    await page.evaluate(() => document.getElementById('tabletopCanvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => !__g.tabletop.active);
    assert.equal(await page.locator('#cv').evaluate(el => getComputedStyle(el).opacity), '1');
    console.log('PASS WebGL context loss returns to playable 2D board');
    assert.deepEqual(errors, []); summary.errors = errors; summary.combat = { simulated, actual };
    fs.writeFileSync(path.join(out, 'browser-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log('PASS browser console errors 0');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
