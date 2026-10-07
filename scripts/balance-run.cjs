#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
function summarize(runs) {
  return [...new Set(runs.map(r => r.profile + '/' + r.difficulty))].map(key => {
    const rows = runs.filter(r => r.profile + '/' + r.difficulty === key), fights = rows.flatMap(r => r.fights);
    const clears = rows.filter(r => r.won).length, n = rows.length, z = 1.96, p = clears / n;
    const center = (p + z*z/(2*n))/(1+z*z/n), half = z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n);
    const fatal = rows.filter(r => !r.won).map(r => r.fights.at(-1)).filter(Boolean);
    return { policy: key, n, clears, clearRate95: [center-half, center+half],
      finalBossKills: rows.filter(r => r.won && r.fights.at(-1)?.won && !r.fights.at(-1)?.timeout).length,
      phoenixUses: fights.filter(f => !f.won).length - fatal.length,
      reach: [1, 2, 3, 4, 5].map(a => rows.filter(r => r.act >= a).length),
      bosses: [1, 2, 3, 4, 5].map(a => { const bs = fights.filter(f => f.act === a && f.kind === 'boss'); return { n: bs.length, wins: bs.filter(f => f.won).length, kills: bs.filter(f => f.won && !f.timeout).length }; }),
      deaths: [1, 2, 3, 4, 5].map(a => Object.fromEntries(['fight', 'elite', 'boss'].map(k => [k, fatal.filter(f => f.act === a && f.kind === k).length]))) };

  });
}
(async () => {
  const count = Number(process.env.RUNS || 20), startSeed = Number(process.env.SEED || 1001);
  const profiles = (process.env.PROFILES || 'novice,balanced,synergy').split(',');
  const difficulties = (process.env.DIFFICULTIES || 'normal').split(',');
  const out = path.resolve(process.env.OUT || '/tmp/balance4.json'), runs = [], errors = [];
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const sources = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', r => { if (new URL(r.url()).pathname.endsWith('.js')) sources.push(r.body().then(body => [new URL(r.url()).pathname, crypto.createHash('sha256').update(body).digest('hex')])); });
  await p.route('**/favicon.ico', r => r.fulfill({ status: 204, body: '' }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  try {
    if (process.env.BASELINE) {
      for (const file of ['v4/data4.js', 'v4/balance4.js', 'v4/encounters4.js', 'v4/battle4.js', 'v4/game4.js']) {
        let source = cp.execFileSync('git', ['show', process.env.BASELINE + ':' + file], { cwd: root, encoding: 'utf8' });
        // Export already-existing legal actions; no old gameplay code or coefficients are altered.
        if (file.endsWith('game4.js')) source = source.replace('startCombat, afterCombat,', 'startCombat, endCombat, afterCombat, tapBench, tapCell, unequip,');
        await p.route('**/' + file, r => r.fulfill({ contentType: 'application/javascript', body: source }));
      }
    }
    await p.goto((process.env.GAME_URL || 'http://127.0.0.1:8000') + '/v4/');
    await p.evaluate(() => { localStorage.clear(); SFX.setMuted(true); });
    for (const f of ['balance-policy4.js', 'balance-runner4.js']) await p.addScriptTag({ path: path.join(__dirname, f) });
    // Optional calibration file replaces *data*, exactly as editing shipped coefficients would.
    // It is unavailable to the decision policy and never changes a run, army or outcome.
    if (process.env.CALIBRATION) {
      const data = JSON.parse(fs.readFileSync(process.env.CALIBRATION));
      await p.evaluate(patch => { for (const [key, value] of Object.entries(patch)) V4.FOE[key] = value; }, data);
    }
    const sourceHashes = Object.fromEntries(await Promise.all(sources));
    for (const f of ['balance-policy4.js', 'balance-runner4.js']) sourceHashes[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, f))).digest('hex');
    const t0 = Date.now();
    for (const difficulty of difficulties) for (const profile of profiles) for (let i = 0; i < count; i++) {
      const seed = startSeed + i * 7919;
      const r = await p.evaluate(({ seed, profile, difficulty }) => BalanceRunner4.run(seed, profile, difficulty), { seed, profile, difficulty });
      runs.push(r);
      if ((i + 1) % 10 === 0 || i + 1 === count) {
        console.log(profile, difficulty, i + 1, '/', count, 'clears', runs.filter(r => r.profile === profile && r.difficulty === difficulty && r.won).length, 'seconds', ((Date.now() - t0) / 1000).toFixed(1));
        fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out + '.checkpoint', JSON.stringify({ sourceHashes, summary: summarize(runs), runs }));
      }
      if (process.env.SCREENSHOT && r.won && r.fights.at(-1)?.won && !r.fights.at(-1)?.timeout) { await p.screenshot({ path: process.env.SCREENSHOT }); delete process.env.SCREENSHOT; }
    }
    if (errors.length) throw Error('Browser errors: ' + errors.join('\n'));
    const summary = summarize(runs);
    const data = { baseline: process.env.BASELINE || null, sourceHashes, calibration: process.env.CALIBRATION ? JSON.parse(fs.readFileSync(process.env.CALIBRATION)) : null, commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: cp.execFileSync('git', ['diff', '--stat'], { cwd: root, encoding: 'utf8' }).trim(), seed: startSeed, count, errors, coefficients: await p.evaluate(() => V4.FOE), summary, runs };
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(data, null, 2));
    if (fs.existsSync(out + '.checkpoint')) fs.unlinkSync(out + '.checkpoint');
    console.log(JSON.stringify(summary, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
