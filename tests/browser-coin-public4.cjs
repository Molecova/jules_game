// Verify the hosted preview actually loads its shared game model and moves it.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.COIN_URL||'http://127.0.0.1:8001/concepts/v4-coin-animation.html?still';
const out=process.env.COIN_OUTPUT||path.resolve(__dirname,'../docs/coin-evidence');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,ignoreHTTPSErrors:true}),errors=[],hostingErrors=[],assets=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()!=='error')return;
   if(m.location().url.startsWith('https://server.ethicalads.io/')&&m.text().includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'))hostingErrors.push(m.text());else errors.push(m.text());});
  p.on('response',r=>{if(/\/(?:v4|concepts)\/.*\.(?:js|jpg)(?:\?|$)/.test(r.url()))assets.push({url:r.url(),status:r.status()});});
  await p.goto(url,{waitUntil:'domcontentloaded'});const open=p.getByText('Open the page',{exact:true});if(await open.count())await open.click();
  await p.waitForFunction(()=>window.COIN_DEMO,null,{timeout:60000});
  await p.evaluate(()=>{if(document.getElementById('auto').getAttribute('aria-pressed')==='true')document.getElementById('auto').click();});
  const poses={};
  for(const cls of ['war','arc','mag']){
   await p.locator(`[data-class="${cls}"]`).click();await p.waitForFunction(()=>{const c=COIN_DEMO.inspect().find(e=>e.id==='0:'+COIN_DEMO.subject);return c&&Math.hypot(...c.rotation)<1e-6&&Math.abs(c.position[1]-.0255)<1e-6;});
   poses[cls]=await p.evaluate(()=>new Promise((resolve,reject)=>{
    document.querySelector('[data-action="attack"]').click();const start=performance.now();function sample(){const c=COIN_DEMO.inspect().find(e=>e.id==='0:'+COIN_DEMO.subject);
     if(c&&Math.hypot(...c.rotation)>.03){document.getElementById('pause').click();return resolve(c);}if(performance.now()-start>10000)return reject(new Error('Attack did not animate'));requestAnimationFrame(sample);}requestAnimationFrame(sample);
   }));
   assert.ok(poses[cls].thickness/poses[cls].diameter<.07);assert.equal(poses[cls].meshes,2);
   await p.screenshot({path:path.join(out,`preview-mobile-${cls}.png`)});await p.locator('#pause').click();
  }
  for(const [width,height]of [[390,844],[360,640]]){await p.setViewportSize({width,height});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.ok(assets.some(r=>r.url.includes('/tabletop-tokens4.js')&&r.status===200));assert.ok(assets.every(r=>r.status>=200&&r.status<400));assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'preview-public-summary.json'),JSON.stringify({url,poses,assets,errors,hostingErrors},null,2)+'\n');
  console.log('PASS hosted shared coin model, three live attack poses, both mobile widths, assets loaded and preview console errors 0');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
