# [작업 요청] Paper Token Forces — 모든 스킬·고유기·무기 이펙트 만들기

## 0. 저장소와 브랜치
- 저장소 `Molecova/jules_game`, 브랜치 `ccr-5e12923f-aw0cjb`. **작업 전에 반드시 최신을 pull** 하고, 끝나면 같은 브랜치에 커밋·푸시해 주세요(다른 사람이 같은 브랜치에서 작업 중).
- 게임: `v4/index.html`(바닐라 JS, 캔버스). 관련 파일
  - `v4/battle4.js` — 전투 규칙. 스킬 실행은 `execSkill()`, 기본 공격 훅은 `hooks()` 안의 `onAttack`/`onHit`/`onTick`.
  - `v4/vfx4.js` — 스킬 이펙트 모듈 `VFX4`(종이·잉크 스타일). 지금은 `cross, pierce, fire, chain, meteor, light, barrier, shadowstep, revive` 몇 개만 전용 연출이 있고 나머지는 거의 없다.
  - `v4/projectiles4.js` — 기본 공격 투사체 모양 `SHOTS4`(유닛별). 근접 공격은 `impact`만 있다.
  - `v4/game4.js` — 그리기. `fx.skill(id, data)` → `B.vfx.skills.emit(id, data)`(1590줄 근처에서 `draw(ctx,'under'|'over')`), 투사체는 `SHOTS4.draw`.
  - 데이터: `v4/data4.js`(유닛 고유기 `ULT`, 스킬 `SKILLS`, 아이템 `ITEMS`/`ITEM_ACT`).

## 1. 목표
아래 표(5장)에 있는 **모든 고유기·스킬 칩·아이템 액티브**, 그리고 **무기(아이템)에서 나가는 효과**(기본 공격 모양, 공격 시 발동하는 패시브)에 알아볼 수 있는 이펙트를 만든다. 플레이어가 "무슨 기술이 어디에 맞았는지"를 한눈에 알 수 있어야 한다.

## 2. 꼭 지킬 규칙(어기면 테스트가 깨짐)
1. **전투 결과를 절대 바꾸지 않는다.** 이펙트는 그리기 전용. 피해·위치·타이밍·상태값을 읽기만 하고 쓰지 않는다.
2. **난수 금지.** 이펙트 코드에서 `Math.random()`·전투 난수(`cb.random`, `env.random`)를 쓰지 않는다. 흔들림·파편 배치는 `vfx4.js`의 `noise(i, seed)` 처럼 결정적인 값으로. (`tests/vfx4.test.cjs`가 이펙트를 켰을 때와 껐을 때 전투 상태와 `Math.random` 호출 횟수가 같은지 검사한다.)
3. 이벤트는 지금처럼 `if (fx.skill) fx.skill(id, data)` 로만 보낸다. `data`는 `visualData()` 모양 `{ source, target, dir, star, cells:[{x,y}], points:[{x,y}], ...extra }` 를 따른다. 새 정보가 필요하면 `extra`에 넣는다.
4. `B.sim`(시뮬레이션), `B.skipping`(빨리 넘기기), `prefers-reduced-motion` 일 때는 이벤트를 만들지 않거나 아주 짧게(지금 `game4.js`의 처리 방식 유지).
5. 성능: 동시에 살아 있는 이펙트 수 상한(지금 48개, `burst traffic is bounded` 테스트) 유지. 휴대폰에서 60fps. 오래 가는 이펙트(장판·오라)는 매 프레임 새로 만들지 말고 하나를 재사용.
6. 스타일: 종이 딱지 보드게임. 굵은 잉크 외곽선(`INK = '#232a3b'`) + 종이 조각·도장·붓 획. 이미 있는 도우미(`ring, star, hex, scraps, rune, outlined`)를 활용하고 새 도우미는 같은 파일에 추가. 이미지·외부 파일 금지(캔버스 드로잉만).
7. 색: 전사 `#79d4ed` 계열, 궁수 `#37896a`/초록·황토, 마법사 `#a282d4`/보라, 화염 `#ef6b38`, 얼음 `#7dcfff`, 독 `#7fbf4a`, 회복 `#7dffa0`, 보호막 `#9fd0ff`, 금색 강조 `#f5c400`. 별(★)이 높을수록 조금 더 크고 화려하게(`data.star`).

## 3. 해야 할 일
### 3-1. 이벤트가 빠진 곳 채우기 (`battle4.js`)
`execSkill()`의 많은 분기가 아직 `visual()` 을 부르지 않는다(예: `zone, blind, windwalk, aim, explosive, bind, storm, sure, lifelink, thornshield, polymorph, surge, invuln, meteors, berserk, bladeAura, rally, smite, haste, guard, mana, markRandom, curse, summon, front, boomerang` 등). 모든 분기에서 **실제로 맞은 칸·대상**으로 `visual(cells, points, extra)` 을 한 번씩 보내도록 추가한다. 지연 공격(`cb.later`, `cb.tele`)은 `phase: 'warn'` → `phase: 'impact'` 두 번(지금 메테오 방식).

### 3-2. 스킬·고유기·아이템 액티브 연출 (`vfx4.js`)
- 5장 표의 **모든 id**에 전용 연출. 같은 계열은 공통 함수로 묶되(베기·관통·폭발·회복·보호막·버프·디버프·소환·순간이동) id마다 색·모양·소리 같은 차이를 준다.
- 고유기(`u_…`)는 칩보다 한 단계 크게(시전자 발밑 원형 도장 + 이름 띠 등).
- 지금 `u_bishop` 을 `barrier` 로 돌려쓰는 식의 임시 매핑은 전용 연출로 바꾼다.

### 3-3. 상태 표시(지속 효과) — 그리기만
`game4.js` 의 유닛 그리기에서 `u.st` 를 **읽기만** 해서 작은 아이콘·오버레이를 그린다:
`root`(덩굴/그물), `silence`(말풍선 X), `chill`(서리), `antiheal`(깨진 하트), `marked`(과녁 + 남은 횟수), `blind`(연기), `link`(두 적을 잇는 사슬 선), `reflect`(가시 테두리), `invuln`(얼음 껍질), `hot`(초록 잎 맴돌기), `blades`(칼날 3~4개가 도는 오라), `storm`(바람 소용돌이), `sure`(금색 조준경), `surge`(보라 불꽃), `ww`(바람 잔상), `fort`(돌 방패), `haste`(속도선), `burn/poison/bleed`(이미 있는 `STATUS_MARK` 확장), 장판 `cb.zones`(독 구름), 변이(기절 중이면서 `'양!'` → 양 실루엣).

### 3-4. 무기에서 나가는 이펙트
- **기본 공격 모양을 무기에 따라 바꾼다.** 지금은 유닛별(`SHOTS4.profile(src)`). 아이템을 든 아군이면 아이템 `shape` 를 우선한다: `sword, greatsword, twin, dagger, mace, hammer, shield, tower` 는 근접 휘두르기 궤적(검은 호, 망치는 내려찍기 충격파, 쌍검은 두 줄, 단검은 찌르기), `bow` 는 화살 색·깃털, `wand/staff/orb/book/grail/ring/tooth/cloak` 는 마력탄 모양·색. 근접 휘두르기는 새로 `SHOTS4`(또는 `vfx4`)에 추가하고, `onAttack` 에서 그리기 이벤트만 보낸다.
- **공격 시 발동하는 패시브(아이템 fx)** 에 작은 이펙트: `cleave`(주변 튐 파편), `venomStack`(독 방울 + 겹 수), `multiHit`(잔상 연타), `hookRoot`(갈고리 사슬), `vampire`/`bloodthirst`/흡혈귀 칩(붉은 흡혈 줄기), `guardHeal`(방패 → 아군 초록 선), `longshot`(먼 거리 명중 시 금색 스파크), `venomBonus`, `burnCrit`, `poisonHit`, `burnHit`, `stormHit`(번개 갈래), `multiShot`(갈라지는 화살), `ambush`(첫 공격 확정 치명 섬광), `healMace`/`healer`(회복 선), `echo`(메아리 잔상), `hourglass`(모래 알갱이), `lastStand`(금빛 방패), `deadeye`, `spellBurn`/`spellSlow`/`spellLeech`/`abyss`. 그리고 고유 효과: 용병 `doubleHit`(연타), 용기사 `burnAdd`(기본 공격 화염 덧칠, 누적될수록 진하게), 광전사 `frenzy`(체력이 낮을수록 붉은 김).
- 발동 지점은 `battle4.js` 의 `onAttack`/`onHit` 에서 해당 효과가 실제로 일어나는 줄 바로 옆에 `fx.proc?.(kind, data)` 같은 **그리기 전용 콜백**을 새로 만들어 보낸다(`createBattleApi` 의 `fx` 객체에 `proc` 추가, `B.sim`/`B.skipping` 이면 무시).

## 4. 검증(푸시 전에 전부 통과)
- `node --test tests/*.test.cjs` 전부 통과. `tests/vfx4.test.cjs` 의 `IDS` 를 늘려 **새로 만든 id 전부**에 대해 "이펙트 켜기/끄기 결과 동일 + 이벤트 1회 + 칸 좌표 유효 + 끝나면 해제" 를 검사.
- 브라우저 테스트(`tests/browser-*.cjs`, 루트에서 `python3 -m http.server 8000` 후 실행) 통과.
- 각 클래스로 한 판씩 직접 돌려 보며 캡처: 고유기 연출, 칩 연출, 무기 기본 공격, 상태 아이콘이 보이는지.
- `docs/` 에 변경 기록(어떤 id가 어떤 연출인지 표) 추가.

## 5. 대상 목록 (게임 데이터에서 자동 생성)
### A. 유닛 고유기 (이벤트 id = u_<유닛id>)

| id | 유닛 | 고유기 | 모드/효과 | 설명 |
|---|---|---|---|---|
| u_squire | 견습 검사 | 돌진 베기 | facing/dmg/2칸 | 앞 2칸을 벤다 |
| u_shieldman | 방패병 | 방패 세우기 | selfOnly/shield | 자신 보호막 250 |
| u_hammer | 망치 전사 | 내려찍기 | single/dmg | 공격 중인 대상을 내려찍고 1.5초 기절 |
| u_duelist | 결투가 | 일격 | facing/dmg/3칸 | 앞 3칸을 꿰뚫어 벤다 |
| u_warden | 기사단장 | 수호 진형 | selfOnly/guard | 모든 전사 아군 4초간 받는 피해 −30% |
| u_paladin | 성기사 | 신성한 망치 | self/lightrain/25칸 | 주변 2칸(5×5)을 휘둘러 적 피해, 같은 범위 아군 125 회복 |
| u_blademaster | 용기사 | 용의 숨결 | facing/dmg/6칸 | 앞쪽 2×3 화염 + 4초 화상(초당 45). 쓸 때마다 이번 전투 동안 기본 공격에 화상 피해 +30 |
| u_archer | 견습 궁수 | 집중 사격 | volley/dmg | 대상에게 화살 3연사 |
| u_venom | 정찰병 | 독침 | single/dmg | 대상 피해 + 6초 중독(초당 20) + 1초 둔화 |
| u_crossbow | 석궁병 | 관통 볼트 | facing/dmg/4칸 | 앞으로 4칸을 꿰뚫는 볼트 |
| u_scout | 척후병 | 속사 | selfOnly/haste | 4초간 자신 공격 속도 +30% |
| u_hunter | 매사냥꾼 | 매 부르기 | selfOnly/summon | 매를 부른다(이미 있으면 매 체력 회복) |
| u_arbalest | 석궁 기사 | 연쇄 볼트 | volley/dmg | 무작위 적 2명에게 볼트 |
| u_ranger | 레인저 | 마무리 사격 | lowest/dmg | 체력 비율이 가장 낮은 적에게 강한 화살. 맞고 체력 25% 이하면 처형(보스 제외) |
| u_windarcher | 바람 궁수 | 돌풍 화살 | front/dmg | 맨 앞의 적 2명에게 돌풍 화살, 맞은 적은 뒤로 2칸 밀려난다 |
| u_ninja | 엘프 명궁 | 화살 난사 | volley/dmg | 무작위 적에게 화살 10발 |
| u_apprentice | 견습 마법사 | 마력탄 | single/dmg | 대상에게 마력탄 |
| u_acolyte | 약초꾼 | 약초 뿌리기 | lowestAlly/heal | 체력 비율이 가장 낮은 아군 300 회복 |
| u_monk | 학자 | 지식의 흐름 | selfOnly/mana | 가장 가까운 아군 2명 마나 +50 |
| u_pyro | 화염술사 | 화염구 | target/dmg/5칸 | 대상과 상하좌우 1칸(5칸)에 화염 + 3초 화상(초당 25) |
| u_cryo | 점성술사 | 별자리 표식 | selfOnly/markRandom | 무작위 적 2명 4초간 받는 피해 +40% |
| u_summoner | 소환술사 | 골렘 소환 | selfOnly/summon | 돌 골렘 소환(이미 있으면 골렘 체력 회복) |
| u_archmage | 대마법사 | 빙결 | selfOnly/markRandom | 무작위 적 2명 2초간 빙결(기절), 그동안 받는 피해 +30% |
| u_warlock | 흑마법사 | 저주의 낙인 | selfOnly/curse | 공격력이 가장 높은 적 둘에게 피해 + 6초 약화, 준 피해의 50% 회복 |
| u_bishop | 현자 | 성스러운 빛 | selfOnly/smite | 무작위 적 1명에게 피해 500, 체력 비율이 가장 낮은 아군 500 회복 |

패시브만 있는 유닛(고유기 없음): 용병(merc), 광전사(berserker)

### B. 스킬 칩 (이벤트 id = 칩 id)

| id | 클래스·등급 | 이름 | 모드/효과 | 설명 |
|---|---|---|---|---|
| cross | 전사 1 | 십자 베기 | facing/dmg/4칸 | 앞 2칸과 앞칸 양옆 1칸을 벤다 |
| bash | 전사 1 | 방패 강타 | facing/dmg/1칸 | 바로 앞 적에게 피해 + 1.5초 기절 |
| bleedcut | 전사 1 | 기력 베기 | facing/dmg/3칸 | 앞쪽 3칸을 베고 준 피해의 절반만큼 회복 |
| taunt | 전사 1 | 도발 | self/taunt/24칸 | 주변 2칸 적이 3초간 자신만 노린다. 보호막 260 |
| whirl | 전사 2 | 회전 베기 | self/dmg/8칸 | 주변 8칸을 두 번 벤다(한 번에 위력 150) |
| wall | 전사 2 | 방벽 세우기 | self/shield/5칸 | 자신 보호막 300, 같은 줄 좌우 2칸 아군 보호막 150 |
| fortify | 전사 2 | 요새화 | selfOnly/fortify | 4초간 받는 피해 −30%, 초당 체력 40 회복 |
| charge | 전사 2 | 돌격 | leap/dmg | 체력이 가장 낮은 적 옆으로 뛰어들어 베고 0.8초 기절 |
| shadowstep | 전사 2 | 그림자 걸음 | leap/dmg | 체력이 가장 낮은 적 뒤로 순간이동해 베고 출혈 |
| bladestorm | 전사 3 | 검의 폭풍 | selfOnly/bladeAura | 5초간 자신 주변 8칸에 칼날. 닿은 적은 10초 출혈(초당 50) |
| bulwark | 전사 3 | 불굴의 함성 | self/rally/24칸 | 자신과 주변 2칸 아군 4초간 받는 피해 −30%, 0.5초마다 체력 30 회복 |
| earth | 전사 3 | 대지 가르기 | facing/dmg/6칸 | 앞으로 4칸 + 2칸째 양옆. 1.2초 기절 |
| assassinate | 전사 3 | 핵펀치 | lowest/dmg | 체력 비율이 가장 낮은 적에게 확정 치명 + 3초 기절 |
| vampire | 전사 3 | 흡혈귀 | selfOnly/passive | 패시브: 기본 공격으로 준 피해의 5%만큼 회복(★2 10% · ★3 15%) |
| shatter | 전사 4 | 파쇄 일격 | facing/dmg/9칸 | 앞쪽 3×3을 내려찍고 1초 기절 |
| execution | 전사 4 | 처형 | leap/dmg | 체력 비율이 가장 낮은 적 옆으로 순간이동해 벤다. 체력 절반 이하면 피해 ×2 |
| quakeking | 전사 5 | 대지 붕괴 | all/dmg | 모든 적 피해 + 1.5초 기절 |
| healarrow | 궁수 1 | 치유 화살 | lowestAlly/heal | 가장 다친 아군에게 치유 화살(130 회복) |
| spread | 궁수 1 | 산탄 사격 | targetFacing/dmg/3칸 | 대상과 그 양옆 1칸 |
| firearrow | 궁수 1 | 불화살 | single/dmg | 대상에게 불화살 + 3초 화상(초당 30) |
| anklearrow | 궁수 1 | 발목 화살 | single/dmg | 대상에게 화살 + 2초간 이동 불가 |
| marktarget | 궁수 1 | 표적 지정 | single/dmg | 대상을 표시. 그 적을 때리는 아군 기본 공격 3번이 확정 치명(8초) |
| bless | 궁수 2 | 축복의 화살 | ally/buff | 공격력이 가장 높은 아군 6초간 주는 피해 +30%, 공격 속도 +20% |
| poisoncloud | 궁수 2 | 독 구름 화살 | target/zone/9칸 | 대상 중심 3×3에 4초 독 구름. 안에 있는 적 중독(초당 30) |
| boomerang | 궁수 2 | 부메랑 화살 | boomerang/dmg | 대상까지 갔다 돌아오며 지나가는 적마다 위력 100씩 두 번 |
| smoke | 궁수 2 | 연막탄 | target/blind/9칸 | 대상 중심 3×3 적 3초간 기본 공격이 빗나감(★1 30% · ★2 50% · ★3 70%) |
| windwalk | 궁수 2 | 바람 걸음 | selfOnly/windwalk | 자신 3초간 회피 +40%, 공격 속도 +20% |
| rain | 궁수 3 | 화살비 | target/dmg/9칸 | 대상 중심 3×3 |
| horn | 궁수 3 | 지휘 나팔 | all/haste | 모든 아군 5초간 공격 속도 +20%(★마다 +8%p) |
| antiheal | 궁수 3 | 치유 차단 화살 | single/dmg | 대상 6초간 받는 회복 −80%, 보호막을 받지 못함 |
| net | 궁수 3 | 그물 화살 | target/dmg/9칸 | 대상 중심 3×3 적 위력 80 + 2초간 이동 불가 |
| aimedshot | 궁수 4 | 조준 저격 | selfOnly/aim | 2초 조준 뒤 체력이 가장 높은 적에게 위력 900 |
| explosive | 궁수 4 | 폭발 화살 | single/explosive | 대상에게 위력 250, 2초 뒤 대상 중심 3×3에 위력 250 폭발 |
| bindchain | 궁수 4 | 결박 사슬 | single/bind | 대상과 가장 가까운 적을 묶는다. 6초간 한쪽이 받는 피해의 50%를 다른 쪽도 받음 |
| stormeye | 궁수 5 | 폭풍의 눈 | selfOnly/storm | 5초간 공격 속도 ×2, 기본 공격이 대상 주변 1칸 적에게도 50% |
| sureshot | 궁수 5 | 신궁 | selfOnly/sure | 5초간 기본 공격 전부 확정 치명 + 치명 피해 +100% |
| ice | 마법사 1 | 얼음 창 | line/dmg | 끝까지 관통 + 2초 둔화 |
| ignite | 마법사 1 | 점화 | single/dmg | 대상 3초 화상(초당 40) |
| manashield | 마법사 1 | 마나 방패 | lowestAlly/shield | 체력 비율이 가장 낮은 아군 보호막 150 |
| frosttouch | 마법사 1 | 서리 손길 | single/dmg | 대상 위력 80 + 2초간 공격 속도 −30% |
| spark | 마법사 1 | 전류 | chain/dmg | 대상과 가장 가까운 적 1명에게 위력 70씩 |
| chain | 마법사 2 | 연쇄 번개 | chain/dmg | 대상에서 가까운 적으로 4번 튄다 |
| frostnova | 마법사 2 | 서리 폭발 | self/dmg/8칸 | 주변 8칸 피해 + 1.2초 빙결 |
| silence | 마법사 2 | 침묵 | single/dmg | 대상 위력 100 + 2.5초간 고유기·능력 사용 불가 |
| lifelink | 마법사 2 | 생명 연결 | selfOnly/lifelink | 체력 비율이 가장 낮은 아군과 가장 높은 아군의 체력 비율을 평균으로 맞춘다 |
| thornshield | 마법사 2 | 가시 보호막 | selfOnly/thornshield | 적과 가장 가까운 아군 보호막 200 + 4초간 받는 피해 30% 반사 |
| meteor | 마법사 3 | 메테오 | target/tele/9칸 | 1.2초 뒤 대상 중심 3×3에 운석 + 화상 |
| blizzard | 마법사 3 | 눈보라 | target/dmg/9칸 | 대상 중심 3×3 피해 + 4초 둔화 + 약화 |
| aegis | 마법사 3 | 신의 가호 | all/shield | 모든 아군 보호막 135 + 회복 135 |
| timewarp | 마법사 3 | 시간 왜곡 | all/timewarp | 모든 아군 5초간 공격 속도 +25%, 모든 적 3초 둔화 |
| polymorph | 마법사 3 | 변이 | selfOnly/polymorph | 체력이 가장 높은 적(보스 제외)을 3초간 양으로. 행동 불가, 받는 피해 +20% |
| thunder | 마법사 4 | 뇌우 | chain/dmg | 대상에서 가까운 적으로 7번 튀고 0.5초 기절 |
| manasurge | 마법사 4 | 마력 폭주 | selfOnly/surge | 6초간 자신 스킬 대기시간 2배 속도, 고유기 마나 2배로 참 |
| iceblessing | 마법사 4 | 얼음 축복 | selfOnly/invuln | 체력 비율이 가장 낮은 아군 3초 무적 |
| cataclysm | 마법사 5 | 종말의 불꽃 | target/tele/25칸 | 1초 뒤 대상 중심 5×5에 불벼락 + 4초 화상(초당 70) |
| meteorshower | 마법사 5 | 운석 낙하 | selfOnly/meteors | 3초 동안 무작위 적 위치에 운석 6개, 각각 3×3 위력 250 |
| aid | 공용 1 | 응급 처치 | selfOnly/heal | 자신 체력 220 회복 |
| warcry | 공용 1 | 전투 함성 | selfOnly/haste | 자신과 가장 가까운 아군 1명 6초간 공격 속도 +15% |
| heavy | 공용 1 | 혼신의 일격 | single/heavy | 대상에게 공격력 ×1.8 피해 |
| adrenaline | 공용 2 | 아드레날린 | selfOnly/haste | 자신 5초간 공격 속도 +60% |
| secondwind | 공용 2 | 재정비 | selfOnly/shield | 자신 보호막 300 + 해로운 효과 제거 |
| resolve | 공용 4 | 결의 | selfOnly/berserk | 자신 체력을 20%로 낮추고 6초간 공격 속도 +100% |

### C. 아이템 (무기 모양 shape · 액티브 이벤트 id = a_<아이템id> · 패시브 효과 fx)

| id | 클래스·등급 | 이름 | shape | 액티브 | 패시브 fx | 설명 |
|---|---|---|---|---|---|---|
| longsword | 전사 1 | 장검 | sword | a_longsword (베어 넘기기, facing/dmg/3칸) | — | 공격력 +20%. 8초마다 앞쪽 3칸 베기 |
| buckler | 전사 1 | 둥근 방패 | shield | a_buckler (방패 막기, selfOnly/shield) | — | 체력 +14%, 받는 피해 −10%. 10초마다 자신 보호막 |
| twinblades | 전사 2 | 쌍단검 | twin | — | ambush | 공격 속도 +20%, 치명 +15%, 치명 피해 +25%. 첫 3번 공격은 확정 치명(기습) |
| holymace | 전사 2 | 성스러운 철퇴 | mace | — | healMace | 체력 +10%. 공격할 때마다 가장 다친 아군을 공격력의 25%만큼 회복 |
| greatsword | 전사 3 | 피의 대검 | greatsword | — | bloodthirst | 공격력 +20%, 흡혈 15%. 체력 50% 이하에서는 흡혈 25% |
| warhammer | 전사 2 | 전쟁 망치 | hammer | — | cleave | 공격력·체력 +10%. 공격하면 대상 주변 적에게도 피해 25% |
| thornmail | 전사 3 | 독 단도 | dagger | — | venomStack | 공격 속도 +30%, 치명 +5%. 공격할 때 5초 중독(초당 20), 끝없이 겹침 |
| dragonslayer | 전사 4 | 그림자 검 | sword | — | multiHit | 공격력 +25%, 치명 +10%. 기본 공격이 30% 확률로 2번, 10% 확률로 3번 |
| towershield | 전사 4 | 수호자의 탑 방패 | tower | — | guardHeal | 체력 +30%, 받는 피해 −15%. 받은 피해의 10%만큼 체력 비율이 가장 낮은 아군 회복 |
| shortbow | 궁수 1 | 단궁 | bow | a_shortbow (쌍발, volley/dmg) | — | 공격 속도 +14%. 7초마다 대상에게 화살 2발 |
| longbow | 궁수 1 | 장궁 | bow | — | longshot | 사거리 +1, 공격력 +12%. 3칸 이상 떨어진 적에게 주는 피해 +25% |
| venombow | 궁수 2 | 독궁 | bow | — | venomBonus | 공격력 +5%. 공격 시 3초 중독(초당 15). 중독된 적에게 주는 피해 +15% |
| quiver | 궁수 2 | 도적의 단검 | dagger | a_quiver (그림자 찌르기, leap/dmg) | — | 근접 공격(사거리 1), 공격력 +25%, 공격 속도 +20%, 체력 +15%. 9초마다 체력이 가장 낮은 적 옆으로 뛰어들어 찌르기 |
| whistle | 궁수 3 | 사냥매 호루라기 | tooth | — | hawkFocus | 전투 시작 시 사냥매 소환, 같은 적 연속 공격 피해 증가 |
| flamebow | 궁수 2 | 화염 활 | bow | — | burnCrit | 공격력 +12%. 공격 시 3초 화상. 화상 걸린 적에게 치명 확률 +25% |
| windcloak | 궁수 3 | 그림자 망토 | cloak | — | evasive | 근접 공격(사거리 1), 공격 속도 +20%, 회피 +20%, 체력 +10%. 회피하면 다음 공격 치명타 |
| eagleeye | 궁수 4 | 매의 눈 반지 | ring | a_eagleeye (매의 눈 저격, farthest/dmg) | headshot | 사거리 +1, 치명 +25%, 치명 피해 +40%. 10초마다 가장 먼 적 저격, 맞은 적 3초간 받는 피해 +20% |
| hornbow | 궁수 4 | 갈고리 쌍검 | twin | — | hookRoot | 근접 공격(사거리 1), 공격력 +20%, 치명 +15%, 체력 +10%. 4번째 공격마다 대상 2초 이동 불가 |
| wand | 마법사 1 | 견습 지팡이 | wand | a_wand (마력 화살, single/dmg) | — | 공격할 때마다 마나 +4, 스킬 위력 +3%. 6초마다 대상에게 마력 화살 |
| frostorb | 마법사 1 | 서리 오브 | orb | — | spellSlow | 스킬 위력 +12%. 스킬에 맞은 적 둔화 |
| firestaff | 마법사 2 | 화염 지팡이 | staff | — | spellBurn | 스킬 위력 +30%. 스킬에 맞은 적 화상 |
| prayerbook | 마법사 2 | 성서 | book | — | healer | 치유 +10%. 다친 아군이 있으면 기본 공격 대신 그 아군을 공격력의 45%만큼 치유 |
| hourglass | 마법사 3 | 시간의 모래시계 | grail | — | hourglass | 마나 25로 시작. 고유기를 쓰면 주변 1칸 아군 마나 +15, 자신 스킬 대기시간 2초 감소 |
| manaring | 마법사 2 | 마나 반지 | ring | — | manaRegen | 마나 10으로 시작. 초당 마나 +3. 장착 스킬 대기시간 −15% |
| lifeorb | 마법사 3 | 생명의 수정 | orb | — | spellLeech | 스킬 위력 +30%, 치유 +14%, 체력 +15%. 스킬 피해의 25% 회복 |
| stormstaff | 마법사 4 | 폭풍의 지팡이 | staff | — | stormHit | 스킬 위력 +18%. 기본 공격이 가까운 적 둘에게 번개(공격력 35%) |
| vampsword | 전사 5 | 흡혈귀의 검 | sword | — | vampire | 공격 속도 +100%. 전투를 체력 50%로 시작. 공격할 때마다 흡혈 +1%(전투 동안 누적) |
| archstaff | 마법사 4 | 대마법사의 지팡이 | staff | — | echo | 스킬 위력 +40%, 마나 20으로 시작. 고유기 3번마다 한 번 더(60%) |
| kingsword | 전사 보스 | 왕의 대검 | sword | — | cleave | 공격력 +30%, 체력 +20%. 공격하면 대상 주변 적에게도 피해 25% |
| aegis | 전사 보스 | 불멸의 방패 | shield | — | lastStand | 체력 +22%, 받는 피해 −6%. 체력 35% 아래로 처음 떨어지면 체력 20% 보호막 + 3초간 받는 피해 −25% |
| stormbow | 궁수 보스 | 폭풍의 활 | bow | — | multiShot | 공격 속도 +25%, 공격력 +15%. 공격할 때마다 가까운 다른 적에게 화살 한 발 더(40%) |
| dragoneye | 궁수 보스 | 용의 눈 | ring | — | deadeye | 사거리 +1, 치명 +30%, 공격력 +15%. 치명 피해 +50%, 체력 50% 이하 적에게 피해 +25% |
| philostone | 마법사 보스 | 현자의 돌 | orb | — | sageStone | 스킬 위력 +45%, 마나 30으로 시작. 초당 마나 +5 |
| abysstome | 마법사 보스 | 심연의 서 | book | — | abyss | 스킬 위력 +55%, 체력 +25%. 스킬에 맞은 적 화상, 스킬 피해의 25% 회복 |
