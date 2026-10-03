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

  const SYN = {
    war: { th: [2, 4, 6], desc: ['전사 체력 +15%', '전사 체력 +30%, 받는 피해 −10%', '모든 아군 받는 피해 −15%'] },
    arc: { th: [2, 4, 6], desc: ['궁수 공격 속도 +20%', '궁수 공격 속도 +40%', '궁수 공격 속도 +60%, 사거리 +1'] },
    mag: { th: [2, 4, 6], desc: ['모든 아군 스킬 위력 +20%, 마법사 마나 획득 +25%', '모든 아군 스킬 위력 +40%, 마법사 마나 획득 +25%', '스킬 위력 +50%, 마법사 마나 30으로 시작'] },
  };

  const U = (id, name, cls, t, hp, atk, as, range, trait, extra) => Object.assign({ kind: 'unit', id, name, cls, t, hp, atk, as, range, trait }, extra || {});
  const UNITS = [
    U('squire', '견습 검사', 'war', 1, 950, 56, 0.75, 1, '적을 쓰러뜨리면 체력 10% 회복', { passive: 'killHeal' }),
    U('shieldman', '방패병', 'war', 1, 1300, 40, 0.6, 1, '전투 시작 시 보호막 220', { passive: 'startShield', armor: 0.1 }),
    U('merc', '용병', 'war', 2, 1150, 66, 0.75, 1, '적을 쓰러뜨리면 골드 +1(전투당 최대 2)', { passive: 'bounty' }),
    U('hammer', '망치 전사', 'war', 2, 1250, 62, 0.6, 1, '3번째 공격마다 대상 1초 기절', { passive: 'stunHit', armor: 0.1 }),
    U('duelist', '결투가', 'war', 3, 1350, 88, 0.9, 1, '첫 공격이 반드시 치명타', { passive: 'firstStrike', crit: 0.15 }),
    U('berserker', '광전사', 'war', 3, 1450, 88, 0.85, 1, '흡혈 15%. 체력이 줄수록 공격 속도가 오름(최대 +60%)', { passive: 'frenzy' }),
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
  const gs = (id) => GD.SKILLS.find((s) => s.id === id) || {};
  const SKX = {
    healarrow: { mode: 'lowestAlly', effect: 'heal', icon: 'heart', mana: 60, power: 260, desc: '가장 다친 아군에게 치유 화살(260 회복)' },
    lightrain: { mode: 'target', effect: 'lightrain', icon: 'star', mana: 100, power: 200, cells: [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], desc: '대상 중심 3×3 피해, 그 안의 아군은 회복' },
    snare: { mode: 'targetFacing', effect: 'dmg', icon: 'ice', mana: 70, power: 140, slow: 3, cells: [[0, 0], [0, -1], [0, 1]], desc: '대상과 양옆 1칸 피해 + 3초 둔화' },
    horn: { mode: 'all', effect: 'haste', icon: 'wind', mana: 90, dur: 5, amt: 1.3, desc: '모든 아군 5초간 공격 속도 +30%' },
    fire: { power: 200 }, chain: { power: 240 }, meteor: { power: 520 }, blizzard: { power: 200 }, ice: { power: 190 },
    frostnova: { power: 170 }, manaflow: { power: 40, mana: 55 }, light: { power: 240 },
    timewarp: { mode: 'all', effect: 'timewarp', icon: 'wind', mana: 100, dur: 5, amt: 1.3, desc: '모든 아군 5초간 가속, 모든 적 3초 둔화' },
    bless: { desc: '공격력이 가장 높은 아군 공격력 +30%, 공격 속도 +20%' },
    judgment: { power: 240, mana: 90, desc: '끝까지 꿰뚫고 맞은 적 5초 취약(받는 피해 +30%)' },
    drainlife: { power: 260, desc: '대상에게 피해, 준 피해의 60% 회복' },
  };
  const S_ = (id, name, cls, t) => Object.assign({}, gs(id), SKX[id] || {}, { kind: 'skill', id, name, cls, t });
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
    S_('light', '치유의 빛', 'mag', 1), S_('purify', '정화', 'mag', 2), S_('revive', '부활의 기도', 'mag', 3),
    S_('manaflow', '마나 순환', 'mag', 1),
    S_('ice', '얼음 창', 'mag', 1), S_('drainlife', '생명 흡수', 'mag', 2), S_('barrier', '마나 방벽', 'mag', 2), S_('blizzard', '눈보라', 'mag', 3), S_('aegis', '신의 가호', 'mag', 3), S_('frostnova', '서리 폭발', 'mag', 2), S_('timewarp', '시간 왜곡', 'mag', 3),
    S_('aid', '응급 처치', 'any', 1), S_('warcry', '전투 함성', 'any', 1), S_('adrenaline', '아드레날린', 'any', 2), S_('heavy', '혼신의 일격', 'any', 1), S_('secondwind', '재정비', 'any', 2),
  ];

  // 아이템: st = 능력치(★에 따라 ×1.6/×2.5), fx = 역할을 바꾸는 효과
  const I_ = (id, name, cls, t, shape, st, fx, desc, feel) => ({ kind: 'item', id, name, cls, t, shape, st, fx, desc, feel });
  const ITEMS = [
    I_('longsword', '장검', 'war', 1, 'sword', { atk: 0.15 }, null, '공격력 +15%', '정석 검사'),
    I_('buckler', '둥근 방패', 'war', 1, 'shield', { hp: 0.2, armor: 0.08 }, null, '체력 +20%, 받는 피해 −8%', '탱커'),
    I_('twinblades', '쌍단검', 'war', 2, 'twin', { as: 0.25, crit: 0.15 }, 'infiltrate', '공격 속도 +25%, 치명 +15%. 전투 시작 시 적 뒤로 도약', '도적'),
    I_('holymace', '성스러운 철퇴', 'war', 2, 'mace', { hp: 0.1 }, 'healMace', '체력 +10%. 공격할 때마다 가장 다친 아군을 공격력의 60%만큼 회복', '성기사'),
    I_('greatsword', '피의 대검', 'war', 3, 'greatsword', { atk: 0.3, lifesteal: 0.1 }, 'bloodrage', '공격력 +30%, 흡혈 10%, 주변 적에게 35% 튐. 체력 50% 이하에서 공격 속도 +40%', '광전사'),
    I_('warhammer', '전쟁 망치', 'war', 2, 'hammer', { atk: 0.1, hp: 0.1 }, 'stunEvery', '공격력·체력 +10%. 4번째 공격마다 대상 1초 기절', '제압'),
    I_('thornmail', '가시 갑옷', 'war', 3, 'armor', { hp: 0.2, armor: 0.1 }, 'thorns', '체력 +20%, 받는 피해 −10%. 근접 피해 30% 반사', '반격 탱커'),
    I_('dragonslayer', '용살자의 검', 'war', 4, 'sword', { atk: 0.3, crit: 0.15 }, 'giantSlayer', '공격력 +30%, 치명 +15%. 정예·보스에게 주는 피해 +40%', '보스 사냥꾼'),
    I_('towershield', '수호자의 탑 방패', 'war', 4, 'tower', { hp: 0.25, armor: 0.2 }, 'towerGuard', '체력 +25%, 받는 피해 −20%. 4초마다 주변 적을 도발하고, 맞으면 주변 아군에게 보호막', '탱커'),
    I_('shortbow', '단궁', 'arc', 1, 'bow', { as: 0.15 }, null, '공격 속도 +15%', '정석 궁수'),
    I_('longbow', '장궁', 'arc', 1, 'bow', { range: 1, atk: 0.1 }, null, '사거리 +1, 공격력 +10%', '저격수'),
    I_('venombow', '독궁', 'arc', 2, 'bow', { atk: 0.05 }, 'poisonHit', '공격력 +5%. 공격 시 중독', '독 사냥꾼'),
    I_('quiver', '축복의 화살통', 'arc', 2, 'charm', { heal: 0.2 }, 'quiverHeal', '3번째 공격마다 가장 다친 아군에게 치유 화살(공격력 ×2.5)', '힐러 궁수'),
    I_('whistle', '사냥매 호루라기', 'arc', 3, 'tooth', { atk: 0.15 }, 'hawkFocus', '공격력 +15%. 전투 시작 시 사냥매 소환, 같은 적 연속 공격 피해 증가', '사냥꾼'),
    I_('flamebow', '화염 활', 'arc', 2, 'bow', { atk: 0.1 }, 'burnHit', '공격력 +10%. 공격 시 3초 화상', '화상 궁수'),
    I_('windcloak', '바람 망토', 'arc', 3, 'cloak', { as: 0.2, dodge: 0.2 }, 'evasive', '공격 속도 +20%, 회피 +20%. 회피하면 다음 공격 치명타', '회피 궁수'),
    I_('eagleeye', '매의 눈 반지', 'arc', 4, 'ring', { range: 1, crit: 0.25 }, 'headshot', '사거리 +1, 치명 +25%, 치명 피해 +60%', '저격수'),
    I_('hornbow', '지휘관의 뿔활', 'arc', 4, 'crossbow', { atk: 0.15, as: 0.1 }, 'markAura', '맞힌 적에 표식(받는 피해 +15%). 주변 1칸 아군 공격 속도 +15%', '지원가'),
    I_('wand', '견습 지팡이', 'mag', 1, 'wand', { manaPerHit: 6, spell: 0.05 }, null, '공격할 때마다 마나 +6, 스킬 위력 +5%', '정석 마법사'),
    I_('frostorb', '서리 오브', 'mag', 1, 'orb', { spell: 0.2 }, 'spellSlow', '스킬 위력 +20%. 스킬에 맞은 적 둔화', '제어'),
    I_('firestaff', '화염 지팡이', 'mag', 2, 'staff', { spell: 0.2 }, 'spellBurn', '스킬 위력 +20%. 스킬에 맞은 적 화상', '공격'),
    I_('prayerbook', '성서', 'mag', 2, 'book', { heal: 0.3 }, 'healer', '치유 +30%. 다친 아군이 있으면 기본 공격 대신 그 아군을 치유', '힐러'),
    I_('hourglass', '시간의 모래시계', 'mag', 3, 'grail', { mana: 20 }, 'hourglass', '마나 20으로 시작. 스킬을 쓰면 주변 1칸 아군 마나 +25', '지원'),
    I_('manaring', '마나 반지', 'mag', 2, 'ring', { mana: 15 }, 'manaRegen', '마나 15로 시작. 초당 마나 +5', '빠른 시전'),
    I_('lifeorb', '생명의 수정', 'mag', 3, 'orb', { spell: 0.15, heal: 0.2 }, 'spellLeech', '스킬 위력 +15%, 치유 +20%. 스킬 피해의 25% 회복', '흡혈 마법사'),
    I_('stormstaff', '폭풍의 지팡이', 'mag', 4, 'staff', { spell: 0.25, manaPerHit: 4 }, 'stormHit', '스킬 위력 +25%. 기본 공격이 가까운 적 둘에게 번개(공격력 50%)', '연쇄 공격'),
    I_('archstaff', '대마법사의 지팡이', 'mag', 4, 'staff', { spell: 0.45, mana: 30 }, 'echo', '스킬 위력 +45%, 마나 30으로 시작. 2번 시전마다 한 번 더(80%)', '폭딜'),
  ];

  // 특성 시너지 10종: 유닛마다 2개. kind 'count' = 정해진 수만큼 모이면, 'combo' = 지정한 유닛이 전부 모이면
  const TRAITS = {
    knight: { name: '기사', short: '기', col: '#3a5fa8', kind: 'count', th: [2, 3, 4], members: ['squire', 'warden', 'blademaster', 'paladin', 'arbalest'],
      desc: ['기사 받는 피해 −15%', '기사 받는 피해 −30%', '기사 받는 피해 −40%, 체력 +15%'] },
    novice: { name: '견습', short: '견', col: '#8a9a5b', kind: 'combo', members: ['squire', 'archer', 'apprentice'],
      desc: ['견습 셋이 모이면 모든 아군 피해 +15%, 스킬 마나 −15%, 받는 피해 −15%'] },
    guardian: { name: '수호자', short: '수', col: '#5b6475', kind: 'count', th: [2, 4, 6], members: ['shieldman', 'warden', 'acolyte', 'monk', 'hammer', 'paladin'],
      desc: ['전투 시작 시 모든 아군 보호막 150', '모든 아군 보호막 400, 수호자 받는 피해 −10%', '모든 아군 보호막 700, 수호자 받는 피해 −20%'] },
    company: { name: '용병단', short: '용', col: '#b07a2a', kind: 'count', th: [2, 3, 4], members: ['merc', 'duelist', 'crossbow', 'hammer', 'scout'],
      desc: ['승리하면 골드 +1', '승리하면 골드 +2, 용병단 공격 속도 +20%', '승리하면 골드 +3, 용병단 공격 속도 +35%'] },
    marksman: { name: '명사수', short: '명', col: '#2e7d5b', kind: 'count', th: [2, 3, 4], members: ['venom', 'crossbow', 'ranger', 'ninja', 'arbalest', 'windarcher'],
      desc: ['명사수 치명타 +15%', '명사수 치명타 +25%, 치명 피해 +40%', '명사수 치명타 +25%, 치명 피해 +40%, 사거리 +1'] },
    wild: { name: '야생', short: '야', col: '#5fa043', kind: 'count', th: [2, 4, 6], members: ['archer', 'venom', 'hunter', 'acolyte', 'scout', 'windarcher', 'summoner'],
      desc: ['모든 아군 초당 체력 1% 재생', '모든 아군 초당 체력 2% 재생, 소환물 체력·공격 +60%', '모든 아군 초당 체력 3% 재생, 소환물 체력·공격 +120%'] },
    arcane: { name: '비전', short: '비', col: '#6a4fc0', kind: 'count', th: [2, 4], members: ['monk', 'cryo', 'archmage', 'bishop', 'pyro', 'summoner'],
      desc: ['비전 유닛 마나 +25로 시작', '비전 유닛 마나 +25로 시작, 모든 아군 마나 획득 +30%'] },
    stars: { name: '별의 인도', short: '별', col: '#c48a00', kind: 'combo', members: ['cryo', 'ninja', 'bishop'],
      desc: ['셋이 모이면 모든 아군 치명타 +20%, 치명 피해 +50%'] },
    mentor: { name: '스승과 제자', short: '스', col: '#a8508a', kind: 'combo', members: ['archmage', 'apprentice'],
      desc: ['둘이 함께면 견습 마법사 스킬 위력 ×2, 대마법사 스킬 마나 −30%'] },
    veteran: { name: '베테랑', short: '베', col: '#7a5a3c', kind: 'count', th: [2, 4, 6], members: ['shieldman', 'merc', 'duelist', 'hunter', 'ranger', 'blademaster', 'berserker', 'warlock'],
      desc: ['베테랑 공격력 +15%', '베테랑 공격력 +30%', '베테랑 공격력 +50%, 적을 쓰러뜨리면 체력 15% 회복'] },
    flame: { name: '불꽃', short: '불', col: '#e0602a', kind: 'count', th: [2, 3], members: ['berserker', 'pyro', 'warlock'],
      desc: ['불꽃 유닛의 기본 공격이 3초 화상', '모든 아군 화상 피해 +60%, 불꽃 유닛 공격력 +20%'] },
  };
  for (const u of UNITS) u.traits = Object.keys(TRAITS).filter((k) => TRAITS[k].members.includes(u.id));

  const DEF = {};
  for (const d of [...UNITS, ...SKILLS, ...ITEMS]) DEF[d.kind + ':' + d.id] = d;

  const ODDS = { 3: [70, 30, 0, 0, 0], 4: [50, 38, 12, 0, 0], 5: [35, 38, 24, 3, 0], 6: [25, 33, 30, 10, 2], 7: [18, 27, 33, 18, 4], 8: [12, 20, 33, 26, 9], 9: [8, 15, 32, 30, 15] };
  const XPNEED = { 3: 6, 4: 10, 5: 16, 6: 24, 7: 32 };
  const POOL_N = [0, 15, 12, 10, 9, 6];
  const MAXT = { unit: 5, skill: 3, item: 4 };
  const BENCH = 8;

  const RELICS = {
    banner: { name: '전투 깃발', desc: '모든 아군 체력 +10%' },
    pauldron: { name: '철갑 견갑', desc: '모든 아군 받는 피해 −8%' },
    horn: { name: '전쟁 뿔피리', desc: '모든 아군 마나 +20으로 시작' },
    drum: { name: '전쟁 북', desc: '전투 시작 4초간 아군 공격 속도 +40%' },
    snowglobe: { name: '눈의 구슬', desc: '전투 시작 시 모든 적 3초 둔화' },
    ember: { name: '꺼지지 않는 불씨', desc: '아군이 입히는 화상 피해 +60%' },
    venomgland: { name: '독샘', desc: '아군이 입히는 중독 피해 +60%' },
    hook: { name: '피 묻은 갈고리', desc: '아군이 입히는 출혈 피해 +60%' },
    thornmail: { name: '가시 갑옷', desc: '모든 아군 근접 피해 10% 반사' },
    whistle: { name: '사냥 호루라기', desc: '소환물 체력·공격력 +50%' },
    phoenix: { name: '불사조 깃털', desc: '한 번, 전투에서 져도 원정이 끝나지 않음' },
    goldtooth: { name: '금니', desc: '전투 승리 시 골드 +2' },
    bigbag: { name: '큰 배낭', desc: '창고 +2칸' },
    scale: { name: '상인의 저울', desc: '라운드마다 첫 다시 뽑기 무료' },
    vault: { name: '황금 금고', desc: '이자 최대치 +2' },
    glue: { name: '합성 아교', desc: '합성할 때마다 골드 +2' },
    flag: { name: '지휘관의 깃발', desc: '출전 인원 +1' },
    dice: { name: '행운의 주사위', desc: '상점 등급 확률이 레벨 1 높은 것처럼' },
    whetstone: { name: '숫돌', desc: '전사 공격력 +15%' },
    feather: { name: '매의 깃털', desc: '궁수 공격 속도 +15%' },
    prism: { name: '마력 수정', desc: '마법사 스킬 위력 +20%' },
    crown: { name: '상인의 왕관', desc: '라운드 수입 +1골드' },
    anvil: { name: '모루', desc: '레벨업 비용 4 → 3골드' },
    bloodstone: { name: '피의 돌', desc: '모든 아군 흡혈 +8%' },
    sandglass: { name: '은 모래시계', desc: '전투 시작 6초간 아군 받는 피해 −30%' },
    lens: { name: '확대경', desc: '모든 아군 치명타 +10%' },
    lantern: { name: '수호 등불', desc: '전투마다 처음 쓰러지는 아군 하나가 체력 30%로 일어남' },
    tome: { name: '고대 마법서', desc: '모든 아군 마나 획득 +25%' },
    victoryhorn: { name: '승리의 나팔', desc: '3연승 이상이면 모든 아군 공격력 +12%' },
    shard: { name: '별 조각', desc: '합성할 때마다 경험치 +2' },
    crest: { name: '용사의 문장', desc: '정예·보스에게 주는 피해 +15%' },
  };

  const NODE = {
    fight: { name: '전투', icon: 'slash', col: '#4b5160', info: '일반 몬스터. 이기면 다음 층으로. 지면 원정 끝.' },
    elite: { name: '정예', icon: 'skull', col: '#d6335a', info: '강한 적. 이기면 한 등급 높은 카드 3장 중 1장을 고릅니다. 지면 원정 끝.' },
    shop: { name: '암시장', icon: 'star', col: '#c48a00', info: '이번 라운드 상점 등급 확률이 한 단계 오르고, 다시 뽑기 3번이 무료. 전투 없음.' },
    forge: { name: '대장간', icon: 'fist', col: '#5b6475', info: '창고의 ★1 스킬·아이템 하나를 복제하거나, 아이템을 다른 클래스용으로 개조. 전투 없음.' },
    camp: { name: '야영지', icon: 'fire', col: '#e07a00', info: '경험치 +6, 또는 골드 +6. 전투 없음.' },
    event: { name: '이벤트', icon: 'eye', col: '#7a4fd0', info: '무슨 일이 생길지 모릅니다. 전투 없음.' },
    treasure: { name: '보물', icon: 'heart', col: '#2e9e6b', info: '유물 3개 중 1개. 전투 없음.' },
    boss: { name: '보스', icon: 'skull', col: '#232a3b', info: '막의 주인. 이기면 유물과 4·5등급 유닛을 고릅니다. 지면 원정 끝.' },
  };

  const STARTS = [
    { id: 'order', name: '기사단', desc: '단단한 앞줄과 회복. 처음 하기 좋은 부대.', units: [['squire', ['cross'], 'longsword'], ['shieldman', ['taunt'], null], ['acolyte', ['light'], null]] },
    { id: 'guild', name: '사냥꾼 길드', desc: '긴 사거리로 뒤에서 쏜다. 앞줄 하나를 잘 지켜야 한다.', units: [['archer', ['pierce'], 'shortbow'], ['venom', ['poisonarrow'], null], ['squire', ['bash'], 'buckler']] },
    { id: 'tower', name: '마법 탑', desc: '스킬 한 방이 강하다. 마나가 차기 전까지 버텨야 한다.', units: [['apprentice', ['fire'], 'wand'], ['acolyte', [], null], ['shieldman', ['bash'], null]] },
  ];

  const DIFF = {
    easy: { name: '쉬움', desc: '적이 약하고, 불사조 깃털 하나를 들고 시작', foe: 0.93, phoenix: true },
    normal: { name: '보통', desc: '지면 바로 원정이 끝나는 원래 규칙', foe: 1, phoenix: false },
    hard: { name: '어려움', desc: '적이 더 강하고 라운드 수입 −1골드', foe: 1.08, phoenix: false, income: -1 },
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

  global.V4 = { CLS, SYN, TRAITS, UNITS, SKILLS, ITEMS, DEF, ODDS, XPNEED, POOL_N, MAXT, BENCH, RELICS, NODE, STARTS, DIFF };
})(window);
