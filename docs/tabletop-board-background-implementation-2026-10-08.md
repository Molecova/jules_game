# A안 게임판·배경 개선 결과

2026-10-08. [5~10시간 계획](tabletop-board-background-plan-2026-10-08.md)의 게임판·배경 범위를 구현했다. 계획의 시간은 작업량 추정이며 실제 경과 시간에 대한 주장은 아니다. 기준은 분리 체크아웃의 `188bc916d86d8051df897de88a5aec232640a973`이다. 작업 전 원본 작업 브랜치와 미리보기 브랜치를 pull했고 둘 다 최신이었다.

## 달라진 화면

목재 프레임은 평평한 박스에서 모서리를 깎고 접합부를 표현한 형태로 바뀌었다. 판 밑에는 적층 목재 단면과 펠트 받침이 있고 배경 테이블에는 개별 목재 판자가 있다. 30개 타일은 모서리와 얇은 틈이 있는 석판으로 만들고, 반복 타일은 두 개의 인스턴스 배치로 렌더링한다. 주광·보조광·실제 그림자로 판과 딱지의 높이를 표현한다.

Wood062의 사진 기반 목재와 Rock030의 절차적 석재 PBR 색상·노멀·거칠기 맵을 사용한다. 원본은 ambientCG CC0이며 외부 CDN 없이 로컬 파일로 읽는다. ZIP 서비스가 접근되지 않아 공식 API에 공개된 재질 미리보기 맵을 받았다. 원본 주소·SHA-256·축소 기록은 [manifest](../v4/assets/tabletop/manifest.json), 라이선스는 [ATTRIBUTION](../v4/assets/tabletop/ATTRIBUTION.md)에 있다. 6개 JPEG 합계는 1,392,018바이트다.

| 막 | 보드·배경 | 테두리 소품 |
| --- | --- | --- |
| 1 | 따뜻한 원목, 밝은 석판, 녹색 펠트 | 작은 침엽수, 돌, 풀, 이끼 |
| 2 | 회색 석판, 오래된 목재 | 석재 기둥 잔해, 풀과 돌 |
| 3 | 모래색 사암, 따뜻한 테이블 | 마른 풀, 조약돌, 세운 사암 |
| 4 | 밝은 설원 석판, 푸른 보조광 | 눈 덮인 나무·돌, 얼음 |
| 5 | 어두운 프레임, 따뜻한 주광과 차가운 보조광 | 작은 유적, 호박색 등불 |

소품은 전투 칸 밖에만 있다. 장애물이나 새로운 이동 규칙으로 사용하지 않는다. 막별 배경 미리보기는 동일한 실제 구매 편성에서 막 번호만 전환한 화면이며 5막 완수 기록이 아니다. 최대 편성 화면은 9개 아군 3성·12개 적의 시각 부하 검사 전용 데이터다.

칩 디자인·인쇄 딱지·HUD·상점·지도는 이번 작업에서 바꾸지 않았다. `game4.js`, `data4.js`, `battle4.js`, `save4.js`, `shared/engine.js`, 적 데이터도 기준과 동일하다. 새 환경은 원정 RNG를 사용하지 않는다.

## 파일과 실행

- `v4/tabletop4.js`: 카메라·조명·품질 설정과 기존 렌더러 연결.
- `v4/tabletop-materials4.js`: 비동기 로컬 PBR 맵, 막별 타일 색상, 텍스처 공유.
- `v4/tabletop-environment4.js`: 프레임·판자·석판과 5막의 인스턴스 소품, 전환 시 자원 해제.
- `v4/assets/tabletop/`: 6개 재질 파일과 출처·라이선스·해시.
- `tests/browser-tabletop4.cjs`: 입력·전투 동치·5막·반복 전환·품질·복귀 검사.

`python3 -m http.server 8001 --bind 127.0.0.1` 뒤 `/v4/`를 연다. `?quality=low`는 픽셀 비율 1, 그림자 512, 낮은 재질 해상도와 소품 수를 사용한다. 기본은 픽셀 비율 최대 1.5, 그림자 1024다. 렌더링 상한은 30fps이며 정지한 그림자를 재사용한다. `?view=2d`는 PBR 다운로드를 생략하고 기존 보드를 사용한다. WebGL 손실 시에도 기존 2D 보드로 돌아간다.

## 전후 화면

같은 화면 크기와 고정된 구매·편성 조건으로 비교한다.

- [개선 전 390×844](tabletop-evidence/before/prep-390x844.png), [개선 후 390×844](tabletop-evidence/polished/prep-390x844.png)
- [360×640](tabletop-evidence/polished/prep-360x640.png), [768×1024](tabletop-evidence/polished/prep-768x1024.png), [390×844 전투](tabletop-evidence/polished/combat-390x844.png), [360×640 전투](tabletop-evidence/polished/combat-360x640.png), [게임판 확대](tabletop-evidence/polished/game-board-detail.png)
- 막별 환경: [1막](tabletop-evidence/polished/theme-act-1.png), [2막](tabletop-evidence/polished/theme-act-2.png), [3막](tabletop-evidence/polished/theme-act-3.png), [4막](tabletop-evidence/polished/theme-act-4.png), [5막](tabletop-evidence/polished/theme-act-5.png)
- [낮은 품질](tabletop-evidence/polished/low-390x844.png), [정상 품질 최대 편성](tabletop-evidence/polished/normal-visual-stress-21-tokens.png), [낮은 품질 최대 편성](tabletop-evidence/polished/visual-stress-21-tokens.png)

## 검증 결과

기존 Node 회귀 검사 **350개 통과**. 기존 브라우저 시작·구매·실제 전투·저장·재개와 v3 시작 검사도 통과했다. 6개 로컬 재질의 해시·파일 크기·이미지 크기는 manifest와 일치했다.

정상 품질의 아군 9개 3성·적 12개 시각 부하 검사에서 5개 막 모두 예산을 충족했다. 최대 삼각형 14,148개, 드로콜 93회, 텍스처 예산 추정 30.47MiB였다. [측정 JSON](tabletop-evidence/polished/normal-stress-summary.json). 기준 편성에서는 기존 2,876개에서 약 6,600~9,100개로 삼각형이 늘었고, 공유 지오메트리로 GPU 지오메트리 수는 기존 86개에서 약 18~23개로 줄었다. 더 많은 입체 모서리와 재질을 표현하는 비용이다.

390×844·360×640·768×1024에서 가로 넘침 없이 30개 칸의 투영·역투영이 일치했다. 실제 가격으로 전사·궁수·마법사를 구매하고 보드↔창고 드래그를 확인했다. 렌더링 중 원정 RNG가 바뀌지 않았으며 실제 전투와 시뮬레이션의 승패·전투 시간이 일치했다. 결과 저장·재개, 명시적인 2D 모드의 PBR 다운로드 생략, WebGL 컨텍스트 손실 시 2D 복귀까지 통과했고 브라우저 예외·콘솔 오류는 0건이었다.

1→5막 전체 순환을 예열 후 **20회** 반복했다. 끝 장면의 GPU 텍스처 21개·지오메트리 23개·셰이더 프로그램 19개가 처음과 마지막 순환에서 동일했다. 약 30.21MiB의 텍스처 예산 추정도 증가하지 않았다. 낮은 품질의 동일 편성은 약 9.35MiB, 21개 딱지 부하 화면은 약 10.03MiB였다. [검사 JSON](tabletop-evidence/polished/browser-summary.json), [브라우저 실행 기록](tabletop-evidence/polished/browser.log), [Node 검사](tabletop-evidence/polished/native-tests.log), [기존 시작·전투·저장 검사](tabletop-evidence/polished/smoke.log).

다양한 적 초상화가 원정 내내 GPU에 누적되지 않도록 사용하지 않는 초상화는 캐시 1.5MiB 상한을 넘을 때 해제한다. 현재 보이는 딱지는 해제하지 않는다. 모든 적 종류를 12개씩 교체하는 별도 부하 검사에서도 캐시와 텍스처 예산 상한을 확인했다. 85종의 적을 차례로 표시했을 때 캐시는 최대 1.49MiB, 전체 텍스처 예산 추정은 최대 31.44MiB였다. 이 변경 뒤 부하 검사를 다시 실행했고, 실제 구매 후 390×844·360×640의 실제 전투·시뮬레이션 동치·6개 재질 로드·콘솔 오류 0도 확인했다. [최종 모바일 전투 JSON](tabletop-evidence/polished/mobile-combat-summary.json), [실행 기록](tabletop-evidence/polished/mobile-combat.log).

Google Fonts 요청은 본 게임의 선택적인 기존 의존성이다. 3D 검사는 해당 CSS를 비워 시스템 글꼴로 실행했고, 기존 시작 검사는 실제 환경의 선택적 Google Fonts 실패를 별도로 기록한다. 게임과 PBR 재질은 정상 로드된다.

클라우드 Chromium의 SwiftShader에서 화면과 기능을 확인한다. GPU 메모리 값은 RGBA8·밉맵·캔버스·보수적인 그림자 버퍼를 합산한 예산 추정이며 드라이버의 실제 할당을 측정한 값이 아니다. 휴대폰 실기기의 fps·발열·배터리는 미검증이다.

## 게시 위치

독립 목표 저장소는 `Molecova/jules_game-tabletop3d`이다. 연결 앱의 생성 권한 부족으로 원격 독립 저장소는 아직 생성되지 않았다. 현재 구현은 원본 저장소의 별도 `tabletop-a-3d` 브랜치에 게시하며 `ccr-5e12923f-aw0cjb`는 수정하지 않는다. 빈 목표 저장소와 앱 접근 권한이 준비되면 전체 이력을 독립 원격으로 옮길 수 있다.

재현 명령:

```sh
node --test tests/*.test.cjs
TABLETOP_OUTPUT=docs/tabletop-evidence/polished node tests/browser-tabletop4.cjs
node tests/browser-tabletop-stress4.cjs
node tests/browser-tabletop-mobile4.cjs
```
