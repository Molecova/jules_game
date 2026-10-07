#!/usr/bin/env node
/* 밸런스 목록: 적용된 유닛·고유기·스킬·무기를 모든 성급으로 내보낸다.
   사용: node scripts/balance-list.cjs */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Math, JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['shared/engine.js', 'game/data.js', 'v4/data4.js', 'v4/balance4.js', 'v4/battle4.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const V = ctx.V4;
const B = ctx.BT4;

const CLS = { war: '전사', arc: '궁수', mag: '마법사', any: '공용' };
const MODE = {
  facing: '바라보는 방향', self: '자신 중심', target: '대상 중심', lowest: '체력 비율 최저 적', single: '대상 1명',
  farthest: '가장 먼 적', line3: '세 줄', leap: '도약', ally: '아군', lowestAlly: '가장 다친 아군', all: '전체', selfOnly: '자신만',
  line: '직선', volley: '연사', targetFacing: '대상부터 뒤로', chain: '연쇄',
};
const EFFECT = {
  dmg: '피해', heal: '회복', shield: '보호막', taunt: '도발+보호막', guard: '받는 피해 감소', summon: '소환', markRandom: '무작위 표식',
  curse: '저주', haste: '공격 속도', bless: '축복', mana: '마나 주기', fortify: '단단해짐', buff: '강화', lightrain: '피해+아군 회복',
  tele: '예고 후 낙하', timewarp: '시간 왜곡', heavy: '강타',
};
const EXTRA = {
  stun: '기절(초)', bleed: '출혈', dur: '지속(초)', red: '피해 감소', crit: '확정 치명', count: '발 수', vuln: '취약', poison: '중독',
  slow: '둔화', amt: '배율', burn: '화상', delay: '지연(초)', cleanse: '정화', drain: '흡혈', weak: '약화', heal: '회복',
  execute: '처형 기준', jumps: '튕김 수', bounty: '현상금', nextCrit: '다음 공격 치명', focus: '집중', summon: '소환', max: '최대',
  finisher: '마무리', n: '대상 수',
};
const fmt = (v) => v === true ? 'O' : v && typeof v === 'object' && !Array.isArray(v) ? '{' + Object.entries(v).map(([k, x]) => k + ' ' + x).join(', ') + '}' : Array.isArray(v) ? JSON.stringify(v) : String(v);
const extras = (d) => Object.keys(EXTRA).filter((k) => d[k] != null && d[k] !== false).map((k) => `${EXTRA[k]} ${fmt(d[k])}`).join(', ') || '—';
const cells = (d) => d.cells ? `${d.cells.length}칸` : '—';
const mode = (d) => MODE[d.mode] || d.mode || '—';
const eff = (d) => EFFECT[d.effect] || d.effect || '—';
const esc = (s) => String(s || '').replace(/\|/g, '/');
const chipCd = B.chipCd;
const cd3 = (d) => [1, 2, 3].map((s) => chipCd(d, s).toFixed(1).replace(/\.0$/, '')).join(' / ');

const out = [];
out.push('# 밸런스 목록 — 유닛 · 고유기 · 스킬 · 무기 ★1/★2/★3', '');
out.push(`> \`node scripts/balance-list.cjs\` 로 게임 데이터에서 자동 생성. 생성 시점 데이터 기준.`, '');
out.push('## 별(★) 규칙', '');
out.push('- **유닛 ★**: 체력·공격 ×1 / ×2 / ×4, 고유기와 장착 스킬의 위력 ×1 / ×1.7 / ×2.8.');
out.push('- **스킬 칩 ★**: 위력 ×1 / ×1.7 / ×2.6, 재사용 대기시간 ★마다 10% 짧게. ★3이면 튕김·발 수 +2(해당 스킬만).');
out.push('- **고유기**: 마나가 차면 시전. 아군 기본 공격 1번에 마나 12, 맞으면 받은 피해 비율만큼 더(최대 10) 찬다. 필요 마나는 유닛 ★과 무관.');
out.push('- **스킬 칩 대기시간**: 따로 정한 값이 없으면 `마나 ÷ 8`초(최소 5초). 전투 시작 후 첫 시전은 대기시간 절반(최대 3초).');
out.push('- **위력**: 피해·회복·보호막의 기준값. 실제 값 = 위력 × 유닛 ★ 배수 × 칩 ★ 배수 × 마법 강화 등.', '');
out.push('- **무기 ★**: 능력치·액티브 위력 ×1 / ×1.6 / ×2.5. 사거리 배수 없음, 회피·시작 마나 배수 상한 1.6. 무기 패시브는 효과별 상한 적용.');
out.push('- **지속 피해**: 칩 ★·유닛 ★·스킬 위력을 함께 적용. 예고형 화상과 장판에도 같은 규칙.');
out.push('- **소모 장수**: ★1 1장, ★2 3장, ★3 9장. 보스 전용 무기는 풀 1장이므로 ★2·★3을 자연 합성할 수 없음.', '');

out.push('## 유닛 (27종) — 능력치와 고유기', '');
for (const cls of ['war', 'arc', 'mag']) {
  out.push(`### ${CLS[cls]}`, '');
  out.push('| 등급 | 유닛 (id) | 체력 ★1/2/3 | 공격 ★1/2/3 | 공속 | 사거리 | 방어 | 고유기 | 마나 | 범위 | 효과 | 기본 위력 | 추가 수치 | 설명 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const u of V.UNITS.filter((x) => x.cls === cls).sort((a, b) => a.t - b.t)) {
    const ladder = key => [1, 2, 3].map(st => B.unitStats({ id: u.id, star: st })[key]).join(' / ');
    const st = `| ${u.t} | ${u.name} (${u.id}) | ${ladder('hp')} | ${ladder('atk')} | ${u.as} | ${u.range} | ${u.armor ? Math.round(u.armor * 100) + '%' : '—'} `;
    if (u.ult) { const d = u.ult; out.push(st + `| **${d.name}** | ${d.mana} | ${mode(d)} · ${cells(d)} | ${eff(d)} | ${d.power ?? '—'} | ${extras(d)} | ${esc(d.desc)} |`); }
    else out.push(st + `| *(패시브만)* | — | — | — | — | — | ${esc(u.trait)} |`);
  }
  out.push('');
}

out.push(`## 상점 스킬 칩 (${V.SKILLS.length}종)`, '');
for (const cls of ['war', 'arc', 'mag', 'any']) {
  out.push(`### ${CLS[cls]}`, '');
  out.push('| 등급 | 스킬 (id) | 마나 | 대기시간 ★1/★2/★3(초) | 범위 | 효과 | 위력 ★1/2/3 (1성 유닛) | 추가 수치 | 설명 |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const d of V.SKILLS.filter((x) => x.cls === cls).sort((a, b) => a.t - b.t || a.name.localeCompare(b.name, 'ko'))) {
    const power = d.power ? [1, 2, 3].map(st => +(d.power * B.SKSTAR[st]).toFixed(2)).join(' / ') : '—';
    out.push(`| ${d.t} | ${d.name} (${d.id}) | ${d.mana || '—'} | ${d.passive ? '패시브' : cd3(d)} | ${mode(d)} · ${cells(d)} | ${eff(d)} | ${d.effect === 'heavy' ? '공격× ' : ''}${power} | ${extras(d)} | ${esc(d.desc)} |`);
  }
  out.push('');
}
const other = V.SKILLS.filter((x) => !CLS[x.cls]);
if (other.length) { out.push('### 기타', ''); for (const d of other) out.push(`- ${d.name} (${d.id}) ${d.cls}`); out.push(''); }

out.push(`## 무기 (${V.ITEMS.length}종)`, '', '능력치 표는 효과의 추가 수치다. 무기를 장착할 유닛의 성급은 별도로 곱한다. 액티브 위력도 1성 유닛 기준이며 패시브·상한은 설명을 따른다.', '');
const statNames = { atk: '공격', as: '공속', hp: '체력', armor: '방어', crit: '치명', critDmg: '치명 피해', dodge: '회피', lifesteal: '흡혈', spell: '스킬 위력', heal: '치유', mana: '시작 마나', manaPerHit: '타격 마나', range: '사거리', melee: '근접' };
const weaponStats = (d, star) => Object.entries(d.st).map(([key, value]) => {
  if (key === 'melee') return '근접'; if (key === 'range') return `사거리 ${value > 0 ? '+' : ''}${value}`;
  const v = value * (['dodge', 'mana'].includes(key) ? Math.min(1.6, B.ITSTAR[star]) : B.ITSTAR[star]);
  return `${statNames[key] || key} ${['mana', 'manaPerHit'].includes(key) ? +v.toFixed(2) : +(v * 100).toFixed(2) + '%'}`;
}).join(', ') || '패시브 효과';
for (const cls of ['war', 'arc', 'mag']) {
  out.push(`### ${CLS[cls]}`, '', '| 등급 | 무기 (id) | ★1 | ★2 | ★3 | 액티브 위력 ★1/2/3 | 효과 |', '|---|---|---|---|---|---|---|');
  for (const d of V.ITEMS.filter(x => x.cls === cls)) {
    out.push(`| ${d.t}${d.special ? ' 보스 전용' : ''} | ${d.name} (${d.id}) | ${weaponStats(d, 1)} | ${weaponStats(d, 2)} | ${weaponStats(d, 3)} | ${d.act ? [1, 2, 3].map(s => +(d.act.power * B.ITSTAR[s]).toFixed(2)).join(' / ') : '—'} | ${esc(d.desc)} |`);
  }
  out.push('');
}

out.push('## 패치 요청 방법', '');
out.push('채팅으로 `id 항목 기존→새 값` 형식으로 보내면 된다. 예: `fire 위력 85→100`, `u_squire 마나 60→50`, `archer 체력 560→600`.');
fs.writeFileSync(path.join(ROOT, 'docs/balance-list.md'), out.join('\n') + '\n');
console.log('docs/balance-list.md', V.UNITS.length, 'units', V.SKILLS.length, 'skills');
