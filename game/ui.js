/* 카드 원정대 — 공용 UI 부품과 도감
 * 카드(유닛·스킬 칩·무기·전술), 범위 격자, 토스트/모달, 도감 화면
 */
(function (global) {
  'use strict';
  const { CLASSES, SYNERGY, KEYWORDS, SKILLS, UNITS, PASSIVES, WEAPONS, TACTICS, byKind, MONSTERS, ACTS, BOSS_INFO, RELICS, EVENTS } = global.GD;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1900); }
  function modal(html, wide) { $('sheet').innerHTML = html; $('sheet').classList.toggle('wide', !!wide); $('modal').hidden = false; $('sheet').scrollTop = 0; }
  function closeModal() { $('modal').hidden = true; }

  // ---------- 발견 기록(도감) ----------
  const SEEN_KEY = 'card-expedition-codex';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { seen = {}; }
  function markSeen(kind, id) {
    const k = kind + ':' + id;
    if (seen[k]) return;
    seen[k] = 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { /* 저장 불가 */ }
  }
  const isSeen = (kind, id) => !!seen[kind + ':' + id];

  // ---------- 범위 격자(5×5) ----------
  function patternGrid(d) {
    const g = Array.from({ length: 25 }, () => '');
    const set = (x, y, v) => { if (x >= 0 && x < 5 && y >= 0 && y < 5) g[y * 5 + x] = v; };
    const hitCls = ['heal', 'shield', 'haste', 'buff', 'revive', 'mana', 'parry', 'fortify'].includes(d.effect) ? 'ally' : d.effect === 'taunt' ? 'warn' : d.effect === 'debuff' ? 'debuff' : 'hit';
    switch (d.mode) {
      case 'facing': set(2, 4, 'me'); for (const [f, s] of d.cells) set(2 + s, 4 - f, hitCls); break;
      case 'line': set(2, 4, 'me'); for (let y = 0; y < 4; y++) set(2, y, hitCls); break;
      case 'targetFacing': set(2, 4, 'me'); for (const [f, s] of d.cells) set(2 + s, 2 - f, hitCls); set(2, 2, hitCls + ' tg'); break;
      case 'self': for (const [x, y] of d.cells) set(2 + x, 2 + y, hitCls); set(2, 2, d.cells.some(([x, y]) => !x && !y) ? hitCls + ' me' : 'me'); break;
      case 'target': for (const [x, y] of d.cells) set(2 + x, 2 + y, hitCls); set(2, 2, hitCls + ' tg'); break;
      case 'chain': set(2, 4, 'me'); [[2, 2], [3, 1], [1, 1], [2, 0]].forEach(([x, y]) => set(x, y, hitCls)); set(2, 2, hitCls + ' tg'); break;
      case 'volley': set(2, 4, 'me'); [[0, 0], [3, 1], [1, 2], [4, 0], [2, 1]].forEach(([x, y]) => set(x, y, hitCls)); break;
      case 'lowest': set(2, 4, 'me'); set(3, 0, hitCls + ' tg'); break;
      case 'leap': set(2, 4, 'me'); set(3, 0, hitCls + ' tg'); set(3, 1, 'me ghost'); break;
      case 'single': set(2, 4, 'me'); set(2, 2, hitCls + ' tg'); break;
      case 'selfOnly': set(2, 2, 'ally me'); break;
      case 'ally': case 'lowestAlly': set(2, 2, 'me'); set(1, 3, 'ally'); break;
      case 'dead': set(2, 2, 'me'); set(3, 3, 'ally tg'); break;
      case 'all': set(2, 2, 'me'); [[0, 1], [4, 3], [1, 4], [3, 0], [4, 1]].forEach(([x, y]) => set(x, y, 'ally')); break;
    }
    return '<div class="pat">' + g.map((v) => `<i class="${v}"></i>`).join('') + '</div>';
  }

  // ---------- 카드 ----------
  const tierDots = (t) => `<span class="tier" aria-label="등급 ${t}">${'●'.repeat(t)}${'○'.repeat(3 - t)}</span>`;
  function base(kind, cls, tier, extraCls) {
    const el = document.createElement('div');
    el.className = `card ${kind} t${tier || 1}${extraCls ? ' ' + extraCls : ''}`;
    el.style.setProperty('--cc', CLASSES[cls] ? CLASSES[cls].color : '#4b5160');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new CustomEvent('pick')); } });
    return el;
  }
  /** 유닛 카드. u 가 원정 유닛이면 레벨·장비 포함, 아니면 기본형 */
  function unitCard(u, opts = {}) {
    const d = byKind.unit[u.id], st = global.BT.unitStats(u.level ? u : { id: u.id, level: 1, skills: [], weapon: null });
    const el = base('unit', d.cls, d.tier, opts.cls);
    const lo = u.level ? { level: u.level, weapon: u.weapon ? Object.assign({}, byKind.weapon[u.weapon.id], { up: u.weapon.up }) : null, skills: (u.skills || []).map((s) => { const sd = byKind.skill[s.id]; return { col: CLASSES[sd.cls].color, icon: sd.icon, up: s.up }; }) } : null;
    el.innerHTML = `${opts.price != null ? `<span class="price">${opts.price}G</span>` : ''}<span class="ctype">${CLASSES[d.cls].full} 딱지 ${tierDots(d.tier)}</span>
      <span class="nm">${d.name}${u.level ? ` <b class="lv">Lv${u.level}</b>` : ''}</span>
      <span class="art"><img src="${global.ART.discURL(d.id, 0, '', lo, 96)}" alt="" draggable="false"></span>
      <span class="st"><span>체 ${st.hp}</span><span>공 ${Math.round(st.atk)}</span><span>사 ${st.range}</span></span>
      <span class="tx">${PASSIVES[d.passive]}</span>`;
    return el;
  }
  function chipCard(c, opts = {}) {
    const d = byKind.skill[c.id];
    const el = base('skill', d.cls, d.tier, opts.cls);
    el.innerHTML = `${opts.price != null ? `<span class="price">${opts.price}G</span>` : ''}<span class="ctype">${CLASSES[d.cls].full} 스킬 칩 ${tierDots(d.tier)}</span>
      <span class="nm"><img class="chipimg" src="${global.ART.chipURL(CLASSES[d.cls].color, d.icon, c.up, 40)}" alt="">${d.name}${c.up ? '<b class="plus">+</b>' : ''}</span>
      ${patternGrid(d)}
      <span class="tx">${d.desc}</span>
      <span class="st"><span>마나 ${d.mana - (c.up ? 10 : 0)}</span>${d.power > 1 ? `<span>위력 ${Math.round(d.power * (c.up ? 1.4 : 1))}</span>` : d.effect === 'heavy' ? `<span>공×${(d.power * (c.up ? 1.4 : 1)).toFixed(1)}</span>` : ''}</span>`;
    return el;
  }
  function weaponCard(w, opts = {}) {
    const d = byKind.weapon[w.id];
    const el = base('weapon', d.cls, d.tier, opts.cls);
    el.innerHTML = `${opts.price != null ? `<span class="price">${opts.price}G</span>` : ''}<span class="ctype">${CLASSES[d.cls].full} 무기 ${tierDots(d.tier)}</span>
      <span class="nm">${d.name}${w.up ? '<b class="plus">+</b>' : ''}</span>
      <span class="art wart"><img src="${global.ART.weaponURL(d, w.up, 64)}" alt="" draggable="false"></span>
      <span class="tx">${d.desc}${w.up ? ' (강화: 수치 ×1.5)' : ''}</span>`;
    return el;
  }
  function tacticCard(t, opts = {}) {
    const d = byKind.tactic[t.id];
    const el = base('tactic', 'any', d.tier, opts.cls);
    const cost = opts.cost != null ? opts.cost : d.cost;
    el.innerHTML = `${opts.price != null ? `<span class="price">${opts.price}G</span>` : ''}<span class="cost">${cost}</span><span class="ctype">전술 카드 ${tierDots(d.tier)}</span>
      <span class="nm">${d.name}</span>
      <span class="art tart"><img src="${global.ART.tacticURL(d.id, 64)}" alt="" draggable="false"></span>
      <span class="tx">${d.desc}</span>`;
    return el;
  }
  function anyCard(kind, item, opts) {
    return kind === 'unit' ? unitCard(item, opts) : kind === 'skill' ? chipCard(item, opts) : kind === 'weapon' ? weaponCard(item, opts) : tacticCard(item, opts);
  }
  function relicButton(r, extra = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice relicbuy';
    b.innerHTML = `<span class="rsym">${r.sym}</span>${r.name}${extra}<small>${r.desc}</small>`;
    return b;
  }

  // ---------- 도감 ----------
  const TABS = [
    ['unit', '딱지'], ['skill', '스킬 칩'], ['weapon', '무기'], ['tactic', '전술 카드'], ['monster', '몬스터'], ['boss', '보스'], ['relic', '유물'], ['rules', '시너지·상태'],
  ];
  let codexTab = 'unit', codexCls = 'all', codexBack = null;
  function openCodex(back) {
    if (back) codexBack = back;
    global.CE.show('codex');
    renderCodex();
  }
  function counts() {
    const n = (kind, list) => [list.filter((x) => isSeen(kind, x.id)).length, list.length];
    const mons = Object.values(MONSTERS).filter((m) => !m.boss);
    const bosses = Object.values(MONSTERS).filter((m) => m.boss);
    return { unit: n('unit', UNITS), skill: n('skill', SKILLS), weapon: n('weapon', WEAPONS), tactic: n('tactic', TACTICS), monster: n('monster', mons), boss: n('monster', bosses), relic: n('relic', Object.values(RELICS)) };
  }
  function renderCodex() {
    const c = counts();
    const total = Object.values(c).reduce((s, [a, b]) => [s[0] + a, s[1] + b], [0, 0]);
    $('codexHead').innerHTML = `<div><h2>도감</h2><p class="muted">발견 ${total[0]} / ${total[1]} · 아직 만나지 못한 항목도 정보는 볼 수 있습니다.</p></div><button type="button" id="codexBack">돌아가기</button>`;
    $('codexBack').onclick = () => { if (codexBack) codexBack(); };
    $('codexTabs').innerHTML = TABS.map(([k, n]) => `<button type="button" class="tab${k === codexTab ? ' on' : ''}" data-k="${k}">${n}${c[k] ? ` <small>${c[k][0]}/${c[k][1]}</small>` : ''}</button>`).join('');
    $('codexTabs').querySelectorAll('.tab').forEach((b) => (b.onclick = () => { codexTab = b.dataset.k; codexCls = 'all'; renderCodex(); }));
    const filterable = ['unit', 'skill', 'weapon'].includes(codexTab);
    $('codexFilter').hidden = !filterable;
    if (filterable) {
      $('codexFilter').innerHTML = [['all', '전체'], ...Object.entries(CLASSES).filter(([k]) => codexTab !== 'unit' || k !== 'any').map(([k, v]) => [k, v.full])].map(([k, n]) => `<button type="button" class="chipbtn${k === codexCls ? ' on' : ''}" data-k="${k}" style="--cc:${CLASSES[k] ? CLASSES[k].color : '#232a3b'}">${n}</button>`).join('');
      $('codexFilter').querySelectorAll('.chipbtn').forEach((b) => (b.onclick = () => { codexCls = b.dataset.k; renderCodex(); }));
    }
    const grid = $('codexGrid');
    grid.innerHTML = '';
    grid.className = 'codexgrid ' + codexTab;
    const add = (el, kind, id) => { if (!isSeen(kind, id)) el.classList.add('unseen'); grid.appendChild(el); };
    const byCls = (x) => codexCls === 'all' || x.cls === codexCls;
    if (codexTab === 'unit') UNITS.filter(byCls).forEach((d) => add(unitCard({ id: d.id }), 'unit', d.id));
    if (codexTab === 'skill') SKILLS.filter(byCls).forEach((d) => add(chipCard({ id: d.id }), 'skill', d.id));
    if (codexTab === 'weapon') WEAPONS.filter(byCls).forEach((d) => add(weaponCard({ id: d.id }), 'weapon', d.id));
    if (codexTab === 'tactic') TACTICS.forEach((d) => add(tacticCard({ id: d.id }), 'tactic', d.id));
    if (codexTab === 'monster' || codexTab === 'boss') {
      const list = Object.values(MONSTERS).filter((m) => (codexTab === 'boss' ? m.boss : !m.boss));
      for (const m of list) {
        const el = document.createElement('div');
        el.className = 'centry' + (m.elite ? ' elite' : '') + (m.boss ? ' boss' : '');
        const where = m.act ? `${m.act}막 ${ACTS[m.act].name}` : m.object ? '설치물' : '소환물';
        const skills = m.skills.map((id) => byKind.skill[id].name).join(', ');
        el.innerHTML = `<img src="${global.ART.tokenURL(m.id, m.summon || m.object ? 0 : 1, m.boss ? 'boss' : m.elite ? 'elite' : '')}" alt="">
          <div><b>${m.name}</b>${m.elite ? ' <span class="tag">정예</span>' : ''}${m.boss ? ' <span class="tag boss">보스</span>' : ''}<small>${where}</small>
          <p>${m.desc || ''}</p><p class="muted">체력 ${m.hp} · 공격 ${m.atk} · 사거리 ${m.range}${m.armor ? ' · 피해 감소 ' + Math.round(m.armor * 100) + '%' : ''}${skills ? ' · 스킬: ' + skills : ''}</p>
          ${m.boss ? `<p class="bossnote">${BOSS_INFO[m.boss]}</p>` : ''}</div>`;
        add(el, 'monster', m.id);
      }
    }
    if (codexTab === 'relic') {
      for (const r of Object.values(RELICS)) {
        const el = document.createElement('div');
        el.className = 'centry relic';
        el.innerHTML = `<span class="rsym big">${r.sym}</span><div><b>${r.name}</b>${r.boss ? ' <span class="tag boss">보스 보상</span>' : ''}<p>${r.desc}</p></div>`;
        add(el, 'relic', r.id);
      }
    }
    if (codexTab === 'rules') {
      const syn = Object.entries(SYNERGY).map(([k, s]) => `<div class="centry"><span class="rsym big" style="background:${CLASSES[k].color};color:#fff">${CLASSES[k].name}</span><div><b>${CLASSES[k].full} 시너지</b><p>서로 다른 ${CLASSES[k].full} 딱지 ${s.th[0]}명: ${s.desc[0]}</p><p>${s.th[1]}명: ${s.desc[1]}</p></div></div>`).join('');
      const kw = Object.values(KEYWORDS).map((k) => `<div class="centry"><span class="rsym big" style="background:${k.color}"></span><div><b>${k.name}</b><p>${k.desc}</p></div></div>`).join('');
      const rules = `<div class="centry wide"><div><b>장비 규칙</b><p>딱지마다 스킬 칩 2개, 무기 1개를 올릴 수 있습니다. 칩과 무기는 같은 계열(공용은 모두) 딱지에만 맞습니다. 편성 화면에서 언제든 바꿔 끼울 수 있습니다.</p>
        <p>스킬 칩은 마나가 찰 때마다 올려진 순서대로 번갈아 씁니다. 강화(+)하면 위력 ×1.4, 마나 −10. 무기를 강화하면 수치가 ×1.5가 됩니다.</p>
        <p>배치 한도는 1막 4명, 2막 5명, 3막 6명입니다. 전투에서 이기면 나간 딱지는 경험치 2, 대기한 딱지는 1을 얻습니다.</p></div></div>`;
      grid.innerHTML = rules + '<h3 class="span">계열 시너지</h3>' + syn + '<h3 class="span">상태이상·키워드</h3>' + kw + '<h3 class="span">이벤트</h3>' +
        EVENTS.map((e) => `<div class="centry"><div><b>${e.title}</b><p class="muted">${e.text}</p><p>${e.choices.map((c) => `· ${c.label}${c.note ? ` (${c.note})` : ''}`).join('<br>')}</p></div></div>`).join('');
    }
  }

  global.CE = Object.assign(global.CE || {}, { $, esc, toast, modal, closeModal, markSeen, isSeen, patternGrid, unitCard, chipCard, weaponCard, tacticCard, anyCard, relicButton, openCodex, renderCodex });
})(window);
