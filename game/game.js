/* 카드 원정대 — 게임 로직
 * 화면: 타이틀 → 지도(갈림길) → 노드(전투/정예/이벤트/상점/야영지/보물/보스) → 다음 막 → 최종 보스
 */
(() => {
  'use strict';
  const { CLASSES, SKILLS, UNITS, CARDS, STARTER, MONSTERS, ACTS, BOSS_INFO, RELICS, EVENTS } = GD;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'card-expedition-save-v1';
  const LANES = 5, MAP_ROWS = 7; // 0~4 일반 층, 5 야영지, 6 보스
  const BOSS_LABEL = { gobking: '왕', lich: '리', dragon: '룡' };
  const NODE_TYPES = {
    battle: { name: '전투', sym: '전', desc: '일반 몬스터' },
    elite: { name: '정예', sym: '정', desc: '강한 적 · 유물 보상' },
    event: { name: '이벤트', sym: '?', desc: '무슨 일이 일어날지 모른다' },
    shop: { name: '상점', sym: '상', desc: '카드·유물 구매, 카드 제거' },
    rest: { name: '야영지', sym: '휴', desc: '회복 또는 카드 강화' },
    treasure: { name: '보물', sym: '보', desc: '유물 획득' },
    boss: { name: '보스', sym: '왕', desc: '막의 끝' },
  };

  // =====================================================================
  // 런(한 번의 원정) 상태
  // =====================================================================
  class Run {
    constructor(data) {
      Object.assign(this, data || {
        hp: 80, maxHp: 80, gold: 50, act: 1, pos: null, relics: [], speed: 1,
        deck: STARTER.map((id) => ({ uid: AC.uid(), id, star: 1, up: false })),
        stats: { battles: 0, wins: 0, elites: 0, bosses: 0, time: 0, kills: 0 },
      });
      if (!this.map) this.map = genMap(this.act);
    }
    has(r) { return this.relics.includes(r); }
    hurt(n) { this.hp = Math.max(0, this.hp - n); }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    addCard(id) { this.deck.push({ uid: AC.uid(), id, star: 1, up: false }); }
    addRelic(id) { if (!this.has(id)) this.relics.push(id); }
    randomCard(rare, kind) {
      const pool = Object.values(CARDS).filter((c) => (rare === undefined || c.rare === rare) && (!kind || c.kind === kind));
      return AC.pick(pool);
    }
    randomRelic(boss) {
      const pool = Object.values(RELICS).filter((r) => !!r.boss === !!boss && !this.has(r.id));
      return pool.length ? AC.pick(pool) : null;
    }
    pickUpgrade(msg) { pickCard(msg, (c) => canUpgrade(c), (c) => { upgrade(c); toast(cardName(c) + ' 강화!'); finishNode(); }); }
    pickRemove(msg) { pickCard(msg, () => this.deck.length > 5, (c) => { this.deck.splice(this.deck.indexOf(c), 1); toast(CARDS[c.id].name + ' 제거'); finishNode(); }); }
    get energy() { return [0, 7, 9, 11][this.act] + (this.has('crystal') ? 1 : 0); }
    get handSize() { return 6 + this.act + (this.has('pack') ? 1 : 0); }
  }
  let R = null;

  const canUpgrade = (c) => (CARDS[c.id].kind === 'unit' ? c.star < 3 : !c.up);
  const upgrade = (c) => { if (CARDS[c.id].kind === 'unit') c.star++; else c.up = true; };
  const cardName = (c) => CARDS[c.id].name + (CARDS[c.id].kind === 'unit' ? (c.star > 1 ? ' ' + '★'.repeat(c.star) : '') : c.up ? '+' : '');

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(R)); } catch (e) { /* 저장 불가 환경 */ } }
  function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }

  // =====================================================================
  // 지도 생성 (갈림길)
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
        // 길이 엇갈리며 교차하지 않게
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
        const w = { battle: 42, event: 22, elite: n.row >= 2 ? 15 : 0, shop: 13, treasure: 8 };
        const keys = Object.keys(w);
        n.type = keys[AC.weighted(keys.map((k) => w[k]))];
      }
    }
    const mids = list.filter((n) => n.row >= 1 && n.row <= MAP_ROWS - 3);
    if (!mids.some((n) => n.type === 'shop')) AC.pick(mids).type = 'shop';
    if (!mids.some((n) => n.type === 'elite')) { const c = mids.filter((n) => n.row >= 2 && n.type !== 'shop'); if (c.length) AC.pick(c).type = 'elite'; }
    return { act, nodes: list };
  }
  const nodeById = (id) => R.map.nodes.find((n) => n.id === id);
  function reachable() {
    if (!R.pos) return R.map.nodes.filter((n) => n.row === 0);
    const cur = nodeById(R.pos);
    return cur ? cur.next.map(nodeById) : [];
  }

  // =====================================================================
  // 공용 UI
  // =====================================================================
  function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }
  function show(screen) {
    for (const id of ['title', 'mapScreen', 'battle', 'ending']) $(id).hidden = id !== screen;
    $('hud').hidden = screen === 'title' || screen === 'ending';
    if (screen !== 'title') renderHud();
    window.scrollTo(0, 0);
  }
  function modal(html) { $('sheet').innerHTML = html; $('modal').hidden = false; $('sheet').scrollTop = 0; }
  function closeModal() { $('modal').hidden = true; }
  const fmtTime = (s) => Math.floor(s / 60) + '분 ' + String(Math.floor(s % 60)).padStart(2, '0') + '초';

  function renderHud() {
    if (!R) return;
    $('hpText').textContent = R.hp + ' / ' + R.maxHp;
    $('hpFill').style.width = (100 * R.hp) / R.maxHp + '%';
    $('goldText').textContent = R.gold;
    const node = R.pos ? nodeById(R.pos) : null;
    $('actText').textContent = R.act + '막 ' + ACTS[R.act].name + (node ? ' · ' + (node.row + 1) + '층' : '');
    $('deckBtn').textContent = '덱 ' + R.deck.length;
    $('relics').innerHTML = R.relics.map((id) => `<button type="button" class="relic" data-r="${id}" title="${RELICS[id].name}: ${RELICS[id].desc}">${RELICS[id].sym}</button>`).join('');
    $('relics').querySelectorAll('.relic').forEach((b) => (b.onclick = () => { const r = RELICS[b.dataset.r]; toast(r.name + ' — ' + r.desc); }));
  }

  // 미니 패턴(5×5) — 스킬 카드에 그려지는 공격 범위
  function patternGrid(d) {
    const g = Array.from({ length: 25 }, () => '');
    const set = (x, y, v) => { if (x >= 0 && x < 5 && y >= 0 && y < 5) g[y * 5 + x] = v; };
    const hitCls = ['heal', 'shield', 'haste', 'buff', 'revive'].includes(d.effect) ? 'ally' : d.effect === 'taunt' ? 'warn' : 'hit';
    switch (d.mode) {
      case 'facing': set(2, 4, 'me'); for (const [f, s] of d.cells) set(2 + s, 4 - f, hitCls); break;
      case 'line': set(2, 4, 'me'); for (let y = 0; y < 4; y++) set(2, y, hitCls); break;
      case 'targetFacing': set(2, 4, 'me'); for (const [f, s] of d.cells) set(2 + s, 2 - f, hitCls); set(2, 2, hitCls + ' tg'); break;
      case 'self': for (const [x, y] of d.cells) set(2 + x, 2 + y, hitCls); set(2, 2, d.cells.some(([x, y]) => !x && !y) ? hitCls + ' me' : 'me'); break;
      case 'target': for (const [x, y] of d.cells) set(2 + x, 2 + y, hitCls); set(2, 2, hitCls + ' tg'); break;
      case 'chain': set(2, 4, 'me'); [[2, 2], [3, 1], [1, 1], [2, 0]].forEach(([x, y]) => set(x, y, hitCls)); set(2, 2, hitCls + ' tg'); break;
      case 'lowest': set(2, 4, 'me'); set(3, 0, hitCls + ' tg'); break;
      case 'single': set(2, 4, 'me'); set(2, 3, hitCls + ' tg'); break;
      case 'selfOnly': set(2, 2, 'ally me'); break;
      case 'ally': set(2, 2, 'me'); set(1, 3, 'ally'); break;
      case 'dead': set(2, 2, 'me'); set(3, 3, 'ally tg'); break;
    }
    return '<div class="pat">' + g.map((v) => `<i class="${v}"></i>`).join('') + '</div>';
  }
  function cardEl(c, opts = {}) {
    const d = CARDS[c.id], cl = CLASSES[d.cls], el = document.createElement('div');
    el.className = 'card ' + d.kind + (d.rare ? ' rare' : '');
    el.style.setProperty('--cc', cl.color);
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    const cost = opts.cost != null ? opts.cost : d.cost;
    const m = AC.STAR_MULT[c.star || 1];
    if (d.kind === 'unit') {
      el.innerHTML = `<span class="cost">${cost}</span><span class="ctype">${cl.full} 유닛</span>
        <span class="nm">${d.name}${c.star > 1 ? ' <b class="stars">' + '★'.repeat(c.star) + '</b>' : ''}</span>
        <span class="art">${d.name[0]}</span>
        <span class="tx">${d.desc || (d.range > 1 ? '원거리 ' + d.range + '칸' : '근접')} · 스킬 ${slotsOf(c)}칸</span>
        <span class="st"><span>체 ${Math.round(d.hp * m)}</span><span>공 ${Math.round(d.atk * m)}</span><span>사 ${d.range}</span></span>`;
    } else {
      const pw = d.effect === 'heavy' ? '공×' + (d.power * (c.up ? 1.4 : 1)).toFixed(1) : d.power > 1 ? Math.round(d.power * (c.up ? 1.4 : 1)) : '';
      el.innerHTML = `<span class="cost">${cost}</span><span class="ctype">${cl.full} 스킬</span>
        <span class="nm">${d.name}${c.up ? '<b class="plus">+</b>' : ''}</span>
        ${patternGrid(d)}
        <span class="tx">${d.desc}</span>
        <span class="st"><span>마나 ${d.mana - (c.up ? 10 : 0)}</span>${pw !== '' ? `<span>위력 ${pw}</span>` : ''}</span>`;
    }
    if (opts.price != null) el.insertAdjacentHTML('beforeend', `<span class="price">${opts.price}G</span>`);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new CustomEvent('pick')); } });
    return el;
  }
  const slotsOf = (c) => (c.star >= 2 ? 3 : 2) + (R && R.has('tome') ? 1 : 0);

  function pickCard(msg, filter, onPick, onCancel) {
    modal(`<h3>${msg}</h3><div class="choices cards" id="pk"></div><div class="row"><button type="button" id="pkCancel">취소</button></div>`);
    const list = R.deck.filter(filter);
    if (!list.length) $('pk').innerHTML = '<p>고를 수 있는 카드가 없습니다.</p>';
    for (const c of list) {
      const el = cardEl(c);
      const go = () => onPick(c);
      el.onclick = go; el.addEventListener('pick', go);
      $('pk').appendChild(el);
    }
    $('pkCancel').onclick = () => (onCancel ? onCancel() : finishNode());
  }
  function showDeck() {
    const sorted = R.deck.slice().sort((a, b) => (CARDS[a.id].kind > CARDS[b.id].kind ? -1 : CARDS[a.id].kind < CARDS[b.id].kind ? 1 : CARDS[a.id].cls.localeCompare(CARDS[b.id].cls)));
    const back = $('modal').hidden ? null : $('sheet').innerHTML;
    modal(`<h3>내 덱 ${R.deck.length}장</h3><p class="muted">유닛 ${R.deck.filter((c) => CARDS[c.id].kind === 'unit').length} · 스킬 ${R.deck.filter((c) => CARDS[c.id].kind === 'skill').length}. 스킬 카드는 같은 계열 유닛(공용은 아무 유닛)에게만 붙일 수 있습니다.</p><div class="choices cards" id="dk"></div><div class="row"><button type="button" id="dkClose">닫기</button></div>`);
    for (const c of sorted) $('dk').appendChild(cardEl(c));
    $('dkClose').onclick = () => { if (back !== null) { $('sheet').innerHTML = back; rebindAfterDeck(); } else closeModal(); };
  }
  let rebindAfterDeck = () => {};

  // =====================================================================
  // 지도 화면
  // =====================================================================
  function showMap() {
    closeModal();
    save();
    show('mapScreen');
    const A = ACTS[R.act];
    $('mapTitle').textContent = R.act + '막 · ' + A.name;
    $('mapSub').textContent = R.pos ? '다음 갈 곳을 고르세요. 선으로 이어진 곳만 갈 수 있습니다.' : '출발 지점을 고르세요. 맨 위의 보스까지 올라가야 합니다.';
    const box = $('mapbox');
    box.querySelectorAll('.mnode').forEach((n) => n.remove());
    const pos = (n) => {
      const x = ((n.lane + 0.5 + n.jx) / LANES) * 100;
      const y = n.row === MAP_ROWS - 1 ? 6 : 100 - ((n.row + 0.5 + n.jy) / (MAP_ROWS - 0.4)) * 100 + 2;
      return { x, y };
    };
    const reach = new Set(reachable().map((n) => n.id));
    const visited = new Set(R.visited || []);
    let svg = '';
    for (const n of R.map.nodes) {
      for (const id of n.next) {
        const m = nodeById(id), a = pos(n), b = pos(m);
        const cls = visited.has(n.id) && visited.has(m.id) ? 'walked' : R.pos === n.id ? 'open' : '';
        svg += `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
      }
    }
    $('mapsvg').innerHTML = svg;
    for (const n of R.map.nodes) {
      const p = pos(n), t = NODE_TYPES[n.type];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mnode t-' + n.type + (reach.has(n.id) ? ' reach' : '') + (visited.has(n.id) ? ' visited' : '') + (R.pos === n.id ? ' here' : '');
      b.style.left = p.x + '%';
      b.style.top = p.y + '%';
      b.textContent = n.type === 'boss' ? BOSS_LABEL[ACTS[R.act].boss] : t.sym;
      b.title = t.name + ' — ' + t.desc;
      b.setAttribute('aria-label', (n.row + 1) + '층 ' + t.name);
      b.disabled = !reach.has(n.id);
      b.onclick = () => enterNode(n);
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
  }
  function finishNode() {
    if (curNode) {
      R.pos = curNode.id;
      R.visited = R.visited || [];
      R.visited.push(curNode.id);
    }
    if (R.hp <= 0) return ending(false);
    if (curNode && curNode.type === 'boss') return nextAct();
    showMap();
  }
  function nextAct() {
    if (R.act >= 3) return ending(true);
    R.act++;
    R.map = genMap(R.act);
    R.pos = null;
    R.visited = [];
    const healed = Math.ceil((R.maxHp - R.hp) * 0.5);
    R.heal(healed);
    modal(`<h3>${R.act}막 — ${ACTS[R.act].name}</h3><p>${R.act === 2 ? '숲을 벗어나자 무너진 성채와 묘지가 펼쳐진다. 죽은 자들이 깨어나고 있다.' : '땅이 뜨겁다. 화산 꼭대기에서 흑룡 아자르의 숨소리가 들려온다.'}</p>
      <p class="muted">체력 ${healed} 회복 · 전투 에너지 ${R.energy}로 증가</p><div class="row"><button type="button" class="primary" id="goAct">출발</button></div>`);
    $('goAct').onclick = () => { curNode = null; showMap(); };
  }

  // =====================================================================
  // 이벤트 / 상점 / 야영지 / 보물
  // =====================================================================
  function showEvent() {
    const ev = AC.pick(EVENTS);
    modal(`<span class="eyebrow">이벤트</span><h3>${ev.title}</h3><p>${ev.text}</p><div class="choices col" id="evc"></div>`);
    for (const ch of ev.choices) {
      const ok = !ch.cond || ch.cond(R);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.disabled = !ok;
      b.innerHTML = `${ch.label}${ch.note ? `<small>${ch.note}</small>` : ''}`;
      b.onclick = () => {
        const res = ch.fn(R);
        renderHud();
        if (res === null) return; // 카드 선택 화면으로 넘어감
        modal(`<h3>${ev.title}</h3><p>${res}</p><div class="row"><button type="button" class="primary" id="evOk">계속</button></div>`);
        $('evOk').onclick = finishNode;
      };
      $('evc').appendChild(b);
    }
    show('mapScreen');
  }

  function showShop() {
    const price = (d) => Math.round((d.kind === 'unit' ? (d.rare ? 95 : 50) : d.rare ? 85 : 45) * AC.rand(0.9, 1.1));
    const pick = (kind, rare) => AC.pick(Object.values(CARDS).filter((c) => c.kind === kind && c.rare === rare));
    const items = [pick('unit', false), pick('unit', Math.random() < 0.4), pick('skill', false), pick('skill', false), pick('skill', true)]
      .map((d) => ({ c: { uid: AC.uid(), id: d.id, star: 1, up: false }, price: price(d), sold: false }));
    const relics = [];
    for (let k = 0; k < 2; k++) { const r = R.randomRelic(false); if (r && !relics.some((x) => x.r === r)) relics.push({ r, price: AC.randi(130, 160), sold: false }); }
    let removed = false;
    const render = () => {
      modal(`<span class="eyebrow">상점</span><h3>떠돌이 상인의 수레</h3><p class="muted">보유 골드 <b>${R.gold}G</b></p>
        <div class="choices cards" id="shc"></div>
        <div class="choices" id="shr"></div>
        <div class="row"><button type="button" id="shRemove" ${removed || R.gold < 60 ? 'disabled' : ''}>카드 제거 60G</button><button type="button" id="deckView">덱 보기</button><button type="button" class="primary" id="shLeave">떠나기</button></div>`);
      for (const it of items) {
        const el = cardEl(it.c, { price: it.sold ? '판매됨 ' : it.price });
        if (it.sold || R.gold < it.price) el.classList.add('cant');
        const buy = () => { if (it.sold) return; if (R.gold < it.price) return toast('골드가 부족합니다'); R.gold -= it.price; it.sold = true; R.deck.push(it.c); toast(CARDS[it.c.id].name + ' 구매'); renderHud(); render(); };
        el.onclick = buy; el.addEventListener('pick', buy);
        $('shc').appendChild(el);
      }
      for (const it of relics) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice relicbuy'; b.disabled = it.sold || R.gold < it.price;
        b.innerHTML = `<span class="rsym">${it.r.sym}</span>${it.r.name} · ${it.sold ? '판매됨' : it.price + 'G'}<small>${it.r.desc}</small>`;
        b.onclick = () => { R.gold -= it.price; it.sold = true; R.addRelic(it.r.id); toast(it.r.name + ' 구매'); renderHud(); render(); };
        $('shr').appendChild(b);
      }
      $('shRemove').onclick = () => pickCard('제거할 카드를 고르세요 (60G)', () => R.deck.length > 5, (c) => { R.gold -= 60; removed = true; R.deck.splice(R.deck.indexOf(c), 1); toast(CARDS[c.id].name + ' 제거'); renderHud(); render(); }, render);
      $('deckView').onclick = () => { rebindAfterDeck = render; showDeck(); };
      $('shLeave').onclick = finishNode;
    };
    render();
    show('mapScreen');
  }

  function showRest() {
    const amt = Math.round(R.maxHp * 0.3);
    modal(`<span class="eyebrow">야영지</span><h3>모닥불</h3><p>타닥거리는 불 앞에서 잠시 숨을 고른다. 한 가지만 할 수 있다.</p>
      <div class="choices col"><button type="button" class="choice" id="rsHeal" ${R.hp >= R.maxHp ? 'disabled' : ''}>휴식<small>체력 ${amt} 회복 (${R.hp}/${R.maxHp})</small></button>
      <button type="button" class="choice" id="rsUp">수련<small>카드 1장 강화 — 유닛 ★ 능력치 ×1.8 · 스킬 위력 ×1.4, 마나 −10</small></button></div>`);
    $('rsHeal').onclick = () => { R.heal(amt); toast('체력 ' + amt + ' 회복'); renderHud(); finishNode(); };
    $('rsUp').onclick = () => pickCard('강화할 카드를 고르세요', canUpgrade, (c) => { upgrade(c); toast(cardName(c) + ' 강화!'); finishNode(); }, showRest);
    show('mapScreen');
  }

  function showTreasure() {
    const r = R.randomRelic(false);
    const g = AC.randi(20, 35);
    R.gold += g;
    if (r) R.addRelic(r.id);
    renderHud();
    modal(`<span class="eyebrow">보물</span><h3>낡은 상자</h3><p>${r ? `<b>${r.name}</b> — ${r.desc}` : '빈 상자다.'}<br>골드 ${g} 획득</p><div class="row"><button type="button" class="primary" id="trOk">챙긴다</button></div>`);
    $('trOk').onclick = finishNode;
    show('mapScreen');
  }

  // =====================================================================
  // 전투
  // =====================================================================
  const CS = 58, COLS = 6, ROWS = 8, PLAYER_ROW = 4;
  const W = CS * COLS + 20, H = CS * ROWS + 20;
  const grid = AC.squareGrid(COLS, ROWS, CS, { ox: 10, oy: 10, diag: true });
  const canvas = $('cv');
  const ctx = AC.setupCanvas(canvas, W, H);
  const isMine = (cell) => grid.cells[cell].r >= PLAYER_ROW;
  let B = null; // 전투 상태

  function genEnemies(kind) {
    const A = ACTS[R.act], out = [], used = new Set();
    const floor = curNode ? curNode.row : 0;
    const put = (id, rows, col) => {
      const def = MONSTERS[id];
      for (let t = 0; t < 60; t++) {
        const cell = grid.idx(col != null && t === 0 ? col : AC.randi(0, COLS - 1), AC.pick(rows));
        if (!used.has(cell)) { used.add(cell); out.push({ uid: AC.uid(), def, cell, scale: 1 + floor * 0.05 }); return; }
      }
    };
    const rowsFor = (d) => (d.range > 1 ? [0, 1] : [2, 3]);
    if (kind === 'boss') {
      const boss = MONSTERS[A.boss];
      put(A.boss, [boss.boss === 'dragon' ? 2 : 1], 2);
      const adds = { gobking: ['goblin', 'goblin'], lich: ['skel', 'skelarch'], dragon: ['imp', 'imp'] }[boss.boss];
      for (const id of adds) put(id, rowsFor(MONSTERS[id]));
      out.forEach((x) => (x.scale = 1));
    } else if (kind === 'elite') {
      for (const id of AC.pick(A.elites)) put(id, rowsFor(MONSTERS[id]));
    } else {
      let budget = [0, 2.6, 3.2, 3.6][R.act] + floor * 0.8;
      while (budget > 0.4 && out.length < 8) {
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
      kind, enemies: genEnemies(kind), hand: [], pile: [], played: [], energy: R.energy, maxEnergy: R.energy,
      redraws: 1 + (R.has('eye') ? 1 : 0), sel: null, phase: 'prep', combat: null, scrollUsed: false, info: null, hover: null,
    };
    B.pile = AC.shuffle(R.deck.slice());
    drawHand(R.handSize);
    show('battle');
    $('bbanner').className = 'bbanner';
    renderBattle();
    if (R.stats.battles === 0) toast('유닛 카드를 아래쪽 네 줄에 놓고, 스킬 카드를 같은 계열 유닛에게 붙이세요');
  }
  function drawHand(n) {
    for (let k = 0; k < n && B.pile.length; k++) B.hand.push(B.pile.pop());
    // 유닛이 너무 적으면 남은 더미에서 유닛과 맞바꾼다
    const units = () => B.hand.filter((c) => CARDS[c.id].kind === 'unit').length;
    while (units() < 2 + R.act) {
      const ui = B.pile.findIndex((c) => CARDS[c.id].kind === 'unit');
      const si = B.hand.findIndex((c) => CARDS[c.id].kind === 'skill');
      if (ui < 0 || si < 0) break;
      const [u] = B.pile.splice(ui, 1);
      B.pile.unshift(B.hand[si]);
      B.hand[si] = u;
    }
  }
  const costOf = (c) => Math.max(0, CARDS[c.id].cost - (CARDS[c.id].kind === 'skill' && R.has('scroll') && !B.scrollUsed ? 1 : 0));
  const canPay = (c) => B.energy >= costOf(c);
  const playedAt = (cell) => B.played.find((p) => p.cell === cell) || null;
  const enemyAt = (cell) => B.enemies.find((e) => e.cell === cell) || null;
  const skillFits = (s, p) => { const d = CARDS[s.id]; return (d.cls === 'any' || d.cls === CARDS[p.c.id].cls) && p.skills.length < slotsOf(p.c); };

  function pay(c) {
    if (CARDS[c.id].kind === 'skill' && R.has('scroll') && !B.scrollUsed && CARDS[c.id].cost > 0) B.scrollUsed = true;
    B.energy -= costOf(c);
    B.hand.splice(B.hand.indexOf(c), 1);
    B.sel = null;
  }
  function placeUnit(c, cell) {
    if (!isMine(cell)) return toast('아래쪽 네 줄(내 진영)에만 놓을 수 있습니다'), false;
    if (playedAt(cell)) return toast('이미 유닛이 있는 칸입니다'), false;
    if (!canPay(c)) return toast('에너지가 부족합니다'), false;
    const cost = costOf(c);
    pay(c);
    B.played.push({ c, cell, skills: [], paid: cost });
    renderBattle();
    return true;
  }
  function attachSkill(s, p) {
    const d = CARDS[s.id];
    if (!p) return toast('스킬은 배치한 아군 유닛에게 붙입니다'), false;
    if (d.cls !== 'any' && d.cls !== CARDS[p.c.id].cls) return toast(`${d.name}은(는) ${CLASSES[d.cls].full} 유닛에게만 붙일 수 있습니다`), false;
    if (p.skills.length >= slotsOf(p.c)) return toast('스킬 칸이 가득 찼습니다 (' + slotsOf(p.c) + '칸)'), false;
    if (!canPay(s)) return toast('에너지가 부족합니다'), false;
    const cost = costOf(s);
    pay(s);
    s.paid = cost;
    p.skills.push(s);
    B.info = { type: 'ally', p };
    toast(CARDS[p.c.id].name + '에게 ' + d.name + ' 장착');
    renderBattle();
    return true;
  }
  function unplay(p) {
    B.played.splice(B.played.indexOf(p), 1);
    for (const s of p.skills) { B.hand.push(s); B.energy += s.paid; }
    B.hand.push(p.c);
    B.energy += p.paid;
    if (p.skills.some((s) => s.paid < CARDS[s.id].cost) || p.paid < CARDS[p.c.id].cost) B.scrollUsed = false;
    B.info = null;
    renderBattle();
  }
  function selectCard(c) {
    if (B.phase !== 'prep') return;
    if (!canPay(c)) return toast('에너지가 부족합니다');
    B.sel = B.sel === c ? null : c;
    if (B.sel) toast(CARDS[c.id].kind === 'unit' ? '내 진영의 빈 칸을 누르세요' : '빛나는 아군 유닛을 누르세요');
    renderBattle();
  }
  function useSelectedOn(cell) {
    const c = B.sel;
    if (CARDS[c.id].kind === 'unit') return placeUnit(c, cell);
    return attachSkill(c, playedAt(cell));
  }

  // 자동 배치: 남은 유닛을 앞/뒷줄에 놓고 스킬을 맞는 유닛에 붙인다
  function autoDeploy() {
    if (B.phase !== 'prep') return;
    // 보스전에서는 광역 패턴을 피하도록 한 칸씩 띄워 배치
    const spread = B.kind === 'boss';
    const order = spread ? [1, 4, 2, 5, 0, 3] : [2, 3, 1, 4, 0, 5];
    const freeCell = (d) => {
      for (const r of d.range > 1 ? [6, 7, 5] : spread ? [4, 5, 6] : [4, 5]) for (const col of order) { const cell = grid.idx(col, r); if (!playedAt(cell)) return cell; }
      return grid.cells.find((c) => isMine(c.i) && !playedAt(c.i)).i;
    };
    // 유닛을 (막 번호 + 2)명까지 먼저 세우고, 붙일 스킬이 있으면 스킬, 없으면 유닛을 더 놓는다
    for (let guard = 0; guard < 20; guard++) {
      const units = B.hand.filter((c) => CARDS[c.id].kind === 'unit' && canPay(c)).sort((a, b) => CARDS[b.id].cost - CARDS[a.id].cost || b.star - a.star);
      const skills = B.hand.filter((c) => CARDS[c.id].kind === 'skill' && canPay(c) && B.played.some((p) => skillFits(c, p)))
        .sort((a, b) => CARDS[b.id].cost - CARDS[a.id].cost);
      if (units.length && (B.played.length < 2 + R.act || !skills.length)) { placeUnit(units[0], freeCell(CARDS[units[0].id])); continue; }
      if (skills.length) {
        const s = skills[0];
        const tgt = B.played.filter((p) => skillFits(s, p)).sort((a, b) => a.skills.length - b.skills.length || CARDS[b.c.id].cost - CARDS[a.c.id].cost)[0];
        attachSkill(s, tgt);
        continue;
      }
      break;
    }
    B.sel = null;
    renderBattle();
  }

  // ---------- 입력 ----------
  const drag = AC.dragController(canvas, {
    pick: (pt) => { if (!B || B.phase !== 'prep' || B.sel) return null; const c = grid.cellAt(pt.x, pt.y); return c ? playedAt(c.i) : null; },
    drop: (p, pt) => {
      const c = grid.cellAt(pt.x, pt.y);
      if (!c || !isMine(c.i)) return;
      const other = playedAt(c.i);
      if (other) other.cell = p.cell;
      p.cell = c.i;
      B.info = { type: 'ally', p };
      renderBattle();
    },
    click: (pt) => {
      if (!B) return;
      const c = grid.cellAt(pt.x, pt.y);
      if (!c) return;
      if (B.phase === 'prep' && B.sel) return useSelectedOn(c.i);
      if (B.combat) {
        const e = B.combat.units.find((u) => !u.dead && u.cell === c.i);
        B.info = e ? { type: 'ent', e } : null;
        return renderInfo();
      }
      const p = playedAt(c.i), en = enemyAt(c.i);
      B.info = p ? { type: 'ally', p } : en ? { type: 'enemy', en } : null;
      renderInfo();
    },
    hover: (pt) => { const c = grid.cellAt(pt.x, pt.y); if (B) B.hover = c ? c.i : null; },
  });
  canvas.addEventListener('pointerleave', () => { if (B) B.hover = null; });

  function startCardDrag(ev, c, el) {
    if (B.phase !== 'prep') return;
    const sx = ev.clientX, sy = ev.clientY;
    let ghost = null;
    const mv = (e) => {
      if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 8 && canPay(c)) {
        ghost = el.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = el.offsetWidth + 'px'; document.body.appendChild(ghost);
        B.sel = c; el.classList.add('sel');
      }
      if (ghost) {
        ghost.style.left = e.clientX - 50 + 'px'; ghost.style.top = e.clientY - 70 + 'px';
        const r = canvas.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        const cell = inside ? grid.cellAt(...Object.values(canvas.toLogical(e))) : null;
        B.hover = cell ? cell.i : null;
      }
    };
    const up = (e) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (!ghost) return selectCard(c);
      ghost.remove();
      const r = canvas.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const pt = canvas.toLogical(e), cell = grid.cellAt(pt.x, pt.y);
        if (cell) useSelectedOn(cell.i);
      }
      B.sel = null;
      renderBattle();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  $('redraw').onclick = () => {
    if (!B || B.phase !== 'prep' || B.redraws <= 0) return;
    B.redraws--;
    const n = B.hand.length;
    B.pile.unshift(...B.hand);
    B.hand = [];
    drawHand(n);
    B.sel = null;
    renderBattle();
  };
  $('auto').onclick = autoDeploy;
  $('speed').onclick = () => { R.speed = R.speed === 1 ? 2 : R.speed === 2 ? 3 : 1; renderControls(); };
  $('fight').onclick = () => fight();
  document.addEventListener('keydown', (e) => {
    if (!B || $('battle').hidden || !$('modal').hidden) return;
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); fight(); }
    if (e.key === 'Escape') { B.sel = null; renderBattle(); }
  });

  // ---------- 전투 개체 ----------
  function makeAlly(p) {
    const d = CARDS[p.c.id];
    const e = AC.makeEntity(d, p.c.star, 0, p.cell, {
      cls: d.cls, color: CLASSES[d.cls].color, label: d.name[0], dodge: d.dodge || 0, lifesteal: d.lifesteal || 0,
      manaPerHit: d.manaPerHit || 12, skills: p.skills.map((s) => ({ def: CARDS[s.id], up: s.up })), pmult: 1,
    });
    if (d.cls === 'sword' && R.has('whetstone')) e.atk *= 1.2;
    if (d.cls === 'bow' && R.has('feather')) e.as *= 1.2;
    if (d.cls === 'holy' && R.has('holywater')) { e.maxHp *= 1.25; e.healMult = 1.25; }
    if (R.has('banner')) e.maxHp *= 1.1;
    e.maxHp = Math.round(e.maxHp); e.hp = e.maxHp;
    let mana = d.startMana || 0;
    if (d.cls === 'mage' && R.has('prism')) mana = Math.max(mana, 30);
    if (R.has('horn')) mana += 20;
    setupSkills(e, mana);
    return e;
  }
  function makeFoe(x) {
    const d = x.def, k = x.scale || 1;
    const e = AC.makeEntity({ hp: d.hp * k, atk: d.atk * k, as: d.as, range: d.range, armor: d.armor || 0, mana: d.mana }, 1, 1, x.cell, {
      def: d, color: d.color, label: d.boss ? BOSS_LABEL[d.boss] : d.name[0], dodge: d.dodge || 0, lifesteal: d.lifesteal || 0,
      skills: d.skills.map((id) => ({ def: CARDS[id], up: false, mana: d.mana })), pmult: ACTS[R.act].pmult, immobile: !!d.immobile,
      boss: d.boss || null, big: !!d.boss, elite: !!d.elite, manaPerHit: 10, v: d.v,
    });
    setupSkills(e, 0);
    if (e.boss) e.script = { a: 3, b: 2, c: 4, flags: {} };
    return e;
  }
  const skillMana = (s) => (s.mana || s.def.mana) - (s.up ? 10 : 0);
  function setupSkills(e, mana) {
    if (e.skills.length) {
      e.ability = { type: 'skill' };
      e.skillIdx = 0;
      e.maxMana = skillMana(e.skills[0]);
      e.mana = Math.min(e.maxMana - 1, mana);
    } else { e.ability = null; e.maxMana = 0; e.mana = 0; }
  }

  // ---------- 스킬 실행 (고전 격자 패턴) ----------
  function facing(u, t) {
    const a = grid.cells[u.cell], b = t ? grid.cells[t.cell] : null;
    if (!b) return u.side ? [0, 1] : [0, -1];
    const dx = b.c - a.c, dy = b.r - a.r;
    if (Math.abs(dx) > Math.abs(dy)) return [Math.sign(dx), 0];
    if (dy) return [0, Math.sign(dy)];
    return u.side ? [0, 1] : [0, -1];
  }
  function rel(cell, f, s, dir) {
    const a = grid.cells[cell], fx = dir[0], fy = dir[1], sx = -fy, sy = fx;
    return grid.idx(a.c + f * fx + s * sx, a.r + f * fy + s * sy);
  }
  function abs(cell, dx, dy) { const a = grid.cells[cell]; return grid.idx(a.c + dx, a.r + dy); }
  function tiles(cb, cells, color, life = 0.45) { for (const i of cells) cb.fx.push({ kind: 'tile', cell: i, color, life, t: 0 }); }

  function skillCells(u, t, d, dir) {
    let cells = [];
    switch (d.mode) {
      case 'facing': cells = d.cells.map(([f, s]) => rel(u.cell, f, s, dir)); break;
      case 'targetFacing': cells = d.cells.map(([f, s]) => rel(t.cell, f, s, dir)); break;
      case 'self': cells = d.cells.map(([x, y]) => abs(u.cell, x, y)); break;
      case 'target': cells = d.cells.map(([x, y]) => abs(t.cell, x, y)); break;
      case 'line': for (let f = 1; f < 12; f++) { const i = rel(u.cell, f, 0, dir); if (i < 0) break; cells.push(i); } break;
      case 'selfOnly': cells = [u.cell]; break;
      case 'single': cells = [t.cell]; break;
    }
    return cells.filter((i) => i >= 0);
  }

  function execSkill(cb, u, t, s) {
    const d = s.def, foe = 1 - u.side;
    const P = d.power * AC.STAR_MULT[u.star] * (s.up ? 1.4 : 1) * u.spell * (u.side ? u.pmult : 1);
    const dir = facing(u, t);
    u.dir = dir;
    const col = u.side ? '#e8436b' : CLASSES[d.cls].color;
    cb.float(u.px, u.py - 36, d.name, u.side ? '#ffd0da' : '#fffdf7', true);
    const healMult = u.healMult || 1;
    const hitCell = (i, amt) => {
      const v = cb.occ[i];
      if (!v || v.side !== foe) return 0;
      const dealt = cb.damage(u, v, amt, 'spell');
      if (d.stun) v.stun = Math.max(v.stun, d.stun);
      if (d.slow) v.slowT = d.slow;
      return dealt;
    };
    const allies = (cells) => cells.map((i) => cb.occ[i]).filter((v) => v && v.side === u.side && !v.dead);
    switch (d.effect) {
      case 'dmg': {
        if (d.mode === 'lowest') {
          const v = cb.alive(foe).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (v) { cb.beam(u.px, u.py, v.px, v.py, col, 0.35); tiles(cb, [v.cell], col); cb.damage(u, v, P, 'spell'); }
          break;
        }
        if (d.mode === 'chain') {
          let cur = t, amt = P;
          const hit = new Set();
          let from = u;
          for (let k = 0; k < 4 && cur; k++) {
            hit.add(cur);
            cb.beam(from.px, from.py, cur.px, cur.py, '#b48cff', 0.35);
            tiles(cb, [cur.cell], col);
            cb.damage(u, cur, amt, 'spell');
            amt *= 0.85;
            from = cur;
            cur = cb.alive(foe).filter((v) => !hit.has(v)).sort((a, b) => grid.dist(from.cell, a.cell) - grid.dist(from.cell, b.cell))[0];
          }
          break;
        }
        const cells = skillCells(u, t, d, dir);
        tiles(cb, cells, col);
        let dealt = 0;
        for (const i of cells) dealt += hitCell(i, P);
        if (d.drain && dealt) cb.heal(u, dealt * d.drain);
        if (d.mode === 'line') cb.beam(u.px, u.py, grid.cells[cells[cells.length - 1] ?? u.cell].x, grid.cells[cells[cells.length - 1] ?? u.cell].y, col, 0.3);
        break;
      }
      case 'tele':
        cb.tele.push({ cells: skillCells(u, t, d, dir), t: 0, delay: d.delay || 1.2, dmg: P, side: foe, src: u, color: col });
        break;
      case 'heal': {
        const cells = skillCells(u, t, d, dir);
        tiles(cb, cells, '#2e9e6b');
        for (const a of allies(cells)) cb.heal(a, P * healMult);
        break;
      }
      case 'shield': {
        const cells = skillCells(u, t, d, dir);
        tiles(cb, cells, '#6aa8ff');
        for (const a of allies(cells)) { a.shield += P; if (d.heal) cb.heal(a, d.heal * healMult); cb.ring(a.px, a.py, '#9fd0ff', 22); }
        break;
      }
      case 'taunt': {
        const cells = skillCells(u, t, d, dir);
        tiles(cb, cells, '#f5c400');
        for (const i of cells) { const v = cb.occ[i]; if (v && v.side === foe) { v.forced = u; v.forcedT = 3; } }
        u.shield += P;
        cb.ring(u.px, u.py, '#f5c400', 40, 0.6);
        break;
      }
      case 'buff': {
        const a = cb.alive(u.side).sort((x, y) => y.atk - x.atk)[0];
        if (a) { a.atk *= 1.3 * (s.up ? 1.1 : 1); a.as *= 1.2; cb.ring(a.px, a.py, '#f5c400', 26, 0.6); cb.float(a.px, a.py - 22, '축복', '#f5c400'); }
        break;
      }
      case 'haste': {
        const cells = skillCells(u, t, d, dir);
        tiles(cb, cells, '#f5c400');
        for (const a of allies(cells)) { a.as *= s.up ? 1.35 : 1.25; cb.ring(a.px, a.py, '#f5c400', 18); }
        break;
      }
      case 'revive': {
        const dead = cb.units.find((v) => v.dead && v.side === u.side && !v.revived && !v.summon);
        if (!dead) { cb.heal(u, 150); break; }
        const cell = !cb.occ[dead.cell] ? dead.cell : grid.neighbors[dead.cell].find((n) => !cb.occ[n]);
        if (cell === undefined) break;
        dead.dead = false; dead.revived = true; dead.hp = Math.round(dead.maxHp * (s.up ? 0.7 : d.power)); dead.mana = 0; dead.moving = null;
        dead.cell = cell; cb.occ[cell] = dead; dead.px = grid.cells[cell].x; dead.py = grid.cells[cell].y;
        cb.ring(dead.px, dead.py, '#fff2b0', 34, 0.8);
        cb.float(dead.px, dead.py - 28, '부활', '#c48a00', true);
        break;
      }
      case 'heavy':
        tiles(cb, [t.cell], col);
        cb.damage(u, t, u.atk * d.power * (s.up ? 1.4 : 1), 'spell');
        break;
    }
  }

  // ---------- 보스 패턴 ----------
  function telegraph(cb, b, cells, delay, dmg, color = '#e8436b') {
    cells = cells.filter((i) => i >= 0);
    if (cells.length) cb.tele.push({ cells, t: 0, delay, dmg, side: 0, src: b, color });
  }
  function summon(cb, id, n, rows) {
    for (let k = 0; k < n; k++) {
      const free = grid.cells.filter((c) => rows.includes(c.r) && !cb.occ[c.i]);
      if (!free.length) return;
      const cell = AC.pick(free).i;
      // 소환된 부하는 본래보다 약하다
      const e = makeFoe({ def: MONSTERS[id], cell, scale: 0.6 });
      e.atk *= 0.8;
      e.summon = true;
      if (cb.spawn(e)) cb.ring(e.px, e.py, '#e8436b', 26, 0.6);
    }
  }
  function bossTick(cb, b, dt) {
    const s = b.script, P = ACTS[R.act].pmult;
    s.a -= dt; s.b -= dt; s.c -= dt;
    const foes = cb.alive(0);
    if (!foes.length) return;
    const near = foes.sort((x, y) => grid.dist(b.cell, x.cell) - grid.dist(b.cell, y.cell))[0];
    const ratio = b.hp / b.maxHp;
    if (b.boss === 'gobking') {
      if (s.a <= 0) { s.a = 9; if (cb.alive(1).length < 4) { cb.float(b.px, b.py - 44, '나와라, 녀석들!', '#ffd0da', true); summon(cb, 'goblin', 1, [0, 1, 2]); } }
      if (s.b <= 0) {
        s.b = 4.5;
        const dir = facing(b, near), cells = [];
        for (let f = 1; f <= 2; f++) for (let k = -1; k <= 1; k++) cells.push(rel(b.cell, f, k, dir));
        cb.float(b.px, b.py - 44, '내려찍기', '#ffd0da', true);
        telegraph(cb, b, cells, 1.3, 120);
      }
    } else if (b.boss === 'lich') {
      if (s.a <= 0) {
        s.a = 5;
        const targets = AC.shuffle(foes.slice()).slice(0, 2).map((v) => v.cell);
        const extra = AC.shuffle(grid.cells.filter((c) => c.r >= PLAYER_ROW && !targets.includes(c.i))).slice(0, 2).map((c) => c.i);
        cb.float(b.px, b.py - 44, '죽음의 저주', '#d8c8ff', true);
        telegraph(cb, b, [...targets, ...extra], 1.5, 110, '#7a4fd0');
      }
      if (s.b <= 0) { s.b = 12; if (cb.alive(1).length < 4) { cb.float(b.px, b.py - 44, '일어나라…', '#d8c8ff', true); summon(cb, 'skel', 1, [1, 2, 3]); } }
    } else if (b.boss === 'dragon') {
      const f = s.flags;
      if (ratio < 0.7 && !f.w1) { f.w1 = true; cb.float(b.px, b.py - 50, '새끼들아!', '#ffd0da', true); summon(cb, 'whelp', 1, [1, 2, 3]); }
      if (ratio <= 0.5 && !f.rage) {
        f.rage = true; b.atk *= 1.3; b.armor = 0.15;
        cb.float(b.px, b.py - 50, '분노!', '#ff4d6d', true); cb.ring(b.px, b.py, '#ff4d6d', 90, 1);
        B.phaseText = '2페이즈 · 분노';
      }
      if (ratio < 0.35 && !f.w2) { f.w2 = true; summon(cb, 'whelp', 1, [1, 2, 3]); }
      if (s.a <= 0) {
        s.a = f.rage ? 5.5 : 7;
        const col = grid.cells[near.cell].c, cells = [];
        for (let r = grid.cells[b.cell].r + 1; r < ROWS; r++) for (let c = col - 1; c <= col + 1; c++) cells.push(grid.idx(c, r));
        cb.float(b.px, b.py - 50, '화염 브레스', '#ffd0da', true);
        telegraph(cb, b, cells, 1.6, 180, '#e8643b');
      }
      if (s.b <= 0) {
        s.b = 6;
        if (foes.some((v) => grid.dist(v.cell, b.cell) <= 1)) {
          cb.float(b.px, b.py - 50, '꼬리 휩쓸기', '#ffd0da', true);
          telegraph(cb, b, grid.neighbors[b.cell], 1.0, 150);
        }
      }
      if (f.rage && s.c <= 0) {
        s.c = 6;
        cb.float(b.px, b.py - 50, '운석 낙하', '#ffd0da', true);
        for (let k = 0; k < 2; k++) {
          const c0 = AC.randi(0, COLS - 2), r0 = AC.randi(PLAYER_ROW, ROWS - 2);
          telegraph(cb, b, [grid.idx(c0, r0), grid.idx(c0 + 1, r0), grid.idx(c0, r0 + 1), grid.idx(c0 + 1, r0 + 1)], 1.5, 160, '#e8643b');
        }
      }
    }
  }

  function combatHooks() {
    return {
      playerShot: '#2f6fd6', enemyShot: '#e8436b',
      onCast: (u, t, cb) => {
        const s = u.skills[u.skillIdx];
        u.skillIdx = (u.skillIdx + 1) % u.skills.length;
        u.maxMana = skillMana(u.skills[u.skillIdx]);
        execSkill(cb, u, t, s);
        return true;
      },
      asMod: (u) => (u.slowT > 0 ? 0.6 : 1),
      dmgTakenMod: (t) => (t.side === 0 && R.has('pauldron') ? 0.9 : 1),
      onTick: (cb, dt) => {
        for (const u of cb.units) if (u.slowT > 0) u.slowT -= dt;
        for (const tl of cb.tele) {
          tl.t += dt;
          if (tl.t >= tl.delay && !tl.done) {
            tl.done = true;
            tiles(cb, tl.cells, tl.color, 0.5);
            for (const i of tl.cells) { const v = cb.occ[i]; if (v && v.side === tl.side && !v.dead) cb.damage(tl.src, v, tl.dmg, 'spell'); }
          }
        }
        cb.tele = cb.tele.filter((tl) => !tl.done);
        for (const b of cb.units) if (b.boss && !b.dead) bossTick(cb, b, dt);
      },
      onDeath: (t, src, cb) => {
        if (t.side === 1) R.stats.kills++;
        if (t.boss) {
          // 보스가 쓰러지면 부하들도 흩어진다
          for (const v of cb.alive(1)) cb.kill(v, null);
          cb.tele = [];
        }
      },
    };
  }

  function fight() {
    if (!B || B.phase !== 'prep') return;
    if (!B.played.length) return toast('유닛 카드를 하나 이상 내 진영에 놓으세요');
    const ents = [...B.played.map(makeAlly), ...B.enemies.map(makeFoe)];
    const cb = new AC.Combat(grid, ents, { hooks: combatHooks(), maxTime: B.kind === 'boss' ? 150 : 75 });
    cb.tele = [];
    B.combat = cb;
    B.phase = 'combat';
    B.sel = null;
    B.info = null;
    B.phaseText = '';
    R.stats.battles++;
    renderBattle();
  }

  function endBattle() {
    const cb = B.combat, won = cb.winner === 0;
    B.phase = 'result';
    B.resultT = 1.4;
    const ban = $('bbanner');
    ban.textContent = won ? (B.kind === 'boss' ? '보스 처치!' : '승리!') : cb.winner === -1 ? '시간 초과' : '패배';
    ban.className = 'bbanner show ' + (won ? 'win' : 'lose');
    renderControls();
  }
  function afterBattle() {
    const cb = B.combat, won = cb.winner === 0, kind = B.kind;
    $('bbanner').className = 'bbanner';
    if (won) {
      R.stats.wins++;
      if (kind === 'elite') R.stats.elites++;
      if (kind === 'boss') R.stats.bosses++;
      let gold = kind === 'boss' ? 60 + R.act * 15 : kind === 'elite' ? 30 + R.act * 8 + AC.randi(0, 8) : 12 + R.act * 4 + AC.randi(0, 6);
      if (R.has('goldtooth')) gold += 12;
      R.gold += gold;
      if (R.has('grail')) R.heal(5);
      return rewards(kind, gold);
    }
    const surv = cb.alive(1);
    const dmg = kind === 'boss' ? 16 + R.act * 4 : AC.clamp(Math.round(4 + R.act * 2 + surv.reduce((s, e) => s + Math.min(e.v || 1, 6), 0) * 2), 6, 26);
    R.hurt(dmg);
    renderHud();
    if (R.hp <= 0) return ending(false);
    if (kind === 'boss') {
      modal(`<h3>패배 — 체력 −${dmg}</h3><p>${ACTS[R.act].name}의 주인은 아직 건재하다. 남은 체력 ${R.hp}. 다시 도전하거나 숨을 고를 수 없다 — 이 길의 끝은 보스뿐이다.</p><div class="row"><button type="button" class="primary" id="retry">다시 도전</button></div>`);
      $('retry').onclick = () => { closeModal(); startBattle('boss'); };
      return;
    }
    modal(`<h3>패배 — 체력 −${dmg}</h3><p>살아남은 적 ${surv.length}명. 보상은 없지만 원정은 계속된다. 남은 체력 ${R.hp}.</p><div class="row"><button type="button" class="primary" id="lossOk">계속</button></div>`);
    $('lossOk').onclick = finishNode;
  }

  function cardChoices(rareChance) {
    const out = [];
    const want = ['unit', 'skill', Math.random() < 0.5 ? 'unit' : 'skill'];
    for (const kind of want) {
      let d, tries = 0;
      do { d = R.randomCard(Math.random() < rareChance, kind); } while (out.some((x) => x.id === d.id) && tries++ < 20);
      out.push(d);
    }
    return AC.shuffle(out);
  }
  function rewards(kind, gold) {
    const relic = kind === 'elite' ? R.randomRelic(false) : null;
    if (relic) R.addRelic(relic.id);
    const bossRelics = kind === 'boss' ? [R.randomRelic(true), R.randomRelic(true), R.randomRelic(true)].filter((r, i, a) => r && a.indexOf(r) === i) : [];
    const choices = cardChoices(kind === 'boss' ? 1 : kind === 'elite' ? 0.5 : 0.22);
    const stage2 = () => {
      modal(`<span class="eyebrow">보상</span><h3>${kind === 'boss' ? ACTS[R.act].name + ' 정복!' : '승리!'}</h3>
        <p>골드 +${gold}${relic ? ` · 유물 <b>${relic.name}</b> — ${relic.desc}` : ''}${R.has('grail') ? ' · 체력 +5' : ''}</p>
        <p class="muted">덱에 넣을 카드를 하나 고르세요.</p><div class="choices cards" id="rw"></div>
        <div class="row"><button type="button" id="deckView">덱 보기</button><button type="button" id="skip">건너뛰기</button></div>`);
      for (const d of choices) {
        const c = { uid: AC.uid(), id: d.id, star: 1, up: false };
        const el = cardEl(c);
        const take = () => { R.deck.push(c); toast(d.name + ' 획득'); finishNode(); };
        el.onclick = take; el.addEventListener('pick', take);
        $('rw').appendChild(el);
      }
      $('skip').onclick = finishNode;
      $('deckView').onclick = () => { rebindAfterDeck = stage2; showDeck(); };
      renderHud();
    };
    if (bossRelics.length) {
      modal(`<span class="eyebrow">보스 보상</span><h3>보스의 보물 중 하나를 고르세요</h3><div class="choices col" id="br"></div>`);
      for (const r of bossRelics) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice relicbuy';
        b.innerHTML = `<span class="rsym">${r.sym}</span>${r.name}<small>${r.desc}</small>`;
        b.onclick = () => { R.addRelic(r.id); toast(r.name + ' 획득'); stage2(); };
        $('br').appendChild(b);
      }
      return;
    }
    stage2();
  }

  // ---------- 전투 화면 렌더 ----------
  function renderControls() {
    if (!B) return;
    const prep = B.phase === 'prep';
    $('energy').innerHTML = Array.from({ length: Math.max(B.maxEnergy, B.energy) }, (_, i) => `<span class="orb ${i < B.energy ? '' : 'off'}"></span>`).join('') + `<span class="lbl">${B.energy} / ${B.maxEnergy}</span>`;
    $('fight').disabled = !prep;
    $('auto').disabled = !prep;
    $('redraw').disabled = !prep || B.redraws <= 0;
    $('redraw').textContent = '다시 뽑기 ' + B.redraws;
    $('speed').textContent = '속도 ×' + R.speed;
  }
  function renderHand() {
    const hand = $('hand');
    hand.innerHTML = '';
    if (B.phase !== 'prep') { hand.innerHTML = `<p class="muted handnote">${B.phase === 'combat' ? '전투 중… 유닛을 누르면 상태를 볼 수 있습니다.' : ''}</p>`; return; }
    for (const c of B.hand) {
      const el = cardEl(c, { cost: costOf(c) });
      if (c === B.sel) el.classList.add('sel');
      if (!canPay(c)) el.classList.add('cant');
      el.addEventListener('pointerdown', (ev) => startCardDrag(ev, c, el));
      el.addEventListener('pick', () => selectCard(c));
      hand.appendChild(el);
    }
    if (!B.hand.length) hand.innerHTML = '<p class="muted handnote">손패를 모두 썼습니다. 전투를 시작하세요.</p>';
  }
  function renderEncounter() {
    const names = {};
    for (const e of B.enemies) names[e.def.name] = (names[e.def.name] || 0) + 1;
    const boss = B.enemies.find((e) => e.def.boss);
    const title = B.kind === 'boss' ? '보스전' : B.kind === 'elite' ? '정예 전투' : '전투';
    $('encounter').innerHTML = `<h2>${title}</h2><p>${Object.entries(names).map(([n, k]) => n + (k > 1 ? ' ×' + k : '')).join(', ')}</p>
      ${boss ? `<p class="bossnote">${BOSS_INFO[boss.def.boss]}</p>` : ''}
      ${R.stats.battles === 0 && B.phase === 'prep' ? '<ol class="howto"><li>유닛 카드를 끌어 아래쪽 4줄에 놓습니다.</li><li>스킬 카드를 같은 계열 유닛 위에 놓으면 그 유닛이 마나가 찰 때 스킬을 씁니다.</li><li>카드에 그려진 격자가 공격 범위입니다. 진한 칸이 시전자, 색칠된 칸이 맞는 칸입니다.</li><li>「자동 배치」로 한 번에 놓을 수도 있습니다.</li></ol>' : ''}`;
  }
  function renderInfo() {
    const box = $('infoBox'), inf = B && B.info;
    if (!inf) { box.innerHTML = '<h2>정보</h2><p class="muted">보드의 유닛을 누르면 능력치와 스킬이 보입니다.</p>'; return; }
    const skillList = (sk) => sk.length ? '<ul class="sk">' + sk.map((s) => `<li style="--cc:${CLASSES[s.def ? s.def.cls : CARDS[s.id].cls].color}"><b>${s.def ? s.def.name : CARDS[s.id].name}${s.up ? '+' : ''}</b> ${s.def ? s.def.desc : CARDS[s.id].desc}</li>`).join('') + '</ul>' : '<p class="muted">스킬 없음 — 기본 공격만 합니다.</p>';
    if (inf.type === 'ally') {
      const p = inf.p, d = CARDS[p.c.id], m = AC.STAR_MULT[p.c.star];
      box.innerHTML = `<h2>${d.name}${p.c.star > 1 ? ' ' + '★'.repeat(p.c.star) : ''}</h2><p class="muted">${CLASSES[d.cls].full} · 체력 ${Math.round(d.hp * m)} · 공격 ${Math.round(d.atk * m)} · 사거리 ${d.range}</p>
        <p>스킬 ${p.skills.length} / ${slotsOf(p.c)}</p>${skillList(p.skills.map((s) => ({ def: CARDS[s.id], up: s.up })))}
        ${B.phase === 'prep' ? '<button type="button" id="unplay">손으로 되돌리기</button>' : ''}`;
      const b = $('unplay');
      if (b) b.onclick = () => unplay(p);
    } else if (inf.type === 'enemy') {
      const d = inf.en.def;
      box.innerHTML = `<h2>${d.name}</h2><p class="muted">체력 ${Math.round(d.hp * (inf.en.scale || 1))} · 공격 ${Math.round(d.atk * (inf.en.scale || 1))} · 사거리 ${d.range}${d.armor ? ' · 피해 감소 ' + d.armor * 100 + '%' : ''}</p>
        ${skillList(d.skills.map((id) => ({ def: CARDS[id] })))}${d.boss ? `<p class="bossnote">${BOSS_INFO[d.boss]}</p>` : ''}`;
    } else {
      const e = inf.e;
      box.innerHTML = `<h2>${e.def.name}${e.star > 1 ? ' ' + '★'.repeat(e.star) : ''}</h2>
        <p class="muted">체력 ${Math.max(0, Math.round(e.hp))} / ${Math.round(e.maxHp)}${e.shield > 0 ? ' · 보호막 ' + Math.round(e.shield) : ''} · 공격 ${Math.round(e.atk)}</p>${skillList(e.skills)}`;
    }
  }
  function renderBattle() {
    renderHud();
    renderControls();
    renderHand();
    renderEncounter();
    renderInfo();
  }

  // ---------- 캔버스 ----------
  function drawToken(x, y, o) {
    const r = o.big ? 30 : 21;
    ctx.save();
    if (o.alpha) ctx.globalAlpha = o.alpha;
    ctx.fillStyle = o.side ? '#e8436b' : '#2f6fd6';
    ctx.beginPath(); ctx.arc(x + 3, y + 3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.flash ? '#ffffff' : o.color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = o.elite || o.big ? 3.5 : 2.5; ctx.strokeStyle = '#232a3b'; ctx.stroke();
    if (o.big) {
      // 왕관
      ctx.fillStyle = '#f5c400'; ctx.strokeStyle = '#232a3b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 14, y - r + 2); ctx.lineTo(x - 14, y - r - 12); ctx.lineTo(x - 7, y - r - 4); ctx.lineTo(x, y - r - 14); ctx.lineTo(x + 7, y - r - 4); ctx.lineTo(x + 14, y - r - 12); ctx.lineTo(x + 14, y - r + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (o.elite) {
      ctx.strokeStyle = '#f5c400'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fffdf7';
    ctx.font = `${o.big ? 28 : 19}px Jua, "Gowun Dodum", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.label, x, y + 1);
    // 바라보는 방향 표시
    if (o.dir) {
      const [fx, fy] = o.dir, tx = x + fx * (r + 5), ty = y + fy * (r + 5);
      ctx.fillStyle = '#232a3b';
      ctx.beginPath(); ctx.moveTo(tx + fx * 5, ty + fy * 5); ctx.lineTo(tx - fy * 5, ty + fx * 5); ctx.lineTo(tx + fy * 5, ty - fx * 5); ctx.closePath(); ctx.fill();
    }
    if (o.star > 1) { ctx.fillStyle = '#c48a00'; ctx.font = '11px sans-serif'; ctx.fillText('★'.repeat(o.star), x, y - r - 6); }
    if (o.skills && o.skills.length) {
      const n = o.skills.length;
      o.skills.forEach((c, k) => {
        const sx = x - (n - 1) * 6 + k * 12, sy = y + r + 7;
        ctx.fillStyle = c; ctx.strokeStyle = '#232a3b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 5); ctx.lineTo(sx - 5, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }
    if (o.stun) { ctx.strokeStyle = '#f5c400'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    if (o.slow) { ctx.strokeStyle = '#6aa8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    if (o.taunt) { ctx.fillStyle = '#f5c400'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('!', x + r, y - r); }
    if (o.selected) { ctx.strokeStyle = '#232a3b'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x - CS / 2 + 4, y - CS / 2 + 4, CS - 8, CS - 8); ctx.setLineDash([]); }
    if (o.glow) { ctx.strokeStyle = o.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 6 + Math.sin(performance.now() / 160) * 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function fillCell(i, color, alpha, inset = 3) {
    const c = grid.cells[i];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(c.x - CS / 2 + inset, c.y - CS / 2 + inset, CS - inset * 2, CS - inset * 2);
    ctx.globalAlpha = 1;
  }
  function draw() {
    if (!B || $('battle').hidden) return;
    const pal = ACTS[R.act].palette;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = pal.ground; ctx.fillRect(0, 0, W, H);
    for (const c of grid.cells) {
      const mine = c.r >= PLAYER_ROW;
      ctx.fillStyle = (mine ? pal.mine : pal.foe)[(c.r + c.c) % 2];
      ctx.fillRect(c.x - CS / 2 + 2, c.y - CS / 2 + 2, CS - 4, CS - 4);
    }
    ctx.strokeStyle = '#232a3b'; ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 10, CS * COLS, CS * ROWS);
    ctx.beginPath(); ctx.moveTo(10, 10 + CS * PLAYER_ROW); ctx.lineTo(10 + CS * COLS, 10 + CS * PLAYER_ROW); ctx.stroke();

    const prep = B.phase === 'prep';
    const sel = B.sel ? CARDS[B.sel.id] : null;
    // 배치 가능 칸 / 스킬 범위 미리보기
    if (prep && sel && sel.kind === 'unit') {
      for (const c of grid.cells) if (c.r >= PLAYER_ROW && !playedAt(c.i)) {
        ctx.strokeStyle = '#2f6fd6'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
        ctx.strokeRect(c.x - CS / 2 + 7, c.y - CS / 2 + 7, CS - 14, CS - 14); ctx.setLineDash([]);
      }
      if (B.hover != null && isMine(B.hover) && !playedAt(B.hover)) fillCell(B.hover, '#2f6fd6', 0.25);
    }
    if (prep && sel && sel.kind === 'skill' && B.hover != null) {
      const p = playedAt(B.hover);
      if (p && skillFits(B.sel, p)) {
        const fake = { cell: p.cell, side: 0 };
        const tgtCell = rel(p.cell, Math.min(3, Math.max(1, CARDS[p.c.id].range)), 0, [0, -1]);
        const t = { cell: tgtCell >= 0 ? tgtCell : p.cell };
        let cells = [];
        if (['facing', 'self', 'line', 'selfOnly', 'targetFacing', 'target', 'single'].includes(sel.mode)) cells = skillCells(fake, t, sel, [0, -1]);
        const col = ['heal', 'shield', 'haste', 'buff'].includes(sel.effect) ? '#2e9e6b' : CLASSES[sel.cls].color;
        for (const i of cells) fillCell(i, col, 0.35);
      }
    }
    if (B.combat) {
      const cb = B.combat;
      // 예고 장판
      for (const tl of cb.tele) {
        const k = Math.min(1, tl.t / tl.delay);
        for (const i of tl.cells) {
          const c = grid.cells[i];
          fillCell(i, tl.color, 0.18 + 0.1 * Math.sin(performance.now() / 70));
          ctx.globalAlpha = 0.55; ctx.fillStyle = tl.color;
          const h = (CS - 6) * k;
          ctx.fillRect(c.x - CS / 2 + 3, c.y + CS / 2 - 3 - h, CS - 6, h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = tl.color; ctx.lineWidth = 2; ctx.strokeRect(c.x - CS / 2 + 3, c.y - CS / 2 + 3, CS - 6, CS - 6);
        }
      }
      for (const f of cb.fx) if (f.kind === 'tile') fillCell(f.cell, f.color, 0.6 * (1 - f.t / f.life), 2);
      const alive = cb.units.filter((u) => !u.dead).sort((a, b) => a.py - b.py);
      for (const e of alive) {
        const o = AC.lungeOffset(e);
        const dir = e.target && !e.target.dead ? facing(e, e.target) : null;
        drawToken(e.px + o.x, e.py + o.y, {
          side: e.side, color: e.color, label: e.label, star: e.star, flash: e.flash > 0, stun: e.stun > 0, slow: e.slowT > 0, taunt: e.forcedT > 0,
          big: e.big, elite: e.elite, dir: e.big ? null : dir, skills: e.side ? null : e.skills.map((s) => CLASSES[s.def.cls].color),
          selected: B.info && B.info.e === e,
        });
      }
      for (const e of alive) AC.drawBars(ctx, e, { hpAlly: '#2f6fd6', hpEnemy: '#e8436b', mana: '#f5c400', back: '#232a3b', w: e.big ? 64 : 42, off: e.big ? 50 : 34, hpH: e.big ? 6 : 5, manaH: 3 });
      AC.drawFx(ctx, cb, { font: 'Jua, sans-serif' });
      const boss = cb.units.find((u) => u.boss);
      if (boss) {
        $('bossbar').hidden = false;
        $('bossName').textContent = boss.def.name + (B.phaseText ? ' — ' + B.phaseText : '');
        $('bossFill').style.width = Math.max(0, (100 * boss.hp) / boss.maxHp) + '%';
        $('bossHp').textContent = Math.max(0, Math.round(boss.hp)) + ' / ' + boss.maxHp;
      }
    } else {
      $('bossbar').hidden = true;
      for (const x of B.enemies) {
        const c = grid.cells[x.cell];
        drawToken(c.x, c.y, { side: 1, color: x.def.color, label: x.def.boss ? BOSS_LABEL[x.def.boss] : x.def.name[0], big: !!x.def.boss, elite: !!x.def.elite, alpha: 0.9, selected: B.info && B.info.en === x });
      }
      for (const p of B.played) {
        if (drag.dragging && drag.obj === p) continue;
        const c = grid.cells[p.cell];
        const glow = sel && sel.kind === 'skill' && skillFits(B.sel, p) ? CLASSES[sel.cls].color : null;
        drawToken(c.x, c.y, { side: 0, color: CLASSES[CARDS[p.c.id].cls].color, label: CARDS[p.c.id].name[0], star: p.c.star, skills: p.skills.map((s) => CLASSES[CARDS[s.id].cls].color), glow, selected: B.info && B.info.p === p, dir: [0, -1] });
      }
      if (drag.dragging && drag.obj) { const p = drag.obj; drawToken(drag.pt.x, drag.pt.y, { side: 0, color: CLASSES[CARDS[p.c.id].cls].color, label: CARDS[p.c.id].name[0], star: p.c.star }); }
    }
  }

  // =====================================================================
  // 타이틀 / 엔딩
  // =====================================================================
  function ending(win) {
    clearSave();
    show('ending');
    $('endTitle').textContent = win ? '흑룡 토벌 성공!' : '원정 실패';
    $('endText').textContent = win ? '아자르가 쓰러지고 화산이 잠잠해졌다. 원정대의 이름이 노래로 남을 것이다.' : `${R.act}막 ${ACTS[R.act].name}에서 원정이 끝났다.`;
    $('endStats').innerHTML = [
      ['플레이 시간', fmtTime(R.stats.time)], ['전투 승리', R.stats.wins + ' / ' + R.stats.battles], ['정예 처치', R.stats.elites], ['보스 처치', R.stats.bosses],
      ['처치한 적', R.stats.kills], ['최종 덱', R.deck.length + '장'], ['유물', R.relics.length + '개'],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('endDeck').innerHTML = R.relics.map((id) => `<span class="pill relic">${RELICS[id].name}</span>`).join('') + R.deck.map((c) => `<span class="pill ${CARDS[c.id].kind}">${cardName(c)}</span>`).join('');
  }
  function title() {
    show('title');
    const fan = $('fan');
    fan.innerHTML = '';
    for (const id of ['fire', 'squire', 'cross']) fan.appendChild(cardEl({ uid: 0, id, star: 1, up: false }));
    const s = loadSave();
    $('continue').hidden = !s;
    if (s) $('continue').textContent = `이어하기 — ${s.act}막 · 체력 ${s.hp}/${s.maxHp}`;
  }
  $('newRun').onclick = () => { clearSave(); R = new Run(); R.visited = []; curNode = null; showMap(); };
  $('continue').onclick = () => { R = new Run(loadSave()); curNode = null; showMap(); };
  $('again').onclick = title;
  $('deckBtn').onclick = () => { rebindAfterDeck = () => {}; showDeck(); };

  // =====================================================================
  // 루프
  // =====================================================================
  AC.loop((dt) => {
    if (R && $('title').hidden && $('ending').hidden) R.stats.time += dt;
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
      B.resultT -= dt;
      if (B.resultT <= 0) { B.phase = 'done'; afterBattle(); }
    }
    draw();
  });

  // 밸런스 시뮬레이션(디버그): 주어진 덱으로 전투를 즉시 계산
  function simBattle(kind, act, deck, floor = 2, relics = []) {
    R = new Run();
    R.act = act;
    R.relics = relics;
    R.deck = deck.map((x) => { const up = x.endsWith('+'), [id, st] = x.replace('+', '').split('*'); return { uid: AC.uid(), id, star: +(st || 1), up }; });
    curNode = { row: floor, type: kind };
    startBattle(kind);
    autoDeploy();
    fight();
    const cb = B.combat;
    while (!cb.done) cb.step(1 / 30);
    const res = { won: cb.winner === 0, t: cb.t, left: cb.alive(0).length, foeLeft: cb.alive(1).length, bossHp: (() => { const b = cb.units.find((u) => u.boss); return b ? Math.max(0, b.hp) / b.maxHp : 0; })(), allies: cb.units.filter((u) => u.side === 0).length };
    B = null;
    return res;
  }

  // 테스트/디버그용 핸들
  window.__exp = { simBattle, get R() { return R; }, get B() { return B; }, autoDeploy, fight, enterNode, reachable, finishNode, nodeById, CARDS };
  title();
})();
