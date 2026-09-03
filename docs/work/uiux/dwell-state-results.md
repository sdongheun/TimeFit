# U-1-DWELL-01 — 선택 체류·짧게 가능 결과 표시

## 시작 조건

`2-O`와 `DATA-DWELL-01`이 모두 수락되어 `CourseV1Stop`의 선택 체류와 `recommended/short` 상태가 실제 결과 스냅샷으로 전달된 뒤에만 시작한다.

## 목적

20분 최소 방문을 숨기지 않되, 같은 장소의 20·30분 변형을 여러 카드로 반복하거나 최대 60/120분을 복잡한 UI로 보이지 않는다.

## 소유 범위

- 수정: `src/ui/`, UI 관련 test, 이 작업 묶음
- 수정 금지: `src/engine/`, `src/data/`, API adapter/cache, Route Proxy, 제품 정책 문서, 보드

## 화면 계약

1. 결과·대안·코스 확인의 시간 여정과 장소 미리보기는 engine snapshot의 `stayMin`과 상태만 사용한다. 화면에서 남는 시간·카탈로그 최대값을 다시 계산하지 않는다.
2. 권장 상태는 현재처럼 `30분` 중심으로 간결하게 보인다. `short` stop 또는 short만 포함한 코스는 읽기 쉬운 짧은 라벨(예: `짧게 가능 · 20분`)을 더한다. 상태는 색만으로 구분하지 않는다.
3. 같은 장소·순서의 체류 변형을 UI에서 합치거나 새 추천으로 만들어서는 안 된다. 엔진 결과 한 코스당 카드 하나다.
4. 최대 60/120분, 가능한 체류 범위, 체류시간 slider/수정 행동은 노출하지 않는다. 남는 시간은 기존 시간 막대의 독립 구간으로 남긴다.
5. 대안 목록의 선택·상세 진입은 추가 API 호출 없이 같은 결과 snapshot을 전달한다. internal diagnostics·B12 flag 조건은 바꾸지 않는다.

## 필수 UI fixture

- 권장 30분 단일 코스, short 20분 단일 코스, 30+20분 혼합 2곳 코스에서 시간 여정·접근성 라벨·장소 카드의 값과 상태가 일치한다.
- 180분·문화시설 120분 max fixture에서도 화면이 120분 최대값을 보여 주거나 자동 체류로 오해시키지 않는다.
- 기존 결과 목록 선택이 network/route 호출 0회인 계약과, production/internal diagnostics 노출 경계를 유지한다.

## 완료 기준과 인계

`npm run test:typecheck`, `npm run test:ui`, 관련 UI test, `npm test`, `git diff --check`를 실행한다. 변경 파일 / 유지한 engine·API 경계 / 테스트 결과 / QA-DWELL-01에 필요한 fixture ID를 남긴다.

## 완료 인계 — 2026-08-30

### 변경 파일

- `src/ui/recommendation/courseV1DwellStateModel.ts`: engine stop snapshot의 선택 체류와 `short` 상태를 재해석 없이 고정 표시 문구로 변환했다.
- `src/ui/recommendation/courseV1JourneyModel.ts`, `CourseV1Journey.tsx`: stop별 `stayState`를 시간 여정과 접근성 문구까지 전달하고, short에는 `짧게 가능 · 활동 N분`을 표시한다.
- `src/ui/recommendation/CourseV1PlacePreview.tsx`, `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`: 대표·대안·코스 확인의 장소 미리보기에 snapshot `stayMin`과 short 라벨을 전달했다. short stop이 하나라도 있는 코스는 대안/대표의 읽기 전용 상태에도 `짧게 가능`을 보인다.
- `test/ui/course-v1-dwell-state.test.ts`, `test/map-transport-ui-contract.test.mjs`: 권장 30분, short 20분, 30+20 혼합과 120분 snapshot 및 최대값/slider 미노출 계약을 고정했다.

### 유지한 계약

- 엔진·데이터의 최소/권장/최대 체류 정책, Route Proxy/API, 카탈로그, navigation·저장 snapshot, diagnostics/B12 조건을 수정하지 않았다.
- UI는 `stayMin`·`stayState`만 소비하며 남는 시간·카탈로그 범위·최대값을 계산하거나 같은 장소·순서의 체류 변형을 합치지 않는다. 코스 한 개당 카드 한 개를 유지하고, 목록 선택/상세 진입에서 새 route/network 요청을 만들지 않는다.
- 최대 60/120분, 체류 범위, 체류시간 slider·수정 행동은 노출하지 않았다. 실제 API/Auth/CAPTCHA/GPS 호출은 0회다.

### 테스트 결과

- UDWELL01-01: 권장 30분·short 20분·30+20 혼합에서 장소 label, 코스 상태, 시간 여정 segment의 값/상태가 snapshot과 일치했다.
- UDWELL01-02: 120분 선택 체류는 최대값이나 자동 확장으로 표현하지 않았고, 정적 계약에서 `maxStay`/`minStay`/slider·조절 UI가 없음을 확인했다.
- `npm run test:typecheck`, `npm run test:ui`, `npm test`(102/102), `git diff --check`를 통과했다.

### 다음 결정·위험

- 통합·결정 수락 뒤 QA는 `QA-DWELL-01`의 50분 short, 권장/short 동시 반환, 운영시간 경계, 상한 비자동 확장 fixture를 실행한다.
- QA가 snapshot과 화면/VoiceOver 렌더링을 확인하기 전에는 체류 범위 표시·사용자 조절·최대 체류 노출·B12 실기기 재비교를 추가하지 않는다.
