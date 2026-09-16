# 수동 장소 선택 UI 다듬기 인수인계

2026-09-15 / 기준 `a2c2993` / 사용자 제안 확인 후 UIUX 구현·자동 검증 완료. 공식 요구사항 ID 부여와 중앙 문서 반영은 통합·결정 역할에 남긴다.

## 결정 이력

이전 방식: GPS 제거 뒤 기존 화면에서 현위치 행동만 제거하고 남은 요소의 배치·명칭은 유지 → 관찰: 시간 설정의 큰 빈 공간, `도착지`와 작은 `복귀`의 모호함, 정상 지도에 노출되는 재시도, 주변의 `기준 위치` 반복, 과거 코스 재확인의 기술 문구가 수동 선택 흐름을 약하게 만듦 → 교체 방식: 수동 검색·지도 선택을 중심 행동으로 재정렬하고 상태별 행동만 노출 → 교체 이유: 위치 자동 결정 없이도 처음 쓰는 사용자가 출발지와 마지막 도착지를 직접 정하고 다음 행동을 이해하게 함 → 상태: **현행 구현·자동 검증 완료, 실기기 시각 확인 전**.

## 1. 변경 파일과 변경 목적

- `src/ui/timeSetup/UnifiedSetupInputs.tsx`
  - 화면 전체에 요소를 분산하던 `space-between`을 상단부터 읽는 `flex-start` 구조로 교체했다.
  - `도착지`를 `마지막 도착지`로 명확히 하고 접근성 명칭도 동일하게 맞췄다.
  - 목적지가 있을 때만 나오던 작은 `복귀` 텍스트를 흰색 텍스트·테두리가 있는 전체 폭 `출발지로 돌아오기` 보조 버튼으로 교체했다.
  - 일반 375×812, 390×844, 402×874 fixture의 무스크롤 예산과 작은 화면·큰 글씨 overflow는 유지했다.
- `src/ui/TimeSetupScreen.tsx`
  - 검색/지도 모달 제목을 `마지막 도착지 선택`으로 통일했다. 선택 state와 추천 입력은 변경하지 않았다.
- `src/ui/PlacePicker.tsx`, `src/ui/locationSearchDraft.ts`
  - 검색 입력을 `장소명 또는 도로명 주소`로 안내하고, 초기 상태를 `검색하거나 지도에서 직접 선택하세요`로 정리했다.
  - 지도 행동을 `지도에서 직접 선택`으로 명확히 하고 비텍스트 파란 테두리로 수동 선택 대안임을 구분했다.
  - 검색 결과를 고른 뒤 하단에서 명시 확정하는 기존 2단계는 유지했다.
- `src/ui/MapPlacePicker.tsx`
  - `지도 다시 시도`는 지도 오류가 발생한 경우에만 나타난다. 정상 로딩/ready 화면에서는 숨긴다.
  - 실패·주소 미확인 문구, 검색 복귀, 좌표 선택 fallback과 중앙 핀 확정은 유지했다. 보조 버튼 텍스트를 공통 흰색 규칙에 맞췄다.
- `src/ui/NearbyBrowseScreen.tsx`
  - 사용자 표현을 `기준 위치`에서 `기준 장소`로 통일했다.
  - 미선택은 `장소 선택`, 선택 이후는 `장소 변경`으로 상태별 행동을 표시한다.
  - 미선택 지도와 하단 시트의 같은 설명을 줄이고, 지도에는 목적 문장, 시트에는 3km 결과 설명과 단일 CTA를 둔다.
  - 선택 후에는 `선택 장소 기준 · 장소명`을 표시한다.
- `src/ui/ManualLocationRestoreGate.tsx`
  - `이전 버전`, `좌표`, `경로 검증` 중심 설명을 `예전에 만든 코스`와 출발지/마지막 도착지 재확인 행동으로 바꿨다.
  - 코스 장소 요약, 라벨·값·화살표가 있는 두 선택 행, `이 코스 이어가기`, `나중에 확인`으로 정보 계층을 정리했다.
  - 서로 다른 장소·만료·적용 실패 시 기존 코스를 보존하는 의미는 유지했다.
- 화면 테스트
  - `test/ui/unified-time-route-setup.test.mjs`
  - `test/ui/location-search-interaction.test.mjs`
  - `test/ui/nearby-browse-screen.test.mjs`
  - `test/ui/manual-location-restore.test.mjs`
  - 수동 선택 명칭·배치, 지도 재시도 상태, 주변 미선택/선택 표현, 과거 코스 안내와 접근성 반례를 보강했다.

## 2. 유지한 공개 계약·정책 경계

- GPS·현위치·위치 권한·자동 측위를 다시 추가하지 않았다. 검색 또는 지도 핀을 사용자가 명시 확정해야 한다.
- 추천의 최대 180분·최대 2곳·운영시간·도착 여유·호출 예산, CAPTCHA, 추천 session 구성과 결과 이동은 변경하지 않았다.
- 새 수동 코스의 `manualLocation.version=1` 증명, 과거 코스의 양 끝 정확 일치 확인, active course/pending/Live Activity 차단 경계와 저장 repository를 변경하지 않았다.
- 주변 탐색은 선택 장소 기준 3km·직선거리 가까운 순이며 코스·기록·학습을 생성하지 않는다.
- 지도 주소 조회 실패의 좌표 선택, 외부 카카오 길찾기, 기록·계정 격리·개인화 정책은 변경하지 않았다.
- 엔진·API·DB·카탈로그·native·App.tsx/navigation·운영 데이터와 중앙 문서를 수정하지 않았다. 기존 작업트리의 다른 변경과 `output/`을 되돌리거나 포함하지 않았고 commit/push/배포하지 않았다.

## 3. 테스트 결과

- 실패 선행 집중 검사: 100개 중 **93 PASS / 7 FAIL**. 새 마지막 도착지·상단 묶음·검색/지도 표현·정상 재시도 숨김·주변 기준 장소·복원 문구 기대가 기존 UI에서 실패했다. `/private/tmp/manual-ui-polish-red.log`.
- 후속 접근성 실패 선행: 53개 중 **51 PASS / 2 FAIL**. 시각 명칭은 바뀌었지만 접근성 라벨과 과거 코스 모달 제목이 아직 `도착지/최종 목적지`였던 편차를 재현했다. `/private/tmp/manual-ui-polish-accessibility-red.log`.
- 최종 집중: **100/100 PASS**, fail/skip 0. `/private/tmp/manual-ui-polish-final-focused.log`.
- `npm run test:typecheck`: PASS. `/private/tmp/manual-ui-polish-final-typecheck.log`.
- `npm run test:ui`: **783 PASS / 0 FAIL / 1 SKIP**, 총 784. skip은 기존 철회 이력 1건이며 새 skip 없음. `/private/tmp/manual-ui-polish-final-ui.log`.
- `npm test`: **547/547 PASS**, fail/skip 0. `/private/tmp/manual-ui-polish-final-full.log`.
- `node scripts/release-build.cjs export`: public iOS bundle PASS. `/private/tmp/manual-ui-polish-final-export.log`.
  - `/private/tmp/timefit-public-export/_expo/static/js/ios/index-15cd06d9f786a48ddebefa93576eaf55.hbc`
  - SHA-256 `128c2f3e6b89847ffc14cb7a128ff9346ba682a1007b64b3039a4a86a8b3eb8a`
  - Archive/IPA/서명/설치 검증은 아님.
- `git diff --check`: PASS.
- 실제 공급자·운영 DB·GPS 호출, Simulator·실기기 실행 없음.

## 4. 다음 결정·위험·재현 조건

정책 변경이 필요한 아래 항목은 구현하지 않았다.

1. 과거 코스에서 다른 출발지/마지막 도착지를 선택했을 때 동일 run을 자동 재계산하여 이어갈지 여부. 현재는 기존 코스를 보존하고 메인에서 새 코스를 만들도록 안내한다.
2. 주변 기준 장소를 앱 재시작 뒤에도 별도로 저장할지 여부.
3. 시간 설정과 주변 둘러보기 사이에서 선택 장소를 자동 공유할지 여부.
4. GPS·현위치 기능 재도입 여부.

최종 QA는 수정 빌드에서 기본 글씨와 큰 글씨로 확인한다. 시간 설정의 과도한 빈 공간 감소, 긴 장소명과 목적지 설정 뒤 `출발지로 돌아오기`, 검색 키보드/결과/지도 왕복, 정상 지도에 재시도0·실패 뒤 재시도1, 주변 미선택 `장소 선택`→선택 후 `장소 변경`, 과거 코스 두 장소 선택·취소·불일치 안내를 확인한다. Simulator 자동 실행은 사용자의 기존 금지 요청에 따라 수행하지 않았다.
