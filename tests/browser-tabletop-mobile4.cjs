// Real purchases and a real fight on the final board; GAME_URL also verifies publication.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const url=process.env.GAME_URL||'http://127.0.0.1:8001/v4/';
const out=process.env.TABLETOP_OUTPUT||path.resolve(__dirname,'../docs/tabletop-evidence/polished');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,ignoreHTTPSErrors:true}),errors=[],assets=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
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
 const actual=await page.evaluate(()=>({won:__g.B.won,t:__g.B.combat.t}));assert.equal(actual.won,simulated.won);assert.equal(actual.t,simulated.t);assert.deepEqual(errors,[]);assert.equal(assets.length,6);assert.ok(assets.every(r=>r.status===200));
 fs.writeFileSync(path.join(out,'mobile-combat-summary.json'),JSON.stringify({url,sizes,assets,simulated,actual,errors,fontHandling:'Optional Google Fonts CSS stubbed; game uses system fonts'},null,2)+'\n');
 console.log('PASS six local PBR assets, three legal class purchases, real 3D combat in both mobile sizes, simulation equality, console errors 0');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
