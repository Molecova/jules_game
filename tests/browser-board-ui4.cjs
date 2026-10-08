// Real UI flow at three viewport sizes. Optional baseline serves an older commit
// through Playwright, without another checkout or changing workspace files.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const out=process.env.UI_OUTPUT||path.resolve(__dirname,'../docs/board-ui-evidence/after');fs.mkdirSync(out,{recursive:true});
const baseline=process.env.UI_BASELINE;
// The comparison page uses 390x844 references; current UI always checks all three.
const sizes=baseline?[[390,844]]:[[390,844],[360,640],[768,1024]];
const older=baseline?Object.fromEntries(['index.html','tabletop4.css','tabletop4.js','tabletop-materials4.js','tabletop-environment4.js'].map(f=>[f,execFileSync('git',['show',baseline+':v4/'+f],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'})])):null;
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const summary={baseline:baseline||null,sizes:[],errors:[]};
 try{
  for(const [width,height]of sizes){
   const p=await b.newPage({viewport:{width,height},deviceScaleFactor:2});
   p.on('pageerror',e=>summary.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')summary.errors.push(m.text());});
   await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
   if(older)await p.route('**/v4/**',r=>{const u=new URL(r.request().url()),f=u.pathname.endsWith('/v4/')?'index.html':u.pathname.split('/').pop();return older[f]!=null?r.fulfill({contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body:older[f]}):r.continue();});
   await p.goto('http://127.0.0.1:8001/v4/');await p.waitForFunction(()=>window.__g?.tabletop?.active);
   // This suite checks static UI and input, not animation frame rate. Limit only
   // its 3D redraws while taking snapshots on cloud software WebGL. The separate
   // tabletop/combat suite exercises the renderer without this override.
   await p.evaluate(()=>{const draw=__g.tabletop.render;let last=0;__g.tabletop.render=()=>{if(performance.now()-last<333)return;last=performance.now();draw();};});
   await p.evaluate(()=>{localStorage.clear();SFX.setMuted(true);const old=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{a[0]=123;crypto.getRandomValues=old;return a;};});
   const check=async selector=>{
    const d=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(d.overflow,false,selector+' horizontal overflow');assert.ok(d.top>=0&&d.bottom<=d.viewportHeight+1&&d.left>=0&&d.right<=d.viewportWidth+1,selector+' remains on screen');return d;
   };
   const shot=async name=>p.screenshot({path:path.join(out,`${name}-${width}x${height}.png`)});
   const title=await check('#newBtn');assert.ok(title.height>=40);await check('#codexBtn');await shot('title');
   await p.locator('#newBtn').click();await check('#sheetIn');await check('[data-go]');await shot('difficulty');
   // The menu accepts keyboard navigation, and its focused control stays visible.
   await p.locator('[data-go]').focus();assert.equal(await p.locator('[data-go]').evaluate(e=>e===document.activeElement),true);
   await p.locator('[data-go]').click();await check('#mapGo');await shot('map');
   await p.locator('.node.next').first().click({force:true});await p.locator('#mapGo').click();
   for(const cls of ['war','arc','mag']){const i=await p.evaluate(cls=>__g.R.shop.unit.findIndex(c=>c&&__g.def(c).cls===cls&&__g.def(c).t===1),cls);assert.ok(i>=0);await p.locator(`#scards [data-s="${i}"]`).click();await p.waitForTimeout(400);await check('#peek');await check('#peek [data-act="buy"]');if(cls==='war')await shot('card-detail');await p.locator('#peek [data-act="buy"]').click();}
   assert.equal(await p.evaluate(()=>__g.R.board.length),3);assert.equal(await p.evaluate(()=>__g.R.gold),3);
   const go=await check('#goBtn');assert.ok(go.height>=40);await p.waitForTimeout(700);await shot('prep');await p.locator('#boardwrap').screenshot({path:path.join(out,`board-${width}x${height}.png`)});
   const point=await p.evaluate(()=>{const u=__g.R.board[0],c=__g.grid.cells[__g.grid.idx(u.x,u.y)];return __g.tabletop.screen(c.x,c.y);});
   await p.mouse.click(point.x,point.y);await check('#usheet .tcard');await shot('unit-detail');await p.locator('#usheet .tc-x').click();
   for(const tab of ['skill','item','unit']){await p.locator(`[data-tab="${tab}"]`).click();assert.equal(await p.locator(`[data-tab="${tab}"]`).getAttribute('aria-selected'),'true');}
   await p.locator('#lockBtn').click();assert.equal(await p.locator('#lockBtn').evaluate(e=>e.classList.contains('on')),true);await p.locator('#lockBtn').click();
   await p.locator('#eLvBox').click();await check('#sheetIn');await shot('shop-odds');
   const d=await p.evaluate(()=>({titleColor:getComputedStyle(document.querySelector('.logo')).color,phoneBackground:getComputedStyle(document.getElementById('phone')).backgroundColor,diagnostics:__g.tabletop.diagnostics()}));
   await p.reload();await p.waitForFunction(()=>window.__g?.tabletop?.active);await check('#contBtn');await check('#newBtn');await check('#codexBtn');await shot('title-saved');
   summary.sizes.push({width,height,title,go,...d});console.log(`PASS UI flow ${width}x${height}, including saved-run title`);await p.close();
  }
  assert.deepEqual(summary.errors,[]);fs.writeFileSync(path.join(out,'ui-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(`PASS title, difficulty, map, card detail, legal purchases, shop tabs/lock/odds and keyboard focus at ${sizes.length} size(s); console errors 0`);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
