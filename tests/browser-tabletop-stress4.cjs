// Nine three-star allies + twelve foes: visual fixture only, not a legal run.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const out=process.env.TABLETOP_OUTPUT||path.resolve(__dirname,'../docs/tabletop-evidence/polished');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await p.goto(process.env.GAME_URL || 'http://127.0.0.1:8001/v4/');await p.waitForFunction(()=>window.__g?.tabletop?.active);
 await p.evaluate(()=>{localStorage.clear();SFX.setMuted(true);__g.newRun('normal');const n=__g.R.map.floors[0][0];n.k='fight';__g.enterNode(n);
 __g.R.board=[0,3,6,9,12,15,18,21,24].map((n,i)=>({kind:'unit',id:V4.UNITS[n].id,uid:'visual'+i,star:3,skills:[],item:null,x:i%5,y:3+Math.floor(i/5)}));
 const original=__g.R.enemies;__g.R.enemies=Array.from({length:12},(_,i)=>({...original[i%original.length],uid:'visual-foe'+i,cell:__g.grid.idx(i%5,Math.floor(i/5))}));__g.R.lv=9;__g.renderPlay();});
 const stats=[];
 for(let act=1;act<=5;act++){
  await p.evaluate(a=>{__g.R.act=a;__g.renderPlay();},act);await p.waitForTimeout(500);
  const d=await p.evaluate(()=>__g.tabletop.diagnostics());assert.equal(d.tokens,21);assert.ok(d.triangles<100000);assert.ok(d.drawCalls<150);assert.ok(d.textureBudgetMiB<=32,JSON.stringify(d));stats.push(d);
 }
 await p.screenshot({path:path.join(out,'normal-visual-stress-21-tokens.png')});
 const ids=await p.evaluate(()=>Object.keys(GD.MONSTERS)),cache=[];
 for(let start=0;start<ids.length;start+=12){
  await p.evaluate(({ids,start})=>{const original=__g.R.enemies[0];__g.R.enemies=ids.slice(start,start+12).map((id,i)=>({...original,id,uid:'cache'+i,cell:__g.grid.idx(i%5,Math.floor(i/5))}));__g.renderPlay();},{ids,start});
  await p.waitForTimeout(400);const d=await p.evaluate(()=>__g.tabletop.diagnostics());assert.ok(d.portraitMiB<=1.5);assert.ok(d.textureBudgetMiB<=32);cache.push(d);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'normal-stress-summary.json'),JSON.stringify({description:'Visual fixture only: 9 three-star allies + 12 foes',themes:stats,portraitCache:{enemyTypes:ids.length,samples:cache},errors},null,2)+'\n');
 console.log('PASS normal quality, 21-token visual fixture in all five themes, rendering budgets, console errors 0');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
