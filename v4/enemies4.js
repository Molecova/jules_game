/* v4 enemy identities. Kept out of the player shop and legacy games. */
(function(g){
  'use strict';
  const M=g.GD.MONSTERS, abilities={}, added=[], reworked=[];
  const colors=['','#718e42','#8b79ad','#e66e36','#56a9c4','#a55fc3'];
  function ability(id,name,action,hint,extra={}) { return abilities[id]={id,name,action,hint,cd:9,wind:1.1,...extra}; }
  const rows=[
    [1,'woodguard','나무방패 고블린','goblin','guard','방패 맞대기','guard','측면 또는 관통으로 후열을 압박하세요.'],
    [1,'gobdrummer','고블린 북잡이','goblin','drum','진군 북소리','haste','북잡이 방향에 돌진·관통을 배치하세요.'],
    [1,'thornroot','가시덩굴 묘목','shroom','root','덩굴 채찍','line','앞뒤로 겹치지 않게 배치하세요.'],
    [1,'acornlobber','도토리 투척꾼','gobarcher','acorn','도토리 포물선','blast','전열 사이 간격을 벌리세요.'],
    [2,'boneguard','해골 방패지기','skel','shield','뼈 성벽','shield','관통으로 호위와 후열을 함께 공격하세요.'],
    [2,'bellkeeper','묘지 종지기','necro','bell','장송의 종','heal','종지기에 접근할 방향을 확보하세요.'],
    [2,'coffinbearer','관 운반자','zombie','coffin','관 열기','summon','증원 전에 집중하거나 범위 공격을 준비하세요.'],
    [2,'chainwraith','사슬 망령','wraith','chain','사슬 낚아채기','pull','사슬 방향에 단단한 유닛을 배치하세요.'],
    [3,'powderimp','화약 임프','imp','bomb','화약통 투척','bomb','밀집을 피하고 보호막을 준비하세요.'],
    [3,'obsidian','흑요석 파수병','magmagolem','armor','과열 갑각','cycle','취약 구간까지 버틸 전열을 준비하세요.'],
    [3,'lavaborer','용암 분출충','salam','worm','분출선','line','같은 세로줄에 여러 유닛을 세우지 마세요.'],
    [3,'flamerider','화염 기수','dragonkin','flag','불길 돌파','dash','측면에 호위를 두세요.'],
    [4,'iceguard','얼음 방패병','frostskel','shield','빙벽 수호','shield','범위·관통으로 호위를 함께 공격하세요.'],
    [4,'frostdrummer','서리 북잡이','yeti','drum','겨울 박자','frostbuff','긴 사거리와 전열 회복을 준비하세요.'],
    [4,'snowleopard','눈표범','frostwolf','beast','설원 도약','leap','표시된 후열 옆에 호위를 두세요.'],
    [4,'crystalmage','얼음 수정술사','icewitch','crystal','균열 수정','cross','십자 모양으로 밀집하지 마세요.'],
    [5,'abyssbanner','심연 기수','demon','flag','차원 깃발','summon','기수 방향을 집중 공격하세요.'],
    [5,'mirrordemon','거울 악마','shade','mirror','잔상 모방','echo','전열 방어를 강화하세요.'],
    [5,'contractpriest','계약 사제','darkpriest','book','고통의 계약','contract','연결된 두 적을 범위 공격으로 압박하세요.'],
    [5,'executioner','심연 처형자','fallen','scythe','처형 예고','execute','회복·보호막으로 표식 대상을 보호하세요.'],
  ];
  for(const [act,id,name,base,art,title,action,hint] of rows){
    const support=['guard','shield','haste','heal','summon','frostbuff','contract'].includes(action);
    const ranged=support&&!['guard','shield'].includes(action)||['line','blast','bomb','cross','pull'].includes(action);
    const a=ability('enemy_'+id,title,action,hint,{color:colors[act]});
    if(action==='heal'||action==='execute'||action==='contract')a.wind=2;
    if(action==='bomb'||action==='cross')a.wind=1.5;
    if(action==='leap'||action==='dash'){a.once=true;a.first=3;}
    if(action==='cycle'){a.wind=0;a.cd=7;}
    if(action==='summon'){a.spawn=act===5?'shade':'skel';a.max=2;a.total=act===2?2:3;a.count=act===2?2:1;a.once=act===2;a.wind=2;}
    M[id]={...M[base],id,name,act,v:act===1?1.5:2.5,hp:Math.round(M[base].hp*(support?.85:1)),atk:Math.round(M[base].atk*(support?.65:.85)),as:.65,range:ranged?3:1,skills:[],proc:null,boss:null,elite:false,
      enemyAbility:a.id,enemyArt:art,artBase:base,color:colors[act],role:support?'지원':ranged?'포격':'돌파',desc:title+' — '+hint,immobile:art==='root'||art==='worm'};
    added.push(id);g.GD.ACTS[act].normal.push(id);
  }
  const edits=[
    ['shroom','독포자 구름','poison','분산 배치와 회복으로 중독에 대비하세요.'],
    ['wolf','무리 사냥','pack','전열을 넓혀 포위를 줄이세요.'],
    ['necro','뼈 일으키기','summon','강령술사 방향을 먼저 압박하세요.'],
    ['wraith','실체화','phase','전열을 유지하고 주문 공격을 사용하세요.'],
    ['whelp','작은 용숨결','cone','전열을 넓게 배치하세요.'],
    ['magmagolem','붕괴 열기','deathblast','원거리 공격과 보호막을 준비하세요.'],
    ['frostwolf','서리 추격','hunt','전열 회복과 방어를 준비하세요.'],
    ['snowarcher','고정 조준','snipe','조준선에 여러 유닛을 겹치지 마세요.'],
    ['shade','그림자 교대','leap','후열에 호위를 두세요.'],
    ['darkpriest','타락의 성가','channel','사제 쪽에 화력을 집중하세요.'],
  ];
  for(const [id,name,action,hint] of edits){
    const d=M[id],a=ability('enemy_'+id,name,action,hint,{color:colors[d.act]});
    if(action==='summon')Object.assign(a,{spawn:'skel',max:2,total:3,count:1,wind:2});
    if(action==='leap')Object.assign(a,{once:true,first:3});
    if(action==='phase')Object.assign(a,{wind:0,cd:7});
    if(action==='snipe')a.wind=2;
    if(['deathblast','pack','hunt'].includes(action))a.passive=true;
    Object.assign(d,{skills:[],proc:null,enemyAbility:a.id,desc:name+' — '+hint});
    reworked.push(id);
  }
  const descriptions={guard:'자신과 가까운 동료 1기의 받는 피해를 3초간 25% 줄입니다.',shield:'가까운 동료에게 최대 체력 18% 보호막을 줍니다.',haste:'주변 동료 최대 3기의 공격 속도를 4초간 25% 높입니다.',line:'바라보는 방향 앞 3칸을 공격합니다.',blast:'목표와 인접 칸을 공격합니다.',heal:'부상당한 동료 최대 2기를 회복합니다.',summon:'약한 동료를 소환합니다. 생존 소환물 최대 2기.',pull:'대상을 빈 칸으로 한 칸 당기고 피해를 줍니다.',bomb:'투척한 폭탄이 1.5초 뒤 주변에서 폭발합니다. 시전자가 죽어도 폭발합니다.',cycle:'4초간 단단해지고 이후 3초간 받는 피해가 20% 증가합니다.',dash:'측면으로 돌진하며 경로를 공격합니다.',frostbuff:'동료 최대 3기의 다음 공격에 둔화를 부여합니다.',leap:'가장 먼 적 근처 빈 칸으로 한 번 도약합니다.',cross:'목표 중심 십자 범위에 피해와 둔화를 줍니다.',echo:'다음 기본 공격을 40% 위력으로 한 번 반복합니다.',contract:'가까운 동료의 피해 일부를 4초간 대신 받습니다.',execute:'체력이 낮은 대상을 표시하고 강한 단일 공격을 합니다.',poison:'목표 주변에 피해를 주고 3초간 중독시킵니다.',pack:'다른 늑대가 붙은 대상을 공격할 때 추가 피해. 4초 간격.',phase:'2초간 회피율이 높아지고 이후 5초간 실체가 드러납니다.',cone:'앞쪽 부채꼴 범위에 피해와 화상을 줍니다.',deathblast:'사망 1.5초 뒤 주변이 한 번 폭발합니다.',hunt:'둔화된 대상을 공격할 때 추가 피해. 4초 간격.',snipe:'2초간 조준한 방향을 관통하는 화살을 쏩니다.',channel:'3초간 부상당한 동료를 치료합니다. 기절·사망 시 중단됩니다.'};
  for(const id of [...added,...reworked]){const d=M[id],a=abilities[d.enemyAbility];a.desc=descriptions[a.action];d.desc=a.name+' — '+a.desc;}
  g.ENEMIES4={abilities,added,reworked,colors};
})(window);
