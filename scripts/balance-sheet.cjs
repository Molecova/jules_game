#!/usr/bin/env node
/* 밸런스 시트: 유닛(능력치+고유기)과 상점 스킬 칩을 표 하나로 내보내고, 고친 표를 게임에 적용한다.
   내보내기: node scripts/balance-sheet.cjs export            → docs/balance-sheet.csv (엑셀·구글 시트용)
   적용하기: node scripts/balance-sheet.cjs apply <표.csv|tsv> → v4/balance4.js (data4.js 원본과 다른 값만 담는다)
   빈 칸은 "그대로", 효과를 없애려면 0. 회색 참고 칸(범위·효과)은 적용하지 않는다. */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PATCH_FILE = path.join(ROOT, 'v4/balance4.js');

function load(withPatch) {
  const ctx = { console, Math, JSON };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = ['shared/engine.js', 'game/data.js', 'v4/data4.js'];
  if (withPatch && fs.existsSync(PATCH_FILE)) files.push('v4/balance4.js');
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.V4;
}

// [머리글, 키, 적용 대상] 대상: u = 유닛, s = 고유기·스킬, info = 참고용(적용 안 함)
const COLS = [
  ['구분', 'kind', 'info'], ['id', 'id', 'info'], ['클래스', 'cls', 'info'], ['이름', 'name', 'u'], ['등급', 't', 'u'],
  ['체력', 'hp', 'u'], ['공격', 'atk', 'u'], ['공속', 'as', 'u'], ['사거리', 'range', 'u'], ['방어', 'armor', 'u'],
  ['고유기·스킬 이름', 'sname', 's'], ['범위(참고)', 'area', 'info'], ['효과(참고)', 'effect', 'info'],
  ['마나', 'mana', 's'], ['대기시간', 'cd', 's'], ['위력', 'power', 's'],
  ['기절', 'stun', 's'], ['둔화', 'slow', 's'], ['약화', 'weak', 's'], ['지속', 'dur', 's'], ['피해감소', 'red', 's'], ['배율', 'amt', 's'],
  ['회복', 'heal', 's'], ['흡혈', 'drain', 's'], ['발수', 'count', 's'], ['튕김', 'jumps', 's'], ['대상수', 'n', 's'], ['지연', 'delay', 's'],
  ['처형', 'execute', 's'], ['마무리', 'finisher', 's'], ['최대', 'max', 's'],
  ['화상dps', 'burn.dps', 's'], ['화상초', 'burn.dur', 's'], ['중독dps', 'poison.dps', 's'], ['중독초', 'poison.dur', 's'],
  ['출혈dps', 'bleed.dps', 's'], ['출혈초', 'bleed.dur', 's'], ['취약', 'vuln.amt', 's'], ['취약초', 'vuln.dur', 's'],
  ['설명', 'desc', 's'],
];
const CLS = { war: '전사', arc: '궁수', mag: '마법사', any: '공용' };
const AREA = (d) => `${d.mode || ''}${d.cells ? ' ' + d.cells.length + '칸' : ''}`;
const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);

function rows(V) {
  const out = [];
  for (const u of V.UNITS) {
    const d = u.ult || {};
    const r = { kind: '유닛', id: u.id, cls: CLS[u.cls], name: u.name, t: u.t, hp: u.hp, atk: u.atk, as: u.as, range: u.range, armor: u.armor || 0,
      sname: u.ult ? d.name : '(패시브만)', area: u.ult ? AREA(d) : '', effect: u.ult ? d.effect : '', desc: u.ult ? d.desc : u.trait };
    if (u.ult) for (const [, k, w] of COLS) if (w === 's' && !(k in r)) r[k] = get(d, k);
    out.push(r);
  }
  for (const d of V.SKILLS) {
    const r = { kind: '스킬', id: d.id, cls: CLS[d.cls] || d.cls, name: '', t: d.t, sname: d.name, area: AREA(d), effect: d.effect, desc: d.desc };
    for (const [, k, w] of COLS) if (w === 's' && !(k in r)) r[k] = get(d, k);
    out.push(r);
  }
  return out;
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function parse(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim() !== ''));
}

function exportSheet() {
  const V = load(true);
  const lines = [COLS.map((c) => c[0]).join(',')];
  for (const r of rows(V)) lines.push(COLS.map(([, k]) => csvCell(r[k])).join(','));
  const file = path.join(ROOT, 'docs/balance-sheet.csv');
  fs.writeFileSync(file, '﻿' + lines.join('\n') + '\n');
  console.log(path.relative(ROOT, file), lines.length - 1, 'rows');
}

function applySheet(file) {
  const table = parse(fs.readFileSync(file, 'utf8'));
  const head = table.shift().map((h) => h.trim());
  const idx = Object.fromEntries(COLS.map(([h, k]) => [k, head.indexOf(h)]));
  if (idx.id < 0 || idx.kind < 0) throw new Error('머리글에 구분·id 칸이 없습니다');
  const V = load(false);
  const patch = { units: {}, ult: {}, skills: {} }, changes = [], warn = [];
  const num = (s) => { const v = Number(String(s).replace(/,/g, '').replace(/%$/, '')); return Number.isFinite(v) ? v : null; };
  for (const cells of table) {
    const val = (k) => (idx[k] >= 0 ? (cells[idx[k]] ?? '').trim() : '');
    const kind = val('kind'), id = val('id');
    const unit = kind === '유닛' ? V.UNITS.find((u) => u.id === id) : null;
    const skill = kind === '스킬' ? V.SKILLS.find((s) => s.id === id) : null;
    if (!unit && !skill) { warn.push(`모르는 줄: ${kind} ${id}`); continue; }
    const set = (bucket, obj, k, raw, label) => {
      if (raw === '') return;
      const old = get(obj, k), isNum = typeof old === 'number' || old === undefined && k !== 'desc' && k !== 'name';
      const v = (k === 'desc' || k === 'name' || k === 'sname') ? raw : num(raw);
      if (v === null) { warn.push(`${id} ${label}: 숫자가 아님 "${raw}"`); return; }
      if (old === v || (isNum && typeof old === 'number' && Math.abs(old - v) < 1e-9)) return;
      if (old === undefined && v === 0) return;
      const key = k === 'sname' ? 'name' : k;
      (bucket[id] = bucket[id] || {})[key] = v;
      changes.push(`${id} ${label}: ${old ?? '없음'} → ${v}`);
    };
    for (const [h, k, w] of COLS) {
      if (w === 'info') continue;
      const raw = val(k);
      if (unit && w === 'u') set(patch.units, unit, k, raw, h);
      else if (unit && w === 's' && unit.ult) set(patch.ult, unit.ult, k === 'sname' ? 'name' : k, raw, h);
      else if (skill && w === 's') set(patch.skills, skill, k === 'sname' ? 'name' : k, raw, h);
      else if (skill && k === 't') set(patch.skills, skill, k, raw, h);
    }
  }
  for (const b of Object.values(patch)) for (const id of Object.keys(b)) if (!Object.keys(b[id]).length) delete b[id];
  const body = `/* 밸런스 시트에서 적용한 값. scripts/balance-sheet.cjs apply 가 만든다(손으로 고치지 말고 시트로).
   data4.js 원본과 다른 값만 담는다. 비우면 원본 그대로. */
(function (global) {
  'use strict';
  const PATCH = ${JSON.stringify(patch, null, 2).replace(/\n/g, '\n  ')};
  const V = global.V4;
  const put = (obj, ch) => { for (const [k, v] of Object.entries(ch)) { if (k.includes('.')) { const [a, b] = k.split('.'); obj[a] = Object.assign({}, obj[a], { [b]: v }); } else obj[k] = v; } };
  for (const u of V.UNITS) {
    if (PATCH.units[u.id]) put(u, PATCH.units[u.id]);
    if (u.ult && PATCH.ult[u.id]) { put(u.ult, PATCH.ult[u.id]); u.trait = u.ult.name + ': ' + u.ult.desc; }
  }
  for (const s of V.SKILLS) if (PATCH.skills[s.id]) { put(s, PATCH.skills[s.id]); if (PATCH.skills[s.id].t != null) s.tier = s.t; }
  V.BALANCE_PATCH = PATCH;
})(window);
`;
  fs.writeFileSync(PATCH_FILE, body);
  console.log(changes.length ? changes.join('\n') : '바뀐 값 없음');
  if (warn.length) console.log('\n확인 필요:\n' + warn.join('\n'));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'export') exportSheet();
else if (cmd === 'apply' && arg) applySheet(arg);
else console.log('사용: node scripts/balance-sheet.cjs export | apply <표.csv|tsv>');
