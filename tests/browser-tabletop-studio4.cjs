// Exercise the actual shared board/coins under the close-up camera, locally or hosted.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const verifiedTransport=require('./browser-tls4.cjs');
const url=process.env.STUDIO_URL||'http://127.0.0.1:8001/concepts/v4-tabletop-studio.html';
const out=process.env.STUDIO_OUTPUT||path.resolve(__dirname,'../docs/tabletop-studio-evidence/local');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 let transport;
 try{
  const page=await browser.newPage({viewport:{width:1040,height:850},deviceScaleFactor:1}),summary={url,views:[],themes:[],errors:[],hostingErrors:[],assets:[]};
  transport=await verifiedTransport(page);summary.transport=transport.transport;
  page.on('pageerror',e=>summary.errors.push(e.message));page.on('console',m=>{if(m.type()!=='error')return;
   if(m.location().url.startsWith('https://server.ethicalads.io/')&&m.text().includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'))summary.hostingErrors.push(m.text());else summary.errors.push(m.text());});
  page.on('response',r=>{if(/\/(v4|concepts)\/.*\.(js|jpg)(\?|$)/.test(r.url()))summary.assets.push({url:r.url(),status:r.status()});});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.goto(url,{waitUntil:'domcontentloaded'});const open=page.getByText('Open the page',{exact:true});if(await open.count())await open.click();
  await page.waitForFunction(()=>window.TABLETOP_STUDIO,null,{timeout:60000});
  await page.waitForFunction(()=>TABLETOP_STUDIO.inspect().length===2&&TABLETOP_STUDIO.inspect().every(c=>Math.abs(c.position[1]-.0255)<1e-6));
  for(const [width,height]of [[1040,850],[390,844],[360,640]]) {
   await page.setViewportSize({width,height});
   for(const angle of ['corner','edge','overhead']) {
    await page.locator(`[data-camera="${angle}"]`).click();await page.waitForTimeout(150);
    const d=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,...TABLETOP_STUDIO.stats()}));
    assert.equal(d.overflow,false);assert.equal(d.coins.tokens,2);assert.equal(d.studio.reflectionSize,128);assert.equal(d.studio.reflectionMiB,1.5);
    for(const c of d.framing)assert.ok(c.left>=0&&c.right<=c.width&&c.top>=0&&c.bottom<=c.height,JSON.stringify({angle,width,c}));
    for(const c of await page.evaluate(()=>TABLETOP_STUDIO.inspect())){assert.ok(c.thickness/c.diameter<.07);assert.equal(c.meshes,2);}
    summary.views.push({width,height,...d});await page.locator('#studio').screenshot({path:path.join(out,`studio-${angle}-${width}.png`)});
   }
  }
  await page.setViewportSize({width:1040,height:850});await page.locator('[data-camera="corner"]').click();
  for(let act=1;act<=5;act++){await page.locator('#act').selectOption(String(act));await page.waitForTimeout(150);const d=await page.evaluate(()=>TABLETOP_STUDIO.stats());assert.equal(d.board.theme,act);summary.themes.push(d);}
  await page.locator('#act').selectOption('1');
  for(const name of ['attack','cast','hit']){
   summary[name]=await page.evaluate(name=>new Promise((resolve,reject)=>{
    TABLETOP_STUDIO.play(name);const start=performance.now();function sample(){const c=TABLETOP_STUDIO.inspect().find(c=>c.id==='0:studio-war');
     if(c&&Math.hypot(c.rotation[0],c.rotation[2],c.rotation[1]+Math.PI)>.03){document.getElementById('pause').click();return resolve(TABLETOP_STUDIO.inspect());}
     if(performance.now()-start>15000)return reject(new Error('No visible '+name+' pose'));requestAnimationFrame(sample);}requestAnimationFrame(sample);
   }),name);
   const held=await page.evaluate(()=>TABLETOP_STUDIO.inspect());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>TABLETOP_STUDIO.inspect()),held);
   await page.locator('#studio').screenshot({path:path.join(out,`studio-${name}.png`)});await page.locator('#pause').click();
   await page.waitForFunction(()=>TABLETOP_STUDIO.inspect().every(c=>Math.abs(c.position[1]-.0255)<1e-6));
  }
  await page.locator('#rank').click();await page.locator('#rank').click();await page.waitForTimeout(300);assert.ok((await page.evaluate(()=>TABLETOP_STUDIO.inspect())).every(c=>c.star===3));
  await page.locator('#studio').screenshot({path:path.join(out,'studio-rank3.png')});
  assert.ok(summary.assets.some(a=>a.url.includes('/tabletop-lighting4.js')&&a.status===200));assert.ok(summary.assets.some(a=>a.url.includes('/tabletop-tokens4.js')&&a.status===200));
  assert.ok(summary.assets.every(a=>a.status>=200&&a.status<400));assert.deepEqual(summary.errors,[]);
  fs.writeFileSync(path.join(out,'studio-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('PASS shared physical board/coins, reflection map, 3 camera angles at 3 sizes, 5 acts, attack/cast/hit, pause, ranks, loaded assets and console errors 0');
 }finally{await browser.close();await transport?.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
