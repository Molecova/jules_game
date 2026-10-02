/* 카드 원정대 — 게임 데이터 (v3)
 * 유닛(딱지) · 스킬 칩 · 무기 · 전술 카드 · 몬스터 · 막/보스 · 유물 · 이벤트 · 시작 부대 · 난이도 · 키워드
 *
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
    sword: { name: '검', full: '검술', color: '#2f6fd6', plastic: '#3f7fe6' },
    guard: { name: '방', full: '수호', color: '#5b6475', plastic: '#7a8494' },
    bow: { name: '궁', full: '궁술', color: '#2e9e6b', plastic: '#38b37c' },
    mage: { name: '마', full: '마법', color: '#7a4fd0', plastic: '#8d63e0' },
    holy: { name: '신', full: '신성', color: '#c48a00', plastic: '#e0a614' },
    rogue: { name: '影', full: '그림자', color: '#a8323b', plastic: '#c2414b' },
    any: { name: '공', full: '공용', color: '#4b5160', plastic: '#6b7180' },
  };

  // 계열 시너지: 서로 다른 유닛 수 기준
  const SYNERGY = {
    sword: { th: [2, 4], desc: ['검술 유닛 공격력 +15%', '검술 유닛 공격력 +35%, 적 처치 시 마나 +30'] },
    guard: { th: [2, 4], desc: ['수호 유닛 받는 피해 −15%', '모든 아군 받는 피해 −10%, 수호 유닛 보호막 300으로 시작'] },
    bow: { th: [2, 4], desc: ['궁술 유닛 공격 속도 +20%', '궁술 유닛 공격 속도 +40%, 사거리 +1'] },
    mage: { th: [2, 4], desc: ['모든 아군 스킬 위력 +20%', '모든 아군 스킬 위력 +45%, 마나 20으로 시작'] },
    holy: { th: [2, 4], desc: ['치유·보호막 +25%', '치유·보호막 +50%, 모든 아군 최대 체력 +10%'] },
    rogue: { th: [2, 4], desc: ['그림자 유닛 치명타 확률 +15%', '그림자 유닛 치명타 확률 +30%, 치명타 피해 ×2.2'] },
  };

  // 상태이상·키워드 (도감용 설명)
  const KEYWORDS = {
    burn: { name: '화상', color: '#e8643b', desc: '일정 시간 동안 0.5초마다 불 피해를 입는다. 다시 걸리면 시간이 갱신된다.' },
    poison: { name: '중독', color: '#5fa043', desc: '일정 시간 동안 독 피해를 입는다. 최대 3중첩까지 쌓인다.' },
    bleed: { name: '출혈', color: '#c0392b', desc: '일정 시간 동안 피해를 입는다. 움직이는 동안 피해가 두 배.' },
    slow: { name: '둔화', color: '#6aa8ff', desc: '공격 속도와 이동 속도가 40% 느려진다.' },
    stun: { name: '기절', color: '#f5c400', desc: '아무 행동도 하지 못한다.' },
    weak: { name: '약화', color: '#8a7a9a', desc: '입히는 피해가 30% 줄어든다.' },
    vuln: { name: '취약', color: '#e8436b', desc: '받는 피해가 늘어난다(기본 30%).' },
    shield: { name: '보호막', color: '#9fd0ff', desc: '체력보다 먼저 피해를 흡수한다.' },
    taunt: { name: '도발', color: '#f5c400', desc: '도발당한 적은 시전자만 노린다.' },
    thorns: { name: '반사', color: '#9a6a3a', desc: '근접 공격을 받으면 피해 일부를 되돌려준다.' },
    haste: { name: '가속', color: '#f5c400', desc: '공격 속도가 오른다.' },
    regen: { name: '재생', color: '#2e9e6b', desc: '매초 최대 체력의 일정 비율을 회복한다.' },
    summon: { name: '소환', color: '#4b5160', desc: '전투 동안만 존재하는 딱지를 불러낸다. 전투가 끝나면 사라진다.' },
    level: { name: '레벨', color: '#f5c400', desc: '전투에 나가 이기면 경험치를 얻는다. 레벨마다 체력과 공격력 +18%. 딱지 테두리의 금색 핀 수가 레벨이다.' },
  };

  const AROUND8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const SQ3 = [[0, 0], ...AROUND8];
  const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const SQ5 = [];
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x || y) SQ5.push([x, y]);
  const ROW5 = [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]];

  // ---------- 스킬 칩 ----------
  // SK(id, 이름, 계열, 등급, 마나, 위력, 범위방식, 칸, 효과, 설명, 추가)
  const SK = (id, name, cls, tier, mana, power, mode, cells, effect, desc, extra) =>
    Object.assign({ id, kind: 'skill', name, cls, tier, mana, power, mode, cells, effect, desc }, extra || {});
  const SKILLS = [
    // 검술
    SK('cross', '십자 베기', 'sword', 1, 60, 170, 'facing', [[1, 0], [2, 0], [1, -1], [1, 1]], 'dmg', '앞 2칸과 앞칸 양옆 1칸을 벤다', { icon: 'slash' }),
    SK('sweep', '횡베기', 'sword', 1, 50, 140, 'facing', [[1, -1], [1, 0], [1, 1]], 'dmg', '앞쪽 가로 3칸을 휩쓴다', { icon: 'slash' }),
    SK('thrust', '돌진 찌르기', 'sword', 1, 60, 200, 'facing', [[1, 0], [2, 0], [3, 0]], 'dmg', '앞으로 3칸을 꿰뚫는다', { icon: 'spear' }),
    SK('bleedcut', '출혈 베기', 'sword', 1, 55, 120, 'facing', [[1, 0], [1, -1], [1, 1]], 'dmg', '앞쪽 3칸을 베고 5초 출혈(초당 45)', { bleed: { dps: 45, dur: 5 }, icon: 'drop' }),
    SK('whirl', '회전 베기', 'sword', 2, 80, 180, 'self', AROUND8, 'dmg', '주변 8칸을 모두 벤다', { icon: 'whirl' }),
    SK('parry', '받아치기', 'sword', 2, 60, 220, 'selfOnly', null, 'parry', '보호막 220, 4초간 근접 피해 40% 반사', { icon: 'shield' }),
    SK('charge', '돌격', 'sword', 2, 70, 240, 'leap', null, 'dmg', '체력이 가장 낮은 적 옆으로 뛰어들어 베고 0.8초 기절', { stun: 0.8, icon: 'fist' }),
    SK('earth', '대지 가르기', 'sword', 3, 90, 260, 'facing', [[1, 0], [2, 0], [3, 0], [4, 0], [2, -1], [2, 1]], 'dmg', '앞으로 4칸 + 2칸째 양옆. 1.2초 기절', { stun: 1.2, icon: 'quake' }),
    SK('bladestorm', '검의 폭풍', 'sword', 3, 100, 170, 'self', SQ5, 'dmg', '주변 2칸 안 모든 적을 벤다', { icon: 'whirl' }),
    // 수호
    SK('taunt', '도발', 'guard', 1, 60, 260, 'self', SQ5, 'taunt', '주변 2칸 적이 3초간 자신만 노린다. 보호막 260', { icon: 'eye' }),
    SK('bash', '방패 강타', 'guard', 1, 55, 150, 'facing', [[1, 0]], 'dmg', '바로 앞 적에게 피해 + 1.5초 기절', { stun: 1.5, icon: 'shield' }),
    SK('wall', '방벽 세우기', 'guard', 2, 70, 260, 'self', ROW5, 'shield', '같은 줄 좌우 2칸 아군에게 보호막 260', { icon: 'shield' }),
    SK('quake', '지진', 'guard', 2, 80, 160, 'self', AROUND8, 'dmg', '주변 8칸 피해 + 3초 둔화', { slow: 3, icon: 'quake' }),
    SK('fortify', '요새화', 'guard', 2, 60, 250, 'selfOnly', null, 'fortify', '5초간 받는 피해 −40%, 체력 250 회복', { icon: 'shield' }),
    SK('bulwark', '불굴의 함성', 'guard', 3, 100, 300, 'self', SQ5, 'shield', '주변 2칸 아군 모두 보호막 300', { icon: 'star' }),
    // 궁술
    SK('pierce', '관통 사격', 'bow', 1, 60, 150, 'line', null, 'dmg', '바라보는 방향 끝까지 관통', { icon: 'arrow' }),
    SK('spread', '산탄 사격', 'bow', 1, 60, 140, 'targetFacing', [[0, 0], [0, -1], [0, 1]], 'dmg', '대상과 그 양옆 1칸', { icon: 'arrow' }),
    SK('poisonarrow', '독화살', 'bow', 1, 55, 90, 'single', null, 'dmg', '대상에게 피해 + 6초 중독(초당 50)', { poison: { dps: 50, dur: 6 }, icon: 'skull' }),
    SK('snipe', '저격', 'bow', 2, 70, 320, 'lowest', null, 'dmg', '체력 비율이 가장 낮은 적 하나', { icon: 'target' }),
    SK('multishot', '연사', 'bow', 2, 70, 120, 'volley', null, 'dmg', '무작위 적 4명에게 화살', { count: 4, icon: 'arrow' }),
    SK('huntmark', '사냥 표식', 'bow', 2, 50, 60, 'single', null, 'dmg', '대상 5초 취약(받는 피해 +30%)', { vuln: { amt: 0.3, dur: 5 }, icon: 'target' }),
    SK('rain', '화살비', 'bow', 3, 90, 160, 'target', SQ3, 'dmg', '대상 중심 3×3', { icon: 'arrow' }),
    // 마법
    SK('fire', '화염 폭발', 'mage', 1, 70, 160, 'target', PLUS, 'dmg', '대상 중심 십자 5칸 + 4초 화상', { burn: { dps: 35, dur: 4 }, icon: 'fire' }),
    SK('ice', '얼음 창', 'mage', 1, 60, 150, 'line', null, 'dmg', '끝까지 관통 + 2초 둔화', { slow: 2, icon: 'ice' }),
    SK('arcane', '비전 화살', 'mage', 1, 60, 75, 'volley', null, 'dmg', '무작위 적에게 마력탄 5발', { count: 5, icon: 'star' }),
    SK('chain', '연쇄 번개', 'mage', 2, 80, 170, 'chain', null, 'dmg', '대상에서 가까운 적으로 4번 튄다', { icon: 'bolt' }),
    SK('frostnova', '서리 폭발', 'mage', 2, 80, 120, 'self', AROUND8, 'dmg', '주변 8칸 피해 + 1.2초 빙결', { stun: 1.2, icon: 'ice' }),
    SK('drainlife', '생명 흡수', 'mage', 2, 60, 200, 'single', null, 'dmg', '대상 피해, 피해의 60% 회복', { drain: 0.6, icon: 'heart' }),
    SK('barrier', '마나 방벽', 'mage', 2, 60, 200, 'self', PLUS, 'shield', '자신과 상하좌우 아군 보호막 200', { icon: 'shield' }),
    SK('meteor', '메테오', 'mage', 3, 100, 380, 'target', SQ3, 'tele', '1.2초 뒤 대상 중심 3×3에 운석 + 화상', { delay: 1.2, burn: { dps: 40, dur: 3 }, icon: 'fire' }),
    SK('blizzard', '눈보라', 'mage', 3, 100, 150, 'target', SQ3, 'dmg', '대상 중심 3×3 피해 + 4초 둔화 + 약화', { slow: 4, weak: 4, icon: 'ice' }),
    // 신성
    SK('light', '치유의 빛', 'holy', 1, 60, 200, 'self', SQ3, 'heal', '자신 중심 3×3 아군 회복', { icon: 'heart' }),
    SK('smite', '신성한 일격', 'holy', 1, 60, 190, 'targetFacing', [[0, 0], [1, 0]], 'dmg', '대상과 그 뒤 1칸. 피해의 40% 회복', { drain: 0.4, icon: 'cross' }),
    SK('bless', '축복', 'holy', 1, 70, 0, 'ally', null, 'buff', '공격력이 가장 높은 아군 공격력 +30%, 공속 +20%', { icon: 'star' }),
    SK('purify', '정화', 'holy', 2, 60, 260, 'lowestAlly', null, 'heal', '체력이 가장 낮은 아군 260 회복 + 해로운 효과 제거', { cleanse: true, icon: 'drop' }),
    SK('sanct', '성역', 'holy', 2, 90, 220, 'self', SQ3, 'shield', '자신 중심 3×3 아군 보호막 220 + 회복 100', { heal: 100, icon: 'cross' }),
    SK('judgment', '심판', 'holy', 2, 80, 190, 'line', null, 'dmg', '끝까지 관통 + 5초 취약', { vuln: { amt: 0.3, dur: 5 }, icon: 'cross' }),
    SK('revive', '부활의 기도', 'holy', 3, 110, 0.5, 'dead', null, 'revive', '찢어진 아군 하나를 체력 50%로 붙여 되살린다', { icon: 'heart' }),
    SK('aegis', '신의 가호', 'holy', 3, 110, 160, 'all', null, 'shield', '모든 아군 보호막 160 + 회복 160', { heal: 160, icon: 'star' }),
    // 그림자
    SK('backstab', '기습', 'rogue', 1, 50, 200, 'single', null, 'dmg', '대상 피해. 대상 체력이 절반 이하면 ×1.8', { execute: 1.8, icon: 'dagger' }),
    SK('poisonblade', '독칼', 'rogue', 1, 50, 110, 'single', null, 'dmg', '대상 피해 + 6초 중독(초당 55)', { poison: { dps: 55, dur: 6 }, icon: 'skull' }),
    SK('fan', '단검 부채', 'rogue', 1, 60, 120, 'facing', [[1, -1], [1, 0], [1, 1], [2, -1], [2, 0], [2, 1]], 'dmg', '앞쪽 3×2 칸에 단검을 뿌린다', { icon: 'dagger' }),
    SK('mark', '죽음의 표식', 'rogue', 2, 50, 50, 'single', null, 'dmg', '대상 6초 취약(받는 피해 +40%)', { vuln: { amt: 0.4, dur: 6 }, icon: 'target' }),
    SK('smoke', '연막탄', 'rogue', 2, 70, 0, 'self', AROUND8, 'debuff', '주변 8칸 적 5초 약화(피해 −30%)', { weak: 5, icon: 'wind' }),
    SK('shadowstep', '그림자 걸음', 'rogue', 2, 70, 240, 'leap', null, 'dmg', '체력이 가장 낮은 적 뒤로 순간이동해 베고 출혈', { bleed: { dps: 50, dur: 4 }, icon: 'wind' }),
    SK('assassinate', '암살', 'rogue', 3, 100, 420, 'lowest', null, 'dmg', '체력 비율이 가장 낮은 적에게 확정 치명타', { crit: true, icon: 'dagger' }),
    // 공용
    SK('aid', '응급 처치', 'any', 1, 50, 260, 'selfOnly', null, 'heal', '자신 체력 회복', { icon: 'heart' }),
    SK('warcry', '전투 함성', 'any', 1, 60, 0, 'self', SQ5, 'haste', '주변 2칸 아군 6초간 공격 속도 +25%', { dur: 6, amt: 1.25, icon: 'star' }),
    SK('heavy', '혼신의 일격', 'any', 1, 40, 2.5, 'single', null, 'heavy', '대상에게 공격력 ×2.5 피해', { icon: 'fist' }),
    SK('adrenaline', '아드레날린', 'any', 2, 60, 0, 'selfOnly', null, 'haste', '자신 5초간 공격 속도 +50%', { dur: 5, amt: 1.5, icon: 'bolt' }),
    SK('manaflow', '마나 순환', 'any', 2, 70, 30, 'self', SQ3, 'mana', '주변 1칸 다른 아군 마나 +30', { icon: 'drop' }),
    SK('secondwind', '재정비', 'any', 2, 60, 300, 'selfOnly', null, 'shield', '자신 보호막 300 + 해로운 효과 제거', { cleanse: true, icon: 'wind' }),
  ];

  // ---------- 유닛(딱지) ----------
  // UN(id, 이름, 계열, 등급, 체력, 공격, 공속, 사거리, 고유능력, 추가)
  const UN = (id, name, cls, tier, hp, atk, as, range, passive, extra) =>
    Object.assign({ id, kind: 'unit', name, cls, tier, hp, atk, as, range, passive }, extra || {});
  const UNITS = [
    UN('squire', '검사', 'sword', 1, 930, 55, 0.75, 1, 'comrade'),
    UN('merc', '용병', 'sword', 1, 1000, 58, 0.7, 1, 'bounty'),
    UN('knight', '기사', 'sword', 2, 1550, 60, 0.6, 1, 'chivalry', { armor: 0.15 }),
    UN('duelist', '결투가', 'sword', 2, 1100, 72, 0.9, 1, 'firstStrike', { crit: 0.15 }),
    UN('berserker', '광전사', 'sword', 3, 1450, 92, 0.85, 1, 'frenzy', { lifesteal: 0.15 }),
    UN('blademaster', '검성', 'sword', 3, 1350, 98, 0.9, 1, 'cleave'),
    UN('shieldman', '방패병', 'guard', 1, 1350, 40, 0.6, 1, 'startShield', { armor: 0.1 }),
    UN('warden', '수비대장', 'guard', 2, 1700, 48, 0.6, 1, 'guardian', { armor: 0.15 }),
    UN('hammer', '망치 전사', 'guard', 2, 1400, 70, 0.6, 1, 'stunHit'),
    UN('juggernaut', '철벽 거인', 'guard', 3, 2300, 70, 0.5, 1, 'undying', { armor: 0.2 }),
    UN('archer', '궁수', 'bow', 1, 630, 52, 0.8, 3, 'focus'),
    UN('hunter', '사냥꾼', 'bow', 1, 700, 48, 0.75, 3, 'hawk'),
    UN('crossbow', '석궁병', 'bow', 2, 840, 82, 0.55, 4, 'pierceArmor'),
    UN('venom', '독화살 사수', 'bow', 2, 760, 58, 0.8, 3, 'poisonHit'),
    UN('ranger', '레인저', 'bow', 3, 1080, 82, 0.9, 4, 'execute', { dodge: 0.2 }),
    UN('apprentice', '견습 마법사', 'mage', 1, 600, 38, 0.65, 3, 'quickMind', { manaPerHit: 15 }),
    UN('pyro', '화염술사', 'mage', 2, 760, 50, 0.65, 3, 'burnHit'),
    UN('cryo', '빙결술사', 'mage', 2, 780, 46, 0.65, 3, 'chillHit'),
    UN('warlock', '흑마법사', 'mage', 2, 840, 50, 0.65, 3, 'spellLeech', { startMana: 35 }),
    UN('archmage', '대마법사', 'mage', 3, 1020, 58, 0.65, 3, 'manaFlow', { manaPerHit: 16, startMana: 40 }),
    UN('summoner', '소환술사', 'mage', 3, 900, 44, 0.6, 3, 'golem'),
    UN('acolyte', '수련 사제', 'holy', 1, 700, 34, 0.7, 3, 'healAura'),
    UN('cleric', '성직자', 'holy', 2, 810, 34, 0.7, 3, 'blessedHands', { manaPerHit: 13 }),
    UN('monk', '수도승', 'holy', 2, 1250, 64, 0.9, 1, 'meditate', { dodge: 0.15 }),
    UN('paladin', '성기사', 'holy', 3, 1880, 72, 0.65, 1, 'aegisAura', { armor: 0.1 }),
    UN('bishop', '대주교', 'holy', 3, 1100, 40, 0.65, 3, 'greatAura'),
    UN('thief', '도적', 'rogue', 1, 780, 60, 0.95, 1, 'bounty', { crit: 0.15 }),
    UN('assassin', '암살자', 'rogue', 2, 900, 78, 0.9, 1, 'infiltrate', { crit: 0.2 }),
    UN('poisoner', '독술사', 'rogue', 2, 860, 60, 0.9, 1, 'poisonHit'),
    UN('ninja', '닌자', 'rogue', 3, 1050, 76, 1.15, 1, 'evasion', { dodge: 0.3, crit: 0.15 }),
    UN('shadowlord', '그림자 군주', 'rogue', 3, 1300, 100, 0.85, 1, 'execute', { crit: 0.25 }),
  ];
  const PASSIVES = {
    comrade: '전우애: 인접한 아군 1명당 공격력 +6%',
    bounty: '현상금: 적을 처치하면 골드 +2',
    chivalry: '기사도: 체력 50% 이하일 때 받는 피해 −20%',
    firstStrike: '선제공격: 첫 공격이 반드시 치명타',
    frenzy: '광란: 잃은 체력 1%당 공격 속도 +1%',
    cleave: '검풍: 3번째 공격마다 주변 적에게 60% 피해',
    startShield: '방패벽: 보호막 220으로 시작',
    guardian: '수호자: 전투 시작 시 주변 2칸 적을 4초 도발',
    stunHit: '강타: 공격 시 15% 확률로 0.8초 기절',
    undying: '불굴: 처음 찢어질 때 체력 35%로 버틴다',
    focus: '집중: 같은 대상을 연달아 쏠수록 피해 +8% (최대 +40%)',
    hawk: '매 동료: 전투 시작 시 매를 소환',
    pierceArmor: '관통: 적의 피해 감소를 무시',
    poisonHit: '독: 공격 시 3초 중독(초당 30)',
    execute: '처형: 체력 30% 이하 적에게 피해 +50%',
    quickMind: '총명: 공격할 때 얻는 마나 +50%',
    burnHit: '불씨: 공격 시 3초 화상(초당 25)',
    chillHit: '냉기: 공격 시 30% 확률로 2초 둔화',
    spellLeech: '흡혈 주문: 스킬 피해의 20% 회복',
    manaFlow: '마나의 흐름: 초당 마나 5 회복',
    golem: '골렘 소환: 전투 시작 시 돌 골렘을 소환',
    healAura: '치유 오라: 주변 1칸 아군 초당 체력 1% 회복',
    blessedHands: '축복받은 손: 치유량 +30%',
    meditate: '명상: 초당 체력 1.5% 회복',
    aegisAura: '수호의 빛: 전투 시작 시 주변 1칸 아군 보호막 200',
    greatAura: '대치유 오라: 주변 2칸 아군 초당 체력 1.5% 회복',
    infiltrate: '잠입: 전투 시작 시 적 후열 옆으로 숨어든다',
    evasion: '잔상: 회피할 때마다 마나 +15',
  };

  // ---------- 무기(플라스틱 미니어처) ----------
  // WP(id, 이름, 계열, 등급, 모양, 능력치, 설명)
  // 능력치 키: atk as hp(배율) armor range crit critDmg dodge lifesteal spell heal mana manaPerHit thorns regen / proc
  const WP = (id, name, cls, tier, shape, stats, desc) => ({ id, kind: 'weapon', name, cls, tier, shape, stats, desc });
  const WEAPONS = [
    WP('rustsword', '녹슨 검', 'sword', 1, 'sword', { atk: 0.12 }, '공격력 +12%'),
    WP('longsword', '장검', 'sword', 2, 'sword', { atk: 0.22 }, '공격력 +22%'),
    WP('bloodblade', '흡혈검', 'sword', 2, 'sword', { atk: 0.12, lifesteal: 0.15 }, '공격력 +12%, 피해 흡혈 15%'),
    WP('flameblade', '화염검', 'sword', 2, 'sword', { atk: 0.1, proc: 'burnHit' }, '공격력 +10%, 공격 시 화상'),
    WP('greatsword', '대검', 'sword', 3, 'greatsword', { atk: 0.3, as: -0.1, proc: 'cleaveHit' }, '공격력 +30%, 공속 −10%, 공격이 주변 적에게 35% 튄다'),
    WP('runeblade', '룬 검', 'sword', 3, 'sword', { atk: 0.18, spell: 0.25, manaPerHit: 4 }, '공격력 +18%, 스킬 위력 +25%, 공격당 마나 +4'),
    WP('buckler', '둥근 방패', 'guard', 1, 'shield', { hp: 0.18, armor: 0.05 }, '체력 +18%, 받는 피해 −5%'),
    WP('spikeshield', '가시 방패', 'guard', 2, 'shield', { hp: 0.12, thorns: 0.25 }, '체력 +12%, 근접 피해 25% 반사'),
    WP('towershield', '탑 실드', 'guard', 3, 'tower', { hp: 0.35, armor: 0.12 }, '체력 +35%, 받는 피해 −12%'),
    WP('warhammer', '전쟁 망치', 'guard', 2, 'hammer', { atk: 0.2, proc: 'stunHit' }, '공격력 +20%, 공격 시 12% 확률 기절'),
    WP('shortbow', '단궁', 'bow', 1, 'bow', { as: 0.15 }, '공격 속도 +15%'),
    WP('longbow', '장궁', 'bow', 2, 'bow', { range: 1, atk: 0.1 }, '사거리 +1, 공격력 +10%'),
    WP('repeater', '연발 석궁', 'bow', 2, 'crossbow', { as: 0.3, atk: -0.05 }, '공격 속도 +30%, 공격력 −5%'),
    WP('venombow', '독궁', 'bow', 2, 'bow', { proc: 'poisonHit' }, '공격 시 중독'),
    WP('hawkbow', '매의 활', 'bow', 3, 'bow', { crit: 0.2, atk: 0.15 }, '치명타 확률 +20%, 공격력 +15%'),
    WP('wand', '견습 지팡이', 'mage', 1, 'wand', { manaPerHit: 4 }, '공격당 마나 +4'),
    WP('firestaff', '화염 지팡이', 'mage', 2, 'staff', { spell: 0.15, proc: 'spellBurn' }, '스킬 위력 +15%, 스킬 적중 시 화상'),
    WP('frostorb', '서리 오브', 'mage', 2, 'orb', { spell: 0.1, proc: 'spellSlow' }, '스킬 위력 +10%, 스킬 적중 시 둔화'),
    WP('archstaff', '대마법사의 지팡이', 'mage', 3, 'staff', { spell: 0.35, mana: 30 }, '스킬 위력 +35%, 마나 30으로 시작'),
    WP('holymace', '성스러운 철퇴', 'holy', 1, 'mace', { atk: 0.12, lifesteal: 0.1 }, '공격력 +12%, 피해 흡혈 10%'),
    WP('prayerbook', '기도서', 'holy', 2, 'book', { heal: 0.35 }, '치유·보호막 +35%'),
    WP('sungrail', '태양 성배', 'holy', 3, 'grail', { hp: 0.2, heal: 0.25, regen: 0.01 }, '체력 +20%, 치유 +25%, 초당 체력 1% 재생'),
    WP('dagger', '단검', 'rogue', 1, 'dagger', { crit: 0.12 }, '치명타 확률 +12%'),
    WP('poisondagger', '독 단검', 'rogue', 2, 'dagger', { proc: 'poisonHit' }, '공격 시 중독'),
    WP('twinblades', '쌍검', 'rogue', 2, 'twin', { as: 0.28 }, '공격 속도 +28%'),
    WP('shadowfang', '그림자 송곳니', 'rogue', 3, 'dagger', { crit: 0.15, critDmg: 0.6 }, '치명타 확률 +15%, 치명타 피해 +60%'),
    WP('leather', '가죽 갑옷', 'any', 1, 'armor', { hp: 0.15 }, '체력 +15%'),
    WP('charm', '행운의 부적', 'any', 1, 'charm', { crit: 0.06, dodge: 0.06 }, '치명타·회피 +6%'),
    WP('cloak', '깃털 망토', 'any', 2, 'cloak', { dodge: 0.12, as: 0.05 }, '회피 +12%, 공속 +5%'),
    WP('manaring', '마나 반지', 'any', 2, 'ring', { mana: 30, manaPerHit: 2 }, '마나 30으로 시작, 공격당 마나 +2'),
    WP('dragontooth', '용의 이빨', 'any', 3, 'tooth', { atk: 0.25, crit: 0.05 }, '공격력 +25%, 치명타 +5%'),
  ];

  // ---------- 전술 카드(전투 중 사용하는 종이 카드) ----------
  // 대상: ally(배치한 아군) enemy(적 유닛) ownCell(내 진영 빈 칸) enemyCell(적 진영 칸) all(즉시) instant(즉시, 전투 밖 효과)
  const TC = (id, name, cost, target, tier, desc, extra) => Object.assign({ id, kind: 'tactic', name, cost, target, tier, desc }, extra || {});
  const TACTICS = [
    TC('bandage', '붕대', 0, 'ally', 1, '아군 하나 보호막 300으로 시작'),
    TC('charge', '돌격 명령', 1, 'all', 1, '모든 아군 처음 6초간 공격 속도 +25%'),
    TC('molotov', '화염병', 1, 'enemyCell', 1, '대상 칸 중심 십자 5칸에 180 피해 + 화상'),
    TC('barricade', '바리케이드', 1, 'ownCell', 1, '내 진영 빈 칸에 나무 바리케이드(체력 1500) 설치'),
    TC('beartrap', '곰 덫', 1, 'enemyCell', 1, '적 진영 빈 칸에 덫. 밟은 적 2초 기절 + 200 피해', { empty: true }),
    TC('scout', '정찰', 0, 'instant', 1, '카드 2장을 뽑는다'),
    TC('warcry', '전투 함성', 1, 'all', 1, '모든 아군 공격력 +15%'),
    TC('reinforce', '증원', 2, 'ownCell', 2, '이번 전투에만 용병 딱지 1명 투입'),
    TC('manapotion', '마나 물약', 0, 'ally', 2, '아군 하나 마나가 가득 찬 채로 시작'),
    TC('oath', '수호의 맹세', 1, 'all', 2, '모든 아군 보호막 150'),
    TC('voodoo', '저주 인형', 1, 'enemy', 2, '적 하나 8초간 받는 피해 +35%'),
    TC('net', '그물', 1, 'enemy', 2, '적 하나 전투 시작 후 3초 기절'),
    TC('caltrops', '마름쇠', 1, 'enemyCell', 2, '대상 칸 중심 3×3 적 6초 둔화 + 출혈'),
    TC('holywater', '성수', 1, 'all', 2, '모든 아군 10초간 초당 체력 2% 재생'),
    TC('counter', '반격 태세', 1, 'all', 2, '모든 아군 근접 피해 20% 반사'),
    TC('coin', '행운의 동전', 0, 'instant', 2, '이번 전투에서 이기면 골드 +20'),
    TC('poisoncloud', '독 안개', 2, 'enemyCell', 3, '대상 칸 중심 3×3 적 8초 중독(초당 45)'),
    TC('bomb', '폭탄', 2, 'enemyCell', 3, '전투 시작 1.5초 뒤 대상 칸 중심 3×3에 400 피해'),
    TC('focus', '집중', 1, 'ally', 3, '아군 하나 공격력 +40%, 공격 속도 +20%'),
    TC('sacrifice', '피의 계약', 0, 'instant', 3, '원정 체력 6을 잃고 에너지 +2'),
    TC('smokescreen', '연막', 1, 'ownCell', 3, '대상 칸 중심 3×3 아군 6초간 회피 +30%'),
  ];

  const ALL = {};
  for (const c of [...UNITS, ...SKILLS, ...WEAPONS, ...TACTICS]) ALL[c.id + ':' + c.kind] = c;
  const byKind = { unit: {}, skill: {}, weapon: {}, tactic: {} };
  for (const c of UNITS) byKind.unit[c.id] = c;
  for (const c of SKILLS) byKind.skill[c.id] = c;
  for (const c of WEAPONS) byKind.weapon[c.id] = c;
  for (const c of TACTICS) byKind.tactic[c.id] = c;

  // ---------- 시작 부대 ----------
  const STARTS = [
    { id: 'order', name: '기사단', desc: '단단한 앞줄과 회복. 처음 하기 좋은 부대.', units: [['squire', ['cross'], 'rustsword'], ['knight', ['sweep'], null], ['cleric', ['light'], null]], chips: ['aid'], weapons: [],
      tactics: ['bandage', 'charge', 'molotov', 'barricade', 'scout', 'warcry'] },
    { id: 'guild', name: '사냥꾼 길드', desc: '긴 사거리와 중독, 빠른 그림자. 배치가 중요하다.', units: [['archer', ['pierce'], 'shortbow'], ['hunter', ['spread'], null], ['thief', ['backstab'], null]], chips: ['poisonarrow'], weapons: [],
      tactics: ['bandage', 'charge', 'beartrap', 'barricade', 'scout', 'net'] },
    { id: 'tower', name: '마탑', desc: '강력한 광역 마법과 둔화. 앞줄이 약하니 방패병을 아껴라.', units: [['apprentice', ['fire'], 'wand'], ['cryo', ['ice'], null], ['shieldman', ['bash'], null]], chips: ['barrier'], weapons: [],
      tactics: ['bandage', 'manapotion', 'molotov', 'barricade', 'scout', 'oath'] },
  ];

  const DIFFICULTY = {
    easy: { name: '견습', desc: '원정 체력 100, 적 능력치 −15%, 골드 +25%', hp: 100, foe: 0.85, gold: 1.25 },
    normal: { name: '모험가', desc: '원정 체력 80. 기본 난이도', hp: 80, foe: 1, gold: 1 },
    hard: { name: '영웅', desc: '원정 체력 70, 적 능력치 +18%, 보스 부하 증가', hp: 70, foe: 1.18, gold: 1, extraAdds: true },
  };

  // ---------- 몬스터 ----------
  // MO(id, 이름, 막, 가치, 체력, 공격, 공속, 사거리, 색, 추가{skills, mana, armor, dodge, lifesteal, proc, elite, boss, immobile, desc})
  const MO = (id, name, act, v, hp, atk, as, range, color, extra) =>
    Object.assign({ id, kind: 'monster', name, act, v, hp, atk, as, range, color, skills: [] }, extra || {});
  const MONSTERS = {
    // 1막 어둠의 숲
    slime: MO('slime', '슬라임', 1, 1, 440, 32, 0.6, 1, '#4f9a5b', { desc: '느리고 말랑하다. 숫자로 밀어붙인다.' }),
    goblin: MO('goblin', '고블린', 1, 1, 360, 42, 0.85, 1, '#6b8f2e', { desc: '재빠른 단검잡이.' }),
    gobarcher: MO('gobarcher', '고블린 궁수', 1, 1.5, 320, 45, 0.7, 3, '#8a7a2e', { desc: '뒤에서 화살을 쏜다.' }),
    wolf: MO('wolf', '늑대', 1, 1.5, 480, 52, 0.95, 1, '#5b6475', { desc: '빠르게 물어뜯는다.' }),
    shroom: MO('shroom', '독버섯 주술사', 1, 2, 460, 36, 0.6, 3, '#9b4fa8', { skills: ['fire'], mana: 70, desc: '포자 폭발로 십자 범위를 태운다.' }),
    bandit: MO('bandit', '산적', 1, 1.5, 520, 50, 0.8, 1, '#8a5a3a', { skills: ['bleedcut'], mana: 60, desc: '칼부림으로 출혈을 남긴다.' }),
    spider: MO('spider', '독거미', 1, 1.5, 420, 40, 0.9, 1, '#4b3b5a', { proc: 'poisonHit', desc: '물면 중독된다.' }),
    boar: MO('boar', '성난 멧돼지', 1, 2, 700, 58, 0.7, 1, '#7a4a2e', { skills: ['charge'], mana: 70, desc: '가장 약한 상대에게 돌진한다.' }),
    ogre: MO('ogre', '오우거', 1, 6, 1900, 90, 0.55, 1, '#8a6a3a', { skills: ['whirl'], armor: 0.1, elite: true, desc: '정예. 주변 8칸을 몽둥이로 휩쓴다.' }),
    alpha: MO('alpha', '늑대 우두머리', 1, 5, 1200, 75, 1.0, 1, '#3b4250', { skills: ['cross'], elite: true, desc: '정예. 늑대 무리를 이끈다.' }),
    banditchief: MO('banditchief', '산적 두목', 1, 5, 1400, 80, 0.8, 1, '#5d3b1e', { skills: ['cross', 'bleedcut'], mana: 60, elite: true, desc: '정예. 부하들과 함께 덮친다.' }),
    gobking: MO('gobking', '고블린 왕 그락', 1, 99, 1700, 55, 0.7, 1, '#556b1f', { boss: 'gobking', armor: 0.1, desc: '보스. 부하를 부르고 앞쪽을 내려찍는다.' }),
    slimeking: MO('slimeking', '슬라임 왕 말랑이', 1, 99, 1900, 50, 0.55, 1, '#3f9a4f', { boss: 'slimeking', desc: '보스. 높이 뛰어 짓누르고, 체력이 줄면 둘로 갈라진다.' }),
    // 2막 망자의 폐허
    skel: MO('skel', '해골 병사', 2, 1, 560, 54, 0.75, 1, '#a39d8a', { skills: ['sweep'], mana: 60, desc: '녹슨 칼로 가로 3칸을 벤다.' }),
    skelarch: MO('skelarch', '해골 궁수', 2, 1.5, 440, 56, 0.7, 3, '#8a8478', { desc: '뼈 화살을 쏜다.' }),
    ghoul: MO('ghoul', '구울', 2, 1.5, 700, 58, 0.9, 1, '#5d7a5a', { lifesteal: 0.2, desc: '물어뜯어 체력을 빼앗는다.' }),
    wraith: MO('wraith', '망령', 2, 2, 520, 66, 0.85, 1, '#5a5f8a', { dodge: 0.25, desc: '흐릿해서 잘 맞지 않는다.' }),
    necro: MO('necro', '강령술사', 2, 2.5, 560, 46, 0.6, 3, '#4b3b6b', { skills: ['chain'], mana: 80, desc: '연쇄 번개를 날린다.' }),
    bat: MO('bat', '흡혈 박쥐', 2, 1, 360, 44, 1.2, 1, '#3b2b4a', { lifesteal: 0.3, desc: '아주 빠르고 피를 빤다.' }),
    zombie: MO('zombie', '좀비', 2, 1.5, 1050, 50, 0.5, 1, '#6b7a4a', { proc: 'poisonHit', desc: '느리지만 질기고, 물면 중독된다.' }),
    cultist: MO('cultist', '광신도', 2, 2, 560, 48, 0.65, 3, '#6b2b3b', { skills: ['mark'], mana: 50, desc: '표식을 새겨 아군을 취약하게 만든다.' }),
    dknight: MO('dknight', '죽음의 기사', 2, 7, 2600, 100, 0.6, 1, '#2b2f3f', { skills: ['earth'], armor: 0.2, elite: true, desc: '정예. 대지를 갈라 줄 전체를 기절시킨다.' }),
    gargoyle: MO('gargoyle', '가고일', 2, 4, 1400, 78, 0.7, 1, '#6b6f78', { armor: 0.25, elite: true, desc: '정예. 돌 피부가 피해를 막는다.' }),
    banshee: MO('banshee', '밴시', 2, 5, 1300, 60, 0.7, 3, '#8ab0c8', { skills: ['smoke', 'chain'], mana: 70, elite: true, desc: '정예. 비명으로 주변을 약화시킨다.' }),
    lich: MO('lich', '리치 모르바스', 2, 99, 2200, 65, 0.6, 3, '#3b4f8a', { boss: 'lich', skills: ['ice'], mana: 80, immobile: true, desc: '보스. 저주를 떨어뜨리고 해골을 일으킨다.' }),
    vampire: MO('vampire', '흡혈귀 백작 루드', 2, 99, 2400, 70, 0.8, 1, '#7a1f2b', { boss: 'vampire', lifesteal: 0.25, desc: '보스. 피를 빨아 회복하고 박쥐 떼를 부른다.' }),
    // 3막 용의 화산
    imp: MO('imp', '화염 임프', 3, 1, 600, 64, 1.1, 1, '#e8643b', { proc: 'burnHit', desc: '할퀴면 불이 붙는다.' }),
    lizard: MO('lizard', '리저드맨', 3, 1.5, 900, 80, 0.75, 1, '#3b7a5a', { skills: ['thrust'], mana: 60, desc: '창으로 3칸을 꿰뚫는다.' }),
    salam: MO('salam', '불도마뱀 술사', 3, 2, 700, 62, 0.6, 3, '#c0502b', { skills: ['fire'], mana: 70, desc: '화염 폭발을 일으킨다.' }),
    whelp: MO('whelp', '새끼 용', 3, 2, 950, 82, 0.7, 2, '#8a2b3b', { proc: 'burnHit', desc: '작은 불꽃을 뿜는다.' }),
    dragonkin: MO('dragonkin', '용인 전사', 3, 3, 1350, 100, 0.7, 1, '#7a3b2b', { skills: ['cross'], mana: 60, armor: 0.15, desc: '십자 베기를 쓰는 용의 전사.' }),
    magmagolem: MO('magmagolem', '용암 골렘', 3, 2.5, 1500, 70, 0.5, 1, '#8a3b1e', { armor: 0.2, proc: 'burnHit', desc: '단단하고 뜨겁다.' }),
    harpy: MO('harpy', '하피', 3, 1.5, 620, 66, 1.0, 3, '#c08a5a', { desc: '공중에서 깃털을 쏜다.' }),
    firecult: MO('firecult', '화염 사제', 3, 2, 720, 50, 0.6, 3, '#b0402b', { skills: ['light'], mana: 70, desc: '동료를 치유한다. 먼저 노려라.' }),
    giant: MO('giant', '화염 거인', 3, 8, 4200, 140, 0.5, 1, '#b84a1f', { skills: ['whirl'], mana: 80, elite: true, desc: '정예. 거대한 회전 공격.' }),
    demonknight: MO('demonknight', '악마 기사', 3, 7, 3000, 120, 0.7, 1, '#4a1f2b', { skills: ['earth', 'cross'], mana: 70, lifesteal: 0.15, elite: true, desc: '정예. 피를 빨며 대지를 가른다.' }),
    dragon: MO('dragon', '흑룡 아자르', 3, 99, 4300, 110, 0.55, 2, '#232a3b', { boss: 'dragon', armor: 0.1, immobile: true, desc: '최종 보스. 브레스, 꼬리, 운석, 새끼 용.' }),
    // 소환물·설치물
    hawk: MO('hawk', '매', 0, 0, 320, 34, 1.2, 1, '#8a6a3a', { summon: true, desc: '사냥꾼이 부르는 매.' }),
    stonegolem: MO('stonegolem', '돌 골렘', 0, 0, 1400, 45, 0.55, 1, '#8a8f99', { armor: 0.2, summon: true, desc: '소환술사가 부르는 골렘.' }),
    barricade: MO('barricade', '바리케이드', 0, 0, 1500, 0, 0.1, 0, '#9a6a3a', { object: true, desc: '길을 막는 나무 바리케이드.' }),
  };
  // 전투가 너무 빨리 끝나지 않도록 몬스터 체력을 늘린다(유닛은 데이터에 이미 반영)
  for (const m of Object.values(MONSTERS)) if (!m.summon && !m.object) m.hp = Math.round(m.hp * 1.5);

  const ACTS = [
    null,
    { name: '어둠의 숲', normal: ['slime', 'goblin', 'gobarcher', 'wolf', 'shroom', 'bandit', 'spider', 'boar'],
      elites: [['ogre'], ['alpha', 'wolf', 'wolf'], ['banditchief', 'bandit', 'bandit']], bosses: ['gobking', 'slimeking'], pmult: 1, foeHp: 1.6, foeAtk: 1.35, eliteHp: 1.35, eliteAtk: 1.12, bossHp: 2.2, bossAtk: 1.25,
      palette: { mine: ['#dde8d5', '#d0dfc6'], foe: ['#f0ded3', '#e8d0c3'], ground: '#e4e8d6' },
      story: '고블린과 짐승이 들끓는 숲. 원정의 시작이다.' },
    { name: '망자의 폐허', normal: ['skel', 'skelarch', 'ghoul', 'wraith', 'necro', 'bat', 'zombie', 'cultist'],
      elites: [['dknight', 'skel'], ['gargoyle', 'gargoyle'], ['banshee', 'bat', 'bat']], bosses: ['lich', 'vampire'], pmult: 1.25, foeHp: 1.9, foeAtk: 1.5, eliteHp: 1.75, eliteAtk: 1.28, bossHp: 2.0, bossAtk: 1.2,
      palette: { mine: ['#e0e2ee', '#d3d6e5'], foe: ['#e8dde8', '#ddd0de'], ground: '#e2e0ea' },
      story: '숲을 벗어나자 무너진 성채와 묘지가 펼쳐진다. 죽은 자들이 깨어나고 있다.' },
    { name: '용의 화산', normal: ['imp', 'lizard', 'salam', 'whelp', 'dragonkin', 'magmagolem', 'harpy', 'firecult'],
      elites: [['giant'], ['dragonkin', 'whelp', 'whelp'], ['demonknight']], bosses: ['dragon'], pmult: 1.5, foeHp: 2.1, foeAtk: 1.6, eliteHp: 2.8, eliteAtk: 1.6, bossHp: 1.65, bossAtk: 1.1,
      palette: { mine: ['#f2e2cf', '#ebd4ba'], foe: ['#f2d4cc', '#eac2b6'], ground: '#efdccc' },
      story: '땅이 뜨겁다. 화산 꼭대기에서 흑룡 아자르의 숨소리가 들려온다.' },
  ];
  const BOSS_INFO = {
    gobking: '7초마다 고블린을 부르고, 4.5초마다 앞쪽 3×2 칸을 내려찍습니다. 빨간 칸이 차오르면 피해가 들어옵니다.',
    slimeking: '5초마다 높이 뛰어 아군 하나 주변 3×3을 짓누릅니다. 체력이 ⅔, ⅓이 될 때마다 작은 슬라임으로 갈라집니다.',
    lich: '움직이지 않습니다. 5초마다 아군이 선 칸들에 저주를 떨어뜨리고, 12초마다 해골을 일으킵니다. 흩어서 배치하세요.',
    vampire: '6초마다 모든 아군의 피를 빨아 회복합니다(피해량은 아군 수에 비례). 체력 50% 이하에서 박쥐 떼를 부릅니다. 빠르게 몰아붙이세요.',
    dragon: '움직이지 않습니다. 화염 브레스는 세 줄을 끝까지 태우고, 가까이 붙으면 꼬리로 주변 8칸을 휩씁니다. 체력 50% 이하에서 분노해 운석을 떨어뜨립니다.',
  };

  // ---------- 유물 ----------
  const RELICS = {
    crystal: { id: 'crystal', name: '에너지 결정', sym: '결', desc: '전투마다 에너지 +1', boss: true },
    pack: { id: 'pack', name: '가죽 배낭', sym: '낭', desc: '전술 카드 손패 +1장', boss: true },
    command: { id: 'command', name: '지휘관의 깃발', sym: '휘', desc: '배치 한도 +1', boss: true },
    tome: { id: 'tome', name: '지혜의 서', sym: '서', desc: '모든 아군 마나 25로 시작', boss: true },
    crown: { id: 'crown', name: '정복자의 왕관', sym: '관', desc: '전투 승리 골드 +50%', boss: true },
    whetstone: { id: 'whetstone', name: '숫돌', sym: '숫', desc: '검술 유닛 공격력 +20%' },
    shieldoil: { id: 'shieldoil', name: '방패 기름', sym: '름', desc: '수호 유닛 받는 피해 −12%' },
    feather: { id: 'feather', name: '매의 깃털', sym: '깃', desc: '궁술 유닛 공격 속도 +20%' },
    prism: { id: 'prism', name: '마력 수정', sym: '정', desc: '마법 유닛 마나 30으로 시작' },
    holywater: { id: 'holywater', name: '성수병', sym: '성', desc: '신성 유닛 치유·보호막 +25%' },
    nightshade: { id: 'nightshade', name: '밤그늘 주머니', sym: '밤', desc: '그림자 유닛 치명타 확률 +10%' },
    banner: { id: 'banner', name: '전투 깃발', sym: '기', desc: '모든 아군 체력 +10%' },
    goldtooth: { id: 'goldtooth', name: '금니', sym: '금', desc: '전투 승리 시 골드 +12' },
    grail: { id: 'grail', name: '피의 성배', sym: '잔', desc: '전투 승리 시 원정 체력 5 회복' },
    pauldron: { id: 'pauldron', name: '철갑 견갑', sym: '갑', desc: '모든 아군 받는 피해 −8%' },
    horn: { id: 'horn', name: '전쟁 뿔피리', sym: '뿔', desc: '전투 시작 시 모든 아군 마나 +20' },
    eye: { id: 'eye', name: '예언자의 눈', sym: '눈', desc: '다시 뽑기 +1회' },
    dummy: { id: 'dummy', name: '훈련용 허수아비', sym: '허', desc: '전투 후 얻는 경험치 +1' },
    anvil: { id: 'anvil', name: '휴대용 모루', sym: '모', desc: '야영지 수련이 2레벨을 올린다' },
    merchant: { id: 'merchant', name: '상인의 증표', sym: '증', desc: '상점 가격 −20%' },
    ember: { id: 'ember', name: '꺼지지 않는 불씨', sym: '불', desc: '아군이 입히는 화상 피해 +60%' },
    venomgland: { id: 'venomgland', name: '독샘', sym: '독', desc: '아군이 입히는 중독 피해 +60%' },
    hook: { id: 'hook', name: '피 묻은 갈고리', sym: '갈', desc: '아군이 입히는 출혈 피해 +60%' },
    snowglobe: { id: 'snowglobe', name: '눈의 구슬', sym: '눈', desc: '전투 시작 시 모든 적 3초 둔화' },
    drum: { id: 'drum', name: '전쟁 북', sym: '북', desc: '전투 시작 4초간 아군 공격 속도 +40%' },
    phoenix: { id: 'phoenix', name: '불사조 깃털', sym: '사', desc: '한 번, 전투에서 져도 원정 체력을 잃지 않는다 (사용 후 사라짐)' },
    scroll: { id: 'scroll', name: '고대 두루마리', sym: '두', desc: '전투마다 첫 전술 카드 에너지 −1' },
    thornmail: { id: 'thornmail', name: '가시 갑옷', sym: '가', desc: '모든 아군 근접 피해 10% 반사' },
    clover: { id: 'clover', name: '네잎클로버', sym: '잎', desc: '전투 보상 선택지 +1' },
    whistle: { id: 'whistle', name: '사냥 호루라기', sym: '호', desc: '소환물 체력·공격력 +50%' },
  };

  // ---------- 이벤트 ----------
  // 선택지 fn(g) 은 결과 문장을 돌려준다. null 이면 선택 화면으로 넘어간다.
  const EVENTS = [
    { id: 'altar', title: '피 묻은 제단', text: '이끼 낀 제단 위에 붉게 빛나는 칩이 놓여 있다. 손을 뻗으면 무언가가 피를 원한다.',
      choices: [{ label: '피를 바친다', note: '체력 −10, 희귀 스킬 칩', fn: (g) => { g.hurt(10); const c = g.randomOf('skill', 3); g.gain('skill', c.id); return `${c.name} 칩을 얻었다.`; } },
        { label: '지나간다', note: '', fn: () => '발걸음을 돌렸다.' }] },
    { id: 'smith', title: '떠돌이 대장장이', text: '“무기 좀 봐줄까? 오늘은 기분이 좋아서 공짜야.” 모루 소리가 숲에 울린다.',
      choices: [{ label: '강화를 맡긴다', note: '칩이나 무기 1개 무료 강화', fn: (g) => { g.pickUpgrade('대장장이가 강화할 것을 고르세요'); return null; } },
        { label: '무기를 산다', note: '골드 −45, 무작위 무기', cond: (g) => g.gold >= 45, fn: (g) => { g.gold -= 45; const w = g.randomOf('weapon', 2); g.gain('weapon', w.id); return `${w.name}을(를) 손에 넣었다.`; } }] },
    { id: 'gamble', title: '도박꾼 고블린', text: '“동전 하나에 운명을 걸어 봐! 앞면이면 두 배, 뒷면이면 내 거!”',
      choices: [{ label: '30골드를 건다', note: '50%: +70골드', cond: (g) => g.gold >= 30, fn: (g) => { g.gold -= 30; if (Math.random() < 0.5) { g.gold += 70; return '앞면! 70골드를 받았다.'; } return '뒷면… 고블린이 낄낄댄다.'; } },
        { label: '무시한다', note: '', fn: () => '고블린이 투덜거리며 사라졌다.' }] },
    { id: 'camp', title: '버려진 야영지', text: '아직 온기가 남은 모닥불과 누군가 두고 간 짐 꾸러미가 보인다.',
      choices: [{ label: '불가에서 쉰다', note: '체력 +18', fn: (g) => { g.heal(18); return '몸이 한결 가벼워졌다.'; } },
        { label: '짐을 뒤진다', note: '골드 +35, 전술 카드 1장', fn: (g) => { g.gold += 35; const t = g.randomOf('tactic', 1); g.gain('tactic', t.id); return `35골드와 ${t.name} 카드를 찾았다.`; } }] },
    { id: 'merc', title: '용병 막사', text: '팔짱 낀 용병이 계약서를 내민다. “실력은 보장하지. 대신 선불이야.”',
      choices: [{ label: '고용한다', note: '골드 −60, 희귀 유닛 합류', cond: (g) => g.gold >= 60 && g.party.length < g.partyMax, fn: (g) => { g.gold -= 60; const u = g.randomOf('unit', 3); g.gain('unit', u.id); return `${u.name}이(가) 합류했다.`; } },
        { label: '거절한다', note: '', fn: () => '용병이 어깨를 으쓱했다.' }] },
    { id: 'well', title: '오래된 우물', text: '깊은 우물 아래에서 무언가 반짝인다. 버리고 싶은 것을 던지면 가벼워진다는 전설이 있다.',
      choices: [{ label: '카드를 던진다', note: '전술 카드 1장 제거', fn: (g) => { g.pickRemove('우물에 던질 전술 카드를 고르세요'); return null; } },
        { label: '동전을 던진다', note: '골드 −15, 50%로 유물', cond: (g) => g.gold >= 15, fn: (g) => { g.gold -= 15; if (Math.random() < 0.5) { const r = g.randomRelic(); if (r) { g.addRelic(r.id); return `${r.name}이(가) 떠올랐다!`; } } return '물소리만 메아리친다.'; } }] },
    { id: 'shrine', title: '잊힌 사당', text: '금 간 여신상이 두 손을 모으고 있다. 기도를 올리면 응답이 있을지도.',
      choices: [{ label: '기도한다', note: '최대 체력 +6', fn: (g) => { g.maxHp += 6; g.hp += 6; return '따뜻한 빛이 감쌌다.'; } },
        { label: '제물을 훔친다', note: '골드 +60, 체력 −8', fn: (g) => { g.gold += 60; g.hurt(8); return '여신상의 눈이 붉게 빛났다…'; } }] },
    { id: 'veteran', title: '은퇴한 용사', text: '지팡이를 짚은 노인이 아이들에게 칼 쓰는 법을 가르치고 있다. “자네 동료도 한 수 배워 가겠나?”',
      choices: [{ label: '가르침을 받는다', note: '유닛 하나 레벨 +1', fn: (g) => { g.pickTrain('가르침을 받을 유닛을 고르세요'); return null; } },
        { label: '이야기를 듣는다', note: '모든 유닛 경험치 +2', fn: (g) => { g.party.forEach((u) => g.addXp(u, 2)); return '오래된 전쟁 이야기에 모두가 귀를 기울였다.'; } }] },
    { id: 'chest', title: '수상한 상자', text: '길 한가운데 상자가 놓여 있다. 너무 반짝인다. 너무 수상하다.',
      choices: [{ label: '연다', note: '50% 유물 / 50% 미믹(체력 −12, 골드 +30)', fn: (g) => { if (Math.random() < 0.5) { const r = g.randomRelic(); if (r) { g.addRelic(r.id); return `${r.name}이(가) 들어 있었다!`; } } g.hurt(12); g.gold += 30; return '상자가 이빨을 드러냈다! 간신히 떼어내고 흘린 동전을 주웠다.'; } },
        { label: '발로 찬다', note: '골드 +10', fn: (g) => { g.gold += 10; return '상자가 “끼잉” 하고 도망쳤다. 동전 몇 개가 떨어졌다.'; } }] },
    { id: 'library', title: '버려진 도서관', text: '먼지 쌓인 서가 사이로 마법진이 그려진 책이 보인다.',
      choices: [{ label: '책을 읽는다', note: '무작위 스킬 칩 1개', fn: (g) => { const c = g.randomOf('skill', 2); g.gain('skill', c.id); return `${c.name} 칩의 비법을 익혔다.`; } },
        { label: '전략서를 고른다', note: '희귀 전술 카드 1장', fn: (g) => { const t = g.randomOf('tactic', 3); g.gain('tactic', t.id); return `${t.name} 카드를 얻었다.`; } }] },
    { id: 'wanderer', title: '떠돌이 무사', text: '모닥불 곁에서 칼을 닦던 무사가 고개를 든다. “갈 곳이 없소. 같이 가도 되겠소?”',
      choices: [{ label: '받아들인다', note: '무작위 유닛 합류', cond: (g) => g.party.length < g.partyMax, fn: (g) => { const u = g.randomOf('unit', 2); g.gain('unit', u.id); return `${u.name}이(가) 원정대에 합류했다.`; } },
        { label: '노잣돈을 준다', note: '골드 −20, 체력 +10', cond: (g) => g.gold >= 20, fn: (g) => { g.gold -= 20; g.heal(10); return '무사가 고개 숙여 감사하며 약초를 건넸다.'; } }] },
    { id: 'forgefire', title: '꺼져 가는 용광로', text: '오래된 용광로에 아직 불씨가 남아 있다. 무언가를 녹여 다른 것으로 만들 수 있을 것 같다.',
      choices: [{ label: '무기를 녹인다', note: '보유 무기 1개 → 더 높은 등급 무작위 무기', cond: (g) => g.weapons.length > 0, fn: (g) => { g.pickReforge('녹일 무기를 고르세요'); return null; } },
        { label: '불을 쬔다', note: '체력 +8', fn: (g) => { g.heal(8); return '손끝이 따뜻해졌다.'; } }] },
  ];

  global.GD = { CLASSES, SYNERGY, KEYWORDS, SKILLS, UNITS, PASSIVES, WEAPONS, TACTICS, byKind, STARTS, DIFFICULTY, MONSTERS, ACTS, BOSS_INFO, RELICS, EVENTS };
})(window);
