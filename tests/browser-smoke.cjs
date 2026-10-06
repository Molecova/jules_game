const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [], resourceFailures = [], fontFailures = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => {
    const url = new URL(r.url());
    if (url.hostname === '127.0.0.1') resourceFailures.push(r.url());
    else if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) fontFailures.push(url.hostname);
  });
  page.on('response', r => {
    const url = new URL(r.url());
    if (r.status() >= 400 && url.hostname === '127.0.0.1' && url.pathname !== '/favicon.ico') resourceFailures.push(`${r.status()} ${r.url()}`);
  });
  try {
    const home = await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    assert.equal(home.status(), 200);
    assert.equal(await page.locator('a.featured').getAttribute('href'), 'v4/index.html');
    console.log('PASS landing page and v4 navigation');
    await page.locator('a.featured').click();
    await page.locator('#newBtn').click();
    await page.locator('[data-df="normal"]').click();
    await page.locator('[data-go]').click();
    await page.locator('#scr-map').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('card-expedition-v4')).map.floors.length === 6));
    // Reachable nodes animate continuously; skip Playwright's stability wait.
    await page.locator('.node.next').first().click({ force: true });
    await page.locator('#mapGo').click();
    await page.locator('#scr-play').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#scards [data-s]').count(), 5);
    const gold = Number(await page.locator('#sgold').innerText());
    for (let i = 0; i < 3; i++) {
      await page.locator('#scards .tier1[data-s]').first().click();
      // The game ignores buy clicks for 350 ms after opening card details.
      await page.waitForTimeout(400);
      await page.locator('#peek [data-act="buy"]').click();
    }
    assert.equal(Number(await page.locator('#sgold').innerText()), gold - 3);
    console.log('PASS v4 expedition, map, shop purchases and gold accounting');
    await page.locator('#goBtn').click();
    await page.locator('#bpanel').waitFor({ state: 'visible' });
    assert.ok(await page.locator('#roster .ring').count() > 0);
    await page.evaluate(() => __g.skipCombat());
    await page.locator('#resBtn').waitFor({ state: 'visible', timeout: 20000 });
    console.log('PASS v4 combat engine completed:', await page.locator('#resBtn').innerText());
    await page.locator('#resBtn').click();
    if (await page.locator('#sheet [data-pick]').first().isVisible()) await page.locator('#sheet [data-pick]').first().click();
    await page.locator('#scr-map').waitFor({ state: 'visible' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#contBtn').waitFor({ state: 'visible' });
    await page.locator('#contBtn').click();
    await page.locator('#scr-map').waitFor({ state: 'visible' });
    console.log('PASS v4 localStorage save and resume');
    await page.goto('http://127.0.0.1:8000/game/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#newRun').click();
    await page.locator('#stGo').click();
    await page.locator('#mapScreen').waitFor({ state: 'visible' });
    assert.ok(await page.locator('.mnode.reach').count() > 0);
    console.log('PASS v3 expedition start and reachable map nodes');
    assert.deepEqual(errors, [], 'JavaScript runtime errors');
    assert.deepEqual(resourceFailures, [], 'Local resource failures');
    console.log('PASS no JavaScript exceptions or failed local resources');
    console.log('Optional font request failures:', [...new Set(fontFailures)].join(', ') || 'none observed');
  } catch (e) {
    await page.screenshot({ path: '/tmp/jules-game-smoke-failure.png' });
    console.error(await page.evaluate(() => ({
      peek: { hidden: document.querySelector('#peek')?.hidden, rect: document.querySelector('#peek')?.getBoundingClientRect().toJSON() },
      buttons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0).map(b => ({ id: b.id, text: b.textContent, data: {...b.dataset} }))
    })));
    throw e;
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
