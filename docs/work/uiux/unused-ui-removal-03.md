# U-UNUSED-UI-REMOVE-03 — UIUX 제거 인계

2026-09-14. 상태: **구현 완료·QA 대기**. 전체 게이트 수락·실기기 성공을 뜻하지 않는다.
기준: [실행 명령](../qa-release/unused-ui-removal-03.md). 다음 담당 `QA-UNUSED-UI-REMOVE-03`.

## 1. 변경 파일·호출 부재·테스트 처리

시작 HEAD `232a45d4c8ab43c704177d64ec46bc221eb99141`. tracked 변경0, untracked 명령 문서와 output/만 있었으며 이를 보존했다. 아래19개는 기준점에서 복구 가능하다. 폴더 전체·과거 데이터 삭제는 수행하지 않았다.

변경 전 `test/ui/unused-ui-removal-03.test.mjs`를 작성했다. App.tsx/index.ts 및 src/scripts/supabase의 TypeScript AST로 import/reexport와 문자열 literal dynamic import/require의 상대경로를 해석했다. 후보 집합 **밖에서 안으로 들어오는 제품 참조0**을 확인하고 이름·경로 rg 검색의 테스트/전용 내부 호출과 대조했다. 보존 호출자를 삭제해서 미사용으로 만들지 않았다. 임의 문자열 조합·모든 네이티브/원격 동적 로딩까지 증명한 것은 아니다.

아래 경로는 모두 `src/ui/` 기준이며 **전부 삭제**했다. 각 항목의 보존 소스 유입0은 동일 AST 검사에서 개별 경로로 확인된다.

| 파일 | 판정·보존 대조 |
| --- | --- |
| courseDateContext.ts | 과거 변경/날짜 wrapper 전용, 보존 유입0; 현재 datedSetupTime/원본 마감 guard 및 repository 유지 |
| mapPinConfirmationModel.ts | 과거 지도 확정 controller, 보존 유입0; 현재 MapPlacePicker 실제 handler 유지 |
| placeSearchRanking.ts | 과거 이름 ranking 및 상태 모델용 타입, 보존 유입0 |
| placeSearchStateModel.ts | 과거 검색 진단/상태, 보존 유입0 |
| placeSearchSuggestionModel.ts | 과거 노선 라벨 표시, 보존 유입0; 현재 PlacePicker·검색 서비스 유지 |
| routeSetupModel.ts | 과거 입력 요약/field reducer, 보존 유입0; 현재 통합 입력 유지 |
| tokens.ts | 미연결 MapControls 전용; 현행 theme.ts 유지 |
| recommendation/MapControls.tsx | 과거 장바구니/지도 버튼, 보존 유입0 |
| recommendation/courseV1DwellStateModel.ts | 과거 체류 요약 표시, 보존 유입0; 현재 상세 review/active 규칙 유지 |
| recommendation/courseV1ResultListModel.ts | 과거 1/2/3곳 대안 목록, 보존 유입0; 현행 최대2곳/대표·더보기 유지 |
| recommendation/oneStopSearchScope.ts | 과거 UI1km/3km 확장 필터, 보존 유입0; 현재 엔진·주변 반경 변경 없음 |
| recommendation/v1ResultState.ts | 과거 결과 UI 상태, 보존 유입0 |
| recommendation/verifiedCourseResultsModel.ts | 과거 continuation/조건부 페이지·lock·시각 gate, 보존 유입0; 실제 release more 및 v1Session 유지 |
| dev/ConditionalPlacePreview.tsx | 미연결 개발 미리보기; 현재 개발 테스트 시각/QA 진입은 별개로 유지 |
| dev/conditionalPlacePreviewFixtures.ts | 위 미리보기 전용 고정 장소 |
| recommendation/ConditionalVisitSection.tsx | 위 미리보기만 사용하는 과거 조건부 section |
| recommendation/CourseV1Journey.tsx | 위 section의 과거 시간 여정 |
| recommendation/CourseV1PlacePreview.tsx | 위 section의 과거 장소 preview; 공용 courseV1PlacePreviewModel/사진 허락 모델은 유지 |
| recommendation/courseV1JourneyModel.ts | 위 여정 전용 계산 |

### 테스트 분류

- **폐기 전용9파일25건 제거**: course-date-context2(과거 DTO 복사), course-replan-date1(과거 replan 시각), map-pin-confirmation-model3(과거 reverse/확정 controller), place-search-ranking8(과거 ranking/진단/노선 라벨), route-setup-model2(과거 입력 reducer), map-controls-contract1(과거 버튼 props), course-v1-dwell-state2(과거 요약), course-v1-results-list5(과거3곳 대안/선택 표시), one-stop-search-scope1(과거 범위 확장).
- **course-v1-journey**: 폐기 함수 검증4건만 제거. 기존 철회 이력 `test.skip`1건은 같은 파일에 그대로 보존했다.
- **verified-course-results**: 폐기 continuation/중복 append/lock/조건부 시각5건 제거. 실제 `releaseOneStopDisplayResult`의 single 대표/대안 제한·다장소 fail-closed2건 유지.
- **conditional-manual-ui**: 폐기 UI 시각·동기 lock·action·실패4건 제거. 삭제 대상이 아닌 `v1Session`의 receipt port 보존/없을 때 unavailable2건은 유지. 보존 함수가 테스트된다는 이유로 신규 UI 연결을 만들지 않았다.
- **test-clock-recommendation-diagnosis**:5건 모두 유지. 폐기 `isConditionalManualConfirmTime` import/보조 assertion2개만 제거. 실제/개발/QA 시각→엔진·CourseConfirm 모델, route 응답, 남은 예산,180분/익일 및 CAPTCHA 날짜 경과 검증은 유지.
- **unified-time-route-setup**: 폐기 section callback 전용1건 제거. 혼합2건은 미리보기 직접 mount/click만 제거하고 새벽/야간 현재 설정 입력 불변·진입0·추가 실행0, public diagnostics 시에도 진입0 검증으로 이관했다. 테스트 명칭도 현재 검증에 맞게 바꿨다. 현재 개발 시각·8개 QA launcher 및 다른 설정 테스트는 보존했다.
- **release-one-stop-more-results**: 모든 케이스 유지. 폐기 section에 더보기 버튼이 있다는 assertion을 파일 부재로 교체하고 현재 Results의 verified more·continuation 호출을 유지했다.
- **신규 unused-ui-removal-03**: 유입0 검사1 + 삭제 목표19 =20건 추가.

총 폐기39건 / 신규20건 / 순감소19건. UI815→796, 기존 skip1 변화0. 혼합 테스트 전체를 지우거나 발견 설정을 줄이지 않았다. current-flow-refactor-safety/location-search-interaction/manual-location-restore/course-date-screen-boundary/current-course-start-expiry/guest-import-record-display의 실제 현재 경계는 미수정·삭제 전후 실행했다.

## 2. 유지한 계약·이력

현재 PlacePicker/MapPlacePicker/TimeSetup/Results/PlaceDetail/CourseConfirm/NearbyBrowse/기록/계정 화면 코드, datedSetupTime/만료 guard, App/navigation/AppFlow, 엔진/서비스/DB/카탈로그/Live Activity/native/권한 미수정. 수동 위치·GPS 미사용·기존 진행 복원·날짜·계정/동의/학습·사진 허락 정책 유지. 운영 데이터 조회/수정·실제 API·사용자 계정 생성 없음.

이전 REMOVE-02에서 개발 목적 확인 때문에 미리보기6개 보존 → 통합19개 참조 조사와 사용자 추가 제거 승인 → 동일 집합 밖 호출0 재확인 후19개 제거 → 사용하지 않는 코드와 전용 회귀의 혼동 해소 → **현행 구현·QA 수락 전**. 과거 미리보기 보존은 이번6개 범위에서 대체됐으며 현재 개발 도구 전체 삭제로 확대하지 않는다.

## 3. 자동 검증

- 삭제 전 목표: **1 PASS /19 FAIL**, `/private/tmp/unused03-red.log`.
- 삭제 전 현재 추천·검색/지도·날짜/만료·기록/진행 보존: **76/76 PASS**, `/private/tmp/unused03-before.log`.
- `npm run test:typecheck`: PASS(exit0), `/private/tmp/unused03-types.log`.
- `npm run test:ui`: **796건 /795 PASS /0 FAIL /기존 skip1**, `/private/tmp/unused03-ui.log`.
- 최종 집중12파일: **156/156 PASS, skip0**, `/private/tmp/unused03-focus.log`. 삭제 목표20건·이전 보존76건 및 변경한 혼합 파일들의 실제 설정/추천/receipt/개발 시각 검증을 포함한다. `node --import tsx --test`로 실행했으며 제품/테스트 수정 후의 결과다.
- `npm test`: **555건 /551 PASS /4 FAIL /skip0**, `/private/tmp/unused03-all.log`. QA 소유 파일의 아래3건과 하위 집계1건이며 UI 테스트 실패0과 구별한다. TypeScript/UI·기본 runner의 발견 단위가 다르므로 기본 수를 UI 순감소와 단순 합산하지 않는다.
- `node scripts/release-build.cjs export`: PASS(exit0), `/private/tmp/unused03-export.log`. 산출물 `/private/tmp/timefit-public-export/_expo/static/js/ios/index-4aabfcd729ae2d0e36ef1ca0b9268d78.hbc`. 기존 번들과 같은 파일명은 미연결 제거에 부합하는 보조 관찰이며 서명 IPA·실기기 동등성 검증으로 주장하지 않는다.
- `git diff --check`: PASS, 최종 인계 포함. 범위 밖 src/engine·services·data·supabase·ios 및 현재 App/화면 코드 diff0.

## 4. QA 후속·실기기 미확인

QA 소유 `test/map-transport-ui-contract.test.mjs`는 수정하지 않았다. 남은 세 혼합 케이스의 대체 기대:

1. `결과 진입점은 V1 대표 코스와 읽기 전용 확인 화면을 사용한다`: ConditionalVisitSection→CourseV1Journey read/assert를 제거/파일 부재로 변경하고 CourseConfirm 연결·legacy 미연결 기대 유지.
2. `URELEASEONESTOP01/UONEMORE01`: 삭제 section의 CourseV1PlacePreview/조건부 문구/확정·더보기 read/assert만 제거. 현재 single/누적 대안/verified-more/실제 continuation·카카오 앱/웹 연결 및 조건부 Results 진입0 기대는 유지.
3. `URELEASEONESTOP01: 새 V1 흐름은 체류 분을 숨기고 short 의미만 숫자 없이 표시한다`: 삭제 Journey/Preview/ListModel의 읽기와 과거 label/remaining assertion을 현행 card/detail/active 모델로 이관. 최종 review에서만 snapshot 계획 체류를 표시하고 Results·장소 상세 B·active에서 숨기는 현행 계약을 유지한다. 전부 체류 숫자 비노출이라는 과거 규칙을 복원하지 않는다.

하위 실패를 보고하는 test/index.js 집계/loader를 고치거나 skip하지 않는다. QA 이관 후 typecheck/UI/전체/export/diff를 최종 diff에서 다시 확인한다. 자동 통과 후 통합 검토→수정 빌드의 수동 검색/지도 선택→추천→코스 진행/완료/기록 및 기존 진행·LA 공유를 확인한다. 이번 실기기·Simulator·Archive·IPA·스토어 확인은 미실행이다. commit/push·운영 정리·배포는 하지 않았다.
