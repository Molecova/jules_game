const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function world(){const c={};c.window=c;vm.createContext(c);vm.runInContext('let seed=123; Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)',c);for(const f of ['shared/engine.js','game/data.js','v4/data4.js','v4/enemies4.js','v4/encounters4.js','v4/enemy-combat4.js','v4/projectiles4.js','v4/battle4.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);return c;}
function fixture(id){const c=world(),grid=c.AC.squareGrid(5,6,64),r={relics:[],act:c.GD.MONSTERS[id].act,round:1,diff:'normal'},fx={play(){},burst(){},death(){},shake(){}},api=c.BT4.create({grid,PLAYER_ROW:3,COLS:5,ROWS:6,getR:()=>r,fx});
 const ally=(id,col,row)=>api.makeAlly({id,uid:id,star:1,skills:[],item:null},grid.idx(col,row),{ttiers:{}});
 const foe=(id,col,row)=>api.makeFoe({uid:id,def:c.GD.MONSTERS[id],cell:grid.idx(col,row),scale:1});
 const u=foe(id,2,2),pal=foe('goblin',1,2),a=ally('squire',2,3),b=ally('archer',3,4);for(const v of [u,pal,a,b])v.hp=v.maxHp=100000;
 const h=api.hooks(),cb=new c.AC.Combat(grid,[u,pal,a,b],{hooks:h,maxTime:40});return{c,grid,api,u,pal,a,b,h,cb,tick(dt){cb.t+=dt;h.onTick(cb,dt);}};
}
test('60 normal enemies, 30 abilities and 18 individual projectile profiles',()=>{const c=world();assert.equal(c.ENEMIES4.added.length,20);assert.equal(c.ENEMIES4.reworked.length,10);assert.equal(Object.keys(c.ENEMIES4.abilities).length,30);assert.equal(Object.keys(c.SHOTS4.profiles).length,18);for(let a=1;a<=5;a++)assert.equal(c.GD.ACTS[a].normal.length,12);});
test('5,000 seeded acts: unique encounters, legal cells, budget, persistence and complete coverage',()=>{
 const c=world(),grid=c.AC.squareGrid(5,6,64),coverage=new Set();
 for(let act=1;act<=5;act++)for(let seed=0;seed<1000;seed++){
  let r={act,round:0,board:[],map:{boss:c.GD.ACTS[act].bosses[seed%2]},encounters:{version:1,seed,used:{},history:[],nodes:{}}};const ids=new Set();
  for(let f=0;f<5;f++){
   r.round=(act-1)*6+f+1;r.node={id:act+'-'+f};const a=c.ENCOUNTERS4.generate(r,'fight',grid);coverage.add(r.encounter.id);assert.ok(!ids.has(r.encounter.id));ids.add(r.encounter.id);assert.ok(a.length>0&&a.length<=9);assert.ok(a.some(x=>x.id===r.encounter.core));assert.equal(new Set(a.map(x=>x.cell)).size,a.length);assert.ok(a.every(x=>x.cell>=0&&x.cell<15));assert.ok(a.reduce((v,x)=>v+c.GD.MONSTERS[x.id].v,0)<=2.2+.4*r.round+.50001);
   const before=JSON.stringify(a);r=JSON.parse(JSON.stringify(r));assert.equal(JSON.stringify(c.ENCOUNTERS4.generate(r,'fight',grid)),before);
  }
  for(const kind of ['elite','boss']){r.node={id:act+'-'+kind};const a=c.ENCOUNTERS4.generate(r,kind,grid);assert.ok(a.length>0);assert.equal(new Set(a.map(x=>x.cell)).size,a.length);assert.ok(a.every(x=>c.GD.MONSTERS[x.id]));}
 }
 assert.equal(coverage.size,30);
});
for(const id of ['woodguard','gobdrummer','thornroot','acornlobber','boneguard','bellkeeper','coffinbearer','chainwraith','powderimp','obsidian','lavaborer','flamerider','iceguard','frostdrummer','snowleopard','crystalmage','abyssbanner','mirrordemon','contractpriest','executioner','shroom','wolf','necro','wraith','whelp','magmagolem','frostwolf','snowarcher','shade','darkpriest'])test(id+' survives 20 seconds with finite state and valid occupancy',()=>{
 const f=fixture(id);for(let i=0;i<1200&&!f.cb.done;i++)f.cb.step(1/60);for(const u of f.cb.units){assert.ok(Number.isFinite(u.hp));assert.ok(Number.isFinite(u.px));if(!u.dead)assert.equal(f.cb.occ[u.cell],u);}assert.ok(f.cb.units.length<=7);if(!f.u.enemy.a.passive)assert.ok(f.u.enemy.uses>0);});
test('interrupt cancels a marked strike; thrown bomb survives caster death',()=>{
 const f=fixture('executioner');f.u.enemy.next=0;f.tick(.01);assert.ok(f.u.enemy.cast);f.u.stun=1;const hp=f.a.hp;f.tick(.1);assert.equal(f.u.enemy.cast,null);f.u.stun=0;f.tick(2.1);assert.equal(f.a.hp,hp);
 const b=fixture('powderimp');b.u.enemy.next=0;b.tick(.01);assert.equal(b.cb.enemyPending.length,1);b.cb.kill(b.u,b.a);const before=b.a.hp;b.tick(1.6);assert.ok(b.a.hp<before);assert.equal(b.cb.enemyPending.length,0);
});
test('summon caps, ownership and no-reward metadata survive repeated cooldowns',()=>{
 const f=fixture('necro');for(let i=0;i<8;i++){f.u.enemy.next=0;f.tick(.01);f.tick(2.1);}const units=f.cb.units.filter(v=>v.enemyOwner===f.u);assert.equal(units.length,2);assert.ok(units.every(v=>v.noReward&&!v.enemy&&!v.ability));f.cb.kill(units[0],f.a);f.u.enemy.next=0;f.tick(.01);f.tick(2.1);assert.equal(f.u.enemy.spawned,3);
});
test('contract transfers once and breaks on owner death',()=>{
 const f=fixture('contractpriest');f.u.enemy.next=0;f.tick(.01);f.tick(2.1);assert.equal(f.pal.enemyContract.owner,f.u);const before=f.u.hp;f.cb.damage(f.a,f.pal,100,'spell');assert.ok(f.u.hp<before);f.cb.kill(f.u,f.a);assert.equal(f.h.dmgTakenMod(f.pal,f.cb,f.a,'spell'),1);
});
test('pull and leap preserve one entity per cell',()=>{for(const id of ['chainwraith','snowleopard']){const f=fixture(id);f.u.enemy.next=0;f.tick(.01);f.tick(1.2);const living=f.cb.alive();assert.equal(new Set(living.map(u=>u.cell)).size,living.length);for(const u of living)assert.equal(f.cb.occ[u.cell],u);}});
test('projectile rendering and impact profiles do not consume random numbers or alter damage',()=>{
 const f=fixture('gobdrummer');const c=f.c;vm.runInContext('Math.random=()=>{throw new Error("visual RNG")}',c);const ctx=new Proxy({}, {get:(o,k)=>k==='save'||k==='restore'?()=>{}:()=>{},set:()=>true});
 for(const d of c.V4.UNITS.filter(d=>d.cls!=='war')){const u={artId:d.id,cls:d.cls,range:3};c.SHOTS4.draw(ctx,{src:u,x:50,y:50,tgt:{px:100,py:100}},2);const hp=f.a.hp;c.SHOTS4.impact(f.cb,u,f.a);c.SHOTS4.drawImpacts(ctx,f.cb);assert.equal(f.a.hp,hp);}
});
test('last enemy death explosion resolves before victory',()=>{const f=fixture('magmagolem');f.cb.kill(f.pal,f.a);f.cb.kill(f.u,f.a);const hp=f.a.hp;f.cb.step(.1);assert.equal(f.cb.done,false);for(let i=0;i<100&&!f.cb.done;i++)f.cb.step(1/60);assert.ok(f.cb.done);assert.ok(f.a.hp<hp);assert.equal(f.cb.winner,0);});
