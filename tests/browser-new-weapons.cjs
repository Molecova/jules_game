// Production game wiring, readable captures and saved equipment at every star.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = process.env.NEW_WEAPONS_BROWSER_OUTPUT || '/tmp/jules-new-weapons';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [], results = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await p.route('**/v4/game4.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'v4/game4.js'), 'utf8').replace('  // 테스트·밸런스용 진입점', '  window.__weaponCheck={draw,save,itemText,skillMain,BASE_E};\n  // 테스트·밸런스용 진입점') }));
  try {
    for (const star of [1, 2, 3]) {
      await p.goto('http://127.0.0.1:8000/v4/');
      await p.evaluate(star => {
        localStorage.clear(); SFX.setMuted(true); __g.newRun('normal'); __g.R.lv = 9;
        const n = __g.R.map.floors[0][0]; n.k = 'fight'; __g.enterNode(n);
        __g.R.board = [['warden', 'greatnail', 'brace'], ['archer', 'restlessbow', 'transfer']].map(([id, item, skill], i) => ({ kind: 'unit', id, uid: 'new' + i, star: 1, x: i * 2, y: i ? 4 : 3, skills: [{ kind: 'skill', id: skill, uid: 'chip' + i, star }], item: { kind: 'item', id: item, uid: 'item' + i, star } }));
        for (const u of __g.R.board) { __g.take(u); __g.take(u.item, 3 ** (star - 1)); __g.take(u.skills[0], 3 ** (star - 1)); }
        __g.R.enemies = ['goblin', 'bandit', 'skel'].map((id, i) => ({ id, cell: __g.grid.idx(i, 2), scale: 1 }));
        __g.renderPlay(); __weaponCheck.save();
      }, star);
      await p.reload(); await p.locator('#contBtn').click();
      assert.deepEqual(await p.evaluate(() => __g.R.board.map(u => [u.item.id, u.item.star, u.skills[0].id, u.skills[0].star])), [['greatnail', star, 'brace', star], ['restlessbow', star, 'transfer', star]]);
      const result = await p.evaluate(star => {
        window.__newEvents = []; const create = VFX4.create;
        VFX4.create = opts => { const vfx = create(opts), emit = vfx.emit; vfx.emit = (id, data) => { __newEvents.push({ id, star: data.star }); return emit(id, data); }; return vfx; };
        __g.startCombat(); __g.B.phase = 'inspect';
        const cb = __g.B.combat, [war, arc] = cb.alive(0), foes = cb.alive(1);
        for (const u of cb.units) { u.hp = u.maxHp = 10000; u.armor = u.dodge = 0; u.enemy = null; u.chip = u.act = null; }
        const skills = war.skills; war.skills = [{ def: V4.DEF['skill:brace'], star }]; war.castIdx = 0; cb.hooks.onCast(war, foes[0], cb); war.skills = skills;
        if (war.shield !== 0 || war.st.root !== 4) throw Error('Brace cast must root, without instant shield');
        for (let i = 0; i < 123; i++) { cb.t += 1 / 60; cb.hooks.onTick(cb, 1 / 60); __g.B.vfx.skills.step(1 / 60); }
        if (war.anchorT !== 2) throw Error('Nail not planted');
        const expectedShield = [0, 100, 170, 260][star] * 2;
        if (war.shield !== expectedShield) throw Error('Wrong second shield pulse: ' + war.shield);
        cb.attack(arc, foes[0]); const next = arc.target;
        if (next === foes[0] || __g.grid.dist(arc.cell, next.cell) > arc.range) throw Error('Bow did not switch to another reachable target');
        const hp = next.hp; cb.attack(arc, next);
        if (hp - next.hp !== Math.round(arc.atk * [0, 3, 3.6, 4.5][star]) || arc.castCount.transfer !== 1) throw Error('Wrong transfer damage or count');
        cb.floaters = []; document.getElementById('bstamp').className = 'bstamp'; document.getElementById('toast').classList.remove('show'); __g.B.vfx.skills.step(.12); __weaponCheck.draw();
        const text = (id, kind) => kind === 'item' ? __weaponCheck.itemText(V4.DEF['item:' + id], star, __weaponCheck.BASE_E) : __weaponCheck.skillMain(V4.DEF['skill:' + id], star, __weaponCheck.BASE_E);
        return { star, shield: war.shield, nailMultiplier: cb.hooks.dmgDealtMod(war, foes[0], 'spell', cb), transferDamage: hp - next.hp, transferCasts: arc.castCount.transfer, events: __newEvents, descriptions: Object.fromEntries([['greatnail', 'item'], ['restlessbow', 'item'], ['brace', 'skill'], ['transfer', 'skill']].map(([id, kind]) => [id, text(id, kind)])) };
      }, star);
      assert.ok(result.events.some(e => e.id === 'p_nailAnchor'));
      assert.ok(result.events.some(e => e.id === 'p_restlessTarget'));
      assert.ok(result.events.some(e => e.id === 'p_braceShield'));
      assert.ok(result.events.some(e => e.id === 'transfer'));
      assert.match(result.descriptions.greatnail, new RegExp(String([0, 30, 48, 60][star])));
      assert.match(result.descriptions.restlessbow, new RegExp(String([0, 50, 80, 125][star])));
      assert.match(result.descriptions.brace, new RegExp(String([0, 100, 170, 260][star])));
      assert.match(result.descriptions.transfer, new RegExp(String([0, 300, 360, 450][star])));
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await p.screenshot({ path: path.join(out, `new-builds-star-${star}.png`) }); results.push(result);
    }
    await p.goto('http://127.0.0.1:8000/concepts/v4-skill-effects.html#transfer'); await p.evaluate(() => SkillStudy.pause());
    assert.equal(await p.locator('#name').innerText(), '환승', 'direct preview link selects the new skill');
    for (const [id, time] of [['brace', 2.12], ['transfer', .15], ['w_greatnail', 2.1], ['w_restlessbow', .1]]) {
      await p.evaluate(({ id, time }) => { SkillStudy.select(id); SkillStudy.seek(time); }, { id, time });
      await p.screenshot({ path: path.join(out, `preview-${id}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ results, errors }, null, 2));
    console.log('PASS new builds at all stars, saved equipment, production events, tooltips, 7 captures; JavaScript exceptions 0');
  } catch (e) { await p.screenshot({ path: path.join(out, 'failure.png') }); throw e; }
  finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
