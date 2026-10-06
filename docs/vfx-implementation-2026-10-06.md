# 모든 기술·무기 이펙트 — 2026-10-06

`docs/gpt-vfx-prompt.md` 작업 결과. 기준 커밋 `ef18f1a`, 브랜치 `ccr-5e12923f-aw0cjb`. 시작 전 pull 완료.

## 적용

현재 데이터의 **고유기 25개 + 스킬 칩 62개 + 아이템 액티브 6개 = 93개**를 모두 연결했다. 아이템 34개의 기본 공격은 장착 아이템의 `shape`·색·깃털/문양을 우선하고, 패시브 발동 33종 및 기존 수호 등불의 부활 연출도 표시한다. 이미지나 외부 에셋을 추가하지 않았다.

- 공통 연출 계열에 id별 상징, 색, 범위, 연사 수, 이름 띠를 더했다. 고유기는 시전자 발밑 도장과 짧은 이름 띠를 가진다. 현자의 성스러운 빛은 적 타격과 아군 회복을 분리한다.
- 이벤트는 실제 전투가 선택한 대상의 좌표를 복사한다. 지연 기술은 `warn`→`impact`; 운석 낙하는 운석 6개마다 한 쌍씩 보낸다. 타격 순간의 대상도 다시 확인한다.
- `fx.skill`·`fx.proc`·`fx.attack` 콜백으로 화면에 전달한다. 새 연출·상태·무기 그리기는 전투 RNG와 `Math.random`을 호출하지 않는다. 피해·이동·상태 시간·확률·배율은 바꾸지 않았다.
- `u.st`·`cb.zones`를 읽어서 지속 효과를 그린다. 변이는 별도 시각 상태의 만료 시간만 보관하며 기존 기절 상태도 확인한다. 장판이나 오라를 매 프레임 이벤트로 생성하지 않는다.
- 살아 있는 이벤트는 최대 **48개**. 그리는 예산은 **16개**로 제한하고 고유기·예고, 일반 기술, 작은 패시브 순서로 우선한다. 짧은 시간의 같은 패시브 연출을 합친다. 한 효과의 파편·경로 수도 제한한다.
- 시뮬레이션·건너뛰기에서 이벤트를 보내지 않는다. 모션 감소 설정은 새 애니메이션을 생성하지 않고 상태 표시를 정적으로 유지한다.

## 직접 확인하는 페이지

[전체 기술 미리보기](../concepts/v4-skill-effects.html)에서 클래스·무기·패시브를 선택하고, ★1~★3 및 타임라인으로 예고·타격·지속 상태를 확인할 수 있다. 현재 데이터를 읽으므로 제거된 칩을 참조하지 않는다. 실제 게임은 [v4/index.html](../v4/index.html).

## 검증

- `node --test tests/*.test.cjs`: **272개 통과**. 모든 현재 기술의 ★1/★3와 부활, 새 패시브/근접 프로필의 그리기·만료, 실제 아이템·용병·광전사 공격을 검사한다.
- 이펙트 켜기/끄기의 HP·보호막·위치·상태·마나·피해·회복·지연 공격·난수 호출 수가 동일하다. 단일 시전 이벤트, 실제 좌표, 지연 기술의 예고/타격 및 이벤트 해제를 확인한다.
- `tests/browser-*.cjs` 전체 통과. 신규 `browser-vfx.cjs`는 기술 93개·무기 34개·패시브 33개를 실제 Canvas에서 그린다. 전사·궁수·마법사 각 한 전투를 진행·완료하고 시뮬레이션·건너뛰기·모션 감소를 확인한다.
- 기존 저장/보상 회귀, 16개 장면 × 2개 폰 화면, 1~5막 30노드/보스 5회 진행도 통과. 원정 검사는 전투 개체를 강화해 진행 연결을 검증한다. 최신 밸런스 변화에 영향을 받지 않도록 고정 시드·유효한 클래스 칩·명시적인 전투 강화를 사용한다.
- 추가 VFX 검사와 기존 게임 회귀 검사에서 JavaScript 예외 0건. 외부 폰트 CSS는 신규 VFX 검사에서 빈 응답으로 대체한다. 기존 스모크의 외부 폰트 요청 실패는 게임 스크립트 오류와 구분한다.
- Linux headless Chromium, DPR 2의 48개 합성 이펙트 스트레스 검사에서 렌더 시간은 `vfx-evidence/verification.json`에 기록한다. 이는 그리기 비용이며 휴대폰 실기기 60fps 인증은 아니다.

```sh
python3 -m http.server 8000
node --test tests/*.test.cjs
node tests/browser-smoke.cjs
node tests/browser-enemies.cjs
node tests/browser-bugfixes.cjs
node tests/browser-scenes.cjs
node tests/browser-run.cjs
node tests/browser-vfx.cjs
```

## 캡처

실제 게임의 전투 훅으로 각 클래스의 고유기·칩을 발동시킨 뒤, 확인할 프레임에서 일시 정지했다. 기본 공격은 실제 `cb.attack`과 짧은 전투 진행으로 찍었다. 연출 확인용 캡처에서 안내 도장과 숫자 떠오르기는 숨겼다. 시험 개체의 체력을 높였으며 난이도 측정용 캡처가 아니다.

| 클래스 | 고유기·칩 | 상태 표시 | 기본 공격 |
|---|---|---|---|
| 전사 | [장면](vfx-evidence/battle-war.png) | [상태](vfx-evidence/battle-war-states.png) | [무기](vfx-evidence/battle-war-weapons.png) |
| 궁수 | [장면](vfx-evidence/battle-arc.png) | [상태](vfx-evidence/battle-arc-states.png) | [무기](vfx-evidence/battle-arc-weapons.png) |
| 마법사 | [장면](vfx-evidence/battle-mag.png) | [상태](vfx-evidence/battle-mag-states.png) | [무기](vfx-evidence/battle-mag-weapons.png) |

[모바일 미리보기](vfx-evidence/catalog-mobile.png) · [데스크톱 미리보기](vfx-evidence/catalog-desktop.png) · [브라우저 검증 기록](vfx-evidence/verification.json)

## 고유기 25개

| 이벤트 id | 이름 | 연출 | 잉크 면 색 |
|---|---|---|---|
| `u_squire` | 돌진 베기 | 청록/종이 검격·타격 파편 · slash 상징 | `#79d4ed` |
| `u_shieldman` | 방패 세우기 | 육각 종이 보호막 · shield 상징 | `#9fd0ff` |
| `u_hammer` | 내려찍기 | 충격파·갈라지는 잉크 획 · quake 상징 | `#d5b170` |
| `u_duelist` | 일격 | 청록/종이 검격·타격 파편 · slash 상징 | `#79d4ed` |
| `u_warden` | 수호 진형 | 돌 방패·수호 고리 · shield 상징 | `#87a8bc` |
| `u_paladin` | 신성한 망치 | 적에게 금빛 기둥·아군에게 초록 회복 · cross 상징 | `#f5c400` |
| `u_blademaster` | 용의 숨결 | 불꽃·종이 불씨 · fire 상징 | `#ef6b38` |
| `u_archer` | 집중 사격 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#37896a` |
| `u_venom` | 독침 | 독 구름·해골·중첩 수 · skull 상징 | `#7fbf4a` |
| `u_crossbow` | 관통 볼트 | 긴 관통 궤적·촉 · arrow 상징 | `#ba974e` |
| `u_scout` | 속사 | 금빛 속도 고리·지휘 표식 · wind 상징 | `#f5c400` |
| `u_hunter` | 매 부르기 | 소환 도장·매 날개/돌 조각 · wind 상징 | `#c0af80` |
| `u_arbalest` | 연쇄 볼트 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#a4b8c8` |
| `u_ranger` | 마무리 사격 | 긴 관통 궤적·촉 · target 상징 | `#ba974e` |
| `u_windarcher` | 돌풍 화살 | 긴 관통 궤적·촉 · wind 상징 | `#ba974e` |
| `u_ninja` | 화살 난사 | 부채꼴/연사/낙하 화살 · star 상징 | `#c3b1ed` |
| `u_apprentice` | 마력탄 | 룬·마력 이동·잔상 · star 상징 | `#a282d4` |
| `u_acolyte` | 약초 뿌리기 | 초록 회복 문양·하트/화살 · heart 상징 | `#84af62` |
| `u_monk` | 지식의 흐름 | 룬·마력 이동·잔상 · drop 상징 | `#a282d4` |
| `u_pyro` | 화염구 | 불꽃·종이 불씨 · fire 상징 | `#ef6b38` |
| `u_cryo` | 별자리 표식 | 조준경·별자리/집중 표식 · star 상징 | `#f5c400` |
| `u_summoner` | 골렘 소환 | 소환 도장·매 날개/돌 조각 · quake 상징 | `#c0af80` |
| `u_archmage` | 빙결 | 얼음 결정·서리 눈꽃 · ice 상징 | `#7dcfff` |
| `u_warlock` | 저주의 낙인 | 붉은 흡혈 줄기·낙인 · skull 상징 | `#b85b7e` |
| `u_bishop` | 성스러운 빛 | 적에게 금빛 기둥·아군에게 초록 회복 · cross 상징 | `#f5c400` |

## 스킬 칩 62개

| 이벤트 id | 이름 | 연출 | 잉크 면 색 |
|---|---|---|---|
| `cross` | 십자 베기 | 청록/종이 검격·타격 파편 · slash 상징 | `#79d4ed` |
| `whirl` | 회전 베기 | 청록/종이 검격·타격 파편 · whirl 상징 | `#79d4ed` |
| `bladestorm` | 검의 폭풍 | 회전 칼날·은빛 호 · whirl 상징 | `#bcccdc` |
| `bash` | 방패 강타 | 충격파·갈라지는 잉크 획 · shield 상징 | `#d5b170` |
| `wall` | 방벽 세우기 | 육각 종이 보호막 · shield 상징 | `#9fd0ff` |
| `bulwark` | 불굴의 함성 | 돌 방패·수호 고리 · star 상징 | `#87a8bc` |
| `bleedcut` | 기력 베기 | 청록/종이 검격·타격 파편 · drop 상징 | `#ba5870` |
| `taunt` | 도발 | 시전자 방패·적을 잇는 도발 선 · eye 상징 | `#f5c400` |
| `fortify` | 요새화 | 돌 방패·수호 고리 · shield 상징 | `#87a8bc` |
| `charge` | 돌격 | 출발/도착 연기·대상 베기 · fist 상징 | `#79d4ed` |
| `earth` | 대지 가르기 | 충격파·갈라지는 잉크 획 · quake 상징 | `#d5b170` |
| `shadowstep` | 그림자 걸음 | 출발/도착 연기·대상 베기 · wind 상징 | `#b798db` |
| `assassinate` | 핵펀치 | 충격파·갈라지는 잉크 획 · dagger 상징 | `#d5b170` |
| `rain` | 화살비 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#37896a` |
| `healarrow` | 치유 화살 | 초록 회복 문양·하트/화살 · heart 상징 | `#7dffa0` |
| `bless` | 축복의 화살 | 금빛 속도 고리·지휘 표식 · star 상징 | `#f5c400` |
| `spread` | 산탄 사격 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#37896a` |
| `horn` | 지휘 나팔 | 금빛 속도 고리·지휘 표식 · wind 상징 | `#f5c400` |
| `chain` | 연쇄 번개 | 실제 대상 순서대로 꺾이는 번개 · bolt 상징 | `#a282d4` |
| `meteor` | 메테오 | 낙하 그림자/운석→충격파 · fire 상징 | `#ef8a43` |
| `ice` | 얼음 창 | 얼음 결정·서리 눈꽃 · ice 상징 | `#7dcfff` |
| `blizzard` | 눈보라 | 얼음 결정·서리 눈꽃 · ice 상징 | `#7dcfff` |
| `aegis` | 신의 가호 | 육각 종이 보호막 · star 상징 | `#9fd0ff` |
| `frostnova` | 서리 폭발 | 얼음 결정·서리 눈꽃 · ice 상징 | `#7dcfff` |
| `timewarp` | 시간 왜곡 | 시계·시간 문양 · wind 상징 | `#a6b7ed` |
| `aid` | 응급 처치 | 초록 회복 문양·하트/화살 · heart 상징 | `#7dffa0` |
| `warcry` | 전투 함성 | 금빛 속도 고리·지휘 표식 · star 상징 | `#f5c400` |
| `adrenaline` | 아드레날린 | 붉은 불꽃·빠른 회전 획 · bolt 상징 | `#dc575f` |
| `heavy` | 혼신의 일격 | 충격파·갈라지는 잉크 획 · fist 상징 | `#d5b170` |
| `secondwind` | 재정비 | 육각 종이 보호막 · wind 상징 | `#92dcd5` |
| `shatter` | 파쇄 일격 | 충격파·갈라지는 잉크 획 · quake 상징 | `#d5b170` |
| `execution` | 처형 | 출발/도착 연기·대상 베기 · dagger 상징 | `#bf7bb0` |
| `resolve` | 결의 | 붉은 불꽃·빠른 회전 획 · shield 상징 | `#dc575f` |
| `thunder` | 뇌우 | 실제 대상 순서대로 꺾이는 번개 · bolt 상징 | `#cab4ff` |
| `quakeking` | 대지 붕괴 | 충격파·갈라지는 잉크 획 · quake 상징 | `#d5b170` |
| `cataclysm` | 종말의 불꽃 | 낙하 그림자/운석→충격파 · fire 상징 | `#df5445` |
| `firearrow` | 불화살 | 부채꼴/연사/낙하 화살 · fire 상징 | `#ef6b38` |
| `anklearrow` | 발목 화살 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#88a96d` |
| `marktarget` | 표적 지정 | 조준경·별자리/집중 표식 · target 상징 | `#f5c400` |
| `poisoncloud` | 독 구름 화살 | 독 구름·해골·중첩 수 · skull 상징 | `#7fbf4a` |
| `boomerang` | 부메랑 화살 | 왕복하는 회전 종이 날 · wind 상징 | `#6cae9c` |
| `smoke` | 연막탄 | 회색 먹구름·X 표식 · eye 상징 | `#aaa7b5` |
| `windwalk` | 바람 걸음 | 바람 소용돌이·잔상 · wind 상징 | `#89cbd1` |
| `antiheal` | 치유 차단 화살 | 부채꼴/연사/낙하 화살 · skull 상징 | `#b77588` |
| `net` | 그물 화살 | 그물 격자·갈고리 사슬 · arrow 상징 | `#84ad69` |
| `aimedshot` | 조준 저격 | 조준경·별자리/집중 표식 · target 상징 | `#f5c400` |
| `explosive` | 폭발 화살 | 화살·도화선 예고→폭발 · fire 상징 | `#ef6b38` |
| `bindchain` | 결박 사슬 | 연결 사슬·체력 연결 · dagger 상징 | `#b9b2d1` |
| `stormeye` | 폭풍의 눈 | 바람 소용돌이·잔상 · wind 상징 | `#89cbd1` |
| `sureshot` | 신궁 | 조준경·별자리/집중 표식 · eye 상징 | `#f5c400` |
| `ignite` | 점화 | 불꽃·종이 불씨 · fire 상징 | `#ef6b38` |
| `manashield` | 마나 방패 | 육각 종이 보호막 · shield 상징 | `#9fd0ff` |
| `frosttouch` | 서리 손길 | 얼음 결정·서리 눈꽃 · ice 상징 | `#7dcfff` |
| `spark` | 전류 | 실제 대상 순서대로 꺾이는 번개 · bolt 상징 | `#9fcafa` |
| `silence` | 침묵 | X 말풍선·점선 마력 · star 상징 | `#ae95d0` |
| `lifelink` | 생명 연결 | 연결 사슬·체력 연결 · heart 상징 | `#b9b2d1` |
| `thornshield` | 가시 보호막 | 육각 종이 보호막 · shield 상징 | `#c7aa7c` |
| `polymorph` | 변이 | 양 실루엣·변이 파편 · star 상징 | `#f4eddb` |
| `manasurge` | 마력 폭주 | 룬·마력 이동·잔상 · drop 상징 | `#a282d4` |
| `iceblessing` | 얼음 축복 | 육각 종이 보호막 · ice 상징 | `#b0e4ff` |
| `vampire` | 흡혈귀 | 붉은 흡혈 줄기·낙인 · drop 상징 | `#b85b7e` |
| `meteorshower` | 운석 낙하 | 낙하 그림자/운석→충격파 · fire 상징 | `#ef8a43` |

## 아이템 액티브 6개

| 이벤트 id | 이름 | 연출 | 잉크 면 색 |
|---|---|---|---|
| `a_longsword` | 베어 넘기기 | 청록/종이 검격·타격 파편 · slash 상징 | `#79d4ed` |
| `a_buckler` | 방패 막기 | 육각 종이 보호막 · shield 상징 | `#9fd0ff` |
| `a_shortbow` | 쌍발 | 부채꼴/연사/낙하 화살 · arrow 상징 | `#37896a` |
| `a_quiver` | 그림자 찌르기 | 출발/도착 연기·대상 베기 · dagger 상징 | `#b798db` |
| `a_eagleeye` | 매의 눈 저격 | 긴 관통 궤적·촉 · target 상징 | `#ba974e` |
| `a_wand` | 마력 화살 | 룬·마력 이동·잔상 · star 상징 | `#a282d4` |

## 무기 34개

| 아이템 id | 이름 | 무기 모양 | 공격 면 색 | 발동/지속 효과 |
|---|---|---|---|---|
| `longsword` | 장검 | `sword` | `#79d4ed` | `—` / `a_longsword` |
| `buckler` | 둥근 방패 | `shield` | `#79d4ed` | `—` / `a_buckler` |
| `twinblades` | 쌍단검 | `twin` | `#79d4ed` | `ambush` |
| `holymace` | 성스러운 철퇴 | `mace` | `#79d4ed` | `healMace` |
| `greatsword` | 피의 대검 | `greatsword` | `#79d4ed` | `bloodthirst` |
| `warhammer` | 전쟁 망치 | `hammer` | `#79d4ed` | `cleave` |
| `thornmail` | 독 단도 | `dagger` | `#79d4ed` | `venomStack` |
| `dragonslayer` | 그림자 검 | `sword` | `#79d4ed` | `multiHit` |
| `towershield` | 수호자의 탑 방패 | `tower` | `#79d4ed` | `guardHeal` |
| `shortbow` | 단궁 | `bow` | `#37896a` | `—` / `a_shortbow` |
| `longbow` | 장궁 | `bow` | `#37896a` | `longshot` |
| `venombow` | 독궁 | `bow` | `#7fbf4a` | `venomBonus` |
| `quiver` | 도적의 단검 | `dagger` | `#37896a` | `—` / `a_quiver` |
| `whistle` | 사냥매 호루라기 | `tooth` | `#37896a` | `hawkFocus` |
| `flamebow` | 화염 활 | `bow` | `#ef6b38` | `burnCrit` |
| `windcloak` | 그림자 망토 | `cloak` | `#37896a` | `evasive` |
| `eagleeye` | 매의 눈 반지 | `ring` | `#d6bd68` | `headshot` / `a_eagleeye` |
| `hornbow` | 갈고리 쌍검 | `twin` | `#37896a` | `hookRoot` |
| `wand` | 견습 지팡이 | `wand` | `#a282d4` | `—` / `a_wand` |
| `frostorb` | 서리 오브 | `orb` | `#7dcfff` | `spellSlow` |
| `firestaff` | 화염 지팡이 | `staff` | `#ef6b38` | `spellBurn` |
| `prayerbook` | 성서 | `book` | `#7dffa0` | `healer` |
| `hourglass` | 시간의 모래시계 | `grail` | `#a282d4` | `hourglass` |
| `manaring` | 마나 반지 | `ring` | `#a282d4` | `manaRegen` |
| `lifeorb` | 생명의 수정 | `orb` | `#7dffa0` | `spellLeech` |
| `stormstaff` | 폭풍의 지팡이 | `staff` | `#ac91ff` | `stormHit` |
| `vampsword` | 흡혈귀의 검 | `sword` | `#c85f83` | `vampire` |
| `archstaff` | 대마법사의 지팡이 | `staff` | `#a282d4` | `echo` |
| `kingsword` | 왕의 대검 | `sword` | `#79d4ed` | `cleave` |
| `aegis` | 불멸의 방패 | `shield` | `#79d4ed` | `lastStand` |
| `stormbow` | 폭풍의 활 | `bow` | `#37896a` | `multiShot` |
| `dragoneye` | 용의 눈 | `ring` | `#f5c400` | `deadeye` |
| `philostone` | 현자의 돌 | `orb` | `#f5c400` | `sageStone` |
| `abysstome` | 심연의 서 | `book` | `#a282d4` | `abyss` |

## 작은 발동 연출 33개

`p_` id는 내부 시각 이벤트이며 실제 콜백은 접두사를 제외한 `fx.proc(kind, data)`이다. 흡혈귀 칩은 `fx.skill("vampire", data)`로 표시한다.

| id | 연출 |
|---|---|
| `p_cleave` | 청록/종이 검격·타격 파편 |
| `p_venomStack` | 독 구름·해골·중첩 수 |
| `p_multiHit` | 청록/종이 검격·타격 파편 |
| `p_hookRoot` | 그물 격자·갈고리 사슬 |
| `p_vampire` | 붉은 흡혈 줄기·낙인 |
| `p_vampireStack` | 붉은 흡혈 줄기·낙인 |
| `p_bloodthirst` | 붉은 흡혈 줄기·낙인 |
| `p_guardHeal` | 초록 회복 문양·하트/화살 |
| `p_longshot` | 조준경·별자리/집중 표식 |
| `p_venomBonus` | 독 구름·해골·중첩 수 |
| `p_burnCrit` | 불꽃·종이 불씨 |
| `p_poisonHit` | 독 구름·해골·중첩 수 |
| `p_burnHit` | 불꽃·종이 불씨 |
| `p_stormHit` | 실제 대상 순서대로 꺾이는 번개 |
| `p_multiShot` | 부채꼴/연사/낙하 화살 |
| `p_ambush` | 조준경·별자리/집중 표식 |
| `p_healMace` | 초록 회복 문양·하트/화살 |
| `p_healer` | 초록 회복 문양·하트/화살 |
| `p_echo` | 룬·마력 이동·잔상 |
| `p_hourglass` | 시계·시간 문양 |
| `p_lastStand` | 육각 종이 보호막 |
| `p_deadeye` | 조준경·별자리/집중 표식 |
| `p_spellBurn` | 불꽃·종이 불씨 |
| `p_spellSlow` | 얼음 결정·서리 눈꽃 |
| `p_spellLeech` | 붉은 흡혈 줄기·낙인 |
| `p_abyss` | 불꽃·종이 불씨 |
| `p_doubleHit` | 청록/종이 검격·타격 파편 |
| `p_burnAdd` | 불꽃·종이 불씨 |
| `p_hawkFocus` | 소환 도장·매 날개/돌 조각 |
| `p_focus` | 조준경·별자리/집중 표식 |
| `p_headshot` | 조준경·별자리/집중 표식 |
| `p_evasive` | 바람 소용돌이·잔상 |
| `p_storm` | 실제 대상 순서대로 꺾이는 번개 |

마나 반지(`manaRegen`)·현자의 돌(`sageStone`)은 매 틱 발동 효과를 만들지 않고 마력 상징을 유지한다. `frenzy`는 체력 비율에 따라 붉은 김을 그린다. `burnAdd`는 누적값에 따라 불꽃 잉크를 더 짙게 그린다.

## 지속 상태

| 상태 | 색 | 상징 |
|---|---|---|
| `root` | `#8eb76c` | `root` |
| `silence` | `#b295d4` | `silence` |
| `chill` | `#7dcfff` | `ice` |
| `antiheal` | `#c96e7b` | `antiheal` |
| `marked` | `#f5c400` | `target` |
| `blind` | `#aaa7b5` | `blind` |
| `link` | `#b9b2d1` | `link` |
| `reflect` | `#c7aa7c` | `reflect` |
| `invuln` | `#9fd0ff` | `invuln` |
| `hot` | `#7dffa0` | `hot` |
| `blades` | `#bcccdc` | `blades` |
| `storm` | `#8cccd1` | `wind` |
| `sure` | `#f5c400` | `sure` |
| `surge` | `#a282d4` | `surge` |
| `ww` | `#89cbd1` | `wind` |
| `fort` | `#91a5b3` | `fort` |
| `haste` | `#f5c400` | `haste` |
| `bless` | `#f5c400` | `star` |
| `burn` | `#ef6b38` | `fire` |
| `poison` | `#7fbf4a` | `skull` |
| `bleed` | `#c2697d` | `drop` |
| `slow` | `#7dcfff` | `ice` |
| `weak` | `#aa95be` | `fist` |
| `vuln` | `#e87898` | `target` |

추가로 결박 대상 사이의 사슬 선, 독 장판, 변이 중의 양 실루엣을 표시한다. 모든 표시는 상태를 읽기만 하며 남은 시간이나 피해를 수정하지 않는다.
