const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..'), plain = x => JSON.parse(JSON.stringify(x));
const FILES = ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/projectiles4.js', 'v4/battle4.js', 'v4/vfx4.js'];
function world() {
  const c = { randomCalls: 0 }; c.window = c; vm.createContext(c);
  vm.runInContext('let seed=12345; Math.random=()=>{randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};', c);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c);
  return c;
}
const catalog = world();
const DEFS = plain([...catalog.V4.SKILLS, ...catalog.V4.UNITS.flatMap(u => u.ult ? [u.ult] : []), ...catalog.V4.ITEMS.flatMap(i => i.act ? [i.act] : [])]);
const IDS = [...DEFS.map(d => d.id), 'revive'];
function fixture(id, star, enabled, itemId) {
  const c = world(), grid = c.AC.squareGrid(5, 6, 64, { ox: 20, oy: 20 });
  const effects = c.VFX4.create(), events = [], procs = [], attacks = [];
  const fx = { play() {}, burst() {}, death() {}, shake() {} };
  if (enabled) {
    fx.skill = (id, data) => { events.push({ id, data: plain(data) }); effects.emit(id, data); };
    fx.proc = (id, data) => { procs.push({ id, data: plain(data) }); effects.emit('p_' + id, data); };
    fx.attack = data => { attacks.push(plain(data)); effects.emit('weapon', data); };
  }
  const api = c.BT4.create({ grid, PLAYER_ROW: 3, COLS: 5, ROWS: 6, getR: () => ({ relics: id === 'revive' ? ['lantern'] : [], round: 1, act: 1, diff: 'normal' }), fx });
  const d = [...c.V4.SKILLS, ...c.V4.UNITS.flatMap(u => u.ult ? [u.ult] : []), ...c.V4.ITEMS.flatMap(i => i.act ? [i.act] : [])].find(d => d.id === id);
  const unitId = id?.startsWith('u_') ? id.slice(2) : ({ war: 'squire', arc: 'archer', mag: 'apprentice', any: 'squire' })[d?.cls || c.V4.DEF['item:' + itemId]?.cls || 'war'];
  const ally = (id, col, row, skills = [], item = null) => api.makeAlly({ kind: 'unit', id, uid: `${col}-${row}`, star: 1, skills, item, rot: 0 }, grid.idx(col, row), { ttiers: {} });
  const caster = ally(unitId, 2, 3, id === 'vampire' ? [{ id, star }] : [], itemId ? { id: itemId, star: 1 } : null);
  const allies = [caster, ally('squire', 1, 4), ally('archer', 3, 4), ally('apprentice', 0, 4)];
  const foes = [[2,2],[2,1],[1,2],[3,2],[1,1],[3,1]].map(([col,row], i) => { const u = api.makeFoe({ uid: 'foe'+i, def: c.GD.MONSTERS.goblin, cell: grid.idx(col,row), scale: 1, rot: 0 }); u.hp = u.maxHp = 100000; return u; });
  const hooks = api.hooks(), cb = new c.AC.Combat(grid, [...allies, ...foes], { hooks });
  for (const u of allies) { u.hp *= 0.45; u.chip = null; u.act = null; }
  // Different ally ratios exercise lowest/highest selection, not just the input target.
  allies[1].hp = allies[1].maxHp * .2; allies[2].hp = allies[2].maxHp * .85;
  if (id === 'revive') { allies[1].card.star=star; cb.kill(allies[1],null); }
  if (d?.kind === 'ult') caster.card.star = star;
  if (d?.effect === 'passive') hooks.onHit(foes[0], 50, caster, 'atk', false, cb);
  else if (d) { caster.skills = [{ def: d, star: d.kind === 'ult' ? 1 : star, cells: c.BT4.expandCells(d, star) }]; caster.castIdx = 0; hooks.onCast(caster, foes[0], cb); }
  return { c, cb, grid, api, hooks, caster, allies, foes, events, procs, attacks, effects, d };
}
function snapshot(f) {
  const status = st => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, typeof v !== 'object' || v === null ? v : Array.isArray(v) ? v : Object.fromEntries(Object.entries(v).map(([a,b]) => [a, ['src','other'].includes(a) ? b?.id : b]))]));
  return plain({ randomCalls: f.c.randomCalls, t: f.cb.t, done: f.cb.done, winner: f.cb.winner,
    projectiles: f.cb.projectiles.map(p => ({ x:p.x, y:p.y, dmg:p.dmg, speed:p.speed, src:p.src.id, tgt:p.tgt.id })),
    tele: f.cb.tele.map(t => ({ cells:t.cells, t:t.t, delay:t.delay, dmg:t.dmg, side:t.side })), later: (f.cb.later||[]).map(l=>({t:l.t,done:l.done})),
    zones: (f.cb.zones||[]).map(z=>({cells:z.cells,t:z.t,tick:z.tick,poison:z.poison})),
    units: f.cb.units.map(u => ({ id:u.id, cell:u.cell, hp:u.hp, maxHp:u.maxHp, shield:u.shield, dead:!!u.dead, stun:u.stun,
      mana:u.mana, dodge:u.dodge, lifesteal:u.lifesteal, crit:u.crit, critDmg:u.critDmg, attackCount:u.atkN, burnAdd:u.burnAdd, st:status(u.st), damage:u.dmgDealt, healing:u.healDone, casts:u.castCount })) });
}
function advance(f, dt) { f.hooks.onTick(f.cb, dt); f.effects.step(dt); }
// Canvas recording proxy rejects invalid coordinates without requiring a native Node canvas.
function canvas() {
  const calls = [], gradient = { addColorStop() {} }, noop = () => {};
  const c = new Proxy({ globalAlpha: 1 }, { get(o, k) {
    if (k in o) return o[k];
    if (k === 'createLinearGradient') return () => gradient;
    if (k === 'measureText') return s => ({ width: s.length * 7 });
    return (...args) => { for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), String(k)); calls.push([k,...args]); };
  }, set(o,k,v) { o[k]=v; return true; } });
  return { c, calls };
}
for (const id of IDS) for (const star of [1,3]) {
  test(`${id} ★${star}: resolved visuals leave combat and RNG unchanged`, () => {
    const off=fixture(id,star,false), on=fixture(id,star,true);
    assert.deepEqual(snapshot(on),snapshot(off));
    const events=on.events.filter(e=>e.id===id), count=on.d?.effect==='meteors'?6:1;
    assert.equal(events.length,count);
    for(const e of events){assert.equal(e.data.star,star);assert.ok(e.data.cells.length>0);for(const p of [...e.data.cells,...e.data.points,e.data.source,e.data.target])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(on.c.VFX4.event(id,e.data));}
    if(on.d?.effect==='tele'||on.d?.effect==='aim'||on.d?.effect==='explosive'||on.d?.effect==='meteors'){
      assert.ok(events.every(e=>e.data.phase==='warn'));
      advance(on,.1);advance(off,.1);assert.equal(on.events.filter(e=>e.id===id).length,count,'no early impact');
      for(let i=0;i<35;i++){advance(on,.1);advance(off,.1);assert.deepEqual(snapshot(on),snapshot(off));}
      const impacts=on.events.filter(e=>e.id===id&&e.data.phase==='impact');assert.equal(impacts.length,count);
      assert.ok(impacts.every(e=>e.data.points.length>0),'impact reports occupants actually hit');
    }
    const {c,calls}=canvas();
    for(const e of on.events.filter(e=>e.id===id)){const v=on.c.VFX4.event(id,e.data);for(const t of [0,.15,v.life*.7])for(const plane of ['under','over'])on.c.VFX4.render(c,v,t,plane);}
    assert.ok(calls.length>5,'profile draws a visible effect');
    const before=snapshot(on);on.effects.step(8);assert.equal(on.effects.count,0);assert.deepEqual(snapshot(on),before);
  });
}
test('all weapon definitions override ally shots and leave enemy profiles intact',()=>{
  for(const d of catalog.V4.ITEMS){const src={side:0,artId:'archer',card:{item:{id:d.id,star:3}}};assert.equal(catalog.SHOTS4.profile(src).id,d.id);assert.equal(catalog.SHOTS4.profile(src).weaponShape,d.shape);const {c}=canvas();catalog.SHOTS4.body(c,catalog.SHOTS4.profile(src),.3);}
  assert.equal(catalog.SHOTS4.profile({side:1,artId:'archer',card:{item:{id:'longsword'}}}).id,'archer');
});
test('all item passives preserve combat/RNG across attacks, spell hits and expiry',()=>{
  for(const d of catalog.V4.ITEMS){const off=fixture(null,1,false,d.id),on=fixture(null,1,true,d.id);
    // Trigger both conditional bonuses and four-attack procs.
    for(const f of [off,on]){f.caster.hp=f.caster.maxHp*.25;f.foes[0].hp=f.foes[0].maxHp*.4;f.foes[0].st.burn={t:3,dps:1,src:f.caster};f.foes[0].st.poison={t:3,dps:1,stacks:1,src:f.caster};f.caster.lsUsed=false;}
    for(let n=0;n<12;n++){for(const f of [off,on]){f.cb.attack(f.caster,f.foes[0]);f.cb.damage(f.caster,f.foes[0],30,'spell');f.cb.damage(f.foes[0],f.caster,1,'atk');}assert.deepEqual(snapshot(on),snapshot(off),d.id);}
    for(let n=0;n<10;n++){advance(off,.1);advance(on,.1);assert.deepEqual(snapshot(on),snapshot(off),d.id);}
    for(const e of on.procs){assert.ok(catalog.VFX4.profiles['p_'+e.id],e.id);assert.ok(e.data.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
  }
});
test('buff/shield/heal events identify recipients rather than enemy input target',()=>{
  for(const id of ['manashield','iceblessing','u_acolyte','lifelink','u_warden','u_monk','bless','warcry']){const f=fixture(id,1,true),e=f.events.find(e=>e.id===id);assert.ok(e);assert.ok(e.data.points.every(p=>f.allies.some(a=>a.px===p.x&&a.py===p.y)),id);}
  const f=fixture('u_bishop',1,true),e=f.events[0];assert.equal(e.data.points.length,1);assert.equal(e.data.healPoints.length,1);assert.equal(f.c.VFX4.event('u_bishop',e.data).style,'judgement');
});
test('persistent statuses and zones draw from frozen combat state without consuming RNG',()=>{
  const f=fixture('polymorph',1,true),u=f.caster;for(const k of Object.keys(f.c.VFX4.statuses))u.st[k]=['chill','marked','blind','link','reflect','hot','blades','vuln','bless','poison','burn','bleed'].includes(k)?{t:2,n:3,stacks:4,other:f.foes[0]}:k==='haste'?[{t:2,amt:1.2}]:2;
  u.stun=2;f.foes[0].st.link={t:2,other:u};f.cb.zones=[{cells:[0,1,2],t:2,color:'#7fbf4a'}];
  const before=snapshot(f),{c,calls}=canvas();for(const reducedMotion of [false,true]){f.c.VFX4.drawStatus(c,u,.5,26,{reducedMotion,polymorph:true});f.c.VFX4.drawFields(c,f.cb,f.grid,{reducedMotion});}
  assert.ok(calls.length>100);assert.deepEqual(snapshot(f),before);
});
test('effects, warnings and forms are bounded, released, and reduced motion suppresses animation',()=>{
  const f=fixture('meteor',1,true);for(let i=0;i<1000;i++)f.effects.emit(IDS[i%IDS.length],{...f.events[0].data,phase:'impact'});assert.ok(f.effects.count<=48);
  f.effects.emit('polymorph',{unitId:9,duration:3});assert.equal(f.effects.hasForm(9),true);f.effects.step(4);assert.equal(f.effects.hasForm(9),false);assert.equal(f.effects.count,0);
  const quiet=f.c.VFX4.create({reducedMotion:()=>true});quiet.emit('polymorph',{unitId:9,duration:3});quiet.emit('cross',{});assert.equal(quiet.count,0);assert.equal(quiet.hasForm(9),true);quiet.clear();assert.equal(quiet.hasForm(9),false);
});

for(const id of Object.keys(catalog.VFX4.profiles).filter(id=>id.startsWith('p_')||id==='weapon')){
  test(`${id}: bounded visual payload renders and expires without RNG`,()=>{
    const {c,calls}=canvas(),data={source:{x:50,y:150},target:{x:50,y:50},points:[{x:50,y:50}],cells:[{x:50,y:50}],star:3,stacks:4,weapon:{weaponShape:'twin',color:'#79d4ed'}},before=catalog.randomCalls,fx=catalog.VFX4.create();
    const e=fx.emit(id,data);assert.ok(e);catalog.VFX4.render(c,e,.1,'under');catalog.VFX4.render(c,e,.1,'over');assert.ok(calls.length>3);fx.step(2);assert.equal(fx.count,0);assert.equal(catalog.randomCalls,before);
  });
}

test('mercenary double hits and berserker life steal remain identical with weapon/proc effects',()=>{
  for(const id of ['u_merc','u_berserker']){
    const off=fixture(id,1,false),on=fixture(id,1,true);for(const f of [off,on])f.caster.hp=f.caster.maxHp*.25;
    for(let n=0;n<20;n++){off.cb.attack(off.caster,off.foes[0]);on.cb.attack(on.caster,on.foes[0]);assert.deepEqual(snapshot(on),snapshot(off));}
    if(id==='u_merc')assert.ok(on.procs.some(e=>e.id==='doubleHit'));
    else{const {c}=canvas(),before=snapshot(on);on.c.VFX4.drawStatus(c,on.caster,.3,26);assert.deepEqual(snapshot(on),before);}
  }
});
