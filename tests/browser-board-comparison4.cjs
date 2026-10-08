const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.COMPARE_URL||'http://127.0.0.1:8001/concepts/v4-board-ui-comparison.html',out=process.env.UI_OUTPUT||path.resolve(__dirname,'../docs/board-ui-evidence/after');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:390,height:844},ignoreHTTPSErrors:true}),errors=[],hostingErrors=[],pictures=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()!=='error')return;if(m.location().url.startsWith('https://server.ethicalads.io/')&&m.text().includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'))hostingErrors.push(m.text());else errors.push(m.text());});
 p.on('response',r=>{if(r.url().includes('/board-ui-evidence/')&&r.url().endsWith('.png'))pictures.push({url:r.url(),status:r.status()});});
 await p.goto(url,{waitUntil:'domcontentloaded'});const open=p.getByText('Open the page',{exact:true});if(await open.count())await open.click();await p.locator('#screen').waitFor();
 for(const key of ['prep','board','title','map','difficulty','card-detail','unit-detail']){
  await p.selectOption('#screen',key);await p.waitForFunction(key=>['before','after'].every(side=>{const i=document.getElementById(side);return i.src.includes('/'+key+'-390x844.png')&&i.complete&&i.naturalWidth>0;}),key);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.evaluate(()=>{const s=document.getElementById('split');s.value=20;s.dispatchEvent(new Event('input'));});
 assert.ok(await p.evaluate(()=>Math.abs(document.querySelector('.divider').offsetLeft/document.getElementById('compare').clientWidth-.2)<.01),'slider changes the displayed split');
 await p.selectOption('#screen','prep');await p.setViewportSize({width:360,height:640});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 assert.ok(pictures.every(r=>r.status>=200&&r.status<400));assert.equal(new Set(pictures.filter(r=>r.status===200).map(r=>r.url)).size,14);
 fs.writeFileSync(path.join(out,'comparison-summary.json'),JSON.stringify({url,pictures,errors,hostingErrors},null,2)+'\n');console.log('PASS seven before/after image pairs, comparison slider, two mobile widths and comparison console errors 0');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
