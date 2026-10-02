/* 카드 원정대 — 게임 데이터
 * 스킬 패턴 좌표
 *   facing       [앞, 옆]  시전자 기준, 대상 쪽을 바라보는 방향으로 회전 (예: [1,0] 바로 앞, [1,-1] 앞-왼쪽)
 *   targetFacing [앞, 옆]  대상 칸 기준, 시전자가 바라보는 방향으로 회전
 *   self         [dx, dy]  시전자 기준 절대 좌표
 *   target       [dx, dy]  대상 기준 절대 좌표
 *   line                  바라보는 방향으로 보드 끝까지
 */
(function (global) {
  'use strict';

  const CLASSES = {
    sword: { name: '검', full: '검 계열', color: '#2f6fd6' },
    bow: { name: '궁', full: '궁 계열', color: '#2e9e6b' },
    mage: { name: '마', full: '마법 계열', color: '#7a4fd0' },
    holy: { name: '신', full: '신성 계열', color: '#c48a00' },
    any: { name: '공', full: '공용', color: '#5b6475' },
  };

  const AROUND8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const SQ3 = [[0, 0], ...AROUND8];
  const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const SQ5 = [];
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x || y) SQ5.push([x, y]);

  // ---------- 스킬 카드 ----------
  const SK = (id, name, cls, cost, mana, power, mode, cells, effect, desc, extra) =>
    Object.assign({ id, kind: 'skill', name, cls, cost, mana, power, mode, cells, effect, desc, rare: false }, extra || {});
  const SKILLS = [
    // 검
    SK('cross', '십자 베기', 'sword', 1, 60, 170, 'facing', [[1, 0], [2, 0], [1, -1], [1, 1]], 'dmg', '앞 2칸과 앞칸 양옆 1칸을 벤다'),
    SK('sweep', '횡베기', 'sword', 1, 50, 140, 'facing', [[1, -1], [1, 0], [1, 1]], 'dmg', '앞쪽 가로 3칸을 휩쓴다'),
    SK('thrust', '돌진 찌르기', 'sword', 1, 60, 200, 'facing', [[1, 0], [2, 0], [3, 0]], 'dmg', '앞으로 3칸을 꿰뚫는다'),
    SK('whirl', '회전 베기', 'sword', 2, 80, 180, 'self', AROUND8, 'dmg', '주변 8칸을 모두 벤다'),
    SK('taunt', '도발', 'sword', 1, 60, 260, 'self', SQ5, 'taunt', '주변 2칸 적이 3초간 자신만 노린다. 보호막 260'),
    SK('earth', '대지 가르기', 'sword', 2, 90, 260, 'facing', [[1, 0], [2, 0], [3, 0], [4, 0], [2, -1], [2, 1]], 'dmg', '앞으로 4칸 + 2칸째 양옆. 1.2초 기절', { stun: 1.2, rare: true }),
    // 궁
    SK('pierce', '관통 사격', 'bow', 1, 60, 150, 'line', null, 'dmg', '바라보는 방향 끝까지 관통'),
    SK('spread', '산탄 사격', 'bow', 1, 60, 140, 'targetFacing', [[0, 0], [0, -1], [0, 1]], 'dmg', '대상과 그 양옆 1칸'),
    SK('snipe', '저격', 'bow', 1, 70, 320, 'lowest', null, 'dmg', '체력 비율이 가장 낮은 적 하나'),
    SK('rain', '화살비', 'bow', 2, 90, 160, 'target', SQ3, 'dmg', '대상 중심 3×3', { rare: true }),
    // 마법
    SK('fire', '화염 폭발', 'mage', 1, 70, 170, 'target', PLUS, 'dmg', '대상 중심 십자 5칸'),
    SK('ice', '얼음 창', 'mage', 1, 60, 150, 'line', null, 'dmg', '끝까지 관통 + 2초 둔화', { slow: 2 }),
    SK('chain', '연쇄 번개', 'mage', 2, 80, 170, 'chain', null, 'dmg', '대상에서 가까운 적으로 4번 튄다'),
    SK('barrier', '마나 방벽', 'mage', 1, 60, 200, 'self', PLUS, 'shield', '자신과 상하좌우 아군 보호막 200'),
    SK('meteor', '메테오', 'mage', 2, 100, 380, 'target', SQ3, 'tele', '1.2초 뒤 대상 중심 3×3에 운석', { rare: true, delay: 1.2 }),
    // 신성
    SK('light', '치유의 빛', 'holy', 1, 60, 200, 'self', SQ3, 'heal', '자신 중심 3×3 아군 회복'),
    SK('smite', '신성한 일격', 'holy', 1, 60, 190, 'targetFacing', [[0, 0], [1, 0]], 'dmg', '대상과 그 뒤 1칸. 피해의 40% 회복', { drain: 0.4 }),
    SK('bless', '축복', 'holy', 1, 70, 0, 'ally', null, 'buff', '공격력이 가장 높은 아군 공격력 +30%, 공속 +20%'),
    SK('sanct', '성역', 'holy', 2, 90, 220, 'self', SQ3, 'shield', '자신 중심 3×3 아군 보호막 220 + 회복 100', { heal: 100 }),
    SK('revive', '부활의 기도', 'holy', 2, 110, 0.5, 'dead', null, 'revive', '쓰러진 아군 하나를 체력 50%로 부활', { rare: true }),
    // 공용
    SK('aid', '응급 처치', 'any', 1, 50, 260, 'selfOnly', null, 'heal', '자신 체력 회복'),
    SK('warcry', '전투 함성', 'any', 1, 60, 0, 'self', SQ5, 'haste', '주변 2칸 아군 공격 속도 +25%'),
    SK('heavy', '혼신의 일격', 'any', 0, 40, 2.5, 'single', null, 'heavy', '대상에게 공격력 ×2.5 피해'),
  ];

  // ---------- 유닛 카드 ----------
  const UN = (id, name, cls, cost, hp, atk, as, range, extra, desc) =>
    Object.assign({ id, kind: 'unit', name, cls, cost, hp, atk, as, range, rare: false, desc: desc || '' }, extra || {});
  const UNITS = [
    UN('squire', '검사', 'sword', 1, 620, 55, 0.75, 1),
    UN('knight', '기사', 'sword', 2, 1050, 60, 0.6, 1, { armor: 0.15 }, '받는 피해 15% 감소'),
    UN('berserker', '광전사', 'sword', 3, 950, 95, 0.85, 1, { lifesteal: 0.15, rare: true }, '피해의 15% 흡혈'),
    UN('archer', '궁수', 'bow', 1, 420, 52, 0.8, 3),
    UN('crossbow', '석궁병', 'bow', 2, 560, 82, 0.55, 4),
    UN('ranger', '레인저', 'bow', 3, 720, 80, 0.9, 4, { dodge: 0.2, rare: true }, '회피 20%'),
    UN('apprentice', '견습 마법사', 'mage', 1, 400, 38, 0.65, 3, { manaPerHit: 14 }, '마나 회복 +40%'),
    UN('warlock', '흑마법사', 'mage', 2, 560, 50, 0.65, 3, { startMana: 35 }, '마나 35로 시작'),
    UN('archmage', '대마법사', 'mage', 3, 680, 58, 0.65, 3, { manaPerHit: 16, startMana: 40, rare: true }, '마나 40으로 시작, 마나 회복 +60%'),
    UN('cleric', '성직자', 'holy', 2, 540, 34, 0.7, 3, { manaPerHit: 13 }, '마나 회복 +30%'),
    UN('paladin', '성기사', 'holy', 3, 1250, 72, 0.65, 1, { armor: 0.1, rare: true }, '받는 피해 10% 감소'),
  ];

  const CARDS = {};
  for (const c of [...UNITS, ...SKILLS]) CARDS[c.id] = c;

  const STARTER = ['squire', 'squire', 'archer', 'apprentice', 'knight', 'cross', 'sweep', 'fire', 'pierce', 'aid'];

  // ---------- 몬스터 ----------
  const MO = (id, name, act, v, hp, atk, as, range, color, extra) =>
    Object.assign({ id, name, act, v, hp, atk, as, range, color, skills: [] }, extra || {});
  const MONSTERS = {
    // 1막 어둠의 숲
    slime: MO('slime', '슬라임', 1, 1, 440, 32, 0.6, 1, '#4f9a5b'),
    goblin: MO('goblin', '고블린', 1, 1, 360, 42, 0.85, 1, '#6b8f2e'),
    gobarcher: MO('gobarcher', '고블린 궁수', 1, 1.5, 320, 45, 0.7, 3, '#8a7a2e'),
    wolf: MO('wolf', '늑대', 1, 1.5, 480, 52, 0.95, 1, '#5b6475'),
    shroom: MO('shroom', '독버섯 주술사', 1, 2, 460, 36, 0.6, 3, '#9b4fa8', { skills: ['fire'], mana: 70 }),
    ogre: MO('ogre', '오우거', 1, 6, 1900, 90, 0.55, 1, '#8a6a3a', { skills: ['whirl'], armor: 0.1, elite: true }),
    alpha: MO('alpha', '늑대 우두머리', 1, 5, 1200, 75, 1.0, 1, '#3b4250', { skills: ['cross'], elite: true }),
    gobking: MO('gobking', '고블린 왕 그락', 1, 99, 1700, 55, 0.7, 1, '#556b1f', { boss: 'gobking', armor: 0.1 }),
    // 2막 망자의 폐허
    skel: MO('skel', '해골 병사', 2, 1, 560, 54, 0.75, 1, '#a39d8a', { skills: ['sweep'], mana: 60 }),
    skelarch: MO('skelarch', '해골 궁수', 2, 1.5, 440, 56, 0.7, 3, '#8a8478'),
    ghoul: MO('ghoul', '구울', 2, 1.5, 700, 58, 0.9, 1, '#5d7a5a', { lifesteal: 0.2 }),
    wraith: MO('wraith', '망령', 2, 2, 520, 66, 0.85, 1, '#5a5f8a', { dodge: 0.25 }),
    necro: MO('necro', '강령술사', 2, 2.5, 560, 46, 0.6, 3, '#4b3b6b', { skills: ['chain'], mana: 80 }),
    dknight: MO('dknight', '죽음의 기사', 2, 7, 2600, 100, 0.6, 1, '#2b2f3f', { skills: ['earth'], armor: 0.2, elite: true }),
    gargoyle: MO('gargoyle', '가고일', 2, 4, 1400, 78, 0.7, 1, '#6b6f78', { armor: 0.25, elite: true }),
    lich: MO('lich', '리치 모르바스', 2, 99, 2200, 65, 0.6, 3, '#3b4f8a', { boss: 'lich', skills: ['ice'], mana: 80, immobile: true }),
    // 3막 용의 화산
    imp: MO('imp', '화염 임프', 3, 1, 600, 64, 1.1, 1, '#e8643b'),
    lizard: MO('lizard', '리저드맨', 3, 1.5, 900, 80, 0.75, 1, '#3b7a5a', { skills: ['thrust'], mana: 60 }),
    salam: MO('salam', '불도마뱀 술사', 3, 2, 700, 62, 0.6, 3, '#c0502b', { skills: ['fire'], mana: 70 }),
    whelp: MO('whelp', '새끼 용', 3, 2, 950, 82, 0.7, 2, '#8a2b3b'),
    dragonkin: MO('dragonkin', '용인 전사', 3, 3, 1350, 100, 0.7, 1, '#7a3b2b', { skills: ['cross'], mana: 60, armor: 0.15 }),
    giant: MO('giant', '화염 거인', 3, 8, 4200, 140, 0.5, 1, '#b84a1f', { skills: ['whirl'], mana: 80, elite: true }),
    dragon: MO('dragon', '흑룡 아자르', 3, 99, 4300, 110, 0.55, 2, '#232a3b', { boss: 'dragon', armor: 0.1, immobile: true }),
  };
  // 전투가 너무 빨리 끝나지 않도록 유닛·몬스터 체력을 같은 비율로 늘린다
  const HP_SCALE = 1.5;
  for (const u of UNITS) u.hp = Math.round(u.hp * HP_SCALE);
  for (const m of Object.values(MONSTERS)) m.hp = Math.round(m.hp * HP_SCALE);

  const ACTS = [
    null,
    { name: '어둠의 숲', normal: ['slime', 'goblin', 'gobarcher', 'wolf', 'shroom'], elites: [['ogre'], ['alpha', 'wolf', 'wolf']], boss: 'gobking', pmult: 1,
      palette: { mine: ['#dde8d5', '#d0dfc6'], foe: ['#f0ded3', '#e8d0c3'], ground: '#e4e8d6' } },
    { name: '망자의 폐허', normal: ['skel', 'skelarch', 'ghoul', 'wraith', 'necro'], elites: [['dknight', 'skel'], ['gargoyle', 'gargoyle']], boss: 'lich', pmult: 1.25,
      palette: { mine: ['#e0e2ee', '#d3d6e5'], foe: ['#e8dde8', '#ddd0de'], ground: '#e2e0ea' } },
    { name: '용의 화산', normal: ['imp', 'lizard', 'salam', 'whelp', 'dragonkin'], elites: [['giant'], ['dragonkin', 'whelp', 'whelp']], boss: 'dragon', pmult: 1.5,
      palette: { mine: ['#f2e2cf', '#ebd4ba'], foe: ['#f2d4cc', '#eac2b6'], ground: '#efdccc' } },
  ];
  const BOSS_INFO = {
    gobking: '7초마다 고블린을 부르고, 4.5초마다 앞쪽 3×2 칸을 내려찍습니다. 빨간 칸이 차오르면 피해가 들어옵니다.',
    lich: '움직이지 않습니다. 4.5초마다 아군이 선 칸들에 저주를 떨어뜨리고, 8초마다 해골을 일으킵니다. 흩어서 배치하세요.',
    dragon: '움직이지 않습니다. 화염 브레스는 세 줄을 끝까지 태우고, 가까이 붙으면 꼬리로 주변 8칸을 휩씁니다. 체력 50% 이하에서 분노해 운석을 떨어뜨립니다.',
  };

  // ---------- 유물 ----------
  const RELICS = {
    crystal: { id: 'crystal', name: '에너지 결정', sym: '결', desc: '전투마다 에너지 +1', boss: true },
    pack: { id: 'pack', name: '가죽 배낭', sym: '낭', desc: '손패 +1장', boss: true },
    tome: { id: 'tome', name: '지혜의 서', sym: '서', desc: '모든 유닛 스킬 칸 +1', boss: true },
    whetstone: { id: 'whetstone', name: '숫돌', sym: '숫', desc: '검 계열 공격력 +20%' },
    feather: { id: 'feather', name: '매의 깃털', sym: '깃', desc: '궁 계열 공격 속도 +20%' },
    prism: { id: 'prism', name: '마력 수정', sym: '정', desc: '마법 계열 마나 30으로 시작' },
    holywater: { id: 'holywater', name: '성수', sym: '성', desc: '신성 계열 체력 +25%, 치유량 +25%' },
    banner: { id: 'banner', name: '전투 깃발', sym: '기', desc: '모든 아군 체력 +10%' },
    goldtooth: { id: 'goldtooth', name: '금니', sym: '금', desc: '전투 승리 시 골드 +12' },
    grail: { id: 'grail', name: '피의 성배', sym: '잔', desc: '전투 승리 시 체력 5 회복' },
    pauldron: { id: 'pauldron', name: '철갑 견갑', sym: '갑', desc: '아군이 받는 피해 -10%' },
    scroll: { id: 'scroll', name: '고대 두루마리', sym: '두', desc: '전투마다 첫 스킬 카드 에너지 -1' },
    horn: { id: 'horn', name: '전쟁 뿔피리', sym: '뿔', desc: '전투 시작 시 모든 아군 마나 +20' },
    eye: { id: 'eye', name: '예언자의 눈', sym: '눈', desc: '다시 뽑기 +1회' },
  };

  // ---------- 이벤트 ----------
  // 각 선택지: { label, note, act(game) → 결과 문장 }
  const EVENTS = [
    { id: 'altar', title: '피 묻은 제단', text: '이끼 낀 제단 위에 붉게 빛나는 두루마리가 놓여 있다. 손을 뻗으면 무언가가 피를 원한다.',
      choices: [{ label: '피를 바친다', note: '체력 −10, 희귀 카드 1장', fn: (g) => { g.hurt(10); const c = g.randomCard(true); g.addCard(c.id); return `${c.name} 카드를 얻었다.`; } },
        { label: '지나간다', note: '아무 일도 없다', fn: () => '발걸음을 돌렸다.' }] },
    { id: 'smith', title: '떠돌이 대장장이', text: '“무기 좀 봐줄까? 오늘은 기분이 좋아서 공짜야.” 모루 소리가 숲에 울린다.',
      choices: [{ label: '카드 강화', note: '카드 1장 무료 강화', fn: (g) => { g.pickUpgrade('대장장이가 강화할 카드를 고르세요'); return null; } },
        { label: '숫돌만 산다', note: '골드 −40, 유물: 숫돌', cond: (g) => g.gold >= 40 && !g.relics.includes('whetstone'), fn: (g) => { g.gold -= 40; g.addRelic('whetstone'); return '숫돌을 챙겼다.'; } }] },
    { id: 'gamble', title: '도박꾼 고블린', text: '“동전 하나에 운명을 걸어 봐! 앞면이면 두 배, 뒷면이면 내 거!”',
      choices: [{ label: '30골드를 건다', note: '50%: +70골드', cond: (g) => g.gold >= 30, fn: (g) => { g.gold -= 30; if (Math.random() < 0.5) { g.gold += 70; return '앞면! 70골드를 받았다.'; } return '뒷면… 고블린이 낄낄댄다.'; } },
        { label: '무시한다', note: '', fn: () => '고블린이 투덜거리며 사라졌다.' }] },
    { id: 'camp', title: '버려진 야영지', text: '아직 온기가 남은 모닥불과 누군가 두고 간 짐 꾸러미가 보인다.',
      choices: [{ label: '불가에서 쉰다', note: '체력 +18', fn: (g) => { g.heal(18); return '몸이 한결 가벼워졌다.'; } },
        { label: '짐을 뒤진다', note: '골드 +35', fn: (g) => { g.gold += 35; return '35골드를 찾았다.'; } }] },
    { id: 'merc', title: '용병 막사', text: '팔짱 낀 용병이 계약서를 내민다. “실력은 보장하지. 대신 선불이야.”',
      choices: [{ label: '고용한다', note: '골드 −50, 희귀 유닛 1장', cond: (g) => g.gold >= 50, fn: (g) => { g.gold -= 50; const c = g.randomCard(true, 'unit'); g.addCard(c.id); return `${c.name}이(가) 합류했다.`; } },
        { label: '거절한다', note: '', fn: () => '용병이 어깨를 으쓱했다.' }] },
    { id: 'well', title: '오래된 우물', text: '깊은 우물 아래에서 무언가 반짝인다. 버리고 싶은 것을 던지면 가벼워진다는 전설이 있다.',
      choices: [{ label: '카드를 던진다', note: '덱에서 카드 1장 제거', fn: (g) => { g.pickRemove('우물에 던질 카드를 고르세요'); return null; } },
        { label: '동전을 던진다', note: '골드 −15, 50%로 유물', cond: (g) => g.gold >= 15, fn: (g) => { g.gold -= 15; if (Math.random() < 0.5) { const r = g.randomRelic(); if (r) { g.addRelic(r.id); return `${r.name}이(가) 떠올랐다!`; } } return '물소리만 메아리친다.'; } }] },
    { id: 'shrine', title: '잊힌 사당', text: '금 간 여신상이 두 손을 모으고 있다. 기도를 올리면 응답이 있을지도.',
      choices: [{ label: '기도한다', note: '최대 체력 +6', fn: (g) => { g.maxHp += 6; g.hp += 6; return '따뜻한 빛이 감쌌다.'; } },
        { label: '제물을 훔친다', note: '골드 +60, 체력 −8', fn: (g) => { g.gold += 60; g.hurt(8); return '여신상의 눈이 붉게 빛났다…'; } }] },
  ];

  global.GD = { CLASSES, SKILLS, UNITS, CARDS, STARTER, MONSTERS, ACTS, BOSS_INFO, RELICS, EVENTS };
})(window);
