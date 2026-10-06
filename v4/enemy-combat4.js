/* Enemy abilities share the combat clock, occupancy and damage pipeline. */
(function(g){
 'use strict';
 const defs=g.ENEMIES4.abilities;
 function wrap(h,env){
  const {grid,makeFoe}=env;
  const prev={...h}, alive=(cb,side)=>cb.alive(side).filter(x=>!x.object);
  const near=(cb,u,side)=>alive(cb,side).sort((a,b)=>grid.dist(u.cell,a.cell)-grid.dist(u.cell,b.cell)||a.id-b.id);
  const around=(cell,r=1)=>grid.cells.filter(c=>grid.dist(cell,c.i)<=r).map(c=>c.i);
  function line(u,t,n=5){const a=grid.cells[u.cell],b=grid.cells[t.cell],dx=Math.sign(b.c-a.c),dy=Math.sign(b.r-a.r);return Array.from({length:n},(_,i)=>grid.idx(a.c+dx*(i+1),a.r+dy*(i+1))).filter(i=>i>=0);}
  function cross(t){const c=grid.cells[t.cell];return [[0,0],[0,1],[0,-1],[1,0],[-1,0]].map(([x,y])=>grid.idx(c.c+x,c.r+y)).filter(i=>i>=0);}
  function initialize(u,i=0){const a=defs[u.def.enemyAbility];if(!a||u.enemy)return;u.enemy={a,next:(a.first||2.6)+i*.43,uses:0,spawned:0,ready:0};}
  function cancel(u){if(u.enemy?.cast){u.immobile=u.enemy.cast.immobile;u.enemy.cast=null;}}
  function cue(cb,u,a,cells,target){const c={u,a,cells,target,at:cb.t,end:cb.t+a.wind,immobile:u.immobile};u.enemy.cast=c;if(['channel','snipe'].includes(a.action))u.immobile=true;cb.float(u.px,u.py-40,a.name,a.color,true);return c;}
  function hit(cb,u,v,m=1){if(!v||v.dead)return;cb.damage(u,v,u.atk*m,'spell');}
  function shield(cb,u,v){if(!v)return;const n=Math.min(v.maxHp*.18,Math.max(0,v.maxHp*.5-v.shield));v.shield+=n;cb.ring(v.px,v.py,'#91d4e8',26,.6);}
  function debuff(v,key,time,u){if(v.dead)return;if(key==='poison')v.st.poison={t:3,dps:u.atk*.12,stacks:1,src:u};else v.st[key]=Math.max(v.st[key]||0,time);}
  function spawn(cb,u,a){
   const e=u.enemy,owned=cb.alive(u.side).filter(x=>x.enemyOwner===u),count=Math.min(a.count||1,a.max-owned.length,a.total-e.spawned,12-cb.alive(u.side).length);
   for(let i=0;i<count;i++){
    const cell=grid.cells.filter(c=>!cb.occ[c.i]&&grid.dist(u.cell,c.i)<=2).sort((a,b)=>grid.dist(u.cell,a.i)-grid.dist(u.cell,b.i)||a.i-b.i)[0]?.i;
    if(cell===undefined)break;
    const def={...g.GD.MONSTERS[a.spawn],skills:[],enemyAbility:null,proc:null},v=makeFoe({def,cell,scale:.45,uid:'summon-'+u.id+'-'+e.spawned,rot:0});
    v.enemyOwner=u;v.summon=true;v.noReward=true;v.ability=null;v.skills=[];
    if(cb.spawn(v)){e.spawned++;cb.ring(v.px,v.py,a.color,25,.5);}
   }
  }
  function resolve(cb,c){
   const {u,a,target:t,cells}=c,e=u.enemy;const friends=near(cb,u,u.side).filter(v=>v!==u),local=friends.filter(v=>grid.dist(u.cell,v.cell)<=2);
   const targets=cells.map(i=>cb.occ[i]).filter(v=>v&&!v.dead&&v.side!==u.side);
   cb.fx.push({kind:'enemyPulse',cells,color:a.color,t:0,life:.45});
   switch(a.action){
    case 'guard':for(const v of [u,...local.slice(0,1)]){v.enemyGuard=cb.t+3;cb.ring(v.px,v.py,a.color,26,.5);}break;
    case 'shield':for(const v of (u.def.id==='iceguard'?[u,...local.slice(0,1)]:local.slice(0,1)))shield(cb,u,v);break;
    case 'haste':for(const v of local.slice(0,3)){v.enemyHaste=cb.t+4;cb.ring(v.px,v.py,a.color,25,.4);}break;
    case 'heal':for(const v of friends.filter(v=>v.hp<v.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,2)){cb.heal(v,Math.min(v.maxHp*.14,u.atk*2.5),u);cb.beam(u.px,u.py,v.px,v.py,a.color,.5);}break;
    case 'summon':spawn(cb,u,a);break;
    case 'pull':if(t&&!t.dead&&cb.t>=(t.enemyPullUntil||0)){
     const to=grid.neighbors[t.cell].filter(i=>!cb.occ[i]&&grid.dist(u.cell,i)<grid.dist(u.cell,t.cell)).sort((a,b)=>grid.dist(u.cell,a)-grid.dist(u.cell,b))[0];
     if(to!==undefined){cb.teleport(t,to);t.enemyPullUntil=cb.t+4;}cb.beam(u.px,u.py,t.px,t.py,a.color,.5);hit(cb,u,t,.65);
    }break;
    case 'cycle':u.enemyArmor=cb.t+4;u.enemyOpen=cb.t+7;break;
    case 'phase':u.enemyPhase=cb.t+2;break;
    case 'dash':case 'leap':if(t&&!t.dead){
     const cell=grid.neighbors[t.cell].filter(i=>!cb.occ[i]).sort((a,b)=>grid.dist(u.cell,a)-grid.dist(u.cell,b))[0];
     if(cell!==undefined){cb.beam(u.px,u.py,grid.cells[cell].x,grid.cells[cell].y,a.color,.5);if(a.action==='dash')for(const v of targets)hit(cb,u,v,.6);cb.teleport(u,cell);u.target=t;}
    }break;
    case 'frostbuff':for(const v of local.slice(0,3)){v.enemyFrost=cb.t+6;cb.ring(v.px,v.py,a.color,23,.4);}break;
    case 'echo':u.enemyEcho=cb.t+5;break;
    case 'contract':if(friends[0]){friends[0].enemyContract={owner:u,end:cb.t+4};cb.beam(u.px,u.py,friends[0].px,friends[0].py,a.color,.6);}break;
    case 'execute':if(t&&!t.dead){hit(cb,u,t,2.4);cb.ring(t.px,t.py,a.color,30,.6);}break;
    case 'channel':e.channel={end:cb.t+3,next:cb.t,target:friends.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]};u.immobile=true;break;
    default:for(const v of targets){hit(cb,u,v,a.action==='snipe'?2:1.4);if(['line','cross'].includes(a.action)&&u.def.act===4||a.action==='line'&&u.def.id==='thornroot')debuff(v,'slow',2,u);if(a.action==='poison')debuff(v,'poison',3,u);if(a.action==='cone')v.st.burn={t:3,dps:u.atk*.12,src:u};}break;
   }
  }
  h.onStart=cb=>{prev.onStart?.(cb);cb.enemyPending=[];cb.enemySummons=0;cb.units.forEach((u,i)=>{if(u.side===1){initialize(u,i);if(u.enemy?.a.action==='leap')u.enemy.leapTarget=near(cb,u,0).at(-1);}});};
  h.preAttack=(u,t,cb)=>{if(u.enemy?.cast||u.enemy?.channel)return true;return prev.preAttack?.(u,t,cb)||false;};
  h.asMod=(u,cb)=>(prev.asMod?.(u,cb)||1)*(u.enemyHaste>cb.t?1.25:1);
  h.dmgTakenMod=(u,cb,src,kind)=>{
   let m=prev.dmgTakenMod?.(u,cb,src,kind)??1;
   if(u.enemyGuard>cb.t)m*=.75;if(u.enemyArmor>cb.t)m*=.65;else if(u.enemyOpen>cb.t)m*=1.2;
   const c=u.enemyContract;if(kind!=='enemyTransfer'&&c&&c.end>cb.t&&!c.owner.dead)m*=.75;
   return m;
  };
  h.onAttack=(u,t,cb)=>{
   prev.onAttack?.(u,t,cb);
   if(u.enemyEcho>cb.t){u.enemyEcho=0;cb.projectiles.push({x:u.px,y:u.py,src:u,tgt:t,dmg:u.atk*.4,crit:false,kind:'enemyEcho',speed:450,color:'#d4b4f5'});}
  };
  h.onHit=(t,dmg,src,kind,crit,cb)=>{
   prev.onHit?.(t,dmg,src,kind,crit,cb);
   const c=t.enemyContract;if(dmg>0&&kind!=='enemyTransfer'&&c&&c.end>cb.t&&!c.owner.dead)cb.damage(src,c.owner,dmg/3,'enemyTransfer');
   if(kind!=='atk'||!src||src.dead)return;
   if(src.enemyFrost>cb.t){src.enemyFrost=0;debuff(t,'slow',2,src);}
   const e=src.enemy;if(!e||e.ready>cb.t||t.dead)return;
   if(e.a.action==='pack'&&near(cb,src,src.side).some(v=>v!==src&&v.def.id==='wolf'&&grid.dist(v.cell,t.cell)<=1)) {e.ready=cb.t+4;cb.damage(src,t,src.atk*.4,'enemyBonus');}
   if(e.a.action==='hunt'&&t.st.slow>0){e.ready=cb.t+4;cb.damage(src,t,src.atk*.5,'enemyBonus');}
  };
  h.onTick=(cb,dt)=>{
   prev.onTick?.(cb,dt);
   for(const u of cb.units){
    if(u.dead)continue;if(u.side===1)initialize(u);const e=u.enemy;if(!e)continue;
    if(e.a.action==='phase')u.dodge=u.enemyPhase>cb.t?.55:0;
    if(e.channel){const ch=e.channel;if(u.stun>0||cb.t>=ch.end||!ch.target||ch.target.dead){e.channel=null;u.immobile=!!u.def.immobile;}else if(cb.t>=ch.next){ch.next+=.5;cb.heal(ch.target,Math.min(ch.target.maxHp*.025,u.atk*.6),u);cb.beam(u.px,u.py,ch.target.px,ch.target.py,e.a.color,.4);}continue;}
    if(e.cast){if(u.stun>0){cancel(u);e.next=e.a.cd;continue;}if(cb.t>=e.cast.end){const c=e.cast;cancel(u);resolve(cb,c);}continue;}
    if(e.a.passive||e.a.once&&e.uses||u.stun>0||u.st?.silence>0)continue;
    e.next-=dt;if(e.next>0)continue;
    let t=near(cb,u,1-u.side)[0];if(!t)continue;
    if(e.a.action==='execute')t=alive(cb,1-u.side).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(e.a.action==='leap')t=e.leapTarget&&!e.leapTarget.dead?e.leapTarget:near(cb,u,1-u.side).at(-1);
    let cells=[t.cell];
    if(['line','snipe','dash'].includes(e.a.action))cells=line(u,t,e.a.action==='snipe'?6:3);
    if(['blast','bomb','poison'].includes(e.a.action))cells=around(t.cell);
    if(e.a.action==='cross')cells=cross(t);
    if(e.a.action==='cone'){const a=grid.cells[u.cell],b=grid.cells[t.cell],dx=Math.sign(b.c-a.c),dy=Math.sign(b.r-a.r);cells=[-1,0,1].map(s=>grid.idx(a.c+dx-s*dy,a.r+dy+s*dx)).filter(i=>i>=0);}
    if(['guard','shield','haste','heal','summon','cycle','phase','frostbuff','contract','channel','echo'].includes(e.a.action))cells=around(u.cell,1);
    e.next=e.a.cd;e.uses++;const c=cue(cb,u,e.a,cells,t);
    if(e.a.action==='bomb'){e.cast=null;cb.enemyPending.push(c);} // thrown bombs survive the caster
   }
   for(const c of cb.enemyPending||[])if(!c.done&&cb.t>=c.end){c.done=true;if(c.a.action==='deathblast'){for(const i of c.cells){const v=cb.occ[i];if(v&&!v.dead&&v.side!==c.u.side)hit(cb,c.u,v,1.5);}cb.fx.push({kind:'enemyPulse',cells:c.cells,color:c.a.color,t:0,life:.5});}else resolve(cb,c);}
   cb.enemyPending=(cb.enemyPending||[]).filter(c=>!c.done);
  };
  h.hasPendingThreats=cb=>(cb.enemyPending||[]).some(c=>!c.done);
  h.onDeath=(u,src,cb)=>{
   cancel(u);if(u.enemy)u.enemy.channel=null;
   if(u.enemy?.a.action==='deathblast'&&!cb.enemyEnding)cb.enemyPending.push({u,a:u.enemy.a,cells:around(u.cell),at:cb.t,end:cb.t+1.5});
   if(u.boss)cb.enemyEnding=true;
   // Summoned enemies do not produce bounty/kill-heal farming.
   prev.onDeath?.(u,u.noReward?null:src,cb);
   if(u.boss){cb.enemyPending=[];cb.enemyEnding=false;}
  };
  return h;
 }
 function draw(ctx,cb,grid,layer){
  const casts=[...(cb.enemyPending||[]),...cb.units.filter(u=>!u.dead&&u.enemy?.cast).map(u=>u.enemy.cast)];
  ctx.save();ctx.lineWidth=2;
  if(layer==='under'){
   for(const c of casts){const p=Math.min(1,(cb.t-c.at)/Math.max(.01,c.end-c.at));for(const i of c.cells){const q=grid.cells[i];if(!q)continue;const s=grid.size*.43;ctx.fillStyle=c.a.color+'35';ctx.fillRect(q.x-s,q.y-s,s*2,s*2);ctx.strokeStyle=c.a.color;ctx.setLineDash([5,3]);ctx.strokeRect(q.x-s,q.y-s,s*2,s*2);ctx.setLineDash([]);ctx.beginPath();ctx.arc(q.x,q.y,s*.65,-Math.PI/2,-Math.PI/2+p*Math.PI*2);ctx.stroke();}}
   for(const f of cb.fx)if(f.kind==='enemyPulse'){ctx.globalAlpha=1-f.t/f.life;ctx.strokeStyle=f.color;for(const i of f.cells){const q=grid.cells[i];ctx.beginPath();ctx.arc(q.x,q.y,8+28*f.t/f.life,0,7);ctx.stroke();}ctx.globalAlpha=1;}
  }else{
   for(const u of cb.units){const c=u.enemyContract;if(!u.dead&&c&&c.end>cb.t&&!c.owner.dead){ctx.strokeStyle='#b768db';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(u.px,u.py);ctx.lineTo(c.owner.px,c.owner.py);ctx.stroke();ctx.setLineDash([]);}}
   for(const c of casts)if(['execute','leap','pull'].includes(c.a.action)&&c.target&&!c.target.dead){const t=c.target;ctx.strokeStyle=c.a.color;ctx.beginPath();ctx.arc(t.px,t.py,30,0,7);ctx.moveTo(t.px-9,t.py-39);ctx.lineTo(t.px,t.py-31);ctx.lineTo(t.px+9,t.py-39);ctx.stroke();}
  }ctx.restore();
 }
 function preview(ctx,grid,enemies,board,selected){
  if(!board.length)return;
  const foes=enemies.map(e=>({...e,def:g.GD.MONSTERS[e.id]})),allies=board.map(u=>({...u,cell:grid.idx(u.x,u.y)}));
  ctx.save();ctx.lineWidth=2;ctx.setLineDash([4,4]);
  for(const u of foes){const a=defs[u.def.enemyAbility];if(!a||(!selected||u.uid!==selected.uid)&&a.action!=='leap')continue;
   const sorted=allies.slice().sort((x,y)=>grid.dist(u.cell,x.cell)-grid.dist(u.cell,y.cell));
   const t=a.action==='leap'?sorted.at(-1):sorted[0],start=grid.cells[u.cell],end=grid.cells[t.cell];
   let cells=[t.cell];
   if(['line','snipe','dash'].includes(a.action)){const dx=Math.sign(end.c-start.c),dy=Math.sign(end.r-start.r);cells=Array.from({length:a.action==='snipe'?6:3},(_,i)=>grid.idx(start.c+dx*(i+1),start.r+dy*(i+1))).filter(i=>i>=0);}
   if(['blast','bomb','poison'].includes(a.action))cells=grid.cells.filter(c=>grid.dist(t.cell,c.i)<=1).map(c=>c.i);
   if(a.action==='cross')cells=[[0,0],[0,1],[0,-1],[1,0],[-1,0]].map(([x,y])=>grid.idx(end.c+x,end.r+y)).filter(i=>i>=0);
   if(a.action==='cone'){const dx=Math.sign(end.c-start.c),dy=Math.sign(end.r-start.r);cells=[-1,0,1].map(s=>grid.idx(start.c+dx-s*dy,start.r+dy+s*dx)).filter(i=>i>=0);}
   if(['guard','shield','haste','heal','summon','cycle','phase','frostbuff','contract','channel','echo','deathblast'].includes(a.action))cells=grid.cells.filter(c=>grid.dist(u.cell,c.i)<=1).map(c=>c.i);
   ctx.strokeStyle=a.color;ctx.fillStyle=a.color+'28';const size=grid.size*.42;
   for(const i of cells){const c=grid.cells[i];ctx.fillRect(c.x-size,c.y-size,size*2,size*2);ctx.strokeRect(c.x-size,c.y-size,size*2,size*2);}
   if(a.action==='leap'){ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
  }ctx.restore();
 }
 g.ENEMYCOMBAT4={wrap,draw,preview};
})(window);
