// Real purchases and a real fight on the final board; GAME_URL also verifies publication.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const url=process.env.GAME_URL||'http://127.0.0.1:8001/v4/';
const out=process.env.TABLETOP_OUTPUT||path.resolve(__dirname,'../docs/tabletop-evidence/polished');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[],assets=[],hostingErrors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{
  if(m.type()!=='error')return;
  // githack's separate content-notice page loads an optional third-party ad.
  // Record that exact blocked ad request separately; every game error still fails.
  if(m.location().url.startsWith('https://server.ethicalads.io/')&&m.text().includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'))hostingErrors.push({url:m.location().url,message:m.text()});
  else errors.push(m.text());
 });
 page.on('response',r=>{if(r.url().includes('/assets/tabletop/'))assets.push({url:r.url(),status:r.status()});});
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const open=page.getByText('Open the page',{exact:true});if(await open.count()){const href=await open.getAttribute('href');if(href)await page.goto(new URL(href,page.url()).href);else await open.click();}
 await page.waitForFunction(()=>window.__g?.tabletop?.active,null,{timeout:60000});
 await page.evaluate(()=>{localStorage.clear();SFX.setMuted(true);const old=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{a[0]=123;crypto.getRandomValues=old;return a;};});
 await page.locator('#newBtn').click();await page.locator('[data-go]').click();await page.locator('.node.next').first().click({force:true});await page.locator('#mapGo').click();
 for(const cls of ['war','arc','mag']){const i=await page.evaluate(cls=>__g.R.shop.unit.findIndex(c=>c&&__g.def(c).cls===cls&&__g.def(c).t===1),cls);assert.ok(i>=0);await page.locator(`#scards [data-s="${i}"]`).click();await page.waitForTimeout(400);await page.locator('#peek [data-act="buy"]').click();}
 assert.equal(await page.evaluate(()=>__g.R.board.length),3);assert.equal(await page.evaluate(()=>__g.R.gold),3);
 await page.waitForTimeout(400);await page.locator('#boardwrap').screenshot({path:path.join(out,'game-board-detail.png')});
 const simulated=await page.evaluate(()=>__g.simFight());await page.locator('#goBtn').click();const sizes=[];
 for(const [width,height]of [[390,844],[360,640]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(500);
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,active:__g.tabletop.active,diagnostics:__g.tabletop.diagnostics()}));assert.equal(result.overflow,false);assert.equal(result.active,true);assert.ok(result.diagnostics.draws>0);assert.ok(result.diagnostics.materials.source.startsWith('ambientCG'));sizes.push({width,height,...result});
  await page.screenshot({path:path.join(out,`combat-${width}x${height}.png`)});
 }
 await page.evaluate(()=>__g.skipCombat());await page.locator('#resBtn').waitFor({state:'visible',timeout:60000});
 const actual=await page.evaluate(()=>({won:__g.B.won,t:__g.B.combat.t}));assert.equal(actual.won,simulated.won);assert.equal(actual.t,simulated.t);assert.deepEqual(errors,[]);
 const loaded=new Set(assets.filter(r=>r.status===200).map(r=>new URL(r.url).pathname.split('/').pop()));
 assert.deepEqual([...loaded].sort(),['Wood062-color.jpg','Wood062-normal-dx.jpg','Wood062-roughness.jpg']);assert.ok(assets.every(r=>r.status>=200&&r.status<400),'no failed assets, including hosting redirects');
 fs.writeFileSync(path.join(out,'mobile-combat-summary.json'),JSON.stringify({url,sizes,assets,simulated,actual,errors,hostingErrors,fontHandling:'Optional Google Fonts CSS stubbed; game uses system fonts'},null,2)+'\n');
 if(hostingErrors.length)console.log('Separate hosting-notice ad failures recorded:',hostingErrors.length);
 console.log('PASS three required local wood maps (no unused stone downloads), three legal class purchases, real 3D combat in both mobile sizes, simulation equality, game console errors 0');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
