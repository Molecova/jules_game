// Presentation-only helper exports. No test armies or results are used as balance evidence.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 360, height: 640 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await p.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }));
  await p.route('**/v4/game4.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.resolve(__dirname, '../v4/game4.js'), 'utf8').replace('  // 테스트·밸런스용 진입점', '  window.__cardTextCheck={itemText,skillMain,skillText,skillExtras,unitLadder,BASE_E};\n  // 테스트·밸런스용 진입점') }));
  try {
    await p.goto('http://127.0.0.1:8000/v4/');
    const result = await p.evaluate(() => {
      const H = __cardTextCheck, e = H.BASE_E, strip = s => s.replace(/<[^>]+>/g, '');
      const all = [...V4.UNITS.map(u => H.unitLadder(u, 1)), ...V4.SKILLS.flatMap(s => [1, 2, 3].map(st => H.skillText(s, st, e))), ...V4.ITEMS.flatMap(i => [1, 2, 3].map(st => H.itemText(i, st, e)))];
      const skill = (id, st, stats = e) => strip(H.skillMain(V4.DEF['skill:' + id], st, stats));
      const item = (id, st) => strip(H.itemText(V4.DEF['item:' + id], st, e));
      return { allValid: all.every(t => !/NaN|undefined/.test(t)), resolve: [1, 2, 3].map(st => skill('resolve', st)), mark: [1, 2, 3].map(st => skill('marktarget', st)), walk: [1, 2, 3].map(st => skill('windwalk', st)), twins: [1, 2, 3].map(st => item('twinblades', st)), cloak: [1, 2, 3].map(st => item('windcloak', st)), shortbow: [1, 2, 3].map(st => item('shortbow', st)), rabbit: item('rabbitbow', 3), aegis: skill('aegis', 3, { ...e, pow: 2.8 }), meteor: strip(H.skillExtras(V4.DEF['skill:meteor'], { ...e, pow: 1.7, spell: 1.75 }, 3)), guard: [1, 2, 3].map(st => strip(H.skillMain(V4.DEF['unit:warden'].ult, 1, { ...e, unitStar: st }))), blades: skill('bladestorm', 3, { ...e, pow: 2.8, spell: 1.4 }) };
    });
    assert.ok(result.allValid);
    for (let i = 0; i < 3; i++) {
      assert.match(result.resolve[i], new RegExp('체력 ' + [40, 45, 50][i] + '%'));
      assert.match(result.mark[i], new RegExp((i + 3) + '회'));
      assert.match(result.walk[i], new RegExp(String([3, 3.5, 4][i]) + '초'));
      assert.match(result.twins[i], new RegExp('치명 피해 \\+' + [25, 40, 63][i] + '%'));
      assert.match(result.cloak[i], new RegExp('회피 \\+' + [20, 32, 32][i] + '%'));
      assert.match(result.shortbow[i], new RegExp('피해 ' + [90, 144, 225][i]));
      assert.match(result.guard[i], new RegExp('−' + [30, 35, 40][i] + '%'));
    }
    assert.match(result.rabbit, /사거리 -1/); assert.match(result.aegis, /회복 728/); assert.match(result.meteor, /화상 초당 309/);
    assert.match(result.blades, /출혈 초당 510/);
    assert.deepEqual(errors, []);
    console.log('PASS all 129 card ladders; star-scaled utility/healing/DoT/weapon actives; crit damage/dodge/range text; console errors 0');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
