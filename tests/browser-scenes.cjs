const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.BUGFIX_OUTPUT||'/tmp/jules-bugfixes','scenes');fs.mkdirSync(out,{recursive:true});
const names=['야영지','대장간','훈련장','훈련 교관','폐허의 서고','좀도둑','용병 길드 게시판','쓰러진 기사','신비한 샘','수상한 제단','버려진 무기고','떠돌이 상인','도박꾼','길 잃은 용병','보물','암시장'];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const report=[];
for(const [width,height,dpr]of [[390,844,2],[360,640,3]]){
 const context=await b.newContext({viewport:{width,height},deviceScaleFactor:dpr});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Existing game fonts are unrelated to scene rendering; serve an empty stylesheet for deterministic offline capture.
 await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await p.route('**/v4/game4.js',r=>{let source=fs.readFileSync(path.join(root,'v4/game4.js'),'utf8');source=source.replace('  // 테스트·밸런스용 진입점', '  window.__sceneTest={choice,relicPick,EVENTS,openCamp,openForge,openTreasure,closeSheet};\n  // 테스트·밸런스용 진입점');return r.fulfill({status:200,contentType:'application/javascript',body:source});});
 await p.goto('http://127.0.0.1:8000/v4/index.html');await p.evaluate(()=>{__g.newRun('normal');__g.enterNode(__g.R.map.floors[0][0]);__g.R.gold=30;__g.R.bench[0]={kind:'item',id:V4.ITEMS[0].id,uid:'scene-item-1',star:1};__g.R.bench[1]={kind:'item',id:V4.ITEMS[1].id,uid:'scene-item-2',star:1};});
 for(const [i,name]of names.entries()){
  await p.evaluate(name=>{const s=__sceneTest;s.closeSheet();__g.R.pending=null;document.getElementById('toast').classList.remove('show');
   if(name==='야영지')s.openCamp();else if(name==='대장간')s.openForge();else if(name==='보물')s.openTreasure();
   else if(name==='암시장')__g.enterNode({id:'scene-shop',k:'shop',f:2});
   else{let found=false;for(const event of s.EVENTS){event();if(document.querySelector('#sheetIn .eyebrow').textContent===name){found=true;break;}}if(!found)throw Error('missing '+name);}
  },name);
  const result=await p.evaluate(({dpr,name})=>{const s=document.getElementById('sheetIn'),can=s.querySelector('canvas.scene'),b=s.getBoundingClientRect(),r=can?.getBoundingClientRect();return{name,canvasCount:s.querySelectorAll('canvas.scene').length,first:s.firstElementChild===can,width:can?.width,height:can?.height,top:b.top,bottom:b.bottom,left:b.left,right:b.right,scroll:s.scrollHeight,client:s.clientHeight,canvasHeight:r?.height,canvasWidth:r?.width,buttons:[...s.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}),docWidth:document.documentElement.scrollWidth,viewWidth:innerWidth,viewHeight:innerHeight};},{dpr,name});
  assert.equal(result.canvasCount,1);assert.ok(result.first);assert.equal(result.width,320*dpr);assert.equal(result.height,140*dpr);assert.ok(result.top>=-1&&result.bottom<=height+1);assert.ok(result.left>=-1&&result.right<=width+1);assert.ok(result.docWidth<=width);assert.ok(result.scroll<=result.client+1,'sheet should fit without scrolling: '+JSON.stringify(result));assert.ok(result.buttons.every((b,i,a)=>b.bottom<=height+1&&(!i||b.top>=a[i-1].bottom)),'choices must be visible without overlap');
  await p.screenshot({animations:'disabled',path:path.join(out,`${String(i+1).padStart(2,'0')}-${name}-${width}x${height}.png`)});report.push({...result,viewport:`${width}x${height}`,dpr});
 }
 assert.equal(await p.evaluate(()=>__g.R.freeRolls),0);await p.locator('[data-o]').last().click();assert.equal(await p.locator('#sheet').isVisible(),false);assert.equal(await p.evaluate(()=>__g.R.freeRolls),0);
 // Unknown scenes are omitted; relic selection and choice callbacks remain functional.
 await p.evaluate(()=>__sceneTest.choice('없는 장면','그림 없이 선택',[{label:'확인',go(){window.__choiceDone=true;}}]));assert.equal(await p.locator('#sheetIn canvas').count(),0);await p.locator('[data-o]').click();assert.ok(await p.evaluate(()=>window.__choiceDone));
 await p.evaluate(()=>__sceneTest.relicPick('보스 전리품'));assert.equal(await p.locator('#sheetIn canvas').count(),0);await p.locator('[data-r]').first().click();assert.equal(await p.evaluate(()=>__g.R.pending),null);
 assert.deepEqual(errors,[]);report.push({viewport:`${width}x${height}`,errors});await context.close();
}
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));await b.close();console.log('PASS 16 scenes × 2 viewports, DPR 2/3, all sheets fit without scroll, unknown scenes omitted, callbacks preserved, console errors 0.');})().catch(e=>{console.error(e);process.exit(1)});
