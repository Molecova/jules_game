const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = process.env.COIN_OUTPUT || path.resolve(__dirname, '../docs/coin-evidence'); fs.mkdirSync(out, {recursive:true});
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[], summary={demo:{},game:{}};
 const listen=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const context=await browser.newContext({viewport:{width:740,height:710},deviceScaleFactor:2,recordVideo:{dir:path.join(out,'video'),size:{width:740,height:710}}});
 const p=await context.newPage();listen(p);
 const settle=()=>p.waitForFunction(()=>{const c=COIN_DEMO.inspect().find(e=>e.id==='0:'+COIN_DEMO.subject);return c&&!c.dying&&Math.hypot(...c.rotation)<1e-6&&Math.abs(c.position[1]-.0255)<1e-6;});
 // Observe inside the browser before the short pulse can finish during video/protocol work.
 const actAndHold=name=>p.evaluate(name=>new Promise((resolve,reject)=>{
  document.querySelector(`[data-action="${name}"]`).click();const start=performance.now();
  function sample(){const c=COIN_DEMO.inspect().find(e=>e.id==='0:'+COIN_DEMO.subject);
   if(c&&Math.hypot(...c.rotation)>.03){if(!COIN_DEMO.paused)document.getElementById('pause').click();return resolve();}
   if(performance.now()-start>10000)return reject(new Error('No visible '+name+' pose: '+JSON.stringify(COIN_DEMO.stats())));
   requestAnimationFrame(sample);
  }requestAnimationFrame(sample);
 }),name);
 try {
  await p.goto('http://127.0.0.1:8001/concepts/v4-coin-animation.html?still');await p.waitForFunction(()=>window.COIN_DEMO);await settle();
  const base=await p.evaluate(()=>COIN_DEMO.inspect());assert.equal(base.length,2);
  for(const c of base){assert.ok(c.thickness/c.diameter<.07);assert.equal(c.meshes,2);}
  await p.locator('#rank').click();await p.locator('#rank').click();await settle();
  await p.locator('#stage').screenshot({path:path.join(out,'coin-closeup.png')});
  summary.demo.base=await p.evaluate(()=>COIN_DEMO.stats());
  for(const cls of ['war','arc','mag']){
   await p.locator(`[data-class="${cls}"]`).click();await settle();await actAndHold('attack');
   const a=await p.evaluate(()=>COIN_DEMO.inspect());await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(()=>COIN_DEMO.inspect()),a,'paused animation retains its pose');
   summary.demo[cls]=a;await p.locator('#stage').screenshot({path:path.join(out,`attack-${cls}.png`)});await p.locator('#pause').click();await settle();
  }
  await actAndHold('move');summary.demo.move=await p.evaluate(()=>COIN_DEMO.inspect());await p.locator('#stage').screenshot({path:path.join(out,'move.png')});await p.locator('#pause').click();await settle();
  await actAndHold('hit');summary.demo.hit=await p.evaluate(()=>COIN_DEMO.inspect());await p.locator('#stage').screenshot({path:path.join(out,'hit.png')});await p.locator('#pause').click();await settle();
  await actAndHold('cast');summary.demo.cast=await p.evaluate(()=>COIN_DEMO.inspect());await p.locator('#stage').screenshot({path:path.join(out,'cast.png')});await p.locator('#pause').click();await settle();
  await actAndHold('death');summary.demo.death=await p.evaluate(()=>COIN_DEMO.inspect());assert.equal(summary.demo.death.find(e=>e.side===0).dying,true);await p.locator('#stage').screenshot({path:path.join(out,'death.png')});await p.locator('#pause').click();
  await p.waitForFunction(()=>!COIN_DEMO.inspect().some(e=>e.side===0));
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-action="place"]').click();await settle();await p.locator('[data-action="attack"]').click();await p.waitForTimeout(200);await settle();assert.equal(await p.evaluate(()=>COIN_DEMO.stats().coins.reducedMotion),true);
  await p.locator('[data-action="death"]').click();await p.waitForFunction(()=>!COIN_DEMO.inspect().some(e=>e.side===0));assert.equal(await p.evaluate(()=>COIN_DEMO.stats().coins.ghosts),0);
  console.log('PASS thin closed coins, flat star ranks, three attack types, move/hit/cast/death poses, pause and reduced motion');
  const video=p.video();await p.close();await context.close();await video.saveAs(path.join(out,'coin-animations.webm'));
  // Controlled engine fixture: two identical cards must retain separate identities.
  // This is a death/revival regression, not a legal expedition victory.
  const g=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});listen(g);
  await g.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await g.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await g.goto('http://127.0.0.1:8001/v4/');await g.waitForFunction(()=>window.__g?.tabletop?.active);
  await g.evaluate(()=>{localStorage.clear();SFX.setMuted(true);__g.newRun('normal');const n=__g.R.map.floors[0][0];__g.enterNode(n);
   __g.R.board=['dup-a','dup-b'].map((uid,i)=>({kind:'unit',id:'squire',uid,star:1,skills:[],item:null,x:i,y:4}));__g.renderPlay();});
  await g.waitForFunction(()=>__g.tabletop.inspectTokens().filter(e=>e.side===0).length===2);await g.waitForTimeout(450);
  const rng=await g.evaluate(()=>__g.R.rng);await g.waitForTimeout(400);assert.equal(await g.evaluate(()=>__g.R.rng),rng);
  await g.evaluate(()=>{__g.startCombat();__g.B.phase='result';});await g.waitForTimeout(450);
  const twin=await g.evaluate(()=>__g.tabletop.inspectTokens().find(e=>e.id==='0:dup-b'));
  await g.evaluate(()=>{const a=__g.B.combat.units.find(e=>e.uidRef==='dup-a');__g.B.combat.kill(a,null);});
  await g.waitForFunction(()=>__g.tabletop.inspectTokens().some(e=>e.id==='0:dup-a'&&e.dying));
  assert.deepEqual(await g.evaluate(()=>__g.tabletop.inspectTokens().find(e=>e.id==='0:dup-b')),twin,'the surviving identical card keeps its own mesh and pose');
  assert.equal(await g.evaluate(()=>__g.B.vfx.debris.length),0,'3D coins do not tear into paper');
  await g.waitForFunction(()=>!__g.tabletop.inspectTokens().some(e=>e.id==='0:dup-a'));
  await g.evaluate(()=>{__g.R.relics=['lantern'];const b=__g.B.combat.units.find(e=>e.uidRef==='dup-b');__g.B.combat.kill(b,null);});
  await g.waitForTimeout(400);assert.equal(await g.evaluate(()=>__g.B.combat.units.find(e=>e.uidRef==='dup-b').dead),false);assert.equal(await g.evaluate(()=>__g.tabletop.inspectTokens().find(e=>e.id==='0:dup-b')?.dying),false,'immediate revival does not create a corpse');
  // Existing sheet pause freezes both combat and the new visual clock.
  await g.evaluate(()=>{document.getElementById('sheet').hidden=false;});await g.waitForTimeout(150);const frozen=await g.evaluate(()=>({coins:__g.tabletop.inspectTokens(),time:__g.tabletop.diagnostics().coins.time}));await g.waitForTimeout(350);assert.deepEqual(await g.evaluate(()=>({coins:__g.tabletop.inspectTokens(),time:__g.tabletop.diagnostics().coins.time})),frozen);
  await g.evaluate(()=>{document.getElementById('sheet').hidden=true;});await g.emulateMedia({reducedMotion:'reduce'});await g.waitForTimeout(200);
  await g.evaluate(()=>__g.B.combat.kill(__g.B.combat.units.find(e=>e.uidRef==='dup-b'),null));await g.waitForFunction(()=>!__g.tabletop.inspectTokens().some(e=>e.id==='0:dup-b'));assert.equal(await g.evaluate(()=>__g.tabletop.diagnostics().coins.ghosts),0);
  summary.game=await g.evaluate(()=>({diagnostics:__g.tabletop.diagnostics(),tokens:__g.tabletop.inspectTokens()}));await g.close();
  console.log('PASS duplicate identities, real death hook, corpse disposal, guardian-lantern revival, sheet pause, reduced-motion death and visual RNG isolation');
  assert.deepEqual(errors,[]);summary.errors=errors;fs.writeFileSync(path.join(out,'coin-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('PASS console errors 0');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
