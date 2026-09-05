# U-RELEASE-VISUAL-01 — 출시 핵심 화면 시각 밀도·진행 피드백 정리

> 상태: **UIUX 구현 완료·통합/수동 QA 대기**  
> 담당: **UIUX 세션**  
> 병렬 가능: `DB-COMPLETION-RECORD-01`, `2-AB`  
> 후속: `QA-FOUNDATION-WAVE-01`, 이후 구조 변경·Live Activity

## 1. 목적과 사용자 관찰

현재 다크·파란색 방향은 유지하면서 핵심 흐름의 시각적 밀도와 한눈에 읽히는 정도를 개선한다.

- 메인 CTA와 진행 코스 영역의 간격이 가까워 행동 구분이 약하다.
- 계산 화면의 점은 정적인 색 변화뿐이고, 두 단계가 같은 tick에 전환되어 실제 진행 피드백으로 읽히지 않는다.
- 대표·대안 카드의 사진과 본문 높이가 커 한 화면에서 비교 가능한 장소 수가 적다.
- 코스 확인 지도가 좌우 22px 안쪽에 갇혀 있고, 세로 코스는 정보가 맞지만 이동·장소·도착의 구조를 빠르게 훑기 어렵다.
- 헤더 우측 정렬용 placeholder가 `icon` 스타일을 그대로 받아 빈 네모 버튼처럼 보인다.

이 작업은 시각 정리만 한다. 진행 코스 영속화, 화면 병합, 탭 교체, 완료 기록 연결, Live Activity는 선행 계약 뒤 별도 작업이다.

## 2. 확정 디자인 방향

1. 테마는 현재의 **다크 배경 + 파란 주요 행동 + 초록 완료/여유 + 주황 활동**을 유지한다. 라이트 테마를 추가하지 않는다.
2. 메인의 주 CTA와 진행/빈 상태 카드 사이 간격을 명확히 분리한다. 진행 데이터가 없을 때 임의 진행 코스를 만들지 않는다.
3. 대표·대안 카드의 공개 정보는 사진, 구분 라벨, 장소명, 활동 카테고리, `약 N분 코스`를 유지하되 세로 높이를 줄인다. 텍스트나 클릭 영역을 잘라 밀도를 얻지 않는다.
4. 코스 확인의 지도만 화면 가로 끝까지 확장하고 헤더·본문은 기존 안전 여백을 유지한다. 지도는 safe area를 침범하지 않는다.
5. 세로 순서는 `출발 → 이동 → 장소 → 이동 → 목적지/복귀 → 도착 여유`를 연속된 guide와 서로 다른 marker로 보여 준다. 엔진 snapshot 값·순서는 그대로 사용한다.
6. 헤더 오른쪽은 실제 행동이 없으면 **보이지 않는 동일 폭 spacer**만 사용한다. 배경·테두리·접근성 요소가 있는 빈 버튼을 렌더하지 않는다.
7. 계산 진행은 실제 UI runtime 경계에 대응한 네 상태만 사용한다: `입력 확인 → 경로 연결 → 후보·시간 검증 → 결과 준비`. 완료된 단계는 켜진 상태, 현재 단계는 pulse, 대기 단계는 outline이다.
8. 결과가 준비되지 않았는데 단계를 자동 진행시키는 장식 timer를 사용하지 않는다. 결과가 준비되면 네 점 완료 상태를 최대 한 render frame만 반영한 뒤 이동할 수 있으나, 100ms 이상의 고정 지연은 추가하지 않는다.
9. 일반 화면 전환·버튼에 새 햅틱을 추가하지 않는다. `AnimatedPressable`의 기존 눌림·Reduce Motion 계약을 유지한다.

## 3. 구현 순서

### A. 실패 계약부터 추가

1. 헤더의 우측 spacer가 button/accessible element가 아니고 배경·테두리가 없는지 확인한다.
2. 로딩 진행 모델이 위 네 상태를 순서대로만 허용하고 뒤로 감소하거나 완료 뒤 갱신되지 않게 한다.
3. runtime callback이 input ready, route port ready, verifying, complete를 실제 호출 순서로 한 번씩 내는지 fake builder/port로 검증한다.
4. 성공·실패·stale QA run에서 장식 timer가 navigation이나 API 호출을 추가하지 않으며, 실패 시 완료 상태를 만들지 않는지 확인한다.
5. 카드 요약의 표시값·accessibility label·전체 카드 tap·원본 course identity가 시각 축소 뒤에도 동일한지 확인한다.
6. CourseConfirm이 기존 route segments/marker/legend/connector 상태와 `코스 시작하기` CTA를 그대로 보존하는지 확인한다.

### B. 로딩 상태를 실제 경계에 연결

- `src/ui/recommendation/v1Session.ts`에 화면 전용 optional progress callback을 추가한다. callback은 저장·navigation payload·엔진 타입에 넣지 않는다.
- `buildRecommendationLimitedInput` 전후와 builder 실행 전후의 실제 경계에서만 상태를 전달한다.
- `TimeSetupScreen`의 연속 `setLoadingStep(1); setLoadingStep(2);`를 제거한다.
- pulse 표시는 별도 작은 표시 컴포넌트/모델로 분리하고 Reduce Motion에서는 반복 scale 없이 색/opacity 상태만 보인다.
- callback 누락은 추천 실패로 처리하지 않는다. 진행 UI는 보조 표시이며 추천 결과의 성공·실패 의미를 바꾸지 않는다.

### C. 화면별 시각 정리

- `HomeScreen`: 주 CTA와 active/placeholder 영역을 최소 24px의 명확한 그룹 간격으로 분리한다. 진행 복원 로직은 수정하지 않는다.
- `CourseV1SummaryCard`: 사진 높이는 108~120px, content padding은 14~16px 범위에서 조정한다. 장소명 두 줄, 활동과 시간 한 줄, 최소 44px 카드 행동 영역, Dynamic Type 잘림 방지를 유지한다.
- `CourseConfirmScreen`: 헤더/본문 여백은 유지하고 `mapFrame`만 좌우 full-bleed로 만든다. 지도 높이는 260~300px 범위이며 작은 iPhone에서도 아래 첫 요약이 일부 보이도록 한다. 지도 bounds padding, 선, marker, 오류 overlay는 유지한다.
- `CourseV1VerticalDetail`: 연속 guide, endpoint/move/stop/buffer marker 차이, 1·2곳 순서를 강화한다. 장소 카드는 요약 카드보다 작게 하되 장소명·활동·체류 문구·카카오맵 링크는 유지한다.
- 이번 작업에서 만지는 화면의 우측 빈 `icon` placeholder는 비시각 spacer로 바꾼다. 실제 아이콘 행동이 있는 header는 건드리지 않는다.

## 4. 허용 파일

- `src/ui/HomeScreen.tsx`
- `src/ui/TimeSetupScreen.tsx`
- `src/ui/recommendation/v1Session.ts`
- 새 로딩 표시용 `src/ui/**` 파일
- `src/ui/recommendation/CourseV1SummaryCard.tsx`
- `src/ui/CourseConfirmScreen.tsx`
- `src/ui/recommendation/CourseV1VerticalDetail.tsx`
- `src/ui/VerifiedCourseProgressScreen.tsx`의 행동 없는 우측 header placeholder 스타일만 허용한다. 상태·CTA·route handoff는 수정하지 않는다.
- 위 표시 계약의 `test/ui/**` 및 기존 UI source-contract 테스트
- 이 작업 문서의 완료 인수인계

범위 밖 파일이 반드시 필요하면 직접 수정하지 말고 인수인계에 이유와 필요한 공개 계약을 남긴다.

## 5. 수정 금지 경계

- `App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`, `FloatingTabBar`
- `VerifiedCourseProgressScreen`의 상태·CTA·route handoff, `ActivityRecordScreen`, `ProfileScreen`, `MyCoursesScreen`
- `src/engine/**`, 추천 후보·순위·호출 예산·체류 계산
- DB repository/migration, App Group, ActivityKit, notification
- route geometry/connector/API/cache 계약과 외부 URL
- `docs/작업조정_보드.md`, `docs/테스트.md`, `추천로직.md`, UIUX 공통 규칙
- 사용자 요청 없는 commit·push

## 6. 의도적으로 후속으로 남기는 UI

- 메인의 진행 코스 재실행 후 복원
- 경로·도착 시각·여유를 한 화면으로 병합
- `내 코스`를 `주변 둘러보기` 탭으로 교체
- 기록 탭을 새 완료 repository로 전환
- 내 정보의 권한/동의 UI
- 코스 확인과 진행 화면의 구조적 통합 여부
- Live Activity·잠금화면·Dynamic Island

이 항목은 병렬 작업 중 임의로 구현하지 않는다.

## 7. 검증과 완료 기준

- 집중 UI 테스트와 `npm run test:typecheck`를 실행한다.
- 다른 병렬 작업이 끝난 뒤 통합 세션이 `npm run test:ui`, `npm test`, `git diff --check`를 한 번 통합 실행한다.
- 실제 외부 API, Supabase, Simulator 조작을 이 작업의 완료 조건으로 삼지 않는다.
- 작은/큰 iPhone 화면의 최종 촉감·Dynamic Type·full-bleed 지도는 통합 QA 뒤 사용자 수동 smoke 1회로 제한한다.
- 인수인계에는 변경 파일/목적, 불변 계약, 집중 테스트 결과, 수동 확인 필요 항목을 남긴다.

## 8. 완료 인수인계 — 2026-09-04

### 1) 변경 파일과 변경 목적

- `src/ui/HomeScreen.tsx`: 주 CTA와 active/placeholder 그룹 사이 간격을 26px로 분리했다.
- `src/ui/TimeSetupScreen.tsx`, `src/ui/recommendation/v1Session.ts`: 장식 timer와 같은 tick의 임의 단계 전환을 제거하고, 입력 구성 전후와 builder 실행 전후의 실제 runtime 경계에서만 선택적 진행 callback을 받도록 연결했다. QA run token이 stale이면 화면 상태와 navigation을 갱신하지 않는다.
- `src/ui/recommendation/recommendationLoadingModel.ts`, `src/ui/recommendation/RecommendationLoadingProgress.tsx`: `입력 확인 → 경로 연결 → 후보·시간 검증 → 결과 준비`만 순차 허용하는 모델과 완료/현재 pulse/대기 outline 표시를 추가했다. Reduce Motion에서는 반복 scale을 실행하지 않는다.
- `src/ui/recommendation/CourseV1SummaryCard.tsx`: 사진 112px, 본문 padding 15px의 작은 카드로 조정하면서 사진·구분·장소명·활동·`약 N분 코스`·전체 카드 tap과 accessibility label을 유지했다.
- `src/ui/CourseConfirmScreen.tsx`, `src/ui/recommendation/CourseV1VerticalDetail.tsx`: 지도만 좌우 full-bleed·높이 280px로 바꾸고, snapshot 순서를 연속 guide와 endpoint/move/stop/buffer marker로 읽히게 했다. 장소명·활동·체류·카카오맵 링크와 route geometry/legend/error overlay는 유지했다.
- `src/ui/VerifiedCourseProgressScreen.tsx`: 행동 없는 우측 header placeholder 두 곳만 배경·테두리·접근성이 없는 동일 폭 spacer로 교체했다.
- `test/ui/release-visual-polish.test.ts`, `test/map-transport-ui-contract.test.mjs`: 진행 순서·실패·callback 비차단·stale guard·무 timer·밀도·full-bleed·spacer·기존 runtime source 계약을 고정했다. 최초 실패는 새 진행 모델 부재로 `MODULE_NOT_FOUND`가 발생한 뒤 구현으로 닫았다.

변경 이력은 `정적 점/같은 tick 임의 전환 → 실제 진행처럼 읽히지 않음 → runtime callback 기반 네 단계 → 결과 준비 상태와 표시를 일치시키기 위해 교체(현행)`이며, `콘텐츠가 큰 카드·분절된 코스 행·빈 icon 버튼 → 비교 밀도와 구조 인지가 낮고 빈 행동으로 보임 → 작은 카드·연속 timeline·비시각 spacer → 정보/행동 계약을 유지하며 시각 위계만 개선(현행)`이다.

### 2) 변경하지 않은 공개 계약·정책 경계

- `App.tsx`, nav/tab/record/profile, 진행 화면의 상태·CTA·route handoff, engine, API/cache/connector, DB, 중앙 문서는 수정하지 않았다.
- 추천 후보·순위·시간/체류·호출 예산, snapshot identity/order, Kakao URL, route segment/marker/legend, 저장/navigation payload를 바꾸지 않았다.
- 진행 복원·설정 병합·탭 교체·완료 기록 UI·Live Activity와 새 햅틱은 추가하지 않았다. 실제 외부 API·Supabase·Simulator도 실행하지 않았다.

### 3) 실행한 테스트와 결과

- 실패 우선: `node --import tsx --test test/ui/release-visual-polish.test.ts` — 최초 0/1 실패(`recommendationLoadingModel` 부재), 구현 후 **5/5 통과**.
- 집중 fixture: 카드/상세·route geometry·runtime boundary·stale QA launcher — **32/32 통과**.
- UI source contract: `node --test test/map-transport-ui-contract.test.mjs` — **14/14 통과**.
- `npm run test:typecheck` — 통과.
- `npm run test:ui` — **264개 중 263 통과, 1개 기존 의도 skip, 실패 0**.
- `npm test` — **117/117 통과**.
- `git diff --check` — 통과.

### 4) 다음 결정·위험·재현 조건

- 통합 QA에서 작은/큰 iPhone과 큰 Dynamic Type으로 카드 두 줄 제목, 첫 상세 요약 노출, 280px full-bleed 지도의 safe area를 수동 smoke해야 한다.
- Reduce Motion on/off에서 현재 단계 pulse 유무와 실제 느린 fixture의 네 단계 체류를 눈으로 확인해야 한다. callback은 보조 표시라 callback 자체 오류가 추천 결과를 실패시키지 않는 계약은 자동 검증했다.
- 병렬 세션이 수정 중인 engine/DB/중앙 문서 변경은 되돌리거나 포함하지 않았다. 통합 시 해당 변경과 함께 전체 검증을 다시 실행해야 한다.
