/* 카드 원정대 — 게임 진행 (v3)
 * 타이틀 → 출정 준비(시작 부대·난이도) → 지도(갈림길) → 노드 → 막 보스 → 다음 막 → 최종 보스
 * 파티(딱지)는 원정 내내 함께하고, 스킬 칩·무기를 딱지 위에 올려 장착한다. 전술 카드는 전투마다 뽑아 쓴다.
 */
(() => {
  'use strict';
  const { CLASSES, SYNERGY, SKILLS, UNITS, PASSIVES, WEAPONS, TACTICS, byKind, STARTS, DIFFICULTY, MONSTERS, ACTS, BOSS_INFO, RELICS, EVENTS } = GD;
  const { $, toast, modal, closeModal, markSeen, tacticCard, anyCard, relicButton } = CE;
  const SAVE_KEY = 'card-expedition-save-v3';
  const LANES = 5, MAP_ROWS = 7; // 0~4 일반 층, 5 야영지, 6 보스
  const PARTY_MAX = 8, SKILL_SLOTS = 2;
  const NODE_TYPES = {
    battle: { name: '전투', desc: '일반 몬스터' },
    elite: { name: '정예', desc: '강한 적 · 유물 보상' },
    event: { name: '이벤트', desc: '무슨 일이 일어날지 모른다' },
    shop: { name: '상점', desc: '딱지·칩·무기·카드 구매, 강화, 훈련' },
    rest: { name: '야영지', desc: '회복, 수련, 정비' },
    treasure: { name: '보물', desc: '유물 획득' },
    forge: { name: '대장간', desc: '칩·무기 강화 또는 재련' },
    boss: { name: '보스', desc: '막의 끝' },
  };
  const uid = () => AC.uid() + '-' + Math.random().toString(36).slice(2, 6);

  // =====================================================================
  // 원정 상태
  // =====================================================================
  class Run {
    constructor(data) { Object.assign(this, data); }
    has(r) { return this.relics.includes(r); }
    hurt(n) { this.hp = Math.max(0, this.hp - n); }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    get partyMax() { return PARTY_MAX; }
    get energy() { return [0, 3, 4, 4][this.act] + (this.has('crystal') ? 1 : 0); }
    get handSize() { return 4 + (this.has('pack') ? 1 : 0); }
    get deployMax() { return 3 + this.act + (this.has('command') ? 1 : 0); }
    addRelic(id) { if (!this.has(id)) { this.relics.push(id); markSeen('relic', id); } }
    randomRelic(boss) {
      const pool = Object.values(RELICS).filter((r) => !!r.boss === !!boss && !this.has(r.id));
      return pool.length ? AC.pick(pool) : null;
    }
    randomOf(kind, tier) {
      const all = { unit: UNITS, skill: SKILLS, weapon: WEAPONS, tactic: TACTICS }[kind];
      const pool = all.filter((x) => x.tier === tier);
      return AC.pick(pool.length ? pool : all);
    }
    gain(kind, id) {
      markSeen(kind, id);
      if (kind === 'unit') {
        if (this.party.length >= PARTY_MAX) { this.gold += 30; toast('파티가 가득 차서 골드 30으로 바꿨습니다'); return; }
        this.party.push(mkUnit(id));
      } else if (kind === 'skill') this.chips.push({ uid: uid(), id, up: false });
      else if (kind === 'weapon') this.weapons.push({ uid: uid(), id, up: false });
      else if (kind === 'tactic') this.tactics.push({ uid: uid(), id });
    }
    addXp(u, n) {
      u.xp += n;
      const ups = [];
      while (u.level < BT.MAX_LEVEL && u.xp >= BT.XP_TABLE[u.level + 1]) { u.level++; ups.push(u.level); }
      return ups;
    }
    pickUpgrade(msg) { pickUpgrade(msg, finishNode); }
    pickRemove(msg) { pickTacticRemove(msg, finishNode); }
    pickTrain(msg) { pickTrain(msg, 1, finishNode); }
    pickReforge(msg) { pickReforge(msg, finishNode); }
  }
  let R = null;
  function mkUnit(id, skills = [], wp = null) {
    markSeen('unit', id);
    skills.forEach((s) => markSeen('skill', s));
    if (wp) markSeen('weapon', wp);
    return { uid: uid(), id, level: 1, xp: 0, skills: skills.map((s) => ({ uid: uid(), id: s, up: false })), weapon: wp ? { uid: uid(), id: wp, up: false } : null, rot: AC.rand(-0.08, 0.08) };
  }
  function newRun(startId, diff) {
    const S = STARTS.find((s) => s.id === startId), D = DIFFICULTY[diff];
    R = new Run({
      version: 3, difficulty: diff, startId, hp: D.hp, maxHp: D.hp, gold: 60, act: 1, pos: null, visited: [], relics: [], speed: 1,
      party: S.units.map(([id, sk, wp]) => mkUnit(id, sk, wp)),
      chips: S.chips.map((id) => ({ uid: uid(), id, up: false })), weapons: S.weapons.map((id) => ({ uid: uid(), id, up: false })),
      tactics: S.tactics.map((id) => ({ uid: uid(), id })),
      stats: { battles: 0, wins: 0, elites: 0, bosses: 0, time: 0, kills: 0 },
    });
    S.chips.forEach((c) => markSeen('skill', c));
    S.tactics.forEach((t) => markSeen('tactic', t));
    R.map = genMap(1);
  }
  const canUpgrade = (x) => !x.up;
  const unitName = (u) => byKind.unit[u.id].name;
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(R)); } catch (e) { /* 저장 불가 환경 */ } }
  function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }

  // 장비 규칙
  const fits = (itemCls, u) => itemCls === 'any' || itemCls === byKind.unit[u.id].cls;
  function equipChip(chip, u) {
    const d = byKind.skill[chip.id];
    if (!fits(d.cls, u)) return toast(`${d.name}은(는) ${CLASSES[d.cls].full} 딱지에만 맞습니다`), false;
    if (u.skills.length >= SKILL_SLOTS) return toast('스킬 칩은 딱지당 2개까지입니다. 올린 칩을 눌러 먼저 빼세요'), false;
    R.chips.splice(R.chips.indexOf(chip), 1);
    u.skills.push(chip);
    SFX.play('attach');
    return true;
  }
  function equipWeapon(w, u) {
    const d = byKind.weapon[w.id];
    if (!fits(d.cls, u)) return toast(`${d.name}은(는) ${CLASSES[d.cls].full} 딱지에만 맞습니다`), false;
    R.weapons.splice(R.weapons.indexOf(w), 1);
    if (u.weapon) R.weapons.push(u.weapon);
    u.weapon = w;
    SFX.play('attach');
    return true;
  }
  function unequip(u, slot) {
    if (slot === 'w') { if (u.weapon) { R.weapons.push(u.weapon); u.weapon = null; } }
    else { const c = u.skills.splice(slot, 1)[0]; if (c) R.chips.push(c); }
    SFX.play('card');
  }

  // =====================================================================
  // 지도
  // =====================================================================
  function genMap(act) {
    const nodes = {};
    const get = (row, lane) => {
      const id = row + '-' + lane;
      if (!nodes[id]) nodes[id] = { id, row, lane, type: null, next: [], jx: AC.rand(-0.18, 0.18), jy: AC.rand(-0.12, 0.12) };
      return nodes[id];
    };
    const link = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); };
    const starts = AC.shuffle([0, 1, 2, 3, 4]).slice(0, 3);
    starts.push(AC.pick(starts));
    for (const s of starts) {
      let lane = s;
      for (let row = 0; row < MAP_ROWS - 1; row++) {
        const n = get(row, lane);
        if (row === MAP_ROWS - 2) { link(n, get(MAP_ROWS - 1, 2)); break; }
        let nl = AC.clamp(lane + AC.randi(-1, 1), 0, LANES - 1);
        const cross = nodes[row + '-' + nl] && nodes[row + '-' + nl].next.includes((row + 1) + '-' + lane);
        if (cross) nl = lane;
        link(n, get(row + 1, nl));
        lane = nl;
      }
    }
    const list = Object.values(nodes);
    for (const n of list) {
      if (n.row === 0) n.type = 'battle';
      else if (n.row === MAP_ROWS - 2) n.type = 'rest';
      else if (n.row === MAP_ROWS - 1) n.type = 'boss';
      else {
        const w = { battle: 40, event: 20, elite: n.row >= 2 ? 14 : 0, shop: 10, treasure: 7, forge: n.row >= 2 ? 9 : 0 };
        const keys = Object.keys(w);
        n.type = keys[AC.weighted(keys.map((k) => w[k]))];
      }
    }
    const mids = list.filter((n) => n.row >= 1 && n.row <= MAP_ROWS - 3);
    if (!mids.some((n) => n.type === 'shop')) AC.pick(mids).type = 'shop';
    if (!mids.some((n) => n.type === 'elite')) { const c = mids.filter((n) => n.row >= 2 && n.type !== 'shop'); if (c.length) AC.pick(c).type = 'elite'; }
    return { act, nodes: list, boss: AC.pick(ACTS[act].bosses) };
  }
  const ICON = {
    battle: '<path d="M5 3l11 11M3 5l2-2M13 16l3-3M15 18l3-3M19 3L8 14M21 5l-2-2M11 16l-3-3M9 18l-3-3"/>',
    elite: '<path d="M6 11a6 6 0 0 1 12 0v3l-2 2v3H8v-3l-2-2z"/><circle cx="9.6" cy="12" r="1.4"/><circle cx="14.4" cy="12" r="1.4"/><path d="M7 7L3 2l5 3M17 7l4-5-5 3M11 19v-2M13 19v-2"/>',
    shop: '<path d="M9 3h6l-2 3h-2z"/><path d="M8 7h8c3 3 4 6 4 9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4c0-3 1-6 4-9z"/><path d="M13.5 11h-2.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H10M12 10v1M12 17v1"/>',
    rest: '<path d="M12 2c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2.5-5.5 0 2 1 3.5 2.5 3.5 0-2.5-1-4.5 0-7z"/><path d="M3 21l18-4M3 17l18 4"/>',
    treasure: '<rect x="3" y="10" width="18" height="10" rx="1.5"/><path d="M3 10c0-4 4-6 9-6s9 2 9 6M3 14h18"/><rect x="10.5" y="12.5" width="3" height="4" rx=".6"/>',
    forge: '<path d="M4 9h12l4-3v4l-3 2H8z"/><path d="M9 12v4M14 12v4M6 20h12M8 16h8l1 4H7z"/>',
  };
  const iconSvg = (type) => (ICON[type] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[type]}</svg>` : '');
  const nodeById = (id) => R.map.nodes.find((n) => n.id === id);
  function reachable() {
    if (!R.pos) return R.map.nodes.filter((n) => n.row === 0);
    const cur = nodeById(R.pos);
    return cur ? cur.next.map(nodeById) : [];
  }

  // =====================================================================
  // 화면·HUD
  // =====================================================================
  function show(screen) {
    for (const id of ['title', 'mapScreen', 'battle', 'ending', 'codex']) {
      const el = $(id), was = !el.hidden;
      el.hidden = id !== screen;
      if (id === screen && !was) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
    }
    $('hud').hidden = !R || screen === 'title' || screen === 'ending' || screen === 'codex';
    if (!$('hud').hidden) renderHud();
    window.scrollTo(0, 0);
  }
  CE.show = show;
  const fmtTime = (s) => Math.floor(s / 60) + '분 ' + String(Math.floor(s % 60)).padStart(2, '0') + '초';
  function renderHud() {
    if (!R) return;
    if (renderHud.lastHp != null && R.hp < renderHud.lastHp) { const w = $('hpwrap'); w.classList.remove('hurt'); void w.offsetWidth; w.classList.add('hurt'); }
    renderHud.lastHp = R.hp;
    $('hpText').textContent = R.hp + ' / ' + R.maxHp;
    $('hpFill').style.width = (100 * R.hp) / R.maxHp + '%';
    $('goldText').textContent = R.gold;
    const node = R.pos ? nodeById(R.pos) : null;
    $('actText').textContent = R.act + '막 ' + ACTS[R.act].name + (node ? ' · ' + (node.row + 1) + '층' : '') + ' · ' + DIFFICULTY[R.difficulty].name;
    $('partyBtn').textContent = '편성 ' + R.party.length;
    $('relics').innerHTML = R.relics.map((id) => `<button type="button" class="relic" data-r="${id}" title="${RELICS[id].name}: ${RELICS[id].desc}">${RELICS[id].sym}</button>`).join('');
    $('relics').querySelectorAll('.relic').forEach((b) => (b.onclick = () => { const r = RELICS[b.dataset.r]; toast(r.name + ' — ' + r.desc); }));
  }

  function showMap() {
    closeModal();
    save();
    show('mapScreen');
    $('mapTitle').textContent = R.act + '막 · ' + ACTS[R.act].name;
    $('mapSub').textContent = R.pos ? '다음 갈 곳을 고르세요. 선으로 이어진 곳만 갈 수 있습니다.' : '출발 지점을 고르세요. 맨 위의 보스까지 올라가야 합니다.';
    const box = $('mapbox');
    box.querySelectorAll('.mnode').forEach((n) => n.remove());
    const pos = (n) => ({ x: ((n.lane + 0.5 + n.jx) / LANES) * 100, y: n.row === MAP_ROWS - 1 ? 6 : 100 - ((n.row + 0.5 + n.jy) / (MAP_ROWS - 0.4)) * 100 + 2 });
    const reach = new Set(reachable().map((n) => n.id));
    const visited = new Set(R.visited || []);
    let svg = '';
    for (const n of R.map.nodes) for (const id of n.next) {
      const m = nodeById(id), a = pos(n), b = pos(m);
      const cls = visited.has(n.id) && visited.has(m.id) ? 'walked' : R.pos === n.id ? 'open' : '';
      svg += `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    }
    $('mapsvg').innerHTML = svg;
    const legend = [['battle', '#fff', '전투'], ['elite', '#e8436b', '정예'], ['event', '#f5c400', '이벤트'], ['shop', '#2e9e6b', '상점'], ['rest', '#e8643b', '야영지'], ['treasure', '#d9a400', '보물'], ['forge', '#7a8494', '대장간']];
    $('maplegend').innerHTML = legend.map(([k, c, n]) => `<span><i style="--c:${c}">${iconSvg(k) || '?'}</i>${n}</span>`).join('') + `<span><img src="${ART.tokenURL(R.map.boss, 1, 'boss')}" alt="">${MONSTERS[R.map.boss].name}</span>`;
    for (const n of R.map.nodes) {
      const p = pos(n), t = NODE_TYPES[n.type];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mnode t-' + n.type + (reach.has(n.id) ? ' reach' : '') + (visited.has(n.id) ? ' visited' : '') + (R.pos === n.id ? ' here' : '');
      b.style.left = p.x + '%'; b.style.top = p.y + '%';
      if (n.type === 'boss') b.innerHTML = `<img src="${ART.tokenURL(R.map.boss, 1, 'boss')}" alt="">`;
      else if (ICON[n.type]) b.innerHTML = iconSvg(n.type);
      else b.textContent = '?';
      b.title = t.name + ' — ' + (n.type === 'boss' ? MONSTERS[R.map.boss].name : t.desc);
      b.setAttribute('aria-label', (n.row + 1) + '층 ' + t.name);
      b.disabled = !reach.has(n.id);
      b.onclick = () => { SFX.play('step'); enterNode(n); };
      box.appendChild(b);
    }
  }

  let curNode = null;
  function enterNode(n) {
    curNode = n;
    if (n.type === 'battle' || n.type === 'elite' || n.type === 'boss') startBattle(n.type);
    else if (n.type === 'event') showEvent();
    else if (n.type === 'shop') showShop();
    else if (n.type === 'rest') showRest();
    else if (n.type === 'treasure') showTreasure();
    else if (n.type === 'forge') showForge();
  }
  function finishNode() {
    if (curNode) { R.pos = curNode.id; R.visited = R.visited || []; R.visited.push(curNode.id); }
    if (R.hp <= 0) return ending(false);
    if (curNode && curNode.type === 'boss') return nextAct();
    showMap();
  }
  function nextAct() {
    if (R.act >= 3) return ending(true);
    R.act++;
    R.map = genMap(R.act);
    R.pos = null; R.visited = [];
    const healed = Math.ceil((R.maxHp - R.hp) * 0.5);
    R.heal(healed);
    modal(`<span class="eyebrow">${R.act}막</span><h3>${ACTS[R.act].name}</h3><p>${ACTS[R.act].story}</p>
      <p class="muted">체력 ${healed} 회복 · 배치 한도 ${R.deployMax}명 · 에너지 ${R.energy}</p><div class="row"><button type="button" class="primary" id="goAct">출발</button></div>`);
    $('goAct').onclick = () => { curNode = null; showMap(); };
  }

  // =====================================================================
  // 고르기 창(강화·수련·제거·재련)
  // =====================================================================
  function pickFrom(title, items, onPick, onCancel, note) {
    modal(`<h3>${title}</h3>${note ? `<p class="muted">${note}</p>` : ''}<div class="choices cards" id="pk"></div><div class="row"><button type="button" id="pkCancel">취소</button></div>`, true);
    if (!items.length) $('pk').innerHTML = '<p>고를 수 있는 것이 없습니다.</p>';
    for (const it of items) {
      const el = anyCard(it.kind, it.item);
      if (it.label) el.insertAdjacentHTML('afterbegin', `<span class="owner">${it.label}</span>`);
      const go = () => onPick(it);
      el.onclick = go; el.addEventListener('pick', go);
      $('pk').appendChild(el);
    }
    $('pkCancel').onclick = () => (onCancel ? onCancel() : finishNode());
  }
  function upgradeables() {
    const out = [];
    for (const c of R.chips) if (canUpgrade(c)) out.push({ kind: 'skill', item: c });
    for (const w of R.weapons) if (canUpgrade(w)) out.push({ kind: 'weapon', item: w });
    for (const u of R.party) {
      for (const c of u.skills) if (canUpgrade(c)) out.push({ kind: 'skill', item: c, label: unitName(u) });
      if (u.weapon && canUpgrade(u.weapon)) out.push({ kind: 'weapon', item: u.weapon, label: unitName(u) });
    }
    return out;
  }
  function pickUpgrade(msg, done, onCancel) {
    pickFrom(msg, upgradeables(), (it) => { it.item.up = true; SFX.play('attach'); toast((it.kind === 'skill' ? byKind.skill : byKind.weapon)[it.item.id].name + ' 강화!'); done(); }, onCancel, '칩: 위력 ×1.4, 마나 −10 · 무기: 수치 ×1.5');
  }
  function pickTrain(msg, n, done, onCancel) {
    const items = R.party.filter((u) => u.level < BT.MAX_LEVEL).map((u) => ({ kind: 'unit', item: u }));
    pickFrom(msg, items, (it) => {
      const u = it.item;
      for (let k = 0; k < n && u.level < BT.MAX_LEVEL; k++) { u.level++; u.xp = Math.max(u.xp, BT.XP_TABLE[u.level]); }
      SFX.play('win'); toast(unitName(u) + ' Lv' + u.level + '!'); done();
    }, onCancel, '레벨마다 체력·공격력 +18%');
  }
  function pickTacticRemove(msg, done, onCancel) {
    pickFrom(msg, R.tactics.length > 3 ? R.tactics.map((t) => ({ kind: 'tactic', item: t })) : [], (it) => { R.tactics.splice(R.tactics.indexOf(it.item), 1); toast(byKind.tactic[it.item.id].name + ' 제거'); done(); }, onCancel, '덱에는 최소 3장이 남아야 합니다');
  }
  function pickReforge(msg, done, onCancel) {
    pickFrom(msg, R.weapons.filter((w) => byKind.weapon[w.id].tier < 3).map((w) => ({ kind: 'weapon', item: w })), (it) => {
      const old = byKind.weapon[it.item.id], nw = R.randomOf('weapon', old.tier + 1);
      R.weapons.splice(R.weapons.indexOf(it.item), 1);
      R.gain('weapon', nw.id);
      SFX.play('boom'); toast(`${old.name} → ${nw.name}`); done();
    }, onCancel, '보관함의 무기를 녹여 한 등급 높은 무작위 무기로 바꿉니다');
  }

  // =====================================================================
  // 이벤트 · 상점 · 야영지 · 대장간 · 보물
  // =====================================================================
  function showEvent() {
    const ev = AC.pick(EVENTS);
    modal(`<span class="eyebrow">이벤트</span><h3>${ev.title}</h3><p>${ev.text}</p><div class="choices col" id="evc"></div>`);
    for (const ch of ev.choices) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice';
      b.disabled = !!ch.cond && !ch.cond(R);
      b.innerHTML = `${ch.label}${ch.note ? `<small>${ch.note}</small>` : ''}`;
      b.onclick = () => {
        const res = ch.fn(R);
        renderHud();
        if (res === null) return;
        modal(`<h3>${ev.title}</h3><p>${res}</p><div class="row"><button type="button" class="primary" id="evOk">계속</button></div>`);
        $('evOk').onclick = finishNode;
      };
      $('evc').appendChild(b);
    }
    show('mapScreen');
  }
  const priceMul = () => (R.has('merchant') ? 0.8 : 1);
  const PRICE = { unit: [0, 45, 75, 110], skill: [0, 40, 65, 95], weapon: [0, 40, 70, 105], tactic: [0, 30, 50, 75] };
  function rollTier(bonus = 0) {
    const w = [[0, 0, 0], [62, 30, 8], [40, 44, 16], [24, 46, 30]][R.act].slice();
    w[2] += bonus; w[0] = Math.max(5, w[0] - bonus);
    return AC.weighted(w) + 1;
  }
  function showShop() {
    const mk = (kind, tier) => { const d = R.randomOf(kind, tier || rollTier()); markSeen(kind, d.id); return { kind, item: kind === 'unit' ? { id: d.id } : { id: d.id, up: false }, d, price: Math.round(PRICE[kind][d.tier] * AC.rand(0.9, 1.1) * priceMul()), sold: false }; };
    const items = [mk('unit'), mk('unit'), mk('skill'), mk('skill'), mk('weapon'), mk('weapon'), mk('tactic')];
    const relics = [];
    for (let k = 0; k < 2; k++) { const r = R.randomRelic(false); if (r && !relics.some((x) => x.r === r)) { relics.push({ r, price: Math.round(AC.randi(130, 160) * priceMul()), sold: false }); markSeen('relic', r.id); } }
    const used = {};
    const svc = (n) => Math.round(n * priceMul());
    const render = () => {
      modal(`<span class="eyebrow">상점</span><h3>떠돌이 상인의 수레</h3><p class="muted">보유 골드 <b>${R.gold}G</b> · 파티 ${R.party.length}/${PARTY_MAX}</p>
        <div class="choices cards" id="shc"></div><div class="choices" id="shr"></div>
        <div class="row svc"><button type="button" id="svUp" ${used.up || R.gold < svc(60) ? 'disabled' : ''}>칩·무기 강화 ${svc(60)}G</button>
        <button type="button" id="svTrain" ${used.train || R.gold < svc(70) ? 'disabled' : ''}>딱지 훈련 ${svc(70)}G</button>
        <button type="button" id="svRemove" ${used.rm || R.gold < svc(50) ? 'disabled' : ''}>카드 제거 ${svc(50)}G</button>
        <button type="button" id="svParty">편성</button><button type="button" class="primary" id="shLeave">떠나기</button></div>`, true);
      for (const it of items) {
        const el = anyCard(it.kind, it.item, { price: it.sold ? '판매됨 ' : it.price });
        const full = it.kind === 'unit' && R.party.length >= PARTY_MAX;
        if (it.sold || R.gold < it.price || full) el.classList.add('cant');
        const buy = () => {
          if (it.sold) return;
          if (full) return toast('파티가 가득 찼습니다 (최대 8)');
          if (R.gold < it.price) return toast('골드가 부족합니다');
          R.gold -= it.price; it.sold = true; R.gain(it.kind, it.d.id); SFX.play('coin'); toast(it.d.name + ' 구매'); renderHud(); render();
        };
        el.onclick = buy; el.addEventListener('pick', buy);
        $('shc').appendChild(el);
      }
      for (const it of relics) {
        const b = relicButton(it.r, ` · ${it.sold ? '판매됨' : it.price + 'G'}`);
        b.disabled = it.sold || R.gold < it.price;
        b.onclick = () => { R.gold -= it.price; it.sold = true; R.addRelic(it.r.id); SFX.play('coin'); toast(it.r.name + ' 구매'); renderHud(); render(); };
        $('shr').appendChild(b);
      }
      $('svUp').onclick = () => pickUpgrade('강화할 칩이나 무기를 고르세요', () => { R.gold -= svc(60); used.up = true; renderHud(); render(); }, render);
      $('svTrain').onclick = () => pickTrain('훈련할 딱지를 고르세요', 1, () => { R.gold -= svc(70); used.train = true; renderHud(); render(); }, render);
      $('svRemove').onclick = () => pickTacticRemove('제거할 전술 카드를 고르세요', () => { R.gold -= svc(50); used.rm = true; renderHud(); render(); }, render);
      $('svParty').onclick = () => openLoadout(render);
      $('shLeave').onclick = finishNode;
    };
    render();
    show('mapScreen');
  }
  function showRest() {
    const amt = Math.round(R.maxHp * 0.3), lv = R.has('anvil') ? 2 : 1;
    const render = () => {
      modal(`<span class="eyebrow">야영지</span><h3>모닥불</h3><p>타닥거리는 불 앞에서 잠시 숨을 고른다. 한 가지만 할 수 있다.</p>
        <div class="choices col"><button type="button" class="choice" id="rsHeal" ${R.hp >= R.maxHp ? 'disabled' : ''}>휴식<small>체력 ${amt} 회복 (${R.hp}/${R.maxHp})</small></button>
        <button type="button" class="choice" id="rsTrain">수련<small>딱지 하나 레벨 +${lv}</small></button>
        <button type="button" class="choice" id="rsUp">정비<small>칩이나 무기 하나 강화</small></button></div>
        <div class="row"><button type="button" id="rsParty">편성 보기</button></div>`);
      $('rsHeal').onclick = () => { R.heal(amt); toast('체력 ' + amt + ' 회복'); renderHud(); finishNode(); };
      $('rsTrain').onclick = () => pickTrain('수련할 딱지를 고르세요', lv, finishNode, render);
      $('rsUp').onclick = () => pickUpgrade('강화할 칩이나 무기를 고르세요', finishNode, render);
      $('rsParty').onclick = () => openLoadout(render);
    };
    render();
    show('mapScreen');
  }
  function showForge() {
    const render = () => {
      modal(`<span class="eyebrow">대장간</span><h3>난쟁이의 대장간</h3><p>“두드려 줄까, 녹여서 새로 만들어 줄까?” 한 가지만 할 수 있다.</p>
        <div class="choices col"><button type="button" class="choice" id="fgUp">강화<small>칩이나 무기 하나 무료 강화</small></button>
        <button type="button" class="choice" id="fgRe" ${R.weapons.some((w) => byKind.weapon[w.id].tier < 3) ? '' : 'disabled'}>재련<small>보관함의 무기 하나 → 한 등급 높은 무작위 무기</small></button>
        <button type="button" class="choice" id="fgBuy" ${R.gold >= 55 ? '' : 'disabled'}>주문 제작<small>골드 55 → 무작위 2등급 무기</small></button></div>
        <div class="row"><button type="button" id="fgParty">편성 보기</button></div>`);
      $('fgUp').onclick = () => pickUpgrade('강화할 칩이나 무기를 고르세요', finishNode, render);
      $('fgRe').onclick = () => pickReforge('재련할 무기를 고르세요', finishNode, render);
      $('fgBuy').onclick = () => { R.gold -= 55; const w = R.randomOf('weapon', 2); R.gain('weapon', w.id); SFX.play('coin'); modal(`<h3>${w.name}</h3><p>${w.desc}</p><div class="row"><button type="button" class="primary" id="fgOk">받는다</button></div>`); $('fgOk').onclick = finishNode; };
      $('fgParty').onclick = () => openLoadout(render);
    };
    render();
    show('mapScreen');
  }
  function showTreasure() {
    const r = R.randomRelic(false), g = AC.randi(20, 35);
    R.gold += g;
    if (r) R.addRelic(r.id);
    renderHud();
    SFX.play('coin');
    modal(`<span class="eyebrow">보물</span><h3>낡은 상자</h3><p>${r ? `<b>${r.name}</b> — ${r.desc}` : '빈 상자다.'}<br>골드 ${g} 획득</p><div class="row"><button type="button" class="primary" id="trOk">챙긴다</button></div>`);
    $('trOk').onclick = finishNode;
    show('mapScreen');
  }

  // =====================================================================
  // 편성(파티·장비) 화면
  // =====================================================================
  let loSel = null; // { kind: 'skill'|'weapon', item }
  function openLoadout(back) {
    loSel = null;
    const render = () => {
      modal(`<span class="eyebrow">편성</span><h3>원정대 딱지 ${R.party.length}/${PARTY_MAX}</h3>
        <p class="muted">보관함의 칩이나 무기를 누른 뒤 딱지를 누르면 올라갑니다(끌어다 놓아도 됩니다). 딱지 위의 칩·무기 자리를 누르면 보관함으로 돌아갑니다. 딱지당 스킬 칩 2개, 무기 1개.</p>
        <div class="party" id="loParty"></div>
        <div class="invwrap"><div><h4>스킬 칩 보관함 <small>${R.chips.length}</small></h4><div class="inv" id="loChips"></div></div>
        <div><h4>무기 보관함 <small>${R.weapons.length}</small></h4><div class="inv" id="loWeapons"></div></div></div>
        <div class="selcard" id="loSel"></div>
        <h4>전술 카드 덱 <small>${R.tactics.length}장 · 전투마다 ${R.handSize}장 뽑기, 에너지 ${R.energy}</small></h4><div class="deckrow" id="loDeck"></div>
        <div class="row"><button type="button" class="primary" id="loClose">닫기</button></div>`, true);
      const party = $('loParty');
      for (const u of R.party) {
        const d = byKind.unit[u.id], st = BT.unitStats(u), lo = battleApi.loadoutOf(u);
        const box = document.createElement('div');
        box.className = 'pslot' + (loSel ? (fits(loSel.kind === 'skill' ? byKind.skill[loSel.item.id].cls : byKind.weapon[loSel.item.id].cls, u) ? ' ok' : ' no') : '');
        box.style.setProperty('--cc', CLASSES[d.cls].color);
        box.dataset.uid = u.uid;
        const nextXp = BT.XP_TABLE[u.level + 1];
        const slotLabel = (i) => (u.skills[i] ? byKind.skill[u.skills[i].id].name + ' 빼기' : '빈 칩 칸');
        box.innerHTML = `<div class="discwrap"><img src="${ART.discURL(d.id, 0, '', lo, 120)}" alt="${d.name}" draggable="false">
            ${[0, 1].map((i) => `<button type="button" class="slot s${i}${u.skills[i] ? ' full' : ''}" data-slot="${i}" title="${slotLabel(i)}" aria-label="${slotLabel(i)}">${u.skills[i] ? '' : '+'}</button>`).join('')}
            <button type="button" class="slot w${u.weapon ? ' full' : ''}" data-slot="w" title="${u.weapon ? byKind.weapon[u.weapon.id].name + ' 빼기' : '빈 무기 칸'}" aria-label="${u.weapon ? byKind.weapon[u.weapon.id].name + ' 빼기' : '빈 무기 칸'}">${u.weapon ? '' : '+'}</button></div>
          <div class="pinfo"><div class="pname"><b>${d.name}</b><span class="lv">Lv${u.level}</span><small style="color:${CLASSES[d.cls].color}">${CLASSES[d.cls].full}</small></div>
          <div class="xpbar" title="경험치"><i style="width:${nextXp ? Math.min(100, (100 * (u.xp - BT.XP_TABLE[u.level])) / (nextXp - BT.XP_TABLE[u.level])) : 100}%"></i></div>
          <small>체 ${st.hp} · 공 ${Math.round(st.atk)} · 공속 ${st.as.toFixed(2)} · 사거리 ${st.range}</small>
          <small class="muted">${PASSIVES[d.passive]}</small>
          ${u.skills.map((s) => `<small>· ${byKind.skill[s.id].name}${s.up ? '+' : ''}</small>`).join('')}${u.weapon ? `<small>· ${byKind.weapon[u.weapon.id].name}${u.weapon.up ? '+' : ''}</small>` : ''}
          <button type="button" class="tiny dismiss" ${R.party.length <= 1 ? 'disabled' : ''}>놓아주기</button></div>`;
        box.querySelectorAll('.slot').forEach((b) => (b.onclick = (e) => {
          e.stopPropagation();
          const sl = b.dataset.slot;
          if (loSel) return tryEquip(u);
          if ((sl === 'w' && u.weapon) || (sl !== 'w' && u.skills[+sl])) { unequip(u, sl === 'w' ? 'w' : +sl); render(); }
        }));
        box.querySelector('.dismiss').onclick = (e) => {
          e.stopPropagation();
          const b2 = e.currentTarget;
          if (b2.dataset.confirm) {
            u.skills.forEach((c) => R.chips.push(c)); if (u.weapon) R.weapons.push(u.weapon);
            R.party.splice(R.party.indexOf(u), 1); toast(d.name + '을(를) 떠나보냈습니다. 장비는 보관함으로'); render(); return;
          }
          b2.dataset.confirm = '1'; b2.textContent = '정말 놓아주기';
        };
        box.onclick = () => { if (loSel) tryEquip(u); };
        party.appendChild(box);
      }
      const piece = (kind, it) => {
        const d = kind === 'skill' ? byKind.skill[it.id] : byKind.weapon[it.id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'piece ' + kind + (loSel && loSel.item === it ? ' on' : '');
        b.title = d.name + ' — ' + d.desc;
        b.innerHTML = `<img src="${kind === 'skill' ? ART.chipURL(CLASSES[d.cls].color, d.icon, it.up, 40) : ART.weaponURL(d, it.up, 48)}" alt=""><span>${d.name}${it.up ? '+' : ''}</span>`;
        b.addEventListener('pointerdown', (ev) => startPieceDrag(ev, kind, it, b));
        return b;
      };
      R.chips.forEach((c) => $('loChips').appendChild(piece('skill', c)));
      R.weapons.forEach((w) => $('loWeapons').appendChild(piece('weapon', w)));
      if (!R.chips.length) $('loChips').innerHTML = '<p class="muted">비어 있음</p>';
      if (!R.weapons.length) $('loWeapons').innerHTML = '<p class="muted">비어 있음</p>';
      if (loSel) $('loSel').appendChild(anyCard(loSel.kind, loSel.item, { cls: 'mini' }));
      for (const t of R.tactics) $('loDeck').appendChild(tacticCard(t, { cls: 'mini' }));
      $('loClose').onclick = () => { loSel = null; back ? back() : closeModal(); renderHud(); };
    };
    const tryEquip = (u) => {
      const ok = loSel.kind === 'skill' ? equipChip(loSel.item, u) : equipWeapon(loSel.item, u);
      if (ok) { toast(`${unitName(u)}에게 ${(loSel.kind === 'skill' ? byKind.skill : byKind.weapon)[loSel.item.id].name} 장착`); loSel = null; }
      render();
    };
    const startPieceDrag = (ev, kind, it, el) => {
      const sx = ev.clientX, sy = ev.clientY;
      let ghost = null;
      const mv = (e) => {
        if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { ghost = el.querySelector('img').cloneNode(); ghost.className = 'dragghost'; document.body.appendChild(ghost); }
        if (ghost) { ghost.style.left = e.clientX - 24 + 'px'; ghost.style.top = e.clientY - 24 + 'px'; }
      };
      const up = (e) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        if (!ghost) { loSel = loSel && loSel.item === it ? null : { kind, item: it }; SFX.play('card'); return render(); }
        ghost.remove();
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const slot = target && target.closest('.pslot');
        if (slot) { loSel = { kind, item: it }; tryEquip(R.party.find((u) => u.uid === slot.dataset.uid)); }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    render();
  }

  // =====================================================================
  // 전투
  // =====================================================================
  const CS = 58, COLS = 6, ROWS = 8, PLAYER_ROW = 4, M = 14;
  const W = CS * COLS + M * 2, H = CS * ROWS + M * 2;
  const grid = AC.squareGrid(COLS, ROWS, CS, { ox: M, oy: M, diag: true });
  const canvas = $('cv');
  const ctx = AC.setupCanvas(canvas, W, H);
  const isMine = (cell) => grid.cells[cell].r >= PLAYER_ROW;
  let B = null;
  const battleApi = BT.create({
    grid, PLAYER_ROW, COLS, ROWS, getR: () => R, getB: () => B,
    fx: { play: (n, g) => SFX.play(n, g), shake: (n) => shake(n), burst: (x, y, c, n) => burst(x, y, c, n), death: (t) => onTokenDeath(t) },
  });

  function genEnemies(kind) {
    const A = ACTS[R.act], out = [], used = new Set();
    const floor = curNode ? curNode.row : 0;
    const put = (id, rows, col) => {
      const def = MONSTERS[id];
      markSeen('monster', id);
      for (let t = 0; t < 60; t++) {
        const cell = grid.idx(col != null && t === 0 ? col : AC.randi(0, COLS - 1), AC.pick(rows));
        if (!used.has(cell)) { used.add(cell); out.push({ uid: uid(), def, cell, scale: 1 + floor * 0.05, rot: AC.rand(-0.09, 0.09) }); return; }
      }
    };
    const rowsFor = (d) => (d.range > 1 ? [0, 1] : [2, 3]);
    if (kind === 'boss') {
      const boss = MONSTERS[R.map.boss];
      put(boss.id, [boss.boss === 'dragon' ? 2 : 1], 2);
      const adds = { gobking: ['goblin', 'goblin'], slimeking: ['slime', 'slime'], lich: ['skel', 'skelarch'], vampire: ['bat', 'bat', 'cultist'], dragon: ['imp', 'imp'] }[boss.boss].slice();
      if (DIFFICULTY[R.difficulty].extraAdds) adds.push(adds[0]);
      for (const id of adds) put(id, rowsFor(MONSTERS[id]));
      out.forEach((x) => (x.scale = 1));
    } else if (kind === 'elite') {
      for (const id of AC.pick(A.elites)) put(id, rowsFor(MONSTERS[id]));
    } else {
      let budget = [0, 3.2, 4.2, 5][R.act] + floor * 0.9;
      while (budget > 0.4 && out.length < 9) {
        const opts = A.normal.filter((id) => MONSTERS[id].v <= budget + 0.5);
        if (!opts.length) break;
        const id = AC.pick(opts);
        budget -= MONSTERS[id].v;
        put(id, rowsFor(MONSTERS[id]));
      }
    }
    return out;
  }

  function startBattle(kind) {
    B = {
      kind, enemies: genEnemies(kind), deployed: [], hand: [], pile: AC.shuffle(R.tactics.slice()), tactics: [], traps: [], placed: [],
      energy: R.energy, maxEnergy: R.energy, redraws: 1 + (R.has('eye') ? 1 : 0), sel: null, phase: 'prep', combat: null,
      scrollUsed: false, info: null, hover: null, vfx: newVfx(), goldBonus: 0, coinBonus: 0, justDrew: true,
    };
    drawHand(R.handSize);
    show('battle');
    $('bbanner').className = 'bbanner';
    $('rosterBox').hidden = true;
    renderBattle();
    if (R.stats.battles === 0) toast('대기석의 딱지를 끌어 아래쪽 네 줄에 놓으세요. 전술 카드는 선택 사항입니다');
  }
  function drawHand(n) { for (let k = 0; k < n && B.pile.length; k++) B.hand.push(B.pile.pop()); }
  const tcost = (c) => Math.max(0, byKind.tactic[c.id].cost - (R.has('scroll') && !B.scrollUsed && byKind.tactic[c.id].cost > 0 ? 1 : 0));
  const deployedAt = (cell) => B.deployed.find((p) => p.cell === cell) || null;
  const placedAt = (cell) => B.placed.find((p) => p.cell === cell) || null;
  const enemyAt = (cell) => B.enemies.find((e) => e.cell === cell) || null;
  const cellFree = (cell) => !deployedAt(cell) && !placedAt(cell);
  const bench = () => R.party.filter((u) => !B.deployed.some((p) => p.u === u));

  function deploy(u, cell) {
    if (!isMine(cell)) return toast('아래쪽 네 줄(내 진영)에만 놓을 수 있습니다'), false;
    if (!cellFree(cell)) return toast('이미 무언가 놓인 칸입니다'), false;
    if (B.deployed.length >= R.deployMax) return toast(`배치 한도는 ${R.deployMax}명입니다`), false;
    B.deployed.push({ u, cell, placedAt: performance.now() });
    SFX.play('place');
    const pc = grid.cells[cell];
    burst(pc.x, pc.y + 10, CLASSES[byKind.unit[u.id].cls].color, 4);
    B.sel = null;
    B.info = { type: 'ally', p: B.deployed[B.deployed.length - 1] };
    renderBattle();
    return true;
  }
  function undeploy(p) {
    B.deployed.splice(B.deployed.indexOf(p), 1);
    for (const t of B.tactics.filter((t) => t.target === p.u.uid)) refundTactic(t);
    B.info = null;
    SFX.play('card');
    renderBattle();
  }
  function refundTactic(t) {
    B.tactics.splice(B.tactics.indexOf(t), 1);
    B.hand.push(t.card);
    B.energy += t.paid;
    if (t.scroll) B.scrollUsed = false;
    if (t.card.id === 'beartrap') B.traps = B.traps.filter((x) => x.cell !== t.cell);
    if (t.card.id === 'barricade' || t.card.id === 'reinforce') B.placed = B.placed.filter((x) => x.cell !== t.cell);
  }
  function playTactic(c, target) {
    const d = byKind.tactic[c.id], cost = tcost(c);
    if (B.energy < cost) return toast('에너지가 부족합니다'), false;
    const scroll = R.has('scroll') && !B.scrollUsed && d.cost > 0;
    if (scroll) B.scrollUsed = true;
    B.energy -= cost;
    B.hand.splice(B.hand.indexOf(c), 1);
    B.sel = null;
    if (d.id === 'scout') { drawHand(2); B.justDrew = true; }
    else if (d.id === 'sacrifice') { R.hurt(6); B.energy += 2; renderHud(); }
    else if (d.id === 'coin') B.coinBonus += 20;
    else {
      const t = Object.assign({ card: c, paid: cost, scroll }, target || {});
      B.tactics.push(t);
      if (d.id === 'beartrap') B.traps.push({ cell: t.cell });
      if (d.id === 'barricade' || d.id === 'reinforce') B.placed.push({ kind: d.id, cell: t.cell, placedAt: performance.now() });
    }
    SFX.play(d.target === 'instant' ? 'card' : 'attach');
    toast(d.name + ' 사용');
    renderBattle();
    return true;
  }
  function useTacticOn(c, cell) {
    const d = byKind.tactic[c.id];
    if (d.target === 'ally') { const p = deployedAt(cell); if (!p) return toast('배치한 아군 딱지를 누르세요'); return playTactic(c, { target: p.u.uid }); }
    if (d.target === 'enemy') { const e = enemyAt(cell); if (!e) return toast('적 딱지를 누르세요'); return playTactic(c, { target: e.uid }); }
    if (d.target === 'ownCell') {
      if (!isMine(cell)) return toast('내 진영 칸을 누르세요');
      if (d.id !== 'smokescreen' && !cellFree(cell)) return toast('빈 칸을 누르세요');
      return playTactic(c, { cell });
    }
    if (d.target === 'enemyCell') {
      if (isMine(cell)) return toast('적 진영 칸을 누르세요');
      if (d.empty && enemyAt(cell)) return toast('적이 없는 빈 칸을 누르세요');
      return playTactic(c, { cell });
    }
  }
  function selectTactic(c) {
    if (B.phase !== 'prep') return;
    const d = byKind.tactic[c.id];
    if (B.energy < tcost(c)) return toast('에너지가 부족합니다');
    if (d.target === 'all' || d.target === 'instant') return playTactic(c);
    B.sel = B.sel && B.sel.c === c ? null : { type: 'tactic', c };
    SFX.play('card');
    if (B.sel) toast({ ally: '대상 아군 딱지를 누르세요', enemy: '대상 적 딱지를 누르세요', ownCell: '내 진영 칸을 누르세요', enemyCell: '적 진영 칸을 누르세요' }[d.target]);
    renderBattle();
  }
  function selectBench(u) {
    if (B.phase !== 'prep') return;
    B.sel = B.sel && B.sel.u === u ? null : { type: 'unit', u };
    SFX.play('card');
    if (B.sel) toast('내 진영의 빈 칸을 누르세요');
    renderBattle();
  }

  // 자동 배치: 강한 딱지부터 앞줄(근접)·뒷줄(원거리)에, 남는 에너지로 전술 카드
  function autoDeploy() {
    if (!B || B.phase !== 'prep') return;
    const spread = B.kind === 'boss';
    const order = spread ? [1, 4, 2, 5, 0, 3] : [2, 3, 1, 4, 0, 5];
    const score = (u) => byKind.unit[u.id].tier * 10 + u.level * 5 + u.skills.length * 3 + (u.weapon ? 3 : 0);
    for (const u of bench().sort((a, b) => score(b) - score(a))) {
      if (B.deployed.length >= R.deployMax) break;
      const d = byKind.unit[u.id];
      const rows = d.range > 1 ? [6, 7, 5] : spread ? [4, 5, 6] : [4, 5];
      let done = false;
      for (const r of rows) { for (const col of order) { const cell = grid.idx(col, r); if (cellFree(cell)) { B.deployed.push({ u, cell, placedAt: performance.now() }); done = true; break; } } if (done) break; }
    }
    autoTactics();
    B.sel = null;
    SFX.play('place');
    renderBattle();
  }
  function autoTactics() {
    const strongestFoe = () => B.enemies.slice().sort((a, b) => b.def.hp * b.def.atk - a.def.hp * a.def.atk)[0];
    const densest = () => {
      let best = null, bn = -1;
      for (const c of grid.cells) { if (isMine(c.i)) continue; const n = [c.i, ...grid.neighbors[c.i]].filter((i) => enemyAt(i)).length; if (n > bn) { bn = n; best = c.i; } }
      return best;
    };
    const topAlly = () => B.deployed.slice().sort((a, b) => b.u.level - a.u.level)[0];
    const skipped = [];
    for (let guard = 0; guard < 12; guard++) {
      const playable = B.hand.filter((c) => tcost(c) <= B.energy && !skipped.includes(c) && !(c.id === 'sacrifice' && R.hp < 30));
      if (!playable.length) break;
      const c = playable.sort((a, b) => byKind.tactic[b.id].tier - byKind.tactic[a.id].tier)[0], d = byKind.tactic[c.id];
      let ok = false;
      if (d.target === 'all' || d.target === 'instant') ok = playTactic(c);
      else if (d.target === 'ally' && topAlly()) ok = playTactic(c, { target: topAlly().u.uid });
      else if (d.target === 'enemy' && strongestFoe()) ok = playTactic(c, { target: strongestFoe().uid });
      else if (d.target === 'enemyCell') {
        const cell = d.empty ? grid.cells.find((x) => x.r === PLAYER_ROW - 1 && !enemyAt(x.i)) : null;
        const tc = d.empty ? (cell ? cell.i : null) : densest();
        if (tc != null) ok = playTactic(c, { cell: tc });
      } else if (d.target === 'ownCell') {
        const cell = grid.cells.find((x) => x.r === PLAYER_ROW && cellFree(x.i));
        if (cell) ok = playTactic(c, { cell: d.id === 'smokescreen' && B.deployed[0] ? B.deployed[0].cell : cell.i });
      }
      if (!ok) skipped.push(c);
    }
  }

  // ---------- 입력 ----------
  const drag = AC.dragController(canvas, {
    pick: (pt) => { if (!B || B.phase !== 'prep' || B.sel) return null; const c = grid.cellAt(pt.x, pt.y); return c ? deployedAt(c.i) : null; },
    drop: (p, pt) => {
      const c = grid.cellAt(pt.x, pt.y);
      if (!c || !isMine(c.i)) { undeploy(p); return; }
      if (placedAt(c.i)) return;
      const other = deployedAt(c.i);
      if (other) other.cell = p.cell;
      p.cell = c.i;
      p.placedAt = performance.now();
      SFX.play('place');
      B.info = { type: 'ally', p };
      renderBattle();
    },
    click: (pt) => {
      if (!B) return;
      const c = grid.cellAt(pt.x, pt.y);
      if (!c) return;
      if (B.phase === 'prep' && B.sel) return B.sel.type === 'unit' ? deploy(B.sel.u, c.i) : useTacticOn(B.sel.c, c.i);
      if (B.combat) { const e = B.combat.units.find((u) => !u.dead && u.cell === c.i); B.info = e ? { type: 'ent', e } : null; return renderInfo(); }
      const p = deployedAt(c.i), en = enemyAt(c.i);
      B.info = p ? { type: 'ally', p } : en ? { type: 'enemy', en } : null;
      renderInfo();
    },
    hover: (pt) => { const c = grid.cellAt(pt.x, pt.y); if (B) B.hover = c ? c.i : null; },
  });
  canvas.addEventListener('pointerleave', () => { if (B) B.hover = null; });
  // 손패·대기석에서 보드로 끌기
  function startDomDrag(ev, el, onPick, onDrop, imgSrc) {
    if (!B || B.phase !== 'prep') return;
    const sx = ev.clientX, sy = ev.clientY;
    let ghost = null;
    const mv = (e) => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
        if (imgSrc) { ghost = document.createElement('img'); ghost.src = imgSrc; ghost.className = 'dragghost'; }
        else { ghost = el.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = el.offsetWidth + 'px'; }
        document.body.appendChild(ghost);
        onPick(true);
      }
      if (ghost) {
        ghost.style.left = e.clientX - (imgSrc ? 30 : 50) + 'px'; ghost.style.top = e.clientY - (imgSrc ? 30 : 70) + 'px';
        const r = canvas.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        const pt = inside ? canvas.toLogical(e) : null, cell = pt ? grid.cellAt(pt.x, pt.y) : null;
        B.hover = cell ? cell.i : null;
      }
    };
    const up = (e) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (!ghost) return onPick(false);
      ghost.remove();
      const r = canvas.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const pt = canvas.toLogical(e), cell = grid.cellAt(pt.x, pt.y);
        if (cell) onDrop(cell.i);
      }
      if (B) { B.sel = null; renderBattle(); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  $('redraw').onclick = () => {
    if (!B || B.phase !== 'prep' || B.redraws <= 0) return;
    B.redraws--;
    const n = B.hand.length;
    B.pile.unshift(...B.hand); B.hand = [];
    drawHand(n);
    B.sel = null; B.justDrew = true;
    renderBattle();
  };
  $('auto').onclick = autoDeploy;
  $('speed').onclick = () => { R.speed = R.speed === 1 ? 2 : R.speed === 2 ? 3 : 1; renderControls(); };
  $('fight').onclick = () => fight();
  $('prepParty').onclick = () => { if (B && B.phase === 'prep') openLoadout(() => { closeModal(); renderBattle(); }); };
  document.addEventListener('keydown', (e) => {
    if (!B || $('battle').hidden || !$('modal').hidden) return;
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); fight(); }
    if (e.key === 'Escape') { B.sel = null; renderBattle(); }
  });

  function fight() {
    if (!B || B.phase !== 'prep') return;
    if (!B.deployed.length) return toast('딱지를 하나 이상 내 진영에 놓으세요');
    const syn = battleApi.synergyCounts(B.deployed.map((p) => p.u));
    const ents = B.deployed.map((p) => battleApi.makeAlly(p.u, p.cell, syn));
    for (const pl of B.placed) {
      if (pl.kind === 'barricade') ents.push(battleApi.makeSummon('barricade', pl.cell, 0, null));
      else { const merc = battleApi.makeAlly({ uid: 'merc', id: 'merc', level: R.act, skills: [{ id: 'sweep', up: false }], weapon: null, rot: 0 }, pl.cell, syn); merc.summon = true; ents.push(merc); }
    }
    for (const x of B.enemies) ents.push(battleApi.makeFoe(x));
    const cb = new AC.Combat(grid, ents, { hooks: battleApi.hooks(), maxTime: B.kind === 'boss' ? 150 : 75 });
    cb.tele = cb.tele || [];
    B.combat = cb;
    B.phase = 'combat';
    B.sel = null; B.info = null; B.phaseText = '';
    R.stats.battles++;
    buildRoster(cb);
    const boss = B.enemies.find((x) => x.def.boss);
    stamp(boss ? boss.def.name : B.kind === 'elite' ? '정예 출현!' : '전투 개시!', boss ? 'boss' : '');
    SFX.play(boss ? 'boss' : 'start');
    renderBattle();
  }
  function stamp(text, cls = '') {
    const ban = $('bbanner');
    ban.textContent = text;
    ban.className = 'bbanner';
    void ban.offsetWidth;
    ban.className = 'bbanner show ' + cls;
    clearTimeout(stamp.t);
    stamp.t = setTimeout(() => { if (B && B.phase === 'combat') ban.className = 'bbanner'; }, 1100);
  }
  function buildRoster(cb) {
    const allies = cb.units.filter((u) => u.side === 0 && !u.object && !u.summon);
    $('roster').innerHTML = allies.map((u, i) => `<div class="rrow" data-i="${i}"><img src="${ART.tokenURL(u.artId, 0)}" alt=""><span class="rn">${u.def.name}</span><span class="rb"><i></i></span><span class="rv">0</span></div>`).join('');
    const rows = [...$('roster').children];
    B.roster = allies.map((e, i) => ({ e, row: rows[i], bar: rows[i].querySelector('i'), val: rows[i].querySelector('.rv') }));
    $('rosterBox').hidden = false;
  }
  function updateRoster() {
    if (!B || !B.roster) return;
    for (const r of B.roster) {
      r.bar.style.width = Math.max(0, (100 * r.e.hp) / r.e.maxHp) + '%';
      r.val.textContent = Math.round(r.e.dmgDealt);
      r.row.classList.toggle('torn', r.e.dead);
    }
  }
  function endBattle() {
    const cb = B.combat, won = cb.winner === 0;
    B.phase = 'result';
    B.resultT = 1.7;
    stamp(won ? (B.kind === 'boss' ? '보스 처치!' : '승리!') : cb.winner === -1 ? '시간 초과' : '패배', won ? 'win' : 'lose');
    SFX.play(won ? 'win' : 'lose');
    renderControls();
  }
  function battleReport(cb) {
    const allies = cb.units.filter((u) => u.side === 0 && !u.summon && !u.object).sort((a, b) => b.dmgDealt - a.dmgDealt);
    if (!allies.length) return '';
    const max = Math.max(1, allies[0].dmgDealt);
    return `<div class="report"><span class="eyebrow">전투 기록 · 입힌 피해</span>${allies.slice(0, 6).map((u, i) => `
      <div class="rrow${u.dead ? ' torn' : ''}"><img src="${ART.tokenURL(u.artId, 0)}" alt=""><span class="rn">${u.def.name}${i === 0 && u.dmgDealt > 0 ? ' <b class="mvp">MVP</b>' : ''}${u.dead ? ' <small>찢어짐</small>' : ''}</span>
      <span class="rb"><i style="width:${(100 * u.dmgDealt) / max}%;background:${CLASSES[u.cls].color}"></i></span><span class="rv">${Math.round(u.dmgDealt)}</span></div>`).join('')}</div>`;
  }
  function grantXp(won) {
    const ups = [];
    const dep = new Set(B.deployed.map((p) => p.u));
    for (const u of R.party) {
      const n = (dep.has(u) ? (won ? 2 : 1) : won ? 1 : 0) + (won && R.has('dummy') ? 1 : 0);
      if (!n) continue;
      if (R.addXp(u, n).length) ups.push(`${unitName(u)} Lv${u.level}`);
    }
    return ups;
  }
  function afterBattle() {
    const cb = B.combat, won = cb.winner === 0, kind = B.kind;
    $('bbanner').className = 'bbanner';
    const ups = grantXp(won);
    const upText = ups.length ? `<p class="lvup">레벨 업! ${ups.join(', ')} — 딱지에 금색 핀이 하나 더 꽂혔다.</p>` : '';
    if (won) {
      R.stats.wins++;
      if (kind === 'elite') R.stats.elites++;
      if (kind === 'boss') R.stats.bosses++;
      let gold = kind === 'boss' ? 60 + R.act * 15 : kind === 'elite' ? 30 + R.act * 8 + AC.randi(0, 8) : 12 + R.act * 4 + AC.randi(0, 6);
      gold = Math.round(gold * DIFFICULTY[R.difficulty].gold * (R.has('crown') ? 1.5 : 1));
      if (R.has('goldtooth')) gold += 12;
      gold += B.goldBonus + B.coinBonus;
      R.gold += gold;
      if (R.has('grail')) R.heal(5);
      return rewards(kind, gold, upText, battleReport(cb));
    }
    const surv = cb.alive(1);
    let dmg = kind === 'boss' ? 16 + R.act * 4 : AC.clamp(Math.round(4 + R.act * 2 + surv.reduce((s, e) => s + Math.min(e.v || 1, 6), 0) * 2), 6, 26);
    let note = '';
    if (R.has('phoenix')) { R.relics.splice(R.relics.indexOf('phoenix'), 1); note = '<p class="lvup">불사조 깃털이 타올라 피해를 막았다!</p>'; dmg = 0; }
    R.hurt(dmg);
    renderHud();
    if (R.hp <= 0) return ending(false);
    if (kind === 'boss') {
      modal(`<h3>패배 — 체력 −${dmg}</h3>${note}<p>${MONSTERS[R.map.boss].name}은(는) 아직 건재하다. 남은 체력 ${R.hp}. 편성을 바꿔 다시 도전하자.</p>${upText}${battleReport(cb)}<div class="row"><button type="button" id="lossParty">편성</button><button type="button" class="primary" id="retry">다시 도전</button></div>`);
      $('retry').onclick = () => { closeModal(); startBattle('boss'); };
      $('lossParty').onclick = () => openLoadout(() => { closeModal(); startBattle('boss'); });
      return;
    }
    modal(`<h3>패배 — 체력 −${dmg}</h3>${note}<p>살아남은 적 ${surv.length}명. 보상은 없지만 원정은 계속된다. 남은 체력 ${R.hp}.</p>${upText}${battleReport(cb)}<div class="row"><button type="button" class="primary" id="lossOk">계속</button></div>`);
    $('lossOk').onclick = finishNode;
  }
  function rewardChoices(kind) {
    const n = 3 + (R.has('clover') ? 1 : 0), bonus = kind === 'boss' ? 40 : kind === 'elite' ? 15 : 0;
    const kinds = AC.shuffle(['skill', 'weapon', R.party.length < PARTY_MAX ? 'unit' : 'skill', 'tactic', 'skill', 'weapon']);
    const out = [];
    for (const k of kinds) {
      if (out.length >= n) break;
      let d, tries = 0;
      do { d = R.randomOf(k, rollTier(bonus)); } while (out.some((x) => x.d.id === d.id) && tries++ < 20);
      markSeen(k, d.id);
      out.push({ kind: k, d });
    }
    return out;
  }
  function rewards(kind, gold, upText, report) {
    const relic = kind === 'elite' ? R.randomRelic(false) : null;
    if (relic) R.addRelic(relic.id);
    const bossRelics = kind === 'boss' ? [R.randomRelic(true), R.randomRelic(true), R.randomRelic(true)].filter((r, i, a) => r && a.indexOf(r) === i) : [];
    const choices = rewardChoices(kind);
    SFX.play('coin');
    const afterPick = (ch) => {
      if (ch.kind === 'skill' || ch.kind === 'weapon') {
        modal(`<h3>${ch.d.name} 획득</h3><p>보관함에 넣었습니다. 지금 딱지에 올릴까요?</p><div class="row"><button type="button" id="apLater">나중에</button><button type="button" class="primary" id="apNow">편성 열기</button></div>`);
        $('apLater').onclick = finishNode;
        $('apNow').onclick = () => openLoadout(finishNode);
      } else finishNode();
    };
    const stage2 = () => {
      modal(`<span class="eyebrow">보상</span><h3>${kind === 'boss' ? ACTS[R.act].name + ' 정복!' : '승리!'}</h3>
        <p>골드 +${gold}${relic ? ` · 유물 <b>${relic.name}</b> — ${relic.desc}` : ''}${R.has('grail') ? ' · 체력 +5' : ''}</p>${upText}${report}
        <p class="muted">하나를 고르세요. 칩과 무기는 보관함에 들어가고, 편성에서 딱지에 올릴 수 있습니다.</p><div class="choices cards" id="rw"></div>
        <div class="row"><button type="button" id="rwParty">편성</button><button type="button" id="skip">건너뛰기</button></div>`, true);
      for (const ch of choices) {
        const el = anyCard(ch.kind, ch.kind === 'unit' ? { id: ch.d.id } : { id: ch.d.id, up: false });
        const take = () => { R.gain(ch.kind, ch.d.id); SFX.play('attach'); toast(ch.d.name + ' 획득'); afterPick(ch); };
        el.onclick = take; el.addEventListener('pick', take);
        $('rw').appendChild(el);
      }
      $('skip').onclick = finishNode;
      $('rwParty').onclick = () => openLoadout(stage2);
      renderHud();
    };
    if (bossRelics.length) {
      modal(`<span class="eyebrow">보스 보상</span><h3>보스의 보물 중 하나를 고르세요</h3><div class="choices col" id="br"></div>`);
      for (const r of bossRelics) {
        markSeen('relic', r.id);
        const b = relicButton(r);
        b.onclick = () => { R.addRelic(r.id); toast(r.name + ' 획득'); stage2(); };
        $('br').appendChild(b);
      }
      return;
    }
    stage2();
  }

  // ---------- 전투 화면 DOM ----------
  function renderControls() {
    if (!B) return;
    const prep = B.phase === 'prep';
    $('energy').innerHTML = Array.from({ length: Math.max(B.maxEnergy, B.energy) }, (_, i) => `<span class="orb ${i < B.energy ? '' : 'off'}"></span>`).join('') + `<span class="lbl">${B.energy} / ${B.maxEnergy}</span>`;
    $('fight').disabled = !prep; $('auto').disabled = !prep; $('prepParty').disabled = !prep;
    $('redraw').disabled = !prep || B.redraws <= 0;
    $('redraw').textContent = '다시 뽑기 ' + B.redraws;
    $('speed').textContent = '속도 ×' + R.speed;
    $('deployCount').textContent = `배치 ${B.deployed.length} / ${R.deployMax}`;
  }
  function renderTray() {
    const tray = $('tray');
    tray.innerHTML = '';
    if (B.phase !== 'prep') { tray.innerHTML = `<p class="muted handnote">${B.phase === 'combat' ? '전투 중… 보드의 딱지를 누르면 상태를 볼 수 있습니다.' : ''}</p>`; return; }
    const list = bench();
    if (!list.length) tray.innerHTML = '<p class="muted handnote">모든 딱지가 나가 있습니다.</p>';
    for (const u of list) {
      const d = byKind.unit[u.id], src = ART.discURL(d.id, 0, '', battleApi.loadoutOf(u), 96);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'traydisc' + (B.sel && B.sel.u === u ? ' sel' : '');
      b.innerHTML = `<img src="${src}" alt="" draggable="false"><span>${d.name} <b>Lv${u.level}</b></span>`;
      b.title = `${d.name} — ${PASSIVES[d.passive]}`;
      b.addEventListener('pointerdown', (ev) => startDomDrag(ev, b, (dragging) => { if (dragging) B.sel = { type: 'unit', u }; else selectBench(u); }, (cell) => deploy(u, cell), src));
      tray.appendChild(b);
    }
  }
  function renderHand() {
    const hand = $('hand');
    hand.innerHTML = '';
    $('usedTactics').innerHTML = '';
    if (B.phase !== 'prep') return;
    const deal = B.justDrew;
    B.justDrew = false;
    if (deal) SFX.play('card');
    B.hand.forEach((c, i) => {
      const el = tacticCard(c, { cost: tcost(c) });
      if (deal) { el.classList.add('deal'); el.style.animationDelay = i * 55 + 'ms'; }
      if (B.sel && B.sel.c === c) el.classList.add('sel');
      if (tcost(c) > B.energy) el.classList.add('cant');
      el.addEventListener('pointerdown', (ev) => startDomDrag(ev, el, (dragging) => {
        const d = byKind.tactic[c.id];
        if (!dragging) return selectTactic(c);
        if (d.target !== 'all' && d.target !== 'instant') B.sel = { type: 'tactic', c };
      }, (cell) => { if (B.sel && B.sel.c === c) useTacticOn(c, cell); }));
      el.addEventListener('pick', () => selectTactic(c));
      hand.appendChild(el);
    });
    if (!B.hand.length) hand.innerHTML = '<p class="muted handnote">손에 전술 카드가 없습니다.</p>';
    const used = $('usedTactics');
    used.innerHTML = B.tactics.length ? '<span class="muted">사용한 카드</span>' + B.tactics.map((t, i) => `<button type="button" class="usedtc" data-i="${i}" title="되돌리기">${byKind.tactic[t.card.id].name} ×</button>`).join('') : '';
    used.querySelectorAll('.usedtc').forEach((b) => (b.onclick = () => { refundTactic(B.tactics[+b.dataset.i]); renderBattle(); }));
  }
  function renderSynergy() {
    const { counts, tiers } = battleApi.synergyCounts(B.deployed.map((p) => p.u));
    const keys = Object.keys(SYNERGY).filter((k) => counts[k]).sort((a, b) => (tiers[b] || 0) - (tiers[a] || 0) || counts[b] - counts[a]);
    $('synBox').innerHTML = `<h2>시너지</h2>${keys.length ? keys.map((k) => {
      const s = SYNERGY[k], t = tiers[k] || 0;
      return `<div class="syn${t ? ' on' : ''}" style="--cc:${CLASSES[k].color}"><span class="sb">${CLASSES[k].name}</span><b>${CLASSES[k].full} ${counts[k]}</b><span class="th">${s.th.map((x) => `<i class="${counts[k] >= x ? 'on' : ''}">${x}</i>`).join('')}</span><small>${t ? s.desc[t - 1] : s.desc[0] + ' (' + s.th[0] + '명)'}</small></div>`;
    }).join('') : '<p class="muted">서로 다른 같은 계열 딱지 2명을 내보내면 시너지가 켜집니다.</p>'}`;
  }
  function renderEncounter() {
    const names = {};
    for (const e of B.enemies) names[e.def.name] = (names[e.def.name] || 0) + 1;
    const boss = B.enemies.find((e) => e.def.boss);
    const title = B.kind === 'boss' ? '보스전' : B.kind === 'elite' ? '정예 전투' : '전투';
    $('encounter').innerHTML = `<h2>${title}</h2><p>${Object.entries(names).map(([n, k]) => n + (k > 1 ? ' ×' + k : '')).join(', ')}</p>
      ${boss ? `<p class="bossnote">${BOSS_INFO[boss.def.boss]}</p>` : ''}
      ${R.stats.battles === 0 && B.phase === 'prep' ? '<ol class="howto"><li>아래 대기석의 딱지를 끌어 내 진영(아래 4줄)에 놓습니다.</li><li>딱지 위의 육각 칩이 스킬, 테두리에 꽂힌 미니어처가 무기입니다. 「편성」에서 바꿔 끼웁니다.</li><li>전술 카드는 에너지를 써서 전투를 돕습니다.</li><li>「자동 배치」로 한 번에 놓을 수도 있습니다.</li></ol>' : ''}`;
  }
  function renderInfo() {
    const box = $('infoBox'), inf = B && B.info;
    if (!inf) { box.innerHTML = '<h2>정보</h2><p class="muted">보드의 딱지를 누르면 능력치와 장비가 보입니다.</p>'; return; }
    const skillList = (sk) => (sk.length ? '<ul class="sk">' + sk.map((s) => `<li style="--cc:${CLASSES[s.def.cls].color}"><b>${s.def.name}${s.up ? '+' : ''}</b> ${s.def.desc}</li>`).join('') + '</ul>' : '<p class="muted">스킬 없음 — 기본 공격만 합니다.</p>');
    if (inf.type === 'ally') {
      const u = inf.p.u, d = byKind.unit[u.id], st = BT.unitStats(u);
      box.innerHTML = `<h2 class="ph"><img src="${ART.discURL(d.id, 0, '', battleApi.loadoutOf(u), 96)}" alt="">${d.name} <span class="lv">Lv${u.level}</span></h2>
        <p class="muted">${CLASSES[d.cls].full} · 체력 ${st.hp} · 공격 ${Math.round(st.atk)} · 사거리 ${st.range}</p><p class="passive">${PASSIVES[d.passive]}</p>
        ${skillList(u.skills.map((s) => ({ def: byKind.skill[s.id], up: s.up })))}${u.weapon ? `<p>무기: <b>${byKind.weapon[u.weapon.id].name}${u.weapon.up ? '+' : ''}</b> — ${byKind.weapon[u.weapon.id].desc}</p>` : '<p class="muted">무기 없음</p>'}
        ${B.phase === 'prep' ? '<button type="button" id="unplay">대기석으로</button>' : ''}`;
      const b = $('unplay');
      if (b) b.onclick = () => undeploy(inf.p);
    } else if (inf.type === 'enemy') {
      const d = inf.en.def, k = (inf.en.scale || 1) * DIFFICULTY[R.difficulty].foe;
      box.innerHTML = `<h2 class="ph"><img src="${ART.tokenURL(d.id, 1, d.boss ? 'boss' : d.elite ? 'elite' : '')}" alt="">${d.name}</h2><p class="muted">체력 ${Math.round(d.hp * k)} · 공격 ${Math.round(d.atk * k)} · 사거리 ${d.range}${d.armor ? ' · 피해 감소 ' + Math.round(d.armor * 100) + '%' : ''}</p>
        <p>${d.desc || ''}</p>${skillList(d.skills.map((id) => ({ def: byKind.skill[id] })))}${d.boss ? `<p class="bossnote">${BOSS_INFO[d.boss]}</p>` : ''}`;
    } else {
      const e = inf.e, sts = Object.keys(e.st || {}).filter((k) => GD.KEYWORDS[k]).map((k) => GD.KEYWORDS[k].name);
      box.innerHTML = `<h2 class="ph"><img src="${ART.tokenURL(e.artId, e.side, kindOf(e))}" alt="">${e.def.name}${e.level > 1 ? ` <span class="lv">Lv${e.level}</span>` : ''}</h2>
        <p class="muted">체력 ${Math.max(0, Math.round(e.hp))} / ${Math.round(e.maxHp)}${e.shield > 0 ? ' · 보호막 ' + Math.round(e.shield) : ''} · 공격 ${Math.round(e.atk)} · 입힌 피해 ${Math.round(e.dmgDealt)}</p>
        ${sts.length || e.stun > 0 ? `<p>상태: ${[...sts, ...(e.stun > 0 ? ['기절'] : [])].join(', ')}</p>` : ''}${skillList(e.skills)}`;
    }
  }
  function renderBattle() { renderHud(); renderControls(); renderTray(); renderHand(); renderEncounter(); renderSynergy(); renderInfo(); }

  // =====================================================================
  // 캔버스 렌더링
  // =====================================================================
  const INK = '#232a3b';
  const boardCache = {};
  function boardBg(act) {
    if (boardCache[act]) return boardCache[act];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const pal = ACTS[act].palette;
    c.fillStyle = pal.ground; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 3200; k++) { c.fillStyle = Math.random() < 0.55 ? 'rgba(35,42,59,.06)' : 'rgba(255,255,255,.22)'; c.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    for (const cell of grid.cells) {
      const mine = cell.r >= PLAYER_ROW, x = cell.x - CS / 2, y = cell.y - CS / 2;
      c.fillStyle = mine ? 'rgba(47,111,214,.10)' : 'rgba(232,67,107,.10)';
      c.fillRect(x + 3.5, y + 3.5, CS - 4, CS - 4);
      c.fillStyle = (mine ? pal.mine : pal.foe)[(cell.r + cell.c) % 2];
      c.fillRect(x + 2, y + 2, CS - 4, CS - 4);
      c.fillStyle = 'rgba(255,255,255,.18)';
      for (let yy = y + 6; yy < y + CS - 4; yy += 7) for (let xx = x + 6 + ((yy / 7) % 2) * 3.5; xx < x + CS - 4; xx += 7) { c.beginPath(); c.arc(xx, yy, 0.9, 0, Math.PI * 2); c.fill(); }
    }
    c.strokeStyle = 'rgba(35,42,59,.35)'; c.lineWidth = 1.2;
    for (let r = 1; r < ROWS; r++) for (let col = 1; col < COLS; col++) { const x = M + col * CS, y = M + r * CS; c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); }
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(M, M, CS * COLS, CS * ROWS);
    c.lineWidth = 1; c.strokeRect(M - 6, M - 6, CS * COLS + 12, CS * ROWS + 12);
    c.lineWidth = 3; c.setLineDash([10, 6]);
    c.beginPath(); c.moveTo(M, M + CS * PLAYER_ROW); c.lineTo(M + CS * COLS, M + CS * PLAYER_ROW); c.stroke(); c.setLineDash([]);
    c.fillStyle = INK;
    for (const [x, y] of [[M - 6, M - 6], [M + CS * COLS + 6, M - 6], [M - 6, M + CS * ROWS + 6], [M + CS * COLS + 6, M + CS * ROWS + 6]]) { ART.star(c, x, y, 5); c.fill(); }
    boardCache[act] = cv;
    return cv;
  }
  const tokenR = (kind) => (kind === 'boss' ? 33 : kind === 'elite' ? 26 : 23);
  const kindOf = (e) => (e.boss ? 'boss' : e.elite ? 'elite' : '');
  const sprite = (artId, side, kind) => ART.token(artId, side, tokenR(kind), 2, kind);
  const STATUS_MARK = { burn: ['#e8643b', 'fire'], poison: ['#5fa043', 'skull'], bleed: ['#c0392b', 'drop'], slow: ['#6aa8ff', 'ice'], weak: ['#8a7a9a', 'fist'], vuln: ['#e8436b', 'target'] };
  const tImgs = {};
  function tacticImg(id) { if (!tImgs[id]) { tImgs[id] = new Image(); tImgs[id].src = ART.tacticURL(id, 40); } return tImgs[id]; }

  function drawUnit(x, y, o) {
    const r = tokenR(o.kind), spr = sprite(o.artId, o.side, o.kind);
    let sq = 0, jx = 0;
    if (o.popT > 0) { const t = 1 - o.popT / 0.35; sq = 0.2 * Math.sin(t * Math.PI * 2) * (1 - t); }
    if (o.hitT > 0) { const k = o.hitT / 0.22; jx = (Math.random() - 0.5) * 5 * k; sq = Math.max(sq, 0.1 * k); }
    if (o.glow) { ctx.strokeStyle = o.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + 2, r + 8 + Math.sin(performance.now() / 160) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (o.selected) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x - CS / 2 + 4, y - CS / 2 + 4, CS - 8, CS - 8); ctx.setLineDash([]); }
    ART.drawToken(ctx, spr, x + jx, y, r, { rot: o.rot || 0, flash: o.flash || 0, squash: sq, lift: o.lift || 0, alpha: o.alpha, dim: o.dim });
    const ty = y - (o.lift || 0);
    if (o.lo) ART.drawLoadout(ctx, x + jx, ty, r, o.lo);
    if (o.kind === 'boss') {
      ctx.fillStyle = '#f5c400'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 13, ty - r + 3); ctx.lineTo(x - 13, ty - r - 10); ctx.lineTo(x - 6, ty - r - 3); ctx.lineTo(x, ty - r - 13); ctx.lineTo(x + 6, ty - r - 3); ctx.lineTo(x + 13, ty - r - 10); ctx.lineTo(x + 13, ty - r + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (o.dir) {
      const [fx, fy] = o.dir, tx = x + fx * (r + 6), tyy = ty + fy * (r + 6) + (fy > 0 ? 3 : 0);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(tx + fx * 5, tyy + fy * 5); ctx.lineTo(tx - fy * 4.5, tyy + fx * 4.5); ctx.lineTo(tx + fy * 4.5, tyy - fx * 4.5); ctx.closePath(); ctx.fill();
    }
    if (o.marks && o.marks.length) o.marks.forEach(([col, ic], i) => {
      const mx = x - r - 4, my = ty - r * 0.55 + i * 11;
      ctx.fillStyle = ART.shade(col, -0.25); ctx.beginPath(); ctx.arc(mx, my + 1.6, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(mx, my); ART.icon(ctx, ic, 3.6); ctx.restore();
    });
    if (o.stun) {
      const t = performance.now() / 300;
      for (let k = 0; k < 3; k++) { const a = t + (k * Math.PI * 2) / 3; ART.star(ctx, x + Math.cos(a) * r * 0.8, ty - r - 4 + Math.sin(a) * 4, 4); ctx.fillStyle = '#f5c400'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (o.taunt) {
      ctx.fillStyle = '#f5c400'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + r * 0.85, ty - r * 0.85, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '12px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x + r * 0.85, ty - r * 0.85 + 1);
    }
    if (o.tacticMark) { const img = tacticImg(o.tacticMark); if (img.complete) ctx.drawImage(img, x - r - 8, ty - r - 8, 22, 22); }
  }
  const facing = (u, t) => battleApi.facing(u, t);
  function unitOpts(e) {
    const kind = kindOf(e), hop = e.moving ? Math.sin(Math.min(1, e.moving.t) * Math.PI) : 0;
    const marks = [];
    for (const k of ['burn', 'poison', 'bleed', 'slow', 'weak', 'vuln']) { const v = e.st && e.st[k]; if (v && (typeof v === 'number' ? v > 0 : true)) marks.push(STATUS_MARK[k]); }
    return {
      artId: e.artId, side: e.side, kind, flash: e.flash, hitT: e.hitT, popT: e.popT, rot: e.rot + hop * 0.12 * (e.id % 2 ? 1 : -1), lift: hop * 5,
      stun: e.stun > 0, taunt: e.forcedT > 0, dir: e.big || e.object || !e.target || e.target.dead ? null : facing(e, e.target),
      lo: e.lo, marks, selected: B.info && B.info.e === e,
    };
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawBar(e) {
    if (e.object && e.hp >= e.maxHp) return;
    const r = tokenR(kindOf(e)), w = r * 2 + 4, x = e.px - w / 2, y = e.py - r - (e.lo && e.lo.weapon ? 15 : 11) - (e.big ? 6 : 0);
    const total = Math.max(e.maxHp, e.hp + e.shield), hpW = (w * Math.max(0, e.hp)) / total;
    ctx.fillStyle = INK; roundRect(x - 1.5, y - 1.5, w + 3, 9, 3); ctx.fill();
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = e.side ? '#e8436b' : '#2f6fd6'; ctx.fillRect(x, y, hpW, 6);
    if (e.shield > 0) { ctx.fillStyle = '#bfe0ff'; ctx.fillRect(x + hpW, y, (w * e.shield) / total, 6); }
    ctx.fillStyle = 'rgba(35,42,59,.35)';
    for (let k = 500; k < total; k += 500) ctx.fillRect(x + (w * k) / total, y, 1, 6);
    if (e.ability && e.maxMana > 0) { ctx.fillStyle = INK; ctx.fillRect(x - 1, y + 7.5, w + 2, 4); ctx.fillStyle = '#f5c400'; ctx.fillRect(x, y + 8.3, (w * e.mana) / e.maxMana, 2.4); }
  }
  const SHOT = { mage: ['#b48cff', '#efe2ff'], holy: ['#f5c400', '#fff6c8'], fire: ['#e8643b', '#ffd36b'] };
  function drawProjectiles(cb) {
    for (const p of cb.projectiles) {
      const ang = Math.atan2(p.tgt.py - p.y, p.tgt.px - p.x), style = p.src && (SHOT[p.src.cls] || (p.kind === 'spell' && p.src.cls !== 'bow' ? SHOT.mage : null));
      p.trail = p.trail || [];
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 7) p.trail.shift();
      if (style) {
        p.trail.forEach(([x, y], i) => { ctx.globalAlpha = (i / p.trail.length) * 0.5; ctx.fillStyle = style[0]; ctx.beginPath(); ctx.arc(x, y, 2 + i * 0.6, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1;
        ctx.fillStyle = style[0]; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'spell' ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = style[1]; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.fillStyle = '#c3cbd6'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -3.5); ctx.lineTo(2, 3.5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = p.src && p.src.side ? '#e8436b' : '#2f6fd6'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -4); ctx.lineTo(-10, 0); ctx.lineTo(-17, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  function drawEffects(cb) {
    for (const f of cb.fx) {
      const k = f.t / f.life;
      if (f.kind === 'ring') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      else if (f.kind === 'beam') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = INK; ctx.lineWidth = 7 * (1 - k) + 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.lineWidth = 5 * (1 - k) + 1; ctx.stroke();
        ctx.strokeStyle = '#fffdf7'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawFloaters(cb) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of cb.floaters) {
      const a = 1 - Math.max(0, f.t - 0.55) / 0.35, sc = f.t < 0.12 ? 1.6 - f.t * 5 : 1;
      const col = f.color === '#ffffff' ? '#fffdf7' : f.color === '#ffb347' ? '#f5c400' : f.color === '#c9a2ff' ? '#e2d0ff' : f.color === '#7dffa0' ? '#9cf0b4' : f.color;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.x, f.y); ctx.scale(sc, sc);
      ctx.font = `${f.big ? 17 : 14}px Jua, "Gowun Dodum", sans-serif`;
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = col; ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
  function drawTele(cb) {
    const now = performance.now();
    for (const tl of cb.tele) {
      const k = Math.min(1, tl.t / tl.delay);
      for (const i of tl.cells) {
        const c = grid.cells[i], x = c.x - CS / 2 + 3, y = c.y - CS / 2 + 3, s = CS - 6;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(now / 70); ctx.fillStyle = tl.color; ctx.fillRect(x, y, s, s);
        ctx.globalAlpha = 0.35; ctx.strokeStyle = tl.color; ctx.lineWidth = 3;
        for (let d = -s; d < s; d += 9) { ctx.beginPath(); ctx.moveTo(x + d + ((now / 30) % 9), y + s); ctx.lineTo(x + d + s + ((now / 30) % 9), y); ctx.stroke(); }
        ctx.globalAlpha = 0.6; ctx.fillStyle = tl.color; ctx.fillRect(x, y + s - s * k, s, s * k);
        ctx.restore();
        ctx.strokeStyle = tl.color; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, s, s);
      }
      const c0 = grid.cells[tl.cells[0]];
      if (c0 && k < 1) {
        ctx.fillStyle = '#f5c400'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y - 12); ctx.lineTo(c0.x + 11, c0.y + 8); ctx.lineTo(c0.x - 11, c0.y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.font = '13px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', c0.x, c0.y + 2);
      }
    }
  }
  function fillCell(i, color, alpha, inset = 3) {
    const c = grid.cells[i];
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.fillRect(c.x - CS / 2 + inset, c.y - CS / 2 + inset, CS - inset * 2, CS - inset * 2);
    ctx.globalAlpha = 1;
  }
  function drawTrap(cell, alpha = 1) {
    const c = grid.cells[cell], img = tacticImg('beartrap');
    if (img.complete) { ctx.globalAlpha = alpha; ctx.drawImage(img, c.x - 18, c.y - 18, 36, 36); ctx.globalAlpha = 1; }
  }

  // ---------- 연출 ----------
  const newVfx = () => ({ debris: [], parts: [], pieces: [], shake: 0 });
  function burst(x, y, col, n) {
    if (!B) return;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120;
      B.vfx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, s: 2.5 + Math.random() * 3, col: Math.random() < 0.35 ? '#fffdf7' : col, t: 0, life: 0.5 + Math.random() * 0.3 });
    }
  }
  function shake(n) { if (B) B.vfx.shake = Math.min(14, Math.max(B.vfx.shake, n)); }
  // 딱지가 찢어지면 위에 올려 둔 칩과 무기가 튕겨 나간다
  function onTokenDeath(t) {
    if (!B) return;
    const kind = kindOf(t);
    B.vfx.debris.push(ART.makeTear(sprite(t.artId, t.side, kind), t.px, t.py, tokenR(kind), t.rot || 0));
    burst(t.px, t.py, t.side ? '#e8436b' : '#2f6fd6', 8);
    if (t.lo) {
      const r = tokenR(kind);
      t.lo.skills.forEach((s, i) => B.vfx.pieces.push({ kind: 'chip', s, x: t.px + (i ? 0.5 : -0.5) * r, y: t.py + r * 0.6, vx: (i ? 1 : -1) * AC.rand(40, 90), vy: -AC.rand(120, 180), rot: 0, vr: AC.rand(-8, 8), t: 0, r: r * 0.34 }));
      if (t.lo.weapon) B.vfx.pieces.push({ kind: 'weapon', w: t.lo.weapon, x: t.px + r * 0.78, y: t.py - r * 0.5, vx: AC.rand(30, 80), vy: -AC.rand(150, 200), rot: 0.55, vr: AC.rand(-10, 10), t: 0, r: r * 0.62 });
    }
    SFX.play('tear', 0.05);
    shake(t.boss ? 14 : 2.5);
  }
  function stepVfx(dt) {
    if (!B) return;
    const v = B.vfx;
    v.debris = v.debris.filter((d) => ART.stepTear(d, dt));
    for (const p of v.parts) { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.rot += p.vr * dt; }
    v.parts = v.parts.filter((p) => p.t < p.life);
    for (const p of v.pieces) { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    v.pieces = v.pieces.filter((p) => p.t < 1.1);
    v.shake = Math.max(0, v.shake - dt * 30);
    if (B.combat) for (const u of B.combat.units) { if (u.hitT > 0) u.hitT -= dt; if (u.popT > 0) u.popT -= dt; }
  }
  function drawVfx() {
    for (const d of B.vfx.debris) ART.drawTear(ctx, d);
    for (const p of B.vfx.pieces) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, p.t - 0.7) / 0.4);
      if (p.kind === 'chip') { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ART.drawChip(ctx, 0, 0, p.r, p.s.col, p.s.icon, p.s.up); }
      else ART.drawWeapon(ctx, p.x, p.y, p.r, p.w, p.rot, p.w.up);
      ctx.restore();
    }
    for (const p of B.vfx.parts) {
      ctx.save(); ctx.globalAlpha = 1 - p.t / p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.65);
      ctx.strokeStyle = 'rgba(35,42,59,.5)'; ctx.lineWidth = 0.6; ctx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.65);
      ctx.restore();
    }
  }

  function draw() {
    if (!B || $('battle').hidden) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (B.vfx.shake > 0.2) ctx.translate((Math.random() - 0.5) * B.vfx.shake, (Math.random() - 0.5) * B.vfx.shake);
    ctx.drawImage(boardBg(R.act), 0, 0, W, H);
    const prep = B.phase === 'prep', sel = B.sel, now = performance.now();
    if (prep && sel && sel.type === 'unit') {
      for (const c of grid.cells) if (c.r >= PLAYER_ROW && cellFree(c.i)) { ctx.strokeStyle = '#2f6fd6'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeRect(c.x - CS / 2 + 7, c.y - CS / 2 + 7, CS - 14, CS - 14); ctx.setLineDash([]); }
      if (B.hover != null && isMine(B.hover) && cellFree(B.hover)) fillCell(B.hover, '#2f6fd6', 0.25);
    }
    if (prep && sel && sel.type === 'tactic' && B.hover != null) {
      const d = byKind.tactic[sel.c.id], h = B.hover, a = grid.cells[h];
      const plus = [h, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => grid.idx(a.c + x, a.r + y))];
      const area = d.id === 'molotov' ? plus : ['caltrops', 'poisoncloud', 'bomb', 'smokescreen'].includes(d.id) ? [h, ...grid.neighbors[h]] : [h];
      const okSide = d.target === 'ownCell' || d.target === 'ally' ? isMine(h) : d.target === 'enemyCell' || d.target === 'enemy' ? !isMine(h) : true;
      for (const i of area) if (i >= 0) fillCell(i, okSide ? '#f5c400' : '#999', 0.35);
    }
    for (const t of B.traps) if (!t.done) drawTrap(t.cell, B.combat ? 0.85 : 1);
    if (B.combat) {
      const cb = B.combat;
      drawTele(cb);
      for (const f of cb.fx) if (f.kind === 'tile') fillCell(f.cell, f.color, 0.6 * (1 - f.t / f.life), 2);
      const alive = cb.units.filter((u) => !u.dead).sort((a, b) => a.py - b.py);
      for (const e of alive) { const o = AC.lungeOffset(e); drawUnit(e.px + o.x, e.py + o.y, unitOpts(e)); }
      drawVfx();
      for (const e of alive) drawBar(e);
      drawProjectiles(cb); drawEffects(cb); drawFloaters(cb);
      const boss = cb.units.find((u) => u.boss);
      if (boss) {
        $('bossbar').hidden = false;
        $('bossName').textContent = boss.def.name + (B.phaseText ? ' — ' + B.phaseText : '');
        $('bossFill').style.width = Math.max(0, (100 * boss.hp) / boss.maxHp) + '%';
        $('bossHp').textContent = Math.max(0, Math.round(boss.hp)) + ' / ' + Math.round(boss.maxHp);
      }
    } else {
      $('bossbar').hidden = true;
      const marks = new Map(B.tactics.filter((t) => t.target).map((t) => [t.target, t.card.id]));
      const tsel = sel && sel.type === 'tactic' ? byKind.tactic[sel.c.id].target : null;
      const items = [
        ...B.enemies.map((x) => ({ y: grid.cells[x.cell].y, f: () => { const c = grid.cells[x.cell]; drawUnit(c.x, c.y, { artId: x.def.id, side: 1, kind: x.def.boss ? 'boss' : x.def.elite ? 'elite' : '', rot: x.rot || 0, selected: B.info && B.info.en === x, tacticMark: marks.get(x.uid), glow: tsel === 'enemy' ? '#f5c400' : null }); } })),
        ...B.placed.map((p) => ({ y: grid.cells[p.cell].y, f: () => { const c = grid.cells[p.cell]; drawUnit(c.x, c.y, { artId: p.kind === 'barricade' ? 'barricade' : 'merc', side: 0, rot: 0, popT: Math.max(0, 0.35 - (now - p.placedAt) / 1000), alpha: p.kind === 'reinforce' ? 0.85 : 1 }); } })),
        ...B.deployed.filter((p) => !(drag.dragging && drag.obj === p)).map((p) => ({ y: grid.cells[p.cell].y, f: () => {
          const c = grid.cells[p.cell];
          drawUnit(c.x, c.y, { artId: p.u.id, side: 0, rot: p.u.rot || 0, popT: Math.max(0, 0.35 - (now - (p.placedAt || 0)) / 1000), lo: battleApi.loadoutOf(p.u), glow: tsel === 'ally' ? '#f5c400' : null, selected: B.info && B.info.p === p, dir: [0, -1], tacticMark: marks.get(p.u.uid) });
        } })),
      ].sort((a, b) => a.y - b.y);
      for (const it of items) it.f();
      drawVfx();
      if (drag.dragging && drag.obj) { const p = drag.obj; drawUnit(drag.pt.x, drag.pt.y, { artId: p.u.id, side: 0, lift: 8, rot: -0.08, lo: battleApi.loadoutOf(p.u) }); }
    }
    ctx.restore();
  }

  // =====================================================================
  // 타이틀 · 출정 준비 · 엔딩
  // =====================================================================
  function ending(win) {
    clearSave();
    show('ending');
    $('endTitle').textContent = win ? '흑룡 토벌 성공!' : '원정 실패';
    $('endText').textContent = win ? '아자르가 쓰러지고 화산이 잠잠해졌다. 원정대의 이름이 노래로 남을 것이다.' : `${R.act}막 ${ACTS[R.act].name}에서 원정이 끝났다.`;
    $('endStats').innerHTML = [
      ['난이도', DIFFICULTY[R.difficulty].name], ['플레이 시간', fmtTime(R.stats.time)], ['전투 승리', R.stats.wins + ' / ' + R.stats.battles], ['정예 처치', R.stats.elites], ['보스 처치', R.stats.bosses],
      ['처치한 적', R.stats.kills], ['딱지', R.party.length + '명'], ['유물', R.relics.length + '개'],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('endDeck').innerHTML = R.party.map((u) => `<img class="enddisc" src="${ART.discURL(u.id, 0, '', battleApi.loadoutOf(u), 96)}" alt="${unitName(u)}" title="${unitName(u)} Lv${u.level}">`).join('') +
      R.relics.map((id) => `<span class="pill relic">${RELICS[id].name}</span>`).join('');
  }
  function title() {
    R = null; B = null;
    show('title');
    const fan = $('fan');
    fan.innerHTML = '';
    for (const [kind, it] of [['skill', { id: 'cross', up: false }], ['unit', { id: 'knight', level: 3, xp: 0, skills: [{ id: 'sweep' }, { id: 'aid', up: true }], weapon: { id: 'longsword', up: false } }], ['weapon', { id: 'flameblade', up: false }]]) fan.appendChild(anyCard(kind, it));
    [['archmage', 0, ''], ['slime', 1, ''], ['dragon', 1, 'boss'], ['assassin', 0, ''], ['goblin', 1, '']].forEach(([id, side, kind], i) => {
      const img = document.createElement('img');
      img.className = 'ftok t' + i; img.src = ART.tokenURL(id, side, kind); img.alt = '';
      fan.appendChild(img);
    });
    const s = loadSave();
    $('continue').hidden = !s;
    if (s) $('continue').textContent = `이어하기 — ${s.act}막 · 체력 ${s.hp}/${s.maxHp}`;
  }
  function setupRun() {
    let pick = 'order', diff = 'normal';
    const render = () => {
      modal(`<span class="eyebrow">출정 준비</span><h3>어떤 부대로 떠날까요?</h3><div class="starts" id="stList"></div>
        <h4>난이도</h4><div class="diffs" id="dfList"></div>
        <div class="row"><button type="button" id="stCancel">돌아가기</button><button type="button" class="primary" id="stGo">출정!</button></div>`, true);
      for (const S of STARTS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'startopt' + (S.id === pick ? ' on' : '');
        b.innerHTML = `<b>${S.name}</b><span class="discs">${S.units.map(([id, sk, wp]) => `<img src="${ART.discURL(id, 0, '', { level: 1, weapon: wp ? byKind.weapon[wp] : null, skills: sk.map((x) => ({ col: CLASSES[byKind.skill[x].cls].color, icon: byKind.skill[x].icon })) }, 96)}" alt="${byKind.unit[id].name}" title="${byKind.unit[id].name}">`).join('')}</span>
          <small>${S.desc}</small><small class="muted">${S.units.map(([id]) => byKind.unit[id].name).join(' · ')} · 보관함: ${S.chips.map((c) => byKind.skill[c].name).join(', ')}</small>`;
        b.onclick = () => { pick = S.id; render(); };
        $('stList').appendChild(b);
      }
      for (const [k, D] of Object.entries(DIFFICULTY)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice' + (k === diff ? ' on' : '');
        b.innerHTML = `${D.name}<small>${D.desc}</small>`;
        b.onclick = () => { diff = k; render(); };
        $('dfList').appendChild(b);
      }
      $('stCancel').onclick = closeModal;
      $('stGo').onclick = () => { clearSave(); newRun(pick, diff); curNode = null; showMap(); };
    };
    render();
  }
  $('newRun').onclick = setupRun;
  $('continue').onclick = () => { const s = loadSave(); if (!s) return; R = new Run(s); curNode = null; showMap(); };
  $('codexBtn').onclick = () => CE.openCodex(() => title());
  $('again').onclick = title;
  $('partyBtn').onclick = () => {
    if (!$('battle').hidden && B && B.phase !== 'prep') return toast('전투 중에는 편성을 바꿀 수 없습니다');
    openLoadout(!$('battle').hidden ? () => { closeModal(); renderBattle(); } : null);
  };
  $('hudCodex').onclick = () => {
    const from = !$('battle').hidden ? 'battle' : 'mapScreen';
    if (from === 'battle' && B && B.phase !== 'prep') return toast('전투가 끝난 뒤에 볼 수 있습니다');
    CE.openCodex(() => { show(from); if (from === 'battle') renderBattle(); });
  };
  const syncMute = () => { $('muteBtn').textContent = SFX.muted ? '소리 꺼짐' : '소리 켬'; $('muteBtn').setAttribute('aria-pressed', String(!SFX.muted)); };
  $('muteBtn').onclick = () => { SFX.setMuted(!SFX.muted); syncMute(); };
  syncMute();
  document.addEventListener('click', (e) => { if (e.target.closest('button')) SFX.play('click'); });

  // =====================================================================
  // 루프
  // =====================================================================
  AC.loop((dt) => {
    if (R && $('title').hidden && $('ending').hidden) R.stats.time += dt;
    stepVfx(dt);
    if (B && B.combat && (B.rosterT = (B.rosterT || 0) - dt) <= 0) { B.rosterT = 0.15; updateRoster(); }
    if (B && B.phase === 'combat' && B.combat) {
      let left = dt * (window.__turbo || R.speed);
      while (left > 0 && !B.combat.done) { const s = Math.min(1 / 60, left); B.combat.step(s); left -= s; }
      if (B.combat.done) endBattle();
    } else if (B && B.phase === 'result') {
      const cb = B.combat;
      for (const f of cb.floaters) { f.t += dt; f.y -= 28 * dt; }
      cb.floaters = cb.floaters.filter((f) => f.t < 0.9);
      for (const f of cb.fx) f.t += dt;
      cb.fx = cb.fx.filter((f) => f.t < f.life);
      cb.projectiles = [];
      B.resultT -= dt;
      if (B.resultT <= 0) { B.phase = 'done'; afterBattle(); }
    }
    draw();
  });

  // =====================================================================
  // 테스트·밸런스 도구 (디버그)
  // =====================================================================
  // 보관함의 칩·무기를 맞는 딱지에 알아서 올린다(봇용)
  function autoEquip() {
    const score = (u) => byKind.unit[u.id].tier * 10 + u.level;
    for (const c of R.chips.slice().sort((a, b) => byKind.skill[b.id].tier - byKind.skill[a.id].tier)) {
      const d = byKind.skill[c.id];
      const u = R.party.filter((x) => fits(d.cls, x) && x.skills.length < SKILL_SLOTS).sort((a, b) => score(b) - score(a))[0];
      if (u) { R.chips.splice(R.chips.indexOf(c), 1); u.skills.push(c); }
    }
    for (const w of R.weapons.slice().sort((a, b) => byKind.weapon[b.id].tier - byKind.weapon[a.id].tier)) {
      const d = byKind.weapon[w.id];
      const u = R.party.filter((x) => fits(d.cls, x) && (!x.weapon || byKind.weapon[x.weapon.id].tier < d.tier)).sort((a, b) => score(b) - score(a))[0];
      if (u) { R.weapons.splice(R.weapons.indexOf(w), 1); if (u.weapon) R.weapons.push(u.weapon); u.weapon = w; }
    }
  }
  function simBattle(kind, act, party, floor = 2, relics = [], diff = 'normal', tactics) {
    newRun('order', diff);
    R.act = act; R.relics = relics; R.map = genMap(act);
    if (tactics) R.tactics = tactics.map((id) => ({ uid: uid(), id }));
    R.party = party.map(([id, lvl, skills, wp]) => { const u = mkUnit(id, skills || [], wp || null); u.level = lvl || 1; return u; });
    curNode = { row: floor, type: kind };
    startBattle(kind);
    autoDeploy();
    fight();
    const cb = B.combat;
    while (!cb.done) cb.step(1 / 30);
    const res = { won: cb.winner === 0, t: cb.t, left: cb.alive(0).filter((u) => !u.object).length, foeLeft: cb.alive(1).length, bossHp: (() => { const b = cb.units.find((u) => u.boss); return b ? Math.max(0, b.hp) / b.maxHp : 0; })(), allies: B.deployed.length };
    B = null;
    return res;
  }
  window.__exp = { simBattle, autoEquip, get R() { return R; }, get B() { return B; }, autoDeploy, fight, enterNode, reachable, finishNode, nodeById, openLoadout };
  title();
})();
