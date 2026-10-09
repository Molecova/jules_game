# 실물 보드·딱지 재질 1차 구현

2026-10-08 착수, 2026-10-09 UTC 검증·게시.

`tabletop-a-3d`의 기존 보드를 제품 사진에 가까운 실물 보드게임 방향으로 바꿨다. 반복 석판과 작은 로우폴리 풍경 모형을 없애고, 얇은 인쇄 보드·원목 프레임·실물 탁상 소품을 만들었다. 게임 규칙, 밸런스, 데이터, 저장, 전투 결과 계산은 바꾸지 않았다.

작업 전 `git pull --ff-only upstream tabletop-a-3d`로 최신 상태를 확인했다. 기준 커밋은 `bd411ec2057e57053b5d9374516c42e1d7a5c3e0`이며 이전 시각 구현은 `f443dc04efdb46e71f68dd918aa5a3802fe5ed2a`이다. 원본 `ccr-5e12923f-aw0cjb`는 수정하지 않는다.

## 구현

- 30개의 별도 석판을 한 장의 무광 인쇄면으로 교체했다. 미세 종이 결, 가는 격자, 칸의 모서리 표시를 인쇄했다. 작은 화면에서도 배치할 칸을 찾을 수 있게 격자 대비를 조정했다.
- 원목 프레임에 네 방향의 사선 맞춤 이음과 작은 모따기를 넣고, 판 두께와 금속 장식을 줄였다. 받침 펠트와 실제 테이블 판자를 사용한다.
- 나무·바위·수정 미니어처를 카드 묶음, 둥근 주사위, 카운터 트레이로 교체했다. 모든 소품은 30칸 밖에 있다.
- 보드 좌표 글자는 작은 고해상도 글자 아틀라스에 모아, 확대할 때 선명하게 보이도록 했다. 주사위에는 1~6개의 눈을 각각 인쇄하고 마주 보는 면의 합이 7이 되게 배치했다.
- 로컬에서 넓은 소프트박스와 반사판을 가진 환경을 생성하고, 금속의 거칠기에 맞게 미리 필터링했다. 게임과 확대 화면이 같은 조명을 쓴다. 고해상도 외부 HDRI나 CDN을 추가하지 않았다.
- 딱지의 얇은 동전 모양과 단순한 원래 초상화를 유지했다. 금속 테두리는 주변 빛을 반사하고, 인쇄면에는 무광 미세 질감을 적용했다. 64개까지 수용하는 하나의 인스턴스 그림자 패스로 접촉 그림자를 그린다.
- 놓기·마법 공격·시전의 들림 높이를 줄였다. 직업별 공격, 이동, 피격, 퇴장, 일시 정지와 동작 줄이기는 유지한다.
- 확대 화면은 정지한 상태에서 같은 장면을 계속 재그리지 않는다. 실제 게임의 30Hz 렌더링과 전투 시계는 그대로다.

[조작 가능한 보드 귀퉁이 확대 화면](../concepts/v4-tabletop-studio.html)은 실제 게임의 `createEnvironment`, `createMaterials`, `createStudio`, `createCoins`를 사용한다. 그림을 덮어 씌운 시안이 아니라 실제 공유 3D 모델이며, 세 각도·다섯 막·성급·공격·시전·피격을 선택할 수 있다. 이 페이지 자체는 전투 피해를 계산하지 않는다.

[실제 게임 전후 비교](../concepts/v4-tabletop-comparison.html)는 같은 시드와 같은 세 직업의 구매·배치 상태를 비교한다. 이전 화면은 기존 검증의 `docs/board-ui-evidence/after/board-390x844.png`를 사용한다.

## 리소스

현재는 Wood062의 색상·노멀·거칠기 3개만 내려받는다. 사용하지 않는 Rock030 파일은 이전 버전의 증거를 위해 저장소에 유지하되 현재 렌더러에서 다운로드하지 않는다. 원목의 출처·라이선스·변환 해시는 [ATTRIBUTION](../v4/assets/tabletop/ATTRIBUTION.md)과 [manifest](../v4/assets/tabletop/manifest.json)에 기록되어 있다.

반사 환경은 보통 128px 큐브에서 만든 1.50MiB의 HalfFloat 필터링 아틀라스이며, 낮은 품질은 64px다. 텍스처 예산에는 반사 아틀라스, 그림자 타깃(보수적으로 8B/px), 미프맵, 원목·종이·펠트·소품 맵, 딱지 인쇄면·접촉 그림자와 실시간 2D 오버레이를 모두 포함한다. 실제 드라이버 할당량을 측정한 값은 아니다. 기존 32MiB·150 draw calls·10만 삼각형 제한을 유지한다.

같은 보통 품질의 21딱지/85종 적 초상화 캐시 검사의 최댓값:

| 항목 | 이전 | 현재 |
|---|---:|---:|
| 텍스처 예산 | 31.80MiB | 23.66MiB |
| Draw calls | 70 | 65 |
| 삼각형 | 18,902 | 12,534 |

반사와 접촉 그림자를 추가하면서도 텍스처 예산은 약 26%, 삼각형은 약 34% 줄었다. [현재 부하 검사](tabletop-studio-evidence/local/normal-stress-summary.json), [이전 동일 검사](board-ui-evidence/after/normal-stress-summary.json).

## 검증

- 기존 Node 검사 **350개 통과**: [실행 로그](tabletop-studio-evidence/local/node-tests.log).
- 390×844·360×640·768×1024에서 30칸 입력, 실제 구매, 보드↔창고 드래그, 난수 상태 보존 통과. 실제 일반 전투 결과는 시뮬레이션과 동일했다(승리, 전투 시각 26.9초). 저장 후 확인된 결과의 이어하기와 2D 선택·강제 WebGL 손실 복귀도 통과: [게임 검사](tabletop-studio-evidence/local/browser-summary.json).
- 다섯 막을 20번 완전히 순환한 100회 전환에서 텍스처 21개·지오메트리 24개·프로그램 16개로 수가 일정했다. 소품은 모든 전투 칸 밖에 있다. 검사는 원래 프레임 제한으로 진행했다.
- 세 각도×세 화면 크기의 확대 카메라에서 두 딱지 전체가 화면 안에 있다. 다섯 막·공격·시전·피격·성급·일시 정지와 공유 모델·조명 모듈 다운로드를 확인했다: [확대 검사](tabletop-studio-evidence/local/studio-summary.json).
- 세 크기에서 타이틀·난이도·지도·상세 창·구매·상점 탭·잠금·확률·키보드 초점·저장 후 타이틀 검사 통과: [UI 검사](tabletop-studio-evidence/local/ui/ui-summary.json).

- 동전 두께/지름 비율 7% 미만과 딱지당 2개 메쉬, 직업별 공격·이동·시전·피격·퇴장, 일시 정지와 동작 줄이기, 동일 카드의 개별 ID, 사망한 모델 해제와 즉시 부활, 시트에 의한 전투 시계 정지 통과: [동작 검사](tabletop-studio-evidence/local/motion/coin-summary.json), [실제 녹화](tabletop-studio-evidence/local/motion/coin-animations.webm).
- 모든 완료된 게임·확대·UI·동작 검사에서 **게임/시안 콘솔 오류 0개**.

공개 링크와 게시 후 검사는 아래에 기록한다.

검사 환경은 클라우드 Chromium의 소프트웨어 WebGL이다. 실제 휴대폰의 FPS 측정은 포함하지 않는다. 정적 UI 검사는 기존 검사 방식대로 재그리기만 3Hz로 제한하고, 전투와 자원 반복 전환 검사는 게임의 실제 렌더러를 쓴다. 선택적 Google Fonts CSS는 검사에서 시스템 글꼴로 대체한다. githack 첫 안내 화면의 선택적 광고에만 발생하는 `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`은 별도 기록하고, 모든 게임·시안 오류는 실패로 처리한다.

재실행:

```sh
node --test tests/*.test.cjs
TABLETOP_OUTPUT=docs/tabletop-studio-evidence/local node tests/browser-tabletop4.cjs
TABLETOP_OUTPUT=docs/tabletop-studio-evidence/local node tests/browser-tabletop-stress4.cjs
STUDIO_OUTPUT=docs/tabletop-studio-evidence/local node tests/browser-tabletop-studio4.cjs
UI_OUTPUT=docs/tabletop-studio-evidence/local/ui node tests/browser-board-ui4.cjs
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/coin-playwright COIN_OUTPUT=docs/tabletop-studio-evidence/local/motion node tests/browser-coin-animation4.cjs
```

정적 서버: `python3 -m http.server 8001 --bind 127.0.0.1`을 저장소에서 실행한다. 배포 실행에 별도 빌드나 npm 설치는 필요 없다.
