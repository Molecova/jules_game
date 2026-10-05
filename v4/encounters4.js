/* Seeded, persisted encounters. No player-loadout counter-picking. */
(function(g){
 'use strict';
 const M=g.GD.MONSTERS,A=g.GD.ACTS;
 const rows=[
 [1,'방패 뒤 궁수','woodguard','gobarcher','slime','호위 돌파'],[1,'북소리 돌격대','gobdrummer','goblin','slime','지원 우선'],[1,'늑대 양익','wolf','gobarcher','goblin','측면 호위'],[1,'독포자 군락','shroom','slime','goblin','분산 배치'],[1,'덩굴 사격진','thornroot','gobarcher','slime','직선 공격'],[1,'도토리와 슬라임','acornlobber','slime','goblin','범위 공격'],
 [2,'뼈 성벽','boneguard','skelarch','skel','호위 돌파'],[2,'관 운반 행렬','coffinbearer','skelarch','skel','증원 제어'],[2,'장송의 종','bellkeeper','skel','bat','지원 우선'],[2,'사슬 매복','chainwraith','ghoul','skelarch','위치 교란'],[2,'강령 의식','necro','skel','skelarch','증원 제어'],[2,'망령과 박쥐','wraith','bat','skelarch','방어 전환'],
 [3,'화약 운반대','powderimp','lizard','imp','범위 공격'],[3,'과열 수비대','obsidian','salam','lizard','방어 전환'],[3,'분출충 포대','lavaborer','lizard','imp','직선 공격'],[3,'불길 측면대','flamerider','harpy','lizard','측면 호위'],[3,'용의 보육장','whelp','dragonkin','harpy','부채꼴 공격'],[3,'무너지는 용암벽','magmagolem','harpy','lizard','사망 폭발'],
 [4,'빙벽 궁수진','iceguard','snowarcher','yeti','호위 돌파'],[4,'서리 사냥대','frostdrummer','frostwolf','yeti','둔화 추격'],[4,'눈표범 매복','snowleopard','icesprite','yeti','측면 호위'],[4,'수정 십자진','crystalmage','yeti','frostskel','분산 배치'],[4,'매머드 전열','mammoth','icesprite','yeti','근접 범위'],[4,'설원 저격대','snowarcher','frostskel','yeti','직선 공격'],
 [5,'차원 증원대','abyssbanner','fallen','demon','증원 제어'],[5,'거울 결투대','mirrordemon','darkpriest','demon','반복 타격'],[5,'고통의 계약단','contractpriest','abomination','demon','연결 지원'],[5,'처형 의식','executioner','hellhound','demon','표식 공격'],[5,'그림자 침투대','shade','fallen','demon','측면 호위'],[5,'타락 기사단','darkpriest','fallen','demon','지원 우선']
 ];
 const templates=rows.map(([act,name,core,wing,filler,tag],i)=>({id:'enc_'+(i+1),act,name,core,wing,filler,tag,hint:g.ENEMIES4.abilities[M[core].enemyAbility]?.hint||'전열을 넓히고 주요 적 방향에 화력을 배치하세요.'}));
 const eliteCores=[['ogre','alpha','banditchief'],['dknight','gargoyle','banshee'],['giant','dragonkin','demonknight'],['frostgiant','yetichief','iceknight'],['archdemon','fallen','succubus']];
 function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
 function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
 function init(r){if(!r.encounters)r.encounters={version:1,seed:hash(String(Date.now())+':'+Math.random()),used:{},history:[],nodes:{}};return r.encounters;}
 function generate(r,kind,grid){
  const state=init(r),key=r.node?.id||`${r.act}:${r.round}:${kind}`;
  if(state.nodes[key]){r.encounter=state.nodes[key].info;return state.nodes[key].enemies.map(x=>({...x}));}
  const rand=rng(hash(state.seed+':'+key)),pick=a=>a[Math.floor(rand()*a.length)];
  const used=state.used[r.act]||(state.used[r.act]=[]), recent=state.history.slice(-2);
  let choices=templates.filter(t=>t.act===r.act&&!used.includes(t.id));
  if(!choices.length)choices=templates.filter(t=>t.act===r.act); // migrated or extended maps only
  const fresh=choices.filter(t=>!recent.includes(t.tag));if(fresh.length)choices=fresh;
  // Every route teaches these three distinct ideas first.
  let t=kind==='fight'&&r.act===1&&used.length<3?templates[[0,1,3][used.length]]:pick(choices);
  if(kind==='fight')used.push(t.id);
  let ids=[],info={id:t.id,name:t.name,tag:t.tag,hint:t.hint,core:t.core};
  const budget=2.2+.4*r.round;
  if(kind==='boss'){
   const boss=r.map.boss,variants=templates.filter(x=>x.act===r.act&& !['summon','heal','channel'].includes(g.ENEMIES4.abilities[M[x.core].enemyAbility]?.action));
   t=pick(variants);ids=[boss,t.core,t.filler];
   info={id:'boss_'+boss+'_'+t.id,name:M[boss].name+' · '+t.name,tag:'보스 · '+t.tag,hint:t.hint,core:boss};
  }else if(kind==='elite'){
   const list=templates.filter(x=>x.act===r.act),i=Math.floor(rand()*3);t=list[i*2];
   ids=[eliteCores[r.act-1][i],t.core,t.filler];
   info={id:`elite_${r.act}_${i}`,name:['돌파 시험','진형 시험','지원망 시험'][i]+' · '+t.name,tag:'정예 · '+t.tag,hint:t.hint,core:ids[0]};
  }else{
   ids=[t.core];let cost=M[t.core].v;
   if(cost+M[t.wing].v<=budget+.5){ids.push(t.wing);cost+=M[t.wing].v;}
   const basePool=A[r.act].normal.filter(id=>!M[id].enemyAbility&&!['firecult','cultist','succubus','abyssmage'].includes(id));
   while(ids.length<7){const pool=[t.filler,...basePool].filter(id=>ids.filter(x=>x===id).length<2&&cost+M[id].v<=budget+.5);if(!pool.length)break;const id=pick(pool);ids.push(id);cost+=M[id].v;}
  }
  const taken=new Set(),enemies=[],flip=rand()<.5;
  for(const [i,id]of ids.entries()){
   const d=M[id],cols=flip?[3,4,2,1,0]:[1,0,2,3,4],rows=d.range>1?[0,1,2]:[2,1,0];
   const candidates=rows.flatMap(row=>cols.map(col=>grid.idx(col,row))).filter(c=>c>=0&&!taken.has(c));
   let cell=d.boss?grid.idx(2,1):candidates[(i===0?0:Math.floor(rand()*Math.min(3,candidates.length)))];
   if(cell===undefined||taken.has(cell))cell=candidates[0];if(cell===undefined)continue;taken.add(cell);
   enemies.push({uid:'enc-'+key+'-'+i,id,cell,scale:1,rot:(rand()-.5)*.12});
  }
  state.history.push(t.tag);state.history=state.history.slice(-6);state.nodes[key]={info,enemies};r.encounter=info;
  return enemies.map(x=>({...x}));
 }
 g.ENCOUNTERS4={templates,generate,hash,rng,init};
})(window);
