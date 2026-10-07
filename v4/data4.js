/* 카드 원정대 v4 — 데이터
 * 3클래스(전사·궁수·마법사), 클래스 전용 스킬·아이템, 상점 등급·풀, 시너지, 유물, 이벤트.
 * 몬스터·막·스킬 패턴 원본은 game/data.js(GD)를 그대로 쓴다.
 */
(function (global) {
  'use strict';
  const GD = global.GD;

  const CLS = {
    war: { name: '전사', short: '전', col: '#26408f', plastic: '#3352ad', art: 'sword' },
    arc: { name: '궁수', short: '궁', col: '#d23f2c', plastic: '#e5533f', art: 'bow' },
    mag: { name: '마법사', short: '마', col: '#11968c', plastic: '#1aafa4', art: 'mage' },
    any: { name: '공용', short: '공', col: '#4b5160', plastic: '#6b7180', art: 'any' },
  };

  // 클래스(전사·궁수·마법사) 시너지는 없앴다. 클래스는 장비·스킬 장착 제한과 카드 색에만 쓴다
  const SYN = {};

  const U = (id, name, cls, t, hp, atk, as, range, trait, extra) => Object.assign({ kind: 'unit', id, name, cls, t, hp, atk, as, range, trait }, extra || {});
  const UNITS = [
    U('squire', '견습 검사', 'war', 1, 950, 56, 0.75, 1, '적을 쓰러뜨리면 체력 10% 회복', { passive: 'killHeal' }),
    U('shieldman', '방패병', 'war', 1, 1300, 40, 0.6, 1, '전투 시작 시 보호막 220', { passive: 'startShield', armor: 0.1 }),
    U('merc', '용병', 'war', 2, 1150, 66, 0.75, 1, '공격할 때 25% 확률로 한 번 더 공격', { passive: 'doubleHit' }),
    U('hammer', '망치 전사', 'war', 2, 1250, 62, 0.6, 1, '3번째 공격마다 대상 1초 기절', { passive: 'stunHit', armor: 0.1 }),
    U('duelist', '결투가', 'war', 3, 1350, 88, 0.9, 1, '첫 공격이 반드시 치명타', { passive: 'firstStrike', crit: 0.15 }),
    U('berserker', '광전사', 'war', 3, 1450, 88, 0.85, 1, '흡혈 15%. 체력이 줄수록 공격 속도가 오름(최대 +40%)', { passive: 'frenzy' }),
    U('warden', '기사단장', 'war', 4, 1950, 80, 0.65, 1, '주변 1칸 아군 받는 피해 −10%', { passive: 'guardAura', armor: 0.15 }),
    U('paladin', '성기사', 'war', 4, 2000, 76, 0.65, 1, '4초마다 주변 1칸 아군 체력 5% 회복', { passive: 'holyAura', armor: 0.15 }),
    U('blademaster', '용기사', 'war', 5, 2600, 112, 0.8, 1, '체력 50% 이하가 되면 한 번 앞 3칸에 화염 숨결', { passive: 'dragonBreath', armor: 0.1 }),
    U('archer', '견습 궁수', 'arc', 1, 620, 52, 0.8, 3, '같은 적을 계속 쏘면 피해가 쌓여 오름(최대 +40%)', { passive: 'focus' }),
    U('venom', '정찰병', 'arc', 1, 580, 48, 0.8, 4, '사거리 4'),
    U('crossbow', '석궁병', 'arc', 2, 760, 80, 0.6, 4, '공격이 방어를 무시', { passive: 'pierceArmor' }),
    U('scout', '척후병', 'arc', 2, 720, 60, 0.9, 3, '처음 세 번의 공격 피해 +60%', { passive: 'opener', dodge: 0.15 }),
    U('hunter', '매사냥꾼', 'arc', 3, 900, 74, 0.85, 3, '전투 시작 시 매 소환', { passive: 'hawk' }),
    U('arbalest', '석궁 기사', 'arc', 3, 1050, 94, 0.55, 4, '화살이 대상 뒤 한 칸까지 꿰뚫음(50%)', { passive: 'heavyBolt', armor: 0.1 }),
    U('ranger', '레인저', 'arc', 4, 1150, 96, 0.9, 4, '체력 20% 이하인 적을 맞히면 처형', { passive: 'execute20', dodge: 0.15 }),
    U('windarcher', '바람 궁수', 'arc', 4, 1100, 84, 1.0, 4, '3번째 공격마다 다른 적 둘에게도 화살(60%)', { passive: 'tripleShot' }),
    U('ninja', '엘프 명궁', 'arc', 5, 1350, 125, 0.95, 4, '4번째 공격마다 일직선 관통 화살', { passive: 'pierce4' }),
    U('apprentice', '견습 마법사', 'mag', 1, 600, 38, 0.65, 3, '마나 20으로 시작', { startMana: 20 }),
    U('acolyte', '약초꾼', 'mag', 1, 700, 34, 0.7, 3, '주변 1칸 아군 초당 체력 1% 재생', { passive: 'healAura' }),
    U('monk', '학자', 'mag', 2, 760, 44, 0.65, 3, '스킬을 쓰면 마나 15를 돌려받음', { passive: 'scholar' }),
    U('pyro', '화염술사', 'mag', 2, 780, 50, 0.65, 3, '기본 공격이 3초 화상', { passive: 'burnHit', spellBonus: 0.1 }),
    U('cryo', '점성술사', 'mag', 3, 900, 52, 0.65, 3, '전투 시작 시 무작위 적 둘이 8초간 받는 피해 +30%', { passive: 'starMark' }),
    U('summoner', '소환술사', 'mag', 3, 920, 44, 0.6, 3, '전투 시작 시 돌 골렘 소환', { passive: 'golem' }),
    U('archmage', '대마법사', 'mag', 4, 1200, 66, 0.65, 3, '스킬 위력 +45%', { spellBonus: 0.45 }),
    U('warlock', '흑마법사', 'mag', 4, 1150, 60, 0.65, 3, '마나 35로 시작. 스킬 피해의 25%만큼 회복, 시작 시 가장 센 적 둘 8초 약화', { passive: 'hex', startMana: 35 }),
    U('bishop', '현자', 'mag', 5, 1500, 76, 0.7, 3, '스킬 칩 3개. 스킬을 쓸 때마다 주변 1칸 아군 체력 8% 회복', { slots: 3, passive: 'sage' }),
  ];

  // 마법사는 뒤에서 버티는 시간이 길어 체력·공격을 조금 더 준다
  for (const u of UNITS) if (u.cls === 'mag') { u.hp = Math.round(u.hp * 1.15 / 10) * 10; u.atk = Math.round(u.atk * 1.1); }

  // ---- 고유기: 유닛마다 하나, 마나가 차면 쓴다(스킬과 같은 형식). 패시브만 가진 유닛은 광전사·석궁병·화염술사 ----
  const A8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], S3 = [[0, 0], ...A8];
  const SQ5U = []; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) SQ5U.push([x, y]);
  const ULT = {
    squire: { name: '돌진 베기', mode: 'facing', effect: 'dmg', cells: [[1, 0], [2, 0]], power: 320, mana: 60, icon: 'slash', desc: '앞 2칸을 벤다' },
    shieldman: { name: '방패 세우기', mode: 'selfOnly', effect: 'shield', power: 250, mana: 70, icon: 'shield', desc: '자신 보호막 250' },
    hammer: { name: '내려찍기', mode: 'single', effect: 'dmg', power: 150, mana: 80, stun: 1.5, icon: 'quake', desc: '공격 중인 대상을 내려찍고 1.5초 기절' },
    duelist: { name: '일격', mode: 'facing', effect: 'dmg', cells: [[1, 0], [2, 0], [3, 0]], power: 400, mana: 70, slash: true, icon: 'slash', desc: '앞 3칸을 꿰뚫어 벤다' },
    warden: { name: '수호 진형', mode: 'selfOnly', effect: 'guard', only: 'war', power: 0, mana: 80, dur: 4, red: 0.3, icon: 'shield', desc: '모든 전사 아군 4초간 받는 피해 −30%' },
    paladin: { name: '신성한 망치', mode: 'self', effect: 'lightrain', cells: SQ5U, power: 250, heal: 125, mana: 90, slash: true, icon: 'cross', desc: '주변 2칸(5×5)을 휘둘러 적 피해, 같은 범위 아군 125 회복' },
    blademaster: { name: '용의 숨결', mode: 'facing', effect: 'dmg', cells: [[1, -1], [1, 0], [1, 1], [2, -1], [2, 0], [2, 1]], power: 200, mana: 50, burn: { dps: 45, dur: 4 }, stackBurn: 30, icon: 'fire', desc: '앞쪽 2×3 화염 + 4초 화상(초당 45). 쓸 때마다 이번 전투 동안 기본 공격에 화상 피해 +30' },
    archer: { name: '집중 사격', mode: 'volley', effect: 'dmg', focus: true, count: 3, power: 50, mana: 60, icon: 'arrow', desc: '대상에게 화살 3연사' },
    venom: { name: '독침', mode: 'single', effect: 'dmg', power: 40, mana: 60, poison: { dps: 20, dur: 6 }, slow: 1, icon: 'skull', desc: '대상 피해 + 6초 중독(초당 20) + 1초 둔화' },
    scout: { name: '속사', mode: 'selfOnly', effect: 'haste', power: 0, mana: 70, dur: 4, amt: 1.3, icon: 'wind', desc: '4초간 자신 공격 속도 +30%' },
    hunter: { name: '매 부르기', mode: 'selfOnly', effect: 'summon', summon: 'hawk', max: 1, power: 0, mana: 80, icon: 'wind', desc: '매를 부른다(이미 있으면 매 체력 회복)' },
    arbalest: { name: '연쇄 볼트', mode: 'volley', effect: 'dmg', count: 2, power: 200, mana: 40, icon: 'arrow', desc: '무작위 적 2명에게 볼트' },
    ranger: { name: '마무리 사격', mode: 'lowest', effect: 'dmg', power: 150, mana: 90, finisher: 0.25, icon: 'target', desc: '체력 비율이 가장 낮은 적에게 강한 화살. 맞고 체력 25% 이하면 처형(보스 제외)' },
    windarcher: { name: '돌풍 화살', mode: 'front', effect: 'dmg', n: 2, push: 2, power: 300, mana: 90, icon: 'wind', desc: '맨 앞의 적 2명에게 돌풍 화살, 맞은 적은 뒤로 2칸 밀려난다' },
    ninja: { name: '화살 난사', mode: 'volley', effect: 'dmg', count: 10, power: 100, mana: 100, icon: 'star', desc: '무작위 적에게 화살 10발' },
    apprentice: { name: '마력탄', mode: 'single', effect: 'dmg', power: 150, mana: 50, icon: 'star', desc: '대상에게 마력탄' },
    acolyte: { name: '약초 뿌리기', mode: 'lowestAlly', effect: 'heal', power: 300, mana: 60, icon: 'heart', desc: '체력 비율이 가장 낮은 아군 300 회복' },
    monk: { name: '지식의 흐름', mode: 'selfOnly', effect: 'mana', n: 2, power: 50, mana: 70, icon: 'drop', desc: '가장 가까운 아군 2명 마나 +50' },
    cryo: { name: '별자리 표식', mode: 'selfOnly', effect: 'markRandom', n: 2, vuln: { amt: 0.4, dur: 4 }, power: 0, mana: 70, icon: 'star', desc: '무작위 적 2명 4초간 받는 피해 +40%' },
    summoner: { name: '골렘 소환', mode: 'selfOnly', effect: 'summon', summon: 'stonegolem', max: 1, power: 0, mana: 100, icon: 'quake', desc: '돌 골렘 소환(이미 있으면 골렘 체력 회복)' },
    archmage: { name: '빙결', mode: 'selfOnly', effect: 'markRandom', n: 2, stun: 2, vuln: { amt: 0.3, dur: 2 }, power: 0, mana: 90, icon: 'ice', desc: '무작위 적 2명 2초간 빙결(기절), 그동안 받는 피해 +30%' },
    warlock: { name: '저주의 낙인', mode: 'selfOnly', effect: 'curse', n: 2, power: 180, mana: 90, weak: 6, drain: 0.5, icon: 'skull', desc: '공격력이 가장 높은 적 둘에게 피해 + 6초 약화, 준 피해의 50% 회복' },
    bishop: { name: '성스러운 빛', mode: 'selfOnly', effect: 'smite', power: 500, heal: 500, mana: 100, icon: 'cross', desc: '무작위 적 1명에게 피해 500, 체력 비율이 가장 낮은 아군 500 회복' },
    crossbow: { name: '관통 볼트', mode: 'facing', effect: 'dmg', cells: [[1, 0], [2, 0], [3, 0], [4, 0]], power: 250, mana: 90, icon: 'arrow', desc: '앞으로 4칸을 꿰뚫는 볼트' },
    pyro: { name: '화염구', mode: 'target', effect: 'dmg', cells: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], power: 150, mana: 70, burn: { dps: 25, dur: 3 }, icon: 'fire', desc: '대상과 상하좌우 1칸(5칸)에 화염 + 3초 화상(초당 25)' },
  };
  // 고유기가 들어간 뒤 맞춘 기본 능력치(측정 기준)
  const STATFIX = { archer: { hp: 0.9, atk: 0.82 }, venom: { hp: 0.9, atk: 0.9 }, pyro: { atk: 0.9 }, monk: { hp: 1.15, atk: 1.15 }, hunter: { atk: 0.9 }, cryo: { hp: 1.1, atk: 1.1 },
    archmage: { hp: 1.2, atk: 1.2 }, warlock: { hp: 1.1, atk: 1.1 }, bishop: { hp: 1.2, atk: 1.1 }, blademaster: { atk: 0.84 } };
  for (const u of UNITS) { const f = STATFIX[u.id]; if (f) { if (f.hp) u.hp = Math.round(u.hp * f.hp / 10) * 10; if (f.atk) u.atk = Math.round(u.atk * f.atk); } }
  for (const u of UNITS) {
    const o = ULT[u.id]; if (!o) continue;
    u.ult = Object.assign({ kind: 'ult', id: 'u_' + u.id, cls: u.cls, t: u.t }, o);
    u.trait = `${o.name}: ${o.desc}`;
    delete u.passive; delete u.startMana; delete u.spellBonus; delete u.slots;
  }
  const gs = (id) => GD.SKILLS.find((s) => s.id === id) || {};
  const SKX = {
    healarrow: { mode: 'lowestAlly', effect: 'heal', icon: 'heart', mana: 60, power: 260, desc: '가장 다친 아군에게 치유 화살(260 회복)' },
    lightrain: { mode: 'target', effect: 'lightrain', icon: 'star', mana: 100, power: 200, cells: [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], desc: '대상 중심 3×3 피해, 그 안의 아군은 회복' },
    snare: { mode: 'targetFacing', effect: 'dmg', icon: 'ice', mana: 70, power: 140, slow: 3, cells: [[0, 0], [0, -1], [0, 1]], desc: '대상과 양옆 1칸 피해 + 3초 둔화' },
    horn: { mode: 'all', effect: 'haste', icon: 'wind', mana: 90, dur: 5, amt: 1.3, desc: '모든 아군 5초간 공격 속도 +30%' },
    fire: { power: 200 }, chain: { power: 240 }, meteor: { power: 520 }, blizzard: { power: 200 }, ice: { power: 190 },
    frostnova: { power: 170 }, manaflow: { power: 40, mana: 55 }, light: { power: 240 },
    timewarp: { mode: 'all', effect: 'timewarp', icon: 'wind', mana: 100, dur: 5, amt: 1.3, desc: '모든 아군 5초간 가속, 모든 적 3초 둔화' },
    bless: { desc: '공격력이 가장 높은 아군 6초간 주는 피해 +30%, 공격 속도 +20%' },
    judgment: { power: 240, mana: 90, desc: '끝까지 꿰뚫고 맞은 적 5초 취약(받는 피해 +30%)' },
    drainlife: { power: 260, desc: '대상에게 피해, 준 피해의 60% 회복' },
  };
  // 스킬 기본 위력은 낮추고(×0.85) 별(★)로 크게 오르게 한다. 설명 속 숫자도 함께 바꾼다
  const S_ = (id, name, cls, t) => {
    const o = Object.assign({}, gs(id), SKX[id] || {}, { kind: 'skill', id, name, cls, t });
    if (o.power > 10) { const np = Math.round(o.power * 0.85 / 5) * 5; if (o.desc) o.desc = o.desc.replace(String(o.power), String(np)); o.power = np; }
    if (o.heal > 10) { const nh = Math.round(o.heal * 0.85 / 5) * 5; if (o.desc) o.desc = o.desc.replace(String(o.heal), String(nh)); o.heal = nh; }
    return o;
  };
  const SKILLS = [
    S_('cross', '십자 베기', 'war', 1), S_('whirl', '회전 베기', 'war', 2), S_('bladestorm', '검의 폭풍', 'war', 3),
    S_('bash', '방패 강타', 'war', 1), S_('wall', '방벽 세우기', 'war', 2), S_('bulwark', '불굴의 함성', 'war', 3),
    S_('bleedcut', '출혈 베기', 'war', 1),
    S_('taunt', '도발', 'war', 1), S_('fortify', '요새화', 'war', 2), S_('charge', '돌격', 'war', 2), S_('earth', '대지 가르기', 'war', 3), S_('shadowstep', '그림자 걸음', 'war', 2), S_('assassinate', '암살', 'war', 3),
    S_('pierce', '관통 사격', 'arc', 1), S_('multishot', '연사', 'arc', 2), S_('rain', '화살비', 'arc', 3),
    S_('healarrow', '치유 화살', 'arc', 1), S_('bless', '축복의 화살', 'arc', 2), S_('lightrain', '빛의 화살비', 'arc', 3),
    S_('huntmark', '사냥 표식', 'arc', 1),
    S_('poisonarrow', '독화살', 'arc', 1), S_('spread', '산탄 사격', 'arc', 1), S_('snipe', '저격', 'arc', 2), S_('judgment', '심판의 화살', 'arc', 3), S_('snare', '속박 화살', 'arc', 2), S_('horn', '지휘 나팔', 'arc', 3),
    S_('fire', '화염 폭발', 'mag', 1), S_('chain', '연쇄 번개', 'mag', 2), S_('meteor', '메테오', 'mag', 3),
    S_('light', '치유의 빛', 'mag', 1), S_('purify', '정화', 'mag', 2),
    S_('manaflow', '마나 순환', 'mag', 1),
    S_('ice', '얼음 창', 'mag', 1), S_('drainlife', '생명 흡수', 'mag', 2), S_('barrier', '마나 방벽', 'mag', 2), S_('blizzard', '눈보라', 'mag', 3), S_('aegis', '신의 가호', 'mag', 3), S_('frostnova', '서리 폭발', 'mag', 2), S_('timewarp', '시간 왜곡', 'mag', 3),
    S_('aid', '응급 처치', 'any', 1), S_('warcry', '전투 함성', 'any', 1), S_('adrenaline', '아드레날린', 'any', 2), S_('heavy', '혼신의 일격', 'any', 1), S_('secondwind', '재정비', 'any', 2),
  ];
  // 스킬 밸런스(시뮬레이션 측정 기준): 빗나가기 쉬운 줄·범위 스킬은 위력을 높이고,
  // 반드시 맞는 단일 대상 스킬과 지나치게 센 지원 스킬은 낮춘다
  const SKBAL = {
    pierce: { power: 360 }, ice: { power: 330 }, judgment: { power: 560 }, rain: { power: 270 }, spread: { power: 150 },
    cross: { power: 205 }, whirl: { power: 280 }, bladestorm: { power: 320 }, earth: { power: 680 }, frostnova: { power: 500 }, bash: { power: 300 },
    poisonarrow: { power: 55, poison: { dps: 40, dur: 6 }, desc: '대상에게 피해 + 6초 중독(초당 40)' },
    huntmark: { power: 20, vuln: { amt: 0.25, dur: 5 }, desc: '대상 5초 취약(받는 피해 +25%)' }, heavy: { power: 1.8, desc: '대상에게 공격력 ×1.8 피해' },
    bleedcut: { power: 80, bleed: { dps: 40, dur: 5 }, desc: '앞쪽 3칸을 베고 5초 출혈(초당 40)' },
    fire: { power: 85 }, meteor: { power: 320 },
    fortify: { power: 120, dur: 3, red: 0.3, desc: '3초간 받는 피해 −30%, 체력 120 회복' },
    manaflow: { power: 45, desc: '주변 1칸 다른 아군 마나 +45' },
    taunt: { power: 260, desc: '주변 2칸 적이 3초간 자신만 노린다. 보호막 260' },
    light: { power: 240 },
    // 중첩 측정(같은 스킬 반복·여러 딱지) 뒤 손본 지원 스킬
    wall: { power: 160, mana: 80, desc: '같은 줄 좌우 2칸 아군에게 보호막 160' },
    aid: { power: 220, mana: 60 },
    secondwind: { power: 200, mana: 70, desc: '자신 보호막 200 + 해로운 효과 제거' },
    purify: { power: 110, desc: '체력이 가장 낮은 아군 110 회복 + 해로운 효과 제거' },
    healarrow: { power: 130, desc: '가장 다친 아군에게 치유 화살(130 회복)' },
    timewarp: { mana: 110, amt: 1.25, desc: '모든 아군 5초간 공격 속도 +25%, 모든 적 3초 둔화' },
    adrenaline: { amt: 1.8, mana: 50, desc: '자신 5초간 공격 속도 +80%(다시 쓰면 시간만 새로)' },
    warcry: { amt: 1.3, desc: '주변 2칸 아군 6초간 공격 속도 +30%' },
  };
  for (const sk of SKILLS) if (SKBAL[sk.id]) Object.assign(sk, SKBAL[sk.id]);

  // 4·5등급 스킬: 위력이 크고 마나도 많이 든다(수치는 그대로 쓴다)
  const SQ5 = []; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) SQ5.push([x, y]);
  const RING5 = SQ5.filter(([x, y]) => x || y);
  const BOX3x3 = [[1, -1], [1, 0], [1, 1], [2, -1], [2, 0], [2, 1], [3, -1], [3, 0], [3, 1]];
  const N_ = (id, name, cls, t, o) => Object.assign({ kind: 'skill', id, name, cls, t }, o);
  SKILLS.push(
    N_('shatter', '파쇄 일격', 'war', 4, { mode: 'facing', effect: 'dmg', cells: BOX3x3, power: 360, mana: 100, stun: 1, icon: 'quake', desc: '앞쪽 3×3을 내려찍고 1초 기절' }),
    N_('execution', '처형', 'war', 4, { mode: 'lowest', effect: 'dmg', power: 520, mana: 90, execute: 2, icon: 'dagger', desc: '체력 비율이 가장 낮은 적. 체력 절반 이하면 피해 ×2' }),
    N_('resolve', '결의', 'any', 4, { mode: 'selfOnly', effect: 'fortify', power: 340, mana: 90, dur: 4, red: 0.35, icon: 'shield', desc: '4초간 받는 피해 −35%, 체력 340 회복' }),
    N_('arrowstorm', '폭풍 화살', 'arc', 4, { mode: 'volley', effect: 'dmg', power: 140, mana: 100, count: 6, icon: 'arrow', desc: '무작위 적에게 화살 6발' }),
    N_('railshot', '꿰뚫는 저격', 'arc', 4, { mode: 'line', effect: 'dmg', power: 760, mana: 100, stun: 0.8, icon: 'target', desc: '끝까지 꿰뚫고 맞은 적 0.8초 기절' }),
    N_('firestorm', '화염 폭풍', 'mag', 4, { mode: 'target', effect: 'dmg', cells: SQ5, power: 200, mana: 120, burn: { dps: 40, dur: 4 }, icon: 'fire', desc: '대상 중심 5×5 피해 + 4초 화상(초당 40)' }),
    N_('thunder', '뇌우', 'mag', 4, { mode: 'chain', effect: 'dmg', power: 340, mana: 110, jumps: 7, stun: 0.5, icon: 'bolt', desc: '대상에서 가까운 적으로 7번 튀고 0.5초 기절' }),
    N_('quakeking', '대지 붕괴', 'war', 5, { mode: 'self', effect: 'dmg', cells: RING5, power: 400, mana: 130, stun: 1.2, icon: 'quake', desc: '주변 2칸 안 모든 적 피해 + 1.2초 기절' }),
    N_('skyarrows', '천 개의 화살', 'arc', 5, { mode: 'volley', effect: 'dmg', power: 140, mana: 130, count: 10, icon: 'arrow', desc: '무작위 적에게 화살 10발' }),
    N_('cataclysm', '종말의 불꽃', 'mag', 5, { mode: 'target', effect: 'tele', cells: SQ5, power: 340, mana: 140, delay: 1, burn: { dps: 70, dur: 4 }, icon: 'fire', desc: '1초 뒤 대상 중심 5×5에 불벼락 + 4초 화상(초당 70)' }),
  );

  // 18차 사용자 패치: 전사 스킬 칩(cd 를 적은 것은 대기시간 고정)
  const WARFIX = {
    bleedcut: { name: '기력 베기', bleed: null, drain: 0.5, desc: '앞쪽 3칸을 베고 준 피해의 절반만큼 회복' },
    shadowstep: { cd: 7, power: 100 },
    charge: { cd: 7 },
    wall: { power: 150, selfShield: 300, desc: '자신 보호막 300, 같은 줄 좌우 2칸 아군 보호막 150' },
    fortify: { power: 0, dur: 4, hot: 40, desc: '4초간 받는 피해 −30%, 초당 체력 40 회복' },
    whirl: { power: 150, hits: 2, desc: '주변 8칸을 두 번 벤다(한 번에 위력 150)' },
    bladestorm: { effect: 'bladeAura', mode: 'selfOnly', cells: null, power: 50, dur: 5, bleedDur: 10, desc: '5초간 자신 주변 8칸에 칼날. 닿은 적은 10초 출혈(초당 50)' },
    earth: { power: 400 },
    bulwark: { effect: 'rally', power: 0, dur: 4, red: 0.3, hot: 60, desc: '자신과 주변 2칸 아군 4초간 받는 피해 −30%, 0.5초마다 체력 30 회복' },
    assassinate: { name: '핵펀치', stun: 3, desc: '체력 비율이 가장 낮은 적에게 확정 치명 + 3초 기절' },
    execution: { mode: 'leap', desc: '체력 비율이 가장 낮은 적 옆으로 순간이동해 벤다. 체력 절반 이하면 피해 ×2' },
    quakeking: { mode: 'all', cells: null, cd: 15, stun: 1.5, desc: '모든 적 피해 + 1.5초 기절' },
  };
  for (const sk of SKILLS) { const f = WARFIX[sk.id]; if (!f) continue; for (const [k, v] of Object.entries(f)) { if (v === null) delete sk[k]; else sk[k] = v; } }

  // 19차 사용자 패치: 궁수·마법사 스킬 칩 재구성(고유기와 겹치는 칩은 상점에서 뺀다)
  const DROP_SK = ['pierce', 'poisonarrow', 'huntmark', 'snare', 'multishot', 'snipe', 'lightrain', 'judgment', 'railshot', 'arrowstorm', 'skyarrows',
    'manaflow', 'light', 'fire', 'barrier', 'drainlife', 'purify', 'firestorm'];
  for (let i = SKILLS.length - 1; i >= 0; i--) if (DROP_SK.includes(SKILLS[i].id)) SKILLS.splice(i, 1);
  const KEEPFIX = { horn: { amt: 1.2, desc: '모든 아군 5초간 공격 속도 +20%(★마다 +8%p)' } };
  for (const sk of SKILLS) if (KEEPFIX[sk.id]) Object.assign(sk, KEEPFIX[sk.id]);
  // 20차 사용자 패치: 공용 칩 약화
  const ANYFIX = {
    aid: { cd: 10, power: 220, desc: '자신 체력 220 회복' },
    warcry: { cd: 8, mode: 'selfOnly', cells: null, n: 1, dur: 6, amt: 1.15, desc: '자신과 가장 가까운 아군 1명 6초간 공격 속도 +15%' },
    adrenaline: { cd: 12, amt: 1.6, desc: '자신 5초간 공격 속도 +60%' },
    secondwind: { cd: 12, power: 300, desc: '자신 보호막 300 + 해로운 효과 제거' },
    resolve: { effect: 'berserk', cd: 11, power: 0, dur: 6, red: null, desc: '자신 체력을 20%로 낮추고 6초간 공격 속도 +100%' },
  };
  for (const sk of SKILLS) { const f = ANYFIX[sk.id]; if (!f) continue; for (const [k, v] of Object.entries(f)) { if (v === null) delete sk[k]; else sk[k] = v; } }
  const X5 = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  SKILLS.push(
    // 궁수
    N_('firearrow', '불화살', 'arc', 1, { mode: 'single', effect: 'dmg', cd: 5, power: 60, burn: { dps: 30, dur: 3 }, icon: 'fire', desc: '대상에게 불화살 + 3초 화상(초당 30)' }),
    N_('anklearrow', '발목 화살', 'arc', 1, { mode: 'single', effect: 'dmg', cd: 5, power: 70, root: 2, icon: 'arrow', desc: '대상에게 화살 + 2초간 이동 불가' }),
    N_('marktarget', '표적 지정', 'arc', 1, { mode: 'single', effect: 'dmg', cd: 6, power: 0, mark: 3, icon: 'target', desc: '대상을 표시. 그 적을 때리는 아군 기본 공격 3번이 확정 치명(8초)' }),
    N_('poisoncloud', '독 구름 화살', 'arc', 2, { mode: 'target', effect: 'zone', cells: S3, cd: 9, power: 0, dur: 4, poison: { dps: 30, dur: 1.5 }, icon: 'skull', desc: '대상 중심 3×3에 4초 독 구름. 안에 있는 적 중독(초당 30)' }),
    N_('boomerang', '부메랑 화살', 'arc', 2, { mode: 'boomerang', effect: 'dmg', cd: 5, power: 100, icon: 'wind', desc: '대상까지 갔다 돌아오며 지나가는 적마다 위력 100씩 두 번' }),
    N_('smoke', '연막탄', 'arc', 2, { mode: 'target', effect: 'blind', cells: S3, cd: 10, power: 0, blind: [0.3, 0.5, 0.7], blindDur: 3, icon: 'eye', desc: '대상 중심 3×3 적 3초간 기본 공격이 빗나감(★1 30% · ★2 50% · ★3 70%)' }),
    N_('windwalk', '바람 걸음', 'arc', 2, { mode: 'selfOnly', effect: 'windwalk', cd: 7, power: 0, dur: 3, dodge: 0.4, amt: 1.2, icon: 'wind', desc: '자신 3초간 회피 +40%, 공격 속도 +20%' }),
    N_('antiheal', '치유 차단 화살', 'arc', 3, { mode: 'single', effect: 'dmg', cd: 9, power: 0, antiheal: 6, icon: 'skull', desc: '대상 6초간 받는 회복 −80%, 보호막을 받지 못함' }),
    N_('net', '그물 화살', 'arc', 3, { mode: 'target', effect: 'dmg', cells: S3, cd: 8, power: 80, root: 2, icon: 'arrow', desc: '대상 중심 3×3 적 위력 80 + 2초간 이동 불가' }),
    N_('aimedshot', '조준 저격', 'arc', 4, { mode: 'selfOnly', effect: 'aim', cd: 12, power: 900, delay: 2, icon: 'target', desc: '2초 조준 뒤 체력이 가장 높은 적에게 위력 900' }),
    N_('explosive', '폭발 화살', 'arc', 4, { mode: 'single', effect: 'explosive', cd: 10, power: 250, blast: 250, delay: 2, icon: 'fire', desc: '대상에게 위력 250, 2초 뒤 대상 중심 3×3에 위력 250 폭발' }),
    N_('bindchain', '결박 사슬', 'arc', 4, { mode: 'single', effect: 'bind', cd: 12, power: 0, dur: 6, amt: 0.5, icon: 'dagger', desc: '대상과 가장 가까운 적을 묶는다. 6초간 한쪽이 받는 피해의 50%를 다른 쪽도 받음' }),
    N_('stormeye', '폭풍의 눈', 'arc', 5, { mode: 'selfOnly', effect: 'storm', cd: 16, power: 0, dur: 5, icon: 'wind', desc: '5초간 공격 속도 ×2, 기본 공격이 대상 주변 1칸 적에게도 50%' }),
    N_('sureshot', '신궁', 'arc', 5, { mode: 'selfOnly', effect: 'sure', cd: 15, power: 0, dur: 5, critAdd: 1, icon: 'eye', desc: '5초간 기본 공격 전부 확정 치명 + 치명 피해 +100%' }),
    // 마법사
    N_('ignite', '점화', 'mag', 1, { mode: 'single', effect: 'dmg', cd: 4, power: 0, burn: { dps: 40, dur: 3 }, icon: 'fire', desc: '대상 3초 화상(초당 40)' }),
    N_('manashield', '마나 방패', 'mag', 1, { mode: 'lowestAlly', effect: 'shield', cd: 5, power: 150, icon: 'shield', desc: '체력 비율이 가장 낮은 아군 보호막 150' }),
    N_('frosttouch', '서리 손길', 'mag', 1, { mode: 'single', effect: 'dmg', cd: 5, power: 80, chill: { amt: 0.3, dur: 2 }, icon: 'ice', desc: '대상 위력 80 + 2초간 공격 속도 −30%' }),
    N_('spark', '전류', 'mag', 1, { mode: 'chain', effect: 'dmg', cd: 5, power: 70, jumps: 2, icon: 'bolt', desc: '대상과 가장 가까운 적 1명에게 위력 70씩' }),
    N_('silence', '침묵', 'mag', 2, { mode: 'single', effect: 'dmg', cd: 10, power: 100, silence: 2.5, icon: 'star', desc: '대상 위력 100 + 2.5초간 고유기·능력 사용 불가' }),
    N_('lifelink', '생명 연결', 'mag', 2, { mode: 'selfOnly', effect: 'lifelink', cd: 10, power: 0, icon: 'heart', desc: '체력 비율이 가장 낮은 아군과 가장 높은 아군의 체력 비율을 평균으로 맞춘다' }),
    N_('thornshield', '가시 보호막', 'mag', 2, { mode: 'selfOnly', effect: 'thornshield', cd: 8, power: 200, dur: 4, reflect: 0.3, icon: 'shield', desc: '적과 가장 가까운 아군 보호막 200 + 4초간 받는 피해 30% 반사' }),
    N_('polymorph', '변이', 'mag', 3, { mode: 'selfOnly', effect: 'polymorph', cd: 12, power: 0, dur: 3, vulnAmt: 0.2, icon: 'star', desc: '체력이 가장 높은 적(보스 제외)을 3초간 양으로. 행동 불가, 받는 피해 +20%' }),
    N_('manasurge', '마력 폭주', 'mag', 4, { mode: 'selfOnly', effect: 'surge', cd: 14, power: 0, dur: 6, icon: 'drop', desc: '6초간 자신 스킬 대기시간 2배 속도, 고유기 마나 2배로 참' }),
    N_('iceblessing', '얼음 축복', 'mag', 4, { mode: 'selfOnly', effect: 'invuln', cd: 12, power: 0, dur: 3, icon: 'ice', desc: '체력 비율이 가장 낮은 아군 3초 무적' }),
    N_('vampire', '흡혈귀', 'war', 3, { mode: 'selfOnly', effect: 'passive', passive: true, power: 0, ls: [0.05, 0.1, 0.15], icon: 'drop', desc: '패시브: 기본 공격으로 준 피해의 5%만큼 회복(★2 10% · ★3 15%)' }),
    N_('meteorshower', '운석 낙하', 'mag', 5, { mode: 'selfOnly', effect: 'meteors', cd: 18, power: 250, count: 6, icon: 'fire', desc: '3초 동안 무작위 적 위치에 운석 6개, 각각 3×3 위력 250' }),
  );

  // 아이템: st = 능력치(★에 따라 ×1.6/×2.5), fx = 역할을 바꾸는 효과
  const I_ = (id, name, cls, t, shape, st, fx, desc, feel) => ({ kind: 'item', id, name, cls, t, shape, st, fx, desc, feel });
  const ITEMS = [
    I_('longsword', '장검', 'war', 1, 'sword', { atk: 0.2 }, null, '공격력 +20%', '정석 검사'),
    I_('buckler', '둥근 방패', 'war', 1, 'shield', { hp: 0.14, armor: 0.1 }, null, '체력 +14%, 받는 피해 −10%', '탱커'),
    I_('twinblades', '쌍단검', 'war', 2, 'twin', { as: 0.2, crit: 0.15, critDmg: 0.25 }, 'ambush', '공격 속도 +20%, 치명 +15%, 치명 피해 +25%. 첫 3번 공격은 확정 치명(기습)', '도적'),
    I_('holymace', '성스러운 철퇴', 'war', 2, 'mace', { hp: 0.1 }, 'healMace', '체력 +10%. 공격할 때마다 가장 다친 아군을 공격력의 25%만큼 회복', '성기사'),
    I_('greatsword', '피의 대검', 'war', 3, 'greatsword', { atk: 0.2, lifesteal: 0.15 }, 'bloodthirst', '공격력 +20%, 흡혈 15%. 체력 50% 이하에서는 흡혈 25%', '광전사'),
    I_('warhammer', '전쟁 망치', 'war', 2, 'hammer', { atk: 0.1, hp: 0.1 }, 'cleave', '공격력·체력 +10%. 공격하면 대상 주변 적에게도 피해 25%', '제압'),
    I_('thornmail', '독 단도', 'war', 3, 'dagger', { as: 0.3, crit: 0.05 }, 'venomStack', '공격 속도 +30%, 치명 +5%. 공격할 때 5초 중독(초당 20), 끝없이 겹침', '암살자'),
    I_('dragonslayer', '그림자 검', 'war', 4, 'sword', { atk: 0.25, crit: 0.1 }, 'multiHit', '공격력 +25%, 치명 +10%. 기본 공격이 30% 확률로 2번, 10% 확률로 3번', '암살자'),
    I_('towershield', '수호자의 탑 방패', 'war', 4, 'tower', { hp: 0.3, armor: 0.15 }, 'guardHeal', '체력 +30%, 받는 피해 −15%. 받은 피해의 10%만큼 체력 비율이 가장 낮은 아군 회복', '수호자'),
    I_('shortbow', '단궁', 'arc', 1, 'bow', { as: 0.14 }, null, '공격 속도 +14%', '정석 궁수'),
    I_('longbow', '장궁', 'arc', 1, 'bow', { range: 1, atk: 0.12 }, 'longshot', '사거리 +1, 공격력 +12%. 3칸 이상 떨어진 적에게 주는 피해 +25%', '저격수'),
    I_('venombow', '독궁', 'arc', 2, 'bow', { atk: 0.05 }, 'venomBonus', '공격력 +5%. 공격 시 3초 중독(초당 15). 중독된 적에게 주는 피해 +15%', '독 사냥꾼'),
    I_('quiver', '도적의 단검', 'arc', 2, 'dagger', { atk: 0.25, as: 0.2, hp: 0.15, melee: true }, null, '근접 공격(사거리 1), 공격력 +25%, 공격 속도 +20%, 체력 +15%', '도적'),
    I_('rabbitbow', '토끼활', 'arc', 2, 'bow', { as: 0.25, atk: 0.1, dodge: 0.1, range: -1 }, 'rabbitHop', '사거리 −1, 공격 속도 +25%, 공격력 +10%, 회피 +10%. 공격 3번마다 적과 멀어지는 쪽으로 한 칸 깡충 물러남', '치고 빠지기'),
    I_('whistle', '사냥매 호루라기', 'arc', 3, 'tooth', {}, 'hawkFocus', '전투 시작 시 사냥매 소환, 같은 적 연속 공격 피해 증가', '사냥꾼'),
    I_('flamebow', '화염 활', 'arc', 2, 'bow', { atk: 0.12 }, 'burnCrit', '공격력 +12%. 공격 시 3초 화상. 화상 걸린 적에게 치명 확률 +25%', '화상 궁수'),
    I_('windcloak', '그림자 망토', 'arc', 3, 'cloak', { as: 0.2, dodge: 0.2, hp: 0.1, melee: true }, 'evasive', '근접 공격(사거리 1), 공격 속도 +20%, 회피 +20%, 체력 +10%. 회피하면 다음 공격 치명타', '도적'),
    I_('eagleeye', '매의 눈 반지', 'arc', 4, 'ring', { range: 1, crit: 0.25 }, 'headshot', '사거리 +1, 치명 +25%, 치명 피해 +40%', '저격수'),
    I_('hornbow', '갈고리 쌍검', 'arc', 4, 'twin', { atk: 0.2, crit: 0.15, hp: 0.1, melee: true }, 'hookRoot', '근접 공격(사거리 1), 공격력 +20%, 치명 +15%, 체력 +10%. 4번째 공격마다 대상 2초 이동 불가', '도적'),
    I_('wand', '견습 지팡이', 'mag', 1, 'wand', { manaPerHit: 4, spell: 0.03 }, null, '공격할 때마다 마나 +4, 스킬 위력 +3%', '정석 마법사'),
    I_('frostorb', '서리 오브', 'mag', 1, 'orb', { spell: 0.12 }, 'spellSlow', '스킬 위력 +12%. 스킬에 맞은 적 둔화', '제어'),
    I_('firestaff', '화염 지팡이', 'mag', 2, 'staff', { spell: 0.3 }, 'spellBurn', '스킬 위력 +30%. 스킬에 맞은 적 화상', '공격'),
    I_('prayerbook', '성서', 'mag', 2, 'book', { heal: 0.1 }, 'healer', '치유 +10%. 다친 아군이 있으면 기본 공격 대신 그 아군을 공격력의 45%만큼 치유', '힐러'),
    I_('hourglass', '시간의 모래시계', 'mag', 3, 'grail', { mana: 25 }, 'hourglass', '마나 25로 시작. 고유기를 쓰면 주변 1칸 아군 마나 +15, 자신 스킬 대기시간 2초 감소', '지원'),
    I_('manaring', '마나 반지', 'mag', 2, 'ring', { mana: 10 }, 'manaRegen', '마나 10으로 시작. 초당 마나 +3. 장착 스킬 대기시간 −15%', '빠른 시전'),
    I_('lifeorb', '생명의 수정', 'mag', 3, 'orb', { spell: 0.3, heal: 0.14, hp: 0.15 }, 'spellLeech', '스킬 위력 +30%, 치유 +14%, 체력 +15%. 스킬 피해의 25% 회복', '흡혈 마법사'),
    I_('stormstaff', '폭풍의 지팡이', 'mag', 4, 'staff', { spell: 0.18, manaPerHit: 3 }, 'stormHit', '스킬 위력 +18%. 기본 공격이 가까운 적 둘에게 번개(공격력 35%)', '연쇄 공격'),
    I_('vampsword', '흡혈귀의 검', 'war', 5, 'sword', { as: 1 }, 'vampire', '공격 속도 +100%. 전투를 체력 50%로 시작. 공격할 때마다 흡혈 +1%(전투 동안 누적)', '흡혈귀'),
    I_('archstaff', '대마법사의 지팡이', 'mag', 4, 'staff', { spell: 0.4, mana: 20 }, 'echo', '스킬 위력 +40%, 마나 20으로 시작. 고유기 3번마다 한 번 더(60%)', '폭딜'),
  ];
  // 아이템 액티브: 재사용 대기시간마다 저절로 쓰는 기술(스킬과 같은 형식). 나머지 아이템 효과는 패시브
  const ITEM_ACT = {
    longsword: [{ name: '베어 넘기기', cd: 8, mode: 'facing', effect: 'dmg', cells: [[1, -1], [1, 0], [1, 1]], power: 170, icon: 'slash' }, '8초마다 앞쪽 3칸 베기'],
    buckler: [{ name: '방패 막기', cd: 10, mode: 'selfOnly', effect: 'shield', power: 160, icon: 'shield' }, '10초마다 자신 보호막'],
    shortbow: [{ name: '쌍발', cd: 7, mode: 'volley', effect: 'dmg', focus: true, count: 2, power: 90, icon: 'arrow' }, '7초마다 대상에게 화살 2발'],
    quiver: [{ name: '그림자 찌르기', cd: 9, mode: 'leap', effect: 'dmg', power: 220, icon: 'dagger' }, '9초마다 체력이 가장 낮은 적 옆으로 뛰어들어 찌르기'],
    wand: [{ name: '마력 화살', cd: 6, mode: 'single', effect: 'dmg', power: 130, icon: 'star' }, '6초마다 대상에게 마력 화살'],
    eagleeye: [{ name: '매의 눈 저격', cd: 10, mode: 'farthest', effect: 'dmg', power: 340, vuln: { amt: 0.2, dur: 3 }, icon: 'target' }, '10초마다 가장 먼 적 저격, 맞은 적 3초간 받는 피해 +20%'],
  };
  for (const it of ITEMS) { const a = ITEM_ACT[it.id]; if (!a) continue; it.act = Object.assign({ kind: 'act', id: 'a_' + it.id, cls: it.cls, t: it.t }, a[0]); it.desc += '. ' + a[1]; }

  // 보스 전용 아이템(5등급): 상점에 나오지 않고 보스 전리품으로만 확률적으로 떨어진다. 한 판에 한 장씩
  const SP_ = (...a) => Object.assign(I_(...a), { special: true });
  ITEMS.push(
    SP_('kingsword', '왕의 대검', 'war', 5, 'sword', { atk: 0.3, hp: 0.2 }, 'cleave', '공격력 +30%, 체력 +20%. 공격하면 대상 주변 적에게도 피해 25%', '보스 전리품'),
    SP_('aegis', '불멸의 방패', 'war', 5, 'shield', { hp: 0.22, armor: 0.06 }, 'lastStand', '체력 +22%, 받는 피해 −6%. 체력 35% 아래로 처음 떨어지면 체력 20% 보호막 + 3초간 받는 피해 −25%', '보스 전리품'),
    SP_('stormbow', '폭풍의 활', 'arc', 5, 'bow', { as: 0.25, atk: 0.15 }, 'multiShot', '공격 속도 +25%, 공격력 +15%. 공격할 때마다 가까운 다른 적에게 화살 한 발 더(40%)', '보스 전리품'),
    SP_('dragoneye', '용의 눈', 'arc', 5, 'ring', { range: 1, crit: 0.3, atk: 0.15 }, 'deadeye', '사거리 +1, 치명 +30%, 공격력 +15%. 치명 피해 +50%, 체력 50% 이하 적에게 피해 +25%', '보스 전리품'),
    SP_('philostone', '현자의 돌', 'mag', 5, 'orb', { spell: 0.45, mana: 30 }, 'sageStone', '스킬 위력 +45%, 마나 30으로 시작. 초당 마나 +5', '보스 전리품'),
    SP_('abysstome', '심연의 서', 'mag', 5, 'book', { spell: 0.55, hp: 0.25 }, 'abyss', '스킬 위력 +55%, 체력 +25%. 스킬에 맞은 적 화상, 스킬 피해의 25% 회복', '보스 전리품'),
  );

  // 시너지
  // 유닛(성격) 10종: 'count' = 서로 다른 딱지 수, 'combo' = 지정한 딱지가 전부, 'peer' = 같은 등급 딱지 수
  // 무기 스타일 9종: 'job' = 출전 딱지가 쥔 그 스타일 무기의 종류 수. 효과는 그 무기를 쥔 딱지가 받는다
  const TRAITS = {
    novice: { name: '견습', short: '견', col: '#8a9a5b', kind: 'combo', members: ['squire', 'archer', 'apprentice'],
      desc: ['견습 셋이 모이면 모든 아군 피해 +8%, 고유기 마나 −10%, 받는 피해 −8%'] },
    mentor: { name: '스승과 제자', short: '스', col: '#a8508a', kind: 'combo', members: ['archmage', 'apprentice'],
      desc: ['둘이 함께면 견습 마법사 스킬 위력 ×2, 대마법사 고유기 마나 −30%'] },
    twins: { name: '불과 얼음', short: '남', col: '#d0603a', kind: 'combo', members: ['pyro', 'cryo'],
      desc: ['남매가 함께면 둘 다 스킬 위력 +30%, 고유기 마나 −15%'] },
    stars: { name: '별의 인도', short: '별', col: '#c48a00', kind: 'combo', members: ['cryo', 'ninja', 'bishop'],
      desc: ['셋이 모이면 모든 아군 치명타 +25%, 치명 피해 +60%, 공격 속도 +15%'] },
    artisan: { name: '장인', short: '장', col: '#8a6a3c', kind: 'count', th: [2, 3, 4], members: ['shieldman', 'hammer', 'crossbow', 'arbalest', 'monk'],
      desc: ['장인이 쥔 무기 수치 ×1.25', '장인이 쥔 무기 수치 ×1.5', '장인이 쥔 무기 수치 ×1.75'] },
    noble: { name: '귀족', short: '귀', col: '#7a4fa0', kind: 'count', th: [2, 3, 4], members: ['warden', 'paladin', 'archmage', 'bishop', 'ninja'],
      desc: ['귀족 체력 +12%', '귀족 체력 +24%, 받는 피해 −8%', '귀족 체력 +36%, 받는 피해 −15%'] },
    wild: { name: '야생', short: '야', col: '#5fa043', kind: 'count', th: [2, 4, 6], members: ['archer', 'venom', 'hunter', 'acolyte', 'scout', 'windarcher', 'summoner'],
      desc: ['모든 아군 초당 체력 1% 재생', '모든 아군 초당 체력 2% 재생, 소환물 체력·공격 +60%', '모든 아군 초당 체력 3% 재생, 소환물 체력·공격 +120%'] },
    veteran: { name: '베테랑', short: '베', col: '#7a5a3c', kind: 'count', th: [2, 4, 6], members: ['shieldman', 'merc', 'duelist', 'hunter', 'ranger', 'blademaster', 'berserker', 'warlock'],
      desc: ['베테랑 공격력 +25%', '베테랑 공격력 +40%', '베테랑 공격력 +50%, 적을 쓰러뜨리면 체력 15% 회복'] },
    gale: { name: '질풍', short: '질', col: '#2f8fd0', kind: 'count', th: [2, 4, 6], members: ['archer', 'apprentice', 'pyro', 'hunter', 'berserker', 'windarcher', 'blademaster'],
      desc: ['모든 아군 공격 속도 +8%, 질풍 +10% 더', '모든 아군 공격 속도 +16%, 질풍 +10% 더', '모든 아군 공격 속도 +25%, 질풍 +10% 더'] },
    peer: { name: '동급', short: '동', col: '#9a7b3a', kind: 'peer', th: [3, 4, 5], members: [],
      desc: ['같은 등급 딱지 3명: 그 딱지들 체력·공격 +12%', '같은 등급 4명: 체력·공격 +20%', '같은 등급 5명: 체력·공격 +30%'] },
    // ---- 무기 스타일 ----
    j_knight: { name: '기사', short: '기', col: '#3a5fa8', kind: 'job', cls: 'war', th: [2, 3], members: ['buckler', 'holymace', 'towershield'],
      desc: ['기사 무기를 쥔 딱지 받는 피해 −15%', '받는 피해 −25%, 체력 +10%'] },
    j_merc: { name: '용병', short: '용', col: '#b07a2a', kind: 'job', cls: 'war', th: [2, 3], members: ['longsword', 'greatsword', 'warhammer'],
      desc: ['용병 공격력 +15%, 승리하면 골드 +1', '용병 공격력 +30%, 승리하면 골드 +2'] },
    j_assassin: { name: '암살자', short: '암', col: '#4a3f6b', kind: 'job', cls: 'war', th: [2, 3], members: ['twinblades', 'thornmail', 'dragonslayer', 'vampsword'],
      desc: ['암살자 치명 +15%, 치명 피해 +30%', '암살자 치명 +30%, 치명 피해 +60%'] },
    j_hunter: { name: '사냥꾼', short: '냥', col: '#5f7a2a', kind: 'job', cls: 'arc', th: [2, 3], members: ['shortbow', 'venombow', 'whistle', 'rabbitbow'],
      desc: ['사냥꾼 공격 속도 +15%', '사냥꾼 공격 속도 +30%, 공격력 +10%'] },
    j_sniper: { name: '저격수', short: '저', col: '#2e7d5b', kind: 'job', cls: 'arc', th: [2, 3], members: ['longbow', 'flamebow', 'eagleeye'],
      desc: ['저격수 치명 피해 +40%', '저격수 치명 피해 +80%, 사거리 +1'] },
    j_rogue: { name: '도적', short: '도', col: '#6b3f4a', kind: 'job', cls: 'arc', th: [2, 3], members: ['quiver', 'windcloak', 'hornbow'],
      desc: ['도적(근접) 회피 +12%, 공격 속도 +12%', '도적 회피 +22%, 공격 속도 +25%'] },
    j_elemental: { name: '원소술사', short: '원', col: '#d0603a', kind: 'job', cls: 'mag', th: [2, 3], members: ['firestaff', 'frostorb', 'stormstaff'],
      desc: ['원소술사 스킬 위력 +20%', '원소술사 스킬 위력 +40%'] },
    j_priest: { name: '사제', short: '사', col: '#2e9e6b', kind: 'job', cls: 'mag', th: [2, 3], members: ['prayerbook', 'lifeorb', 'hourglass'],
      desc: ['사제 치유·보호막 +25%', '사제 치유·보호막 +50%, 전투 시작 시 모든 아군 보호막 150'] },
    j_magus: { name: '마도사', short: '마', col: '#6a4fc0', kind: 'job', cls: 'mag', th: [2, 3], members: ['wand', 'manaring', 'archstaff'],
      desc: ['마도사 시작 마나 +20, 마나 획득 +20%', '마도사 시작 마나 +40, 마나 획득 +40%'] },
  };
  for (const u of UNITS) u.traits = Object.keys(TRAITS).filter((k) => TRAITS[k].kind !== 'job' && TRAITS[k].members.includes(u.id));
  for (const it of ITEMS) it.job = Object.keys(TRAITS).find((k) => TRAITS[k].kind === 'job' && TRAITS[k].members.includes(it.id)) || null;

  const DEF = {};
  for (const d of [...UNITS, ...SKILLS, ...ITEMS]) DEF[d.kind + ':' + d.id] = d;

  const ODDS = { 3: [70, 30, 0, 0, 0], 4: [50, 38, 12, 0, 0], 5: [35, 38, 24, 3, 0], 6: [25, 33, 30, 10, 2], 7: [18, 27, 33, 18, 4], 8: [12, 20, 33, 26, 9], 9: [8, 15, 32, 30, 15] };
  const XPNEED = { 3: 6, 4: 10, 5: 16, 6: 24, 7: 32, 8: 44 };
  const MAXLV = 9, LAST_ACT = 5;
  const POOL_N = [0, 30, 25, 20, 15, 10]; // 공용 풀: 카드 한 종류당 등급별 장수
  const MAXT = { unit: 5, skill: 5, item: 5 };
  const BENCH = 8;

  const RELICS = {
    banner: { name: '전투 깃발', desc: '모든 아군 체력 +6%' },
    pauldron: { name: '철갑 견갑', desc: '모든 아군 받는 피해 −5%' },
    horn: { name: '전쟁 뿔피리', desc: '모든 아군 마나 +15로 시작' },
    drum: { name: '전쟁 북', desc: '전투 시작 4초간 아군 공격 속도 +25%' },
    snowglobe: { name: '눈의 구슬', desc: '전투 시작 시 모든 적 2초 둔화' },
    ember: { name: '꺼지지 않는 불씨', desc: '아군이 입히는 화상 피해 +40%' },
    venomgland: { name: '독샘', desc: '아군이 입히는 중독 피해 +40%' },
    hook: { name: '피 묻은 갈고리', desc: '아군이 입히는 출혈 피해 +40%' },
    thornmail: { name: '가시 갑옷', desc: '모든 아군 근접 피해 6% 반사' },
    whistle: { name: '사냥 호루라기', desc: '소환물 체력·공격력 +30%' },
    phoenix: { name: '불사조 깃털', desc: '한 번, 전투에서 져도 원정이 끝나지 않음' },
    goldtooth: { name: '금니', desc: '전투 승리 시 골드 +1' },
    bigbag: { name: '큰 배낭', desc: '창고 +2칸' },
    scale: { name: '상인의 저울', desc: '라운드마다 첫 다시 뽑기 무료' },
    vault: { name: '황금 금고', desc: '이자 최대치 +2' },
    glue: { name: '합성 아교', desc: '합성할 때마다 골드 +1' },
    flag: { name: '지휘관의 깃발', desc: '출전 인원 +1' },
    dice: { name: '행운의 주사위', desc: '상점 등급 확률이 레벨 1 높은 것처럼' },
    whetstone: { name: '숫돌', desc: '전사 공격력 +8%' },
    feather: { name: '매의 깃털', desc: '궁수 공격 속도 +8%' },
    prism: { name: '마력 수정', desc: '마법사 스킬 위력 +10%' },
    crown: { name: '상인의 왕관', desc: '라운드 수입 +1골드' },
    anvil: { name: '모루', desc: '레벨업 비용 4 → 3골드' },
    bloodstone: { name: '피의 돌', desc: '모든 아군 흡혈 +5%' },
    sandglass: { name: '은 모래시계', desc: '전투 시작 5초간 아군 받는 피해 −20%' },
    lens: { name: '확대경', desc: '모든 아군 치명타 +6%' },
    lantern: { name: '수호 등불', desc: '전투마다 처음 쓰러지는 아군 하나가 체력 20%로 일어남' },
    tome: { name: '고대 마법서', desc: '모든 아군 마나 획득 +15%' },
    victoryhorn: { name: '승리의 나팔', desc: '정예·보스 전투에서 모든 아군 공격력 +8%' },
    shard: { name: '별 조각', desc: '합성할 때마다 경험치 +1' },
    crest: { name: '용사의 문장', desc: '정예·보스에게 주는 피해 +8%' },
  };

  const NODE = {
    fight: { name: '전투', icon: 'slash', col: '#4b5160', info: '일반 몬스터. 이기면 다음 층으로. 지면 원정 끝.' },
    elite: { name: '정예', icon: 'skull', col: '#d6335a', info: '강한 적. 이기면 한 등급 높은 카드 3장 중 1장을 고릅니다. 지면 원정 끝.' },
    shop: { name: '암시장', icon: 'star', col: '#c48a00', info: '이번 라운드 상점 등급 확률이 한 단계 오른다. 절반 확률로 보스 전용 아이템을 판다. 전투 없음.' },
    forge: { name: '대장간', icon: 'fist', col: '#5b6475', info: '골드를 내고 복제하거나, 담금질(★+1 또는 부서짐)·단조(아이템 둘 → 한 등급 높은 하나)·개조. 전투 없음.' },
    camp: { name: '야영지', icon: 'fire', col: '#e07a00', info: '경험치 +6, 또는 골드 +6. 35% 확률로 야습(정예급 전투)을 이겨야 쉴 수 있다.' },
    event: { name: '이벤트', icon: 'eye', col: '#7a4fd0', info: '선택에 따라 보상·비용·함정·정예급 전투가 생길 수 있습니다.' },
    treasure: { name: '보물', icon: 'heart', col: '#2e9e6b', info: '유물 3개 중 1개. 30% 확률로 미믹(정예급 전투), 이기면 골드 +3도.' },
    boss: { name: '보스', icon: 'skull', col: '#232a3b', info: '막의 주인. 이기면 유물과 높은 등급 스킬·아이템을 고릅니다(40% 보스 전용 아이템). 마지막 보스를 이기면 원정 완수.' },
  };

  const DIFF = {
    // foeHp: 적 체력 배수, foeAtk: 적 공격력(스킬 위력 포함) 배수
    normal: { name: '보통', desc: '기본 난이도', foeHp: 2.0, foeAtk: 1.5, phoenix: false },
    hard: { name: '어려움', desc: '적이 더 강하다', foeHp: 3.0, foeAtk: 2.25, phoenix: false },
    hell: { name: '지옥', desc: '적이 훨씬 강하다', foeHp: 4.0, foeAtk: 3.0, phoenix: false },
  };

  // 적 강도: 일반 적 한 마리의 체력·공격이 1막 대비 2막 2배 · 3막 4배 · 4막 8배 · 5막 15배가 되도록 막마다 맞춘 배수.
  // 막 안에서는 라운드마다 ×ramp(막 가운데가 기준). 정예전은 같은 라운드 일반전 대비 체력 합 1.5배·초당 피해 1.25배,
  // 보스전은 막 마지막 일반전 대비 체력 합 2배·초당 피해 1.2배가 되도록(처음 3배·1.4배로 맞춘 뒤 ×2/3·×6/7) 핵심 적(정예 0번·보스)마다 따로 맞췄다
  // (같은 막의 정예·보스끼리는 체력×공격이 같고, 체력과 공격의 비율은 원래 개성을 따른다). 난이도 배수는 여기에 곱한다.
  const ACT_LEN = 9; // 한 막의 칸 수(첫 전투 1 + 중간 7 + 보스 1)
  const FOE = {
    mult: [0, 1, 2, 4, 8, 15], ramp: 1.08,
    normal: { hp: [0, 1.65, 1.936, 2.528, 3.916, 5.504], atk: [0, 1.18, 1.469, 2.044, 4.51, 6.354] },
    elite: { ogre: [0.807, 0.721], alpha: [0.825, 0.737], banditchief: [0.827, 0.739], dknight: [2.123, 3.007], gargoyle: [3.033, 4.295], banshee: [3.588, 5.082], giant: [3.676, 5.606], dragonkin: [6.483, 9.887], demonknight: [3.97, 6.055], frostgiant: [6.142, 9.944], yetichief: [8.865, 14.353], iceknight: [8.585, 13.899], archdemon: [10.518, 14.05], fallen: [24.442, 32.649], succubus: [36.488, 48.74] },
    boss: { gobking: [1.729, 2.175], slimeking: [1.935, 2.433], lich: [3.739, 5.535], vampire: [3.406, 5.043], dragon: [4.691, 8.771], surt: [4.861, 9.089], icequeen: [9.511, 17.069], yetiking: [7.312, 13.122], abysslord: [13.543, 30.218], fallenking: [9.251, 20.639] },
  };

  // 3막 두 번째 보스(몬스터·막 원본은 GD 를 이 페이지에서만 늘린다)
  const GM = GD.MONSTERS;
  if (!GM.surt) {
    GM.surt = { id: 'surt', kind: 'monster', name: '불의 거인왕 수르트', act: 3, v: 99, hp: 5600, atk: 118, as: 0.55, range: 1, color: '#a8321f', skills: [], boss: 'surt', armor: 0.1,
      desc: '보스. 세로줄을 내려쳐 태우고 임프를 부른다. 분노하면 주변을 불사른다.' };
    GD.ACTS[3].bosses.push('surt');
    GM.lich.hp = Math.round(GM.lich.hp * 1.3); // 2막 두 보스 난이도 맞춤
    GD.BOSS_INFO.surt = '6초마다 아군 하나가 선 세로줄을 통째로 내려칩니다(화상). 8초마다 임프를 부르고, 체력 50% 이하에서 분노해 공격 속도가 오르고 4초마다 주변 8칸을 태웁니다. 세로로 겹치지 않게 흩어 두세요.';
  }

  // 4막·5막(원정 확장): 몬스터·막·보스 설명
  if (!GM.yeti) {
    const MO = (id, name, act, v, hp, atk, as, range, color, extra) => (GM[id] = Object.assign({ id, kind: 'monster', name, act, v, hp, atk, as, range, color, skills: [] }, extra || {}));
    MO('yeti', '설인', 4, 2, 1900, 88, 0.65, 1, '#e8eef4', { armor: 0.1, desc: '두꺼운 털가죽으로 버틴다.' });
    MO('frostwolf', '서리 늑대', 4, 1.5, 1200, 82, 1.0, 1, '#a8c8e0', { desc: '눈밭을 빠르게 내달린다.' });
    MO('icesprite', '얼음 정령', 4, 2, 1000, 70, 0.6, 3, '#bfe8ff', { skills: ['ice'], mana: 60, desc: '얼음 창으로 줄을 꿰뚫고 둔화시킨다.' });
    MO('frostskel', '빙결 해골', 4, 1.5, 1400, 86, 0.75, 1, '#bfe8ff', { skills: ['sweep'], mana: 60, desc: '얼어붙은 칼로 가로 3칸을 벤다.' });
    MO('snowarcher', '설원 사냥꾼', 4, 1.5, 1050, 90, 0.75, 3, '#e8eef4', { desc: '눈보라 속에서 화살을 쏜다.' });
    MO('icewitch', '얼음 마녀', 4, 2.5, 1200, 66, 0.6, 3, '#3b6b9a', { skills: ['blizzard'], mana: 90, desc: '눈보라로 3×3을 얼리고 약화시킨다.' });
    MO('mammoth', '털매머드', 4, 3, 3200, 100, 0.5, 1, '#7a5a3a', { armor: 0.2, skills: ['quake'], mana: 80, desc: '땅을 굴러 주변을 흔들고 둔화시킨다.' });
    MO('frostgolem', '서리 골렘', 4, 2.5, 2600, 80, 0.55, 1, '#9ab8d0', { armor: 0.25, desc: '얼음 덩어리. 매우 단단하다.' });
    MO('frostgiant', '서리 거인', 4, 8, 8000, 160, 0.5, 1, '#8ab8d8', { skills: ['whirl'], mana: 80, elite: true, desc: '정예. 거대한 얼음 몽둥이로 주변 8칸을 휩쓴다.' });
    MO('yetichief', '설인 우두머리', 4, 5, 3200, 120, 0.8, 1, '#f4f6fa', { skills: ['cross'], mana: 60, armor: 0.1, elite: true, desc: '정예. 설인 무리를 이끈다.' });
    MO('iceknight', '얼음 기사', 4, 6, 3600, 130, 0.7, 1, '#dcecf8', { skills: ['earth'], mana: 80, armor: 0.2, elite: true, desc: '정예. 대지를 갈라 줄을 기절시킨다.' });
    MO('icequeen', '얼음 여왕 시엘라', 4, 99, 7000, 105, 0.6, 3, '#6a9ac8', { boss: 'icequeen', immobile: true, armor: 0.1, desc: '보스. 아군을 얼음 감옥에 가두고 정령을 부른다.' });
    MO('yetiking', '설인 왕 우가', 4, 99, 8200, 130, 0.7, 1, '#f4f6fa', { boss: 'yetiking', armor: 0.15, desc: '보스. 땅을 내려찍어 기절시키고 설인을 부른다.' });
    MO('demon', '악마 병사', 5, 2, 2400, 110, 0.75, 1, '#c84a4a', { lifesteal: 0.1, skills: ['cross'], mana: 60, desc: '피를 빨며 십자로 벤다.' });
    MO('shade', '그림자', 5, 2, 1500, 115, 0.95, 1, '#2b2340', { dodge: 0.3, desc: '흐릿해서 잘 맞지 않는다.' });
    MO('abyssmage', '심연 술사', 5, 2.5, 1400, 90, 0.6, 3, '#2b1f3b', { skills: ['chain'], mana: 80, desc: '연쇄 번개를 날린다.' });
    MO('hellhound', '지옥견', 5, 2, 1700, 105, 1.05, 1, '#3b2b2b', { proc: 'burnHit', desc: '물면 불이 붙는다.' });
    MO('fallen', '타락 기사', 5, 3, 3000, 120, 0.65, 1, '#4a4658', { armor: 0.2, skills: ['earth'], mana: 90, desc: '대지를 갈라 줄을 기절시킨다.' });
    MO('succubus', '서큐버스', 5, 2.5, 1500, 100, 0.7, 3, '#e0a0c0', { skills: ['drainlife'], mana: 60, desc: '생명을 빨아 회복한다.' });
    MO('darkpriest', '타락 사제', 5, 2.5, 1500, 70, 0.6, 3, '#5a1f3b', { skills: ['light'], mana: 70, desc: '동료를 치유한다. 먼저 노려라.' });
    MO('abomination', '흉물', 5, 3.5, 4200, 110, 0.5, 1, '#7a4a6a', { proc: 'poisonHit', desc: '느리고 질기며, 닿으면 중독된다.' });
    MO('archdemon', '대악마', 5, 9, 9500, 190, 0.7, 1, '#a83232', { skills: ['whirl', 'earth'], mana: 70, lifesteal: 0.15, elite: true, desc: '정예. 피를 빨며 주변을 휩쓸고 대지를 가른다.' });
    MO('abysslord', '심연의 군주 녹스', 5, 99, 9500, 125, 0.55, 3, '#3b2b5a', { boss: 'abysslord', immobile: true, armor: 0.1, desc: '최종 보스. 어둠의 창과 그림자, 분노하면 심연 폭발.' });
    MO('fallenking', '타락한 왕 모르간', 5, 99, 12500, 160, 0.7, 1, '#4a1f3b', { boss: 'fallenking', armor: 0.15, desc: '최종 보스. 처형의 일격과 어둠의 방패, 분노하면 기사를 부른다.' });
    // 막이 바뀌는 첫 전투가 너무 튀지 않게 기본치를 조금 낮춘다(라운드에 따른 강화가 따로 붙는다)
    for (const m of Object.values(GM)) if (m.act === 5 && !m.boss) { m.hp = Math.round(m.hp * 0.88); m.atk = Math.round(m.atk * 0.9); }
    GD.ACTS[4] = { name: '얼어붙은 봉우리', normal: ['yeti', 'frostwolf', 'icesprite', 'frostskel', 'snowarcher', 'icewitch', 'mammoth', 'frostgolem'],
      elites: [['frostgiant'], ['yetichief', 'yeti', 'yeti'], ['iceknight', 'frostskel']], bosses: ['icequeen', 'yetiking'], story: '화산 너머 얼음 봉우리. 숨결마저 얼어붙는다.' };
    GD.ACTS[5] = { name: '심연의 성채', normal: ['demon', 'shade', 'abyssmage', 'hellhound', 'fallen', 'succubus', 'darkpriest', 'abomination'],
      elites: [['archdemon'], ['fallen', 'fallen', 'shade'], ['succubus', 'abomination', 'darkpriest']], bosses: ['abysslord', 'fallenking'], story: '봉우리 꼭대기에 열린 심연의 문. 모든 것의 끝이 기다린다.' };
    Object.assign(GD.BOSS_INFO, {
      icequeen: '움직이지 않습니다. 5초마다 아군 둘의 칸에 얼음 감옥(피해 + 1.5초 기절), 10초마다 얼음 정령을 부릅니다. 체력 50% 이하에서 6초마다 한 줄 전체에 눈보라(둔화). 흩어 두세요.',
      yetiking: '5초마다 아군 하나 중심 3×3을 내려찍어 기절시키고, 9초마다 설인을 부릅니다. 체력 50% 이하에서 분노해 빠르고 세집니다. 앞줄을 단단하게.',
      abysslord: '움직이지 않습니다. 6초마다 아군이 선 세로줄에 어둠의 창(받는 피해 증가), 10초마다 그림자를 부릅니다. 체력 50% 이하에서 2×2 심연 폭발 셋을 떨어뜨립니다.',
      fallenking: '5초마다 앞쪽 3×2에 처형의 일격, 8초마다 어둠의 방패(보호막)를 두릅니다. 체력 50% 이하에서 타락 기사 둘을 부르고 빨라집니다. 보호막이 오르기 전에 몰아치세요.',
    });
  }

  global.V4 = { CLS, SYN, TRAITS, UNITS, SKILLS, ITEMS, DEF, ODDS, XPNEED, MAXLV, LAST_ACT, POOL_N, MAXT, BENCH, RELICS, NODE, DIFF, FOE, ACT_LEN };
})(window);
