// Full catalog rendering, actual class battles, reduced motion and simulation/skip guards.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.VFX_OUTPUT||'/tmp/jules-vfx';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[],results={};p.on('pageerror',e=>errors.push(e.message));
await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await p.route('**/v4/game4.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'v4/game4.js'),'utf8').replace('  // 테스트·밸런스용 진입점','  window.__visualDebug={draw};\n  // 테스트·밸런스용 진입점')}));
try{
await p.goto('http://127.0.0.1:8000/concepts/v4-skill-effects.html');await p.evaluate(()=>SkillStudy.pause());
const ids=await p.evaluate(()=>SkillStudy.ids);assert.equal(ids.length,93);
for(const id of ids){await p.evaluate(id=>{SkillStudy.select(id);SkillStudy.seek(0.2);SkillStudy.seek(2.4);},id);}
await p.evaluate(()=>{SkillStudy.select('u_bishop');SkillStudy.seek(.23);});await p.screenshot({path:path.join(out,'catalog-mobile.png'),fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await p.setViewportSize({width:1180,height:920});await p.screenshot({path:path.join(out,'catalog-desktop.png'),fullPage:true});
await p.locator('[data-group="weapon"]').click();const weapons=await p.locator('#library [data-id]').evaluateAll(bs=>bs.map(b=>b.dataset.id));for(const id of weapons)await p.evaluate(id=>{SkillStudy.select(id);SkillStudy.seek(.12);},id);
await p.locator('[data-group="proc"]').click();const procs=await p.locator('#library [data-id]').evaluateAll(bs=>bs.map(b=>b.dataset.id));for(const id of procs)await p.evaluate(id=>{SkillStudy.select(id);SkillStudy.seek(.12);},id);
results.catalog={skills:ids.length,weapons:weapons.length,procs:procs.length};
await p.setViewportSize({width:390,height:844});
const loadouts={war:[['squire','cross','twinblades'],['blademaster','bladestorm','greatsword'],['warden','fortify','warhammer']],arc:[['crossbow','poisoncloud','venombow'],['scout','net','hornbow'],['hunter','stormeye','shortbow']],mag:[['bishop','meteor','stormstaff'],['archmage','polymorph','frostorb'],['warlock','silence','lifeorb']]};
for(const [cls,rows]of Object.entries(loadouts)){
await p.goto('http://127.0.0.1:8000/v4/');await p.evaluate(rows=>{
localStorage.clear();SFX.setMuted(true);__g.newRun('normal');__g.R.lv=9;__g.R.gold=60;__g.R.board=rows.map(([id,skill,item],i)=>({kind:'unit',id,uid:'vfx'+i,star:2,skills:[{kind:'skill',id:skill,uid:'chip'+i,star:2}],item:{kind:'item',id:item,uid:'weapon'+i,star:2},x:1+i,y:i===0?3:4}));const node=__g.R.map.floors[0][0];node.k='fight';__g.enterNode(node);__g.R.enemies=['goblin','bandit','skel','goblin','bandit'].map((id,i)=>({id,cell:__g.grid.idx(i,2),scale:1,uid:'foe'+i}));__g.renderPlay();
window.__emits=[];const create=VFX4.create;VFX4.create=options=>{const fx=create(options),emit=fx.emit;fx.emit=(id,data)=>{__emits.push({id,phase:data?.phase});return emit(id,data);};return fx;};__g.startCombat();const cb=__g.B.combat;
for(const u of cb.units){u.maxHp=u.hp=100000;if(u.side===0){u.hp=70000;if(u.chip)u.chip.t=0;}}
for(const u of cb.units.filter(u=>u.side===0&&!u.summon))cb.hooks.onCast(u,cb.alive(1)[0],cb);
cb.hooks.onTick(cb,.01);cb.floaters=[];document.getElementById('bstamp').className='bstamp';document.getElementById('toast').classList.remove('show');__g.B.phase='inspect';__g.B.vfx.skills.step(.16);__visualDebug.draw();
},rows);
await p.screenshot({path:path.join(out,`battle-${cls}.png`)});
results[cls]=await p.evaluate(()=>({emits:__emits,active:__g.B.vfx.skills.count,statuses:__g.B.combat.units.map(u=>Object.keys(u.st)),weapons:__g.B.combat.units.filter(u=>u.side===0&&!u.summon).map(u=>SHOTS4.profile(u).id)}));
assert.ok(results[cls].emits.some(e=>e.id.startsWith('u_')));assert.ok(results[cls].emits.some(e=>!e.id.startsWith('u_')&&!e.id.startsWith('p_')));assert.ok(results[cls].statuses.some(s=>s.length));assert.deepEqual(results[cls].weapons,rows.map(r=>r[2]));
await p.evaluate(()=>{__g.B.phase='combat';__g.B.combat.hooks.onTick(__g.B.combat,.18);__g.B.vfx.skills.step(.18);__g.B.combat.floaters=[];__g.B.phase='inspect';__visualDebug.draw();});await p.screenshot({path:path.join(out,`battle-${cls}-states.png`)});
await p.evaluate(()=>{const cb=__g.B.combat;for(const u of cb.alive(0).filter(u=>!u.summon))cb.attack(u,cb.alive(1)[1]);for(let i=0;i<4;i++){cb.step(1/60);__g.B.vfx.skills.step(1/60);}cb.floaters=[];__visualDebug.draw();});await p.screenshot({path:path.join(out,`battle-${cls}-weapons.png`)});
const sim=await p.evaluate(()=>{const before=__emits.length;__g.simFight();return{before,after:__emits.length};});assert.equal(sim.before,sim.after);
// Complete one actual battle per class through the production asynchronous skip path.
await p.evaluate(()=>{__g.startCombat();for(const u of __g.B.combat.units)if(u.side===0)u.maxHp=u.hp=100000;__g.skipCombat();window.skipEmits=__emits.length;});await p.locator('#resBtn').waitFor({state:'visible',timeout:30000});assert.equal(await p.evaluate(()=>__emits.length),await p.evaluate(()=>skipEmits));assert.equal(await p.evaluate(()=>__g.B.vfx.skills.count),0);results[cls].completed=true;
}
await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.evaluate(()=>{__g.newRun('normal');__g.R.board=[{kind:'unit',id:'squire',uid:'reduced',star:2,skills:[{kind:'skill',id:'cross',uid:'cross',star:1}],item:null,x:2,y:3}];const n=__g.R.map.floors[0][0];n.k='fight';__g.enterNode(n);__g.renderPlay();__g.startCombat();__g.B.combat.hooks.onCast(__g.B.combat.units[0],__g.B.combat.alive(1)[0],__g.B.combat);});assert.equal(await p.evaluate(()=>__g.B.vfx.skills.count),0);
// Render-only workload at the full 48-effect cap. Timing is headless desktop evidence, not phone certification.
results.render=await p.evaluate(()=>{const cv=document.createElement('canvas');cv.width=880;cv.height=880;const c=cv.getContext('2d');c.scale(2,2);const fx=VFX4.create(),ids=Object.keys(VFX4.profiles).filter(id=>!id.startsWith('p_')),source={x:220,y:300},target={x:220,y:120},cells=Array.from({length:9},(_,i)=>({x:162+(i%3)*58,y:62+Math.floor(i/3)*58}));for(let i=0;i<48;i++)fx.emit(ids[i%ids.length],{source,target,cells,points:cells,star:3});fx.step(.2);const times=[];for(let i=0;i<60;i++){const t=performance.now();c.clearRect(0,0,440,440);fx.draw(c,'under');fx.draw(c,'over');times.push(performance.now()-t);}times.sort((a,b)=>a-b);return{effects:fx.count,medianMs:times[30],p95Ms:times[57],maxMs:times[59]};});
assert.equal(results.render.effects,48);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({catalog:results.catalog,classes:3,reduceMotion:true,simSkipSuppressed:true,render:results.render,errors}));
}catch(e){await p.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
