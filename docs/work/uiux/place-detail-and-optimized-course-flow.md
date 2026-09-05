# U-PLACE-COURSE-FLOW-01 — 장소 상세 선택과 최적 코스 단일 화면 연결

> 상태: **현행 계약 2건 복원·기존 보완 회귀 완료 / QA 최종 판정 후행**  
> 선행 결정: `DEC-PLACE-COURSE-FLOW-01` 최종 승인  
> 소유: UIUX

## 작업 명령

기존 구현 기록은 보존한다. 현재 실행할 명령은 마지막의 **현행 계약 복원 — 2026-09-05**다. 이전 보완의 `체류 분을 재노출하지 마`를 review까지 확대한 해석과 `모든 코스 connector 최대 4개` 지시는 철회한다. 그 외 세로 카드 유지·실측 패널·실행형 테스트 보완은 유지하며 다시 되돌리지 않는다.

"U-PLACE-COURSE-FLOW-01을 진행해. `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`, `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`, `docs/work/integration-decision/place-detail-and-optimized-course-flow.md`, `docs/work/uiux/README.md`와 이 작업 문서만 먼저 읽어. 과거 구현의 세부 이유가 필요한 경우에만 `two-stop-limited-assembly.md`, `course-confirm-route-geometry.md`, `active-verified-course-resume.md`, `runtime-course-auth-guard.md`, `course-completion-history.md`의 현재 인수인계 anchor를 읽어.

목표는 현재의 `추천 카드 tap 즉시 선택`, `CourseConfirm → 별도 VerifiedCourseProgress push`를 최종 승인 흐름으로 교체하는 것이다. 새 추천 정책이나 새 route 알고리즘을 만들지 말고, 엔진이 제공한 exact `VerifiedCourseV1.placeIds/stops/legs` 최적 순서 snapshot을 그대로 화면·지도·Kakao handoff에 사용해.

반드시 코드 변경 전에 실패하는 UI/계약 테스트를 먼저 만들어. 현재 과거 흐름을 강제하는 `test/ui/two-stop-selection.test.ts`, `test/ui/active-verified-course-resume.test.ts`, `test/ui/release-visual-polish.test.ts`와 관련 UI 테스트는 삭제하거나 assertion을 약화하지 말고 새 정책으로 교체해. QA 소유의 새 `test/qa-place-course-flow.test.ts`는 수정하지 마.

1단계로 장소 상세와 명시 선택을 구현해. `src/ui/nav.ts`와 `App.tsx`에 계층형 `PlaceDetail` route/screen을 추가하고, 새 `src/ui/PlaceDetailScreen.tsx`와 순수 표시/marker/selection model을 분리해. route params에 callback, provider, controller, 함수, Date, 사용자 ID를 넣지 마. JSON-safe request identity, 선택 종류(first/pair), 기존 course/session snapshot만 전달하고, UI 전용 one-shot handoff가 상세의 명시 선택 결과를 원래 Results가 focus될 때 정확히 한 번 소비하게 해. 취소·interactive back·중복 tap·stale request는 선택으로 처리하면 안 되고 중복 Results route를 push하면 안 된다.

첫 one-stop 카드 tap은 상세만 열고 `selectFirst/begin`을 호출하지 않는다. 상세의 `이 장소 선택하기`가 성공해 원래 Results로 돌아온 뒤에만 기존 `createInlineTwoStopSelectionController.selectFirst()`와 pair begin을 최대 1회 실행한다. B 카드 tap도 상세만 열고, `함께 선택하기`가 성공한 뒤에만 기존 `selectPair()`를 실행한다. 기존 A0/A1/A2 controller, `TwoStopSelectionSnapshot`, 목록·더보기·continuation·scroll 복원, tray, fixed CTA, pair loading/results/terminal, shared 36회 ledger는 재사용한다. A 삭제는 A0를 route 0회로 복원하고 B 삭제는 A1과 후보를 유지한다.

장소 상세는 지도 자체가 safe area 아래 전체 배경을 차지하고, 상단 닫기 control과 하단 floating sheet만 지도 위에 둔다. 첫 상세에는 이미 허용된 실제 현재 위치·설정 출발지·후보 장소, 두 번째 상세에는 여기에 선택 A를 표시한다. 같은 좌표의 marker는 중복 겹침을 정규화하되 의미 label은 잃지 마. 두 번째 상세에서 방문 번호·근사 경로·선택 순서를 그리지 마. 기존 `KakaoRouteMap`을 재사용하되 current marker와 configured origin을 구분할 UI 타입이 필요하면 UI 소유 타입만 최소 확장하고 기존 코스 지도 marker 회귀를 막아.

`TimeSetupScreen`에서 이미 얻은 devicePoint는 `RecommendationSession`의 optional JSON-safe `deviceLocationSnapshot`으로 UI에만 전달해. 엔진 input builder, route/API request, DB, 완료 기록, 로그, navigation URL에 전달하거나 영속 저장하지 마. 상세 진입 자체는 Location API를 다시 호출하거나 새 권한 prompt를 띄우지 않는다. snapshot이 없거나 권한 거절/GPS 실패면 설정 출발지를 fallback으로 표시하고 상세는 유지한다.

floating sheet에는 사진, 장소명, category/subCategory, optional `detailDescription`, operatingHours, 주소, `카카오맵에서 장소 보기`, 명시 선택 CTA를 표시해. `detailDescription`이 없으면 `상세 설명 없음`, 운영시간이 없으면 `운영시간 확인 필요`, 사진이 없으면 기존 카테고리 fallback을 사용한다. 설명·운영시간을 추론하거나 상세 진입마다 Kakao/TourAPI/Route Proxy를 호출하지 마. 데이터 세션이 병렬로 `detailDescription?: string`을 추가할 수 있지만 그 완료를 기다리지 않고 optional 계약으로 구현해. 카카오 장소 보기는 기존 `openKakaoPlaceWithAppFallback`을 재사용하며 선택·코스 시작·체류를 기록하지 않는다.

2단계로 코스 검토와 진행을 한 화면 상태로 통합해. `CourseConfirmScreen`을 `review | active` 상태를 가진 단일 컨테이너로 확장하고 기존 지도 geometry/endpoint walk loader, `CourseV1VerticalDetail`, `verifiedCourseProgressModel`, Kakao route handoff, AppFlow active course, runtime replacement guard, 완료 repository를 재사용해. review의 `코스 시작하기`는 새 화면을 navigate하지 않고 같은 CourseConfirm instance에서 active course를 만들고 다시 렌더해야 한다. 지도·snapshot identity·엔진 최적 방문 순서는 유지한다.

active 상태에서는 현재 다음 travel 구간의 Kakao 길찾기만 primary로 활성화한다. 미래 구간은 보이되 disabled, 완료 구간은 완료로 표시한다. handoff 성공 때만 기존 단계 전이를 허용하고 실패·invalid coordinate·중복 tap은 현재 단계와 재시도를 유지한다. 선택 순서·직선거리로 장소를 다시 정렬하거나 route를 재계산하지 마. Home의 진행 카드와 외부 Kakao 복귀는 같은 `courseRunId`·마지막 확정 단계로 통합 CourseConfirm active 상태를 연다. active 화면을 닫으면 Home으로 돌아가되 active를 제거하지 않고, 명시 취소·코스 마치기만 제거한다. 완료 기록은 같은 run에 정확히 한 번 생성해야 한다.

`VerifiedCourseProgress` 별도 route/screen은 새 production navigation에서 사용하지 않는다. 남은 참조를 확인한 뒤 안전하게 제거하거나, 마이그레이션 호환 entry가 반드시 필요하면 사용자에게 노출되지 않는 이유와 제거 조건을 기록해. 단순히 파일을 남겨 두고 두 진행 UI가 함께 살아 있게 하지 마. `App.tsx`, `src/ui/nav.ts`는 이 UIUX 세션만 수정한다.

범위 밖은 건드리지 마. `src/engine/`, `src/data/busan_poi_catalog.json`, data build script, API adapter/Edge, Supabase migration/repository 계약, `.env*`, 추천 호출 상한, 운영시간 정책, Live Activity/GPS 자동 도착은 수정하지 않는다. 새 native dependency를 추가하지 않는다.

최소 자동 검증은 A0 상세 open route/API/pair/권한 요청 0, 상세 close 완전 복원, 명시 A 선택 pair begin 1, B 상세 선택 추가 route 0, stale/double tap, A/B 삭제 복원, current/origin/candidate marker 조합과 fallback, 설명/시간/사진 있음·없음, 엔진 B→A 순서가 지도·카드·Kakao에 동일, review→active stack 증가 0, 현재 구간만 활성, handoff 성공/실패, Home 이어가기, 완료 멱등성을 포함해야 한다. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `node --test test/map-transport-ui-contract.test.mjs`, `git diff --check`를 실행해.

완료 후 이 문서에 변경 파일과 목적, 변경하지 않은 공개 계약, 테스트 명령과 수치, 제거/호환 처리한 이전 route, QA가 사용할 testID·fixture entry, 남은 실기기 위험을 기록해. 중앙 기준 문서·작업조정 보드·QA 문서는 수정하지 말고 커밋하지 마."

## 구현 순서

1. 과거 즉시 선택·별도 진행 화면을 강제하는 실패 테스트 전환
2. place detail 순수 model과 one-shot handoff
3. route/screen·지도·floating sheet
4. Results의 명시 A/B 선택 연결
5. CourseConfirm review/active 통합
6. Home resume·runtime guard·completion 연결
7. legacy progress route 정리와 전체 회귀

## 금지되는 축약

- 카드 tap을 선택으로 간주
- 상세 결과 callback을 navigation params로 전달
- 현재 위치를 추천 origin으로 몰래 교체
- 상세 진입 live API/권한 요청
- 선택 순서로 코스 번호 부여
- review에서 바로 Kakao 실행 또는 active 별도 push
- 미래 구간 길찾기 활성화
- 기존 테스트 삭제·skip으로 통과

## 완료 인수인계 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `App.tsx`, `src/ui/nav.ts`: 계층형 `PlaceDetail` route를 등록하고 JSON-safe request identity·selection kind·기존 session/course snapshot만 전달한다. 별도 `VerifiedCourseProgress` production route는 제거했다.
- `src/ui/TimeSetupScreen.tsx`: 이미 허용·획득된 `devicePoint`만 optional `deviceLocationSnapshot`으로 같은 in-memory recommendation session에 보존한다. 엔진 input builder는 기존 필드만 명시 투영하므로 위치 snapshot을 엔진·route request로 전달하지 않는다.
- `src/ui/placeDetailModel.ts`, `src/ui/PlaceDetailScreen.tsx`: one-shot 선택 handoff, stale/연타/cancel 차단, current/origin/selected/candidate marker와 동일 좌표 label 병합, 원천 상세·운영시간·사진 fallback, 전체 지도와 safe-area floating control/sheet, 기존 Kakao place app→HTTPS→browser fallback을 구현했다.
- `src/ui/ResultsScreen.tsx`: one-stop/B 카드 tap은 상세만 열고, 상세의 명시 선택 결과가 원래 Results focus에서 소비된 뒤에만 기존 `selectFirst`/`selectPair`를 최대 한 번 실행한다. 기존 A0/A1/A2 snapshot·scroll·continuation·tray·fixed CTA·36회 ledger는 그대로 재사용한다.
- `src/ui/KakaoRouteMap.tsx`: 기존 코스 marker kind를 유지하면서 상세 전용 current/selected/candidate kind와 표시 label을 최소 확장했다.
- `src/ui/CourseConfirmScreen.tsx`, `src/ui/courseConfirmActiveModel.ts`, `src/ui/activeVerifiedCourseModel.ts`: exact `placeIds/stops/legs` 순서를 재정렬 없이 review/active 한 화면에서 사용한다. 시작은 stack push 없이 같은 instance를 active로 바꾸며, 현재 travel만 길찾기 가능하고 성공 때만 기존 progress를 전이한다. 기존 Home 이어가기 화면은 변경하지 않고 projection target만 같은 `courseRunId`와 progress를 가진 `CourseConfirm`으로 바꿨다. 명시 완료는 기존 로컬 completion controller를, 명시 취소는 active clear를 사용한다.
- `src/ui/VerifiedCourseProgressScreen.tsx`: production route와 함께 제거했다. 진행 모델은 `src/ui/recommendation/verifiedCourseProgressModel.ts`에 단일 상태 계약으로 남아 통합 화면이 재사용한다.
- `test/ui/place-detail-and-optimized-course-flow.test.ts`: 실패 선행 PF fixture 6건을 추가했다. `active-verified-course-resume`, `course-completion-history`, `release-visual-polish`, `runtime-course-auth-guard`, `map-transport-ui-contract`의 과거 별도 진행 화면 source assertion만 승인된 통합 화면으로 교체했으며 assertion 삭제·skip은 하지 않았다.

변경 이력 상태는 `카드 tap 즉시 선택·별도 progress push → 장소 확인 전 선택과 중복 화면 문제 → 상세의 명시 선택·CourseConfirm review/active → 탐색/확정 의미와 exact snapshot을 한 화면에서 일치시키기 위함 → 현행 구현 완료`다.

### 2. 변경하지 않은 공개 계약·정책 경계

- `src/engine/`, 추천/API adapter·Edge, `src/data/busan_poi_catalog.json`, data build script, Supabase migration/repository, 완료 repository 계약, Live Activity를 수정하지 않았다.
- 최대 120분·도착 여유·최소 20분, one-stop 8회/더보기 8회, pair 3/6/36회 ledger, 조건부 10:00~18:00, exact 최적 순서·동률 A 우선과 Kakao handoff 계약을 유지했다.
- `deviceLocationSnapshot`은 UI marker에만 사용한다. 위치 권한 재요청·Location API 호출·추천 origin 교체·navigation URL·로그·영속 저장은 추가하지 않았다.
- 상세 설명과 운영시간은 카탈로그 값만 표시하며 각각 `상세 설명 없음`, `운영시간 확인 필요`로 fail-safe한다. DATA 작업의 optional `detailDescription` 유무는 UI 진행을 차단하지 않는다.
- 중앙 기준 문서·작업조정 보드·QA 문서는 수정하지 않았고 commit/push도 하지 않았다.

### 3. 실행한 테스트와 결과

- 실패 선행: `npx tsx --test test/ui/place-detail-and-optimized-course-flow.test.ts` → `placeDetailModel` 미구현으로 0 pass / 1 fail을 확인했다.
- 집중 PF fixture: 같은 명령 → 6/6 통과. A0 open/close의 route API·pair·권한 0, JSON-safe params, one-shot/stale/연타/cancel, marker 조합·fallback, 상세 값 있음/없음, B→A 순서·현재 travel 단독 활성, production route 통합을 확인했다.
- `npm run test:typecheck` → 통과.
- `npm run test:ui` → 310 total, 309 pass, 기존 의도적 skip 1, fail 0.
- `npm test` → 117/117 통과.
- `node --test test/map-transport-ui-contract.test.mjs` → 14/14 통과.
- `git diff --check` → 통과.
- 지시된 QA 소유 후보 `test/qa-place-course-flow.test.ts`는 현재 worktree에 존재하지 않아 수정하지 않았고 별도 실행값도 만들지 않았다. core 전체 회귀의 TypeScript discovery와 신규 UI fixture는 통과했다.

### 4. QA fixture entry·다음 결정/위험

- QA entry/testID: `verified-course-card-{courseId}` → `place-detail-close` / `place-detail-sheet` / `place-detail-kakao` / `place-detail-select` → `two-stop-selection-tray` / `two-stop-fixed-cta` → `verified-course-start` → `active-course-current` / `active-step-current|future|complete` / `verified-progress-primary` / `active-course-cancel` / `finish-without-record`.
- fixed fixture는 one-stop A, exact `B→A` pair, 현재 위치=출발지/다름/없음, 설명·운영시간·사진 있음/없음, Kakao handoff 성공/실패, completion `created/already_completed/storage_*`를 사용하면 된다. 실제 API 호출 없이 UI flow를 재현할 수 있다.
- 남은 실기기 위험은 작은 iPhone에서 전체 지도 viewport와 하단 sheet/홈 인디케이터, interactive back 뒤 A0/A1 scroll 완전 복원, 외부 Kakao 복귀 뒤 같은 active 단계, 2곳 B→A marker·카드·길찾기 순서다. QA가 internal build에서 smoke 1회 확인해야 한다.
- `VerifiedCourseProgress` route/screen은 호환 entry 없이 제거됐다. 현재 repository 내부 production 참조가 없고 Home·신규 시작이 모두 `CourseConfirm`을 사용하므로 제거 조건을 충족한다. 과거 deep link나 외부 저장 route는 공개 계약이 아니며 발견되면 새 화면을 되살리지 말고 `CourseConfirm { session, course, activeId }`로 마이그레이션한다.

## 수락 전 보완 — 2026-09-05

**이력 주의:** 아래 보완 명령 중 review 체류 분 비노출 및 코스 수 구분 없는 connector 최대 4개는 잘못된 지시이며 철회됐다. 마지막 `현행 계약 복원`을 우선한다. 나머지 보완 범위는 유효하다.

### 목적·판정·기존 요구사항 관계

- 부모 결정: `DEC-PLACE-COURSE-FLOW-01` 최종 승인. `COURSE-10/11/12/15`, `UXV-43/44/46/55`의 **보완**이며 추천 정책 변경이나 신규 화면 기획이 아니다.
- 확정된 코드 관찰: CourseConfirm의 review 분기만 `CourseV1VerticalDetail`을 렌더하고 active 분기는 텍스트 목록으로 교체한다. 승인된 지도·세로 장소 코스 유지와 다르다.
- 확정된 코드 관찰: PlaceDetail은 내용에 따라 커지는 absolute sheet를 사용하지만 지도 bottom padding은 `360 + safe area`로 고정되어 있다. 작은 화면·긴 내용에서 가림이 발생할 위험은 확인됐으나 실제 기기별 가림 높이를 측정한 것은 아니다. 고정 fixture로 먼저 재현·측정한다.
- 확정된 검증 한계: 신규 테스트의 route/pair/permission 카운터는 실제 동작에 연결되지 않고 0으로 선언된 값만 비교한다. 순수 handoff 테스트와 source 문자열 검사는 유용하지만 production 연결의 무호출·정확히 한 번 실행을 입증하지 못한다.
- 변경 이력: `구현 완료 보고 → 위 계약 누락·레이아웃 위험·검증 공백 관찰 → 공통 세로 코스 유지·측정 기반 상세 영역·실행형 계약 검증 → 사용자 승인 흐름을 회귀 없이 충족 → 수락 전 보완`. 기존 완료 보고는 당시 작업 이력이며 최종 수락을 뜻하지 않는다.

### 복사해서 전달할 보완 명령

```text
U-PLACE-COURSE-FLOW-01의 수락 전 보완 전체를 수행해. AGENTS.md, docs/README.md, docs/work/uiux/README.md, 기존 공통 UIUX 규칙·테스트명세, 부모 결정과 이 문서의 최초 명령·완료 인수인계·보완 절을 읽고 시작해. 기존 완료 기록만 보고 아래 세 항목 중 일부를 생략하지 마. 제품 코드는 UIUX 소유 경계에서만 변경한다.

1. 코스 시작 전후 같은 지도와 세로 장소 코스를 유지해.
CourseConfirmScreen의 review/active 렌더 분기를 먼저 확인하고, 시작 시 장소 카드가 없어지는 실패 fixture를 작성해. 지도·최적 순서의 세로 장소 카드·이동 구간은 공통 표시 트리로 유지하고 현재/완료/미래 상태와 행동 영역만 전환해. 기존 CourseV1VerticalDetail을 확장하거나 UI 표시 컴포넌트로 분리하되 코스 UI를 두 벌 복제하지 마. 장소 사진·이름·카테고리·기존 시간 표시 정책을 보존하고 체류 표시는 마지막 현행 복원 명령대로 review에만 허용하고 active에서는 숨긴다.
review는 코스 시작하기만 진행 행동으로 제공한다. 카카오 장소 보기는 정보 확인이며 길찾기·체류·선택을 시작하지 않는다. active는 세로 코스의 해당 구간에 현재 길찾기 행동을 연결하고 미래 구간은 비활성, 완료 구간은 완료로 표시해. 도착지/출발지 복귀 마지막 leg도 빠뜨리지 마. 별도 텍스트 목록으로 장소 카드를 대체하거나 같은 길찾기 primary를 여러 개 만들지 마.
기존 progress model의 이동 완료·다음 구간·마지막 완료 의미는 유지해. 외부 앱 열기 성공은 실제 도착을 뜻하지 않으므로 GPS/예상 시각으로 방문·체류를 합성하지 마. handoff 실패·invalid·연타는 단계 유지, 성공만 기존 전이이며 완료 저장 실패의 재시도/기록 없이 마치기도 보존한다. 같은 CourseConfirm instance, courseRunId, snapshot, Home 이어가기, 교체 확인, 완료 멱등성을 유지한다.

2. 상세 패널과 지도 viewport를 내용·화면 크기에 맞게 연결해.
PlaceDetailScreen의 sheet 실측 높이와 지도 boundsPadding이 어긋나는 조건을 먼저 검증해. 설명 없음/240자, 여러 줄 운영시간·긴 주소·긴 제목, 위치 fallback·외부 링크 오류, 작은 iPhone 크기·큰 글씨를 fixture로 조합한다. 모든 조합을 실제 기기로 반복하지 말고 고정 레이아웃 입력과 표시 계약으로 먼저 검사한다.
패널에 화면 크기·safe area를 반영한 최대 높이를 두고 긴 정보는 패널 내부에서 스크롤 가능하게 해. 명시 선택 CTA는 정보 스크롤 밖의 하단 safe area 위에 유지한다. 지도에서 현재 위치·설정 출발지·후보가 보일 공간과 닫기 control을 확보하고 패널 실측 또는 공통 레이아웃 모델의 높이를 viewport padding에 반영한다. 고정 360을 다른 고정 숫자로 바꾸는 것으로 끝내지 마. 접힘/확장은 필요한 경우에만 도입하고 복잡한 새 native 의존성은 추가하지 않는다. 큰 글씨를 막거나 설명을 없애는 방식으로 해결하지 마. 단순 재렌더마다 지도를 다시 중앙 정렬해 사용자의 pan을 뺏지 않도록 위치 집합·실제 레이아웃 변경을 구분한다.

3. 실제 production 연결을 실행하는 계약 테스트로 보완해.
선언만 한 0 카운터를 합격 근거로 쓰지 마. 화면이 실제 사용하는 selection/navigation orchestration에 fake pair port, route/connector port, permission port, external opener, completion repository를 연결하고 이벤트를 실행해 호출 수·순서·상태·route identity를 assert해. 필요하면 연결 로직을 UI 전용 controller로 추출하되 테스트 전용 가짜 흐름을 만들지 마. 문자열 존재 검사는 보조로만 남긴다.
필수 시나리오는 카드 열기/닫기, interactive back, 명시 A 선택 후 focus 중복, B 상세 닫기/선택, stale request, A/B 삭제와 늦은 pair 응답, review→active, 현재 구간 실패/성공/연타, Home 복귀, 명시 완료 중복/저장 실패다. 세로 카드의 동일 ID·최적 순서·현재 action 상태를 review/active에서 비교한다. B→A 최적 fixture도 사용하고 선택 순서로 재정렬하지 않는다.
호출 기준을 구분해. 상세 열기/닫기와 카카오 장소 보기에는 추천/pair/route/저장/권한 요청이 없다(장소 보기 external opener는 허용). 명시 A 선택은 기존 selectFirst/pair begin 최대 한 번과 기존 36회 session ledger를 허용한다. B 선택과 A/B 삭제는 기존 검증 결과·snapshot을 재사용한다. CourseConfirm 최초 진입은 기존 COURSE-11/UXV-46의 필요한 endpoint walk connector 1곳 최대 4개·2곳 최대 6개만 허용하며 추천/transit/최적화 재계산은 금지한다. 같은 코스 재렌더·review→active·재진입은 기존 connector 결과를 재사용한다. 시작은 in-memory active 생성이지 완료 저장이 아니며 명시 완료만 기존 completion repository를 호출한다. 자동 테스트의 실제 네트워크·운영 DB 호출은 항상 0이다.

src/engine, API adapter/Edge, repository/DB, 데이터 catalog/build script, .env, 호출 상한과 운영시간 정책, Live Activity는 수정하지 마. DATA-PLACE-DETAIL-01의 optional detailDescription과 fallback을 그대로 소비하고 설명 확충을 다시 작업하지 마. QA 소유 test/qa-place-course-flow.test.ts 및 fixture, 중앙 문서는 수정하지 않는다. 기존 Results/controller/continuation을 새 구현으로 갈아엎지 마.

실패 선행 fixture를 확인한 뒤 구현하고, 집중 UI 계약 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check를 실행해. iOS 번들 export 또는 고정 fixture E2E도 하나 실행하고 정확한 명령·결과를 남겨. 추가 skip·assertion 삭제로 통과시키지 마. 시뮬레이터 수동 순회·반복 앱 삭제·env 변경·실제 API 반복 호출은 하지 않는다. 최종 실기기 smoke는 QA 자동 통과 뒤 한 번 요청한다.

완료 인수인계를 이 문서에 별도로 추가해: 변경 파일/목적, 유지한 계약, 실행한 테스트·실패 선행 및 최종 수치, 레이아웃 fixture 크기/글씨 조건과 결과, QA의 실행 가능한 entry/testID, 미검증 실기기 항목. 세 보완 항목 각각 충족 근거를 기록하고 하나라도 미충족이면 완료라고 쓰지 마. 커밋하지 마.
```

### 다음 작업·병렬 경계

- UIUX 보완은 한 세션에서 처리한다. CourseConfirm·표시 컴포넌트·테스트의 중복 편집을 피한다.
- QA는 새 fixture 설계만 병렬 가능하다. 최종 게이트와 실기기 smoke는 이 보완 인수인계 검토 후 진행한다.
- 엔진/API/DB/데이터 추가 작업은 열지 않는다. 해당 경계의 결함이 실제 fixture로 재현될 때만 별도 인계한다.

## 수락 전 보완 완료 인수인계 — 2026-09-05 UIUX

이 절은 앞선 반려된 완료 기록을 대체하는 보완 실행 결과다. 세 보완 항목의 구현과 지정 자동 검증을 완료했으며, 실제 iOS 레이아웃·제스처를 검증 완료로 주장하지 않는다. 최종 수락은 QA 후행이다.

### 1. 변경 파일 / 변경 목적

- `src/ui/CourseConfirmScreen.tsx`, `src/ui/recommendation/CourseV1VerticalDetail.tsx`, `src/ui/courseConfirmActiveModel.ts`: review와 active가 같은 지도·세로 코스 트리를 사용한다. B→A snapshot의 장소 카드 ID, 사진, 이름, 활동과 이동 순서를 유지하고 마지막 도착/복귀 leg도 같은 트리에 둔다. 별도 active 텍스트 목록으로 교체하지 않는다. 현재 travel(체류 중에는 다음 travel) 안에 `verified-progress-primary` 하나만 배치하고 미래 구간은 비활성 상태, 지난 구간은 완료로 표시한다. 외부 앱 열기 성공만으로 현재 이동을 완료로 표시하지 않는다. 동일 tick 이동 완료 연타와 늦은 외부 성공은 원본 progress 객체를 비교해 새 상태를 덮어쓰지 않는다.
- 같은 CourseConfirm에서 시작·진행을 유지하고 `usePreventRemove`로 active native back을 Home 복귀에 연결했다. 의도적인 완료/기록 없이 마치기/취소 navigation은 guard를 해제한 다음 수행한다. 완료 repository 실패·동일 입력 재시도·기록 없이 마치기 계약은 유지한다.
- 최종 코스의 기존 connector builder/port는 그대로 사용하되 이 화면의 요청을 `.slice(0, 4)`로 제한했다. 현재 공용 builder는 two-stop에 최대 6개를 반환하므로, 이 작업의 COURSE-11/보완 명령 최대 4개 경계를 화면 진입점에서 지킨다. 포트의 기존 in-flight/10분 메모리를 재사용하며 추천·transit 재검증은 하지 않는다.
- `src/ui/PlaceDetailScreen.tsx`, `src/ui/placeDetailLayout.ts`: window/safe-area를 반영한 패널 최대 높이, 정보 영역 내부 ScrollView, 스크롤 밖 선택 CTA를 연결했다. sheet `onLayout` 높이 + 16px를 지도 bottom padding에 반영하고, 닫기 영역 66px와 화면 높이에 비례한 최소 지도 영역을 남긴다. 고정 360px padding을 제거했고 글씨 크기 제한이나 설명 생략은 추가하지 않았다.
- `src/ui/KakaoRouteMap.tsx`: WebView 초기 HTML을 동일 instance 동안 유지한다. 실행 중 위치·route geometry·bounds padding의 값이 실제 바뀔 때만 `setBounds`하고, label/행동 상태만 바뀌거나 같은 값 배열을 다시 생성한 렌더는 사용자의 pan을 유지한다.
- `src/ui/ResultsScreen.tsx`: 기존 inline controller·continuation은 교체하지 않았다. Results focus에서 선택 소비 후 요청을 닫고, Results unmount에서도 미소비 요청을 폐기해 interactive back·stale 상세가 뒤늦게 선택되지 않게 했다.
- `test/ui/place-course-screen-runtime.test.mjs`, `test/ui/support/screenRuntime.mjs`: production TSX 함수·hook 상태·effect·실제 event handler를 실행하는 고정 native host를 추가했다. Results/PlaceDetail/CourseConfirm/세로 카드/지도 bridge 코드를 실행하며 pair, 위치 권한, connector, external opener, completion 경계를 fixture로 교체한다. 테스트용 선택/진행 흐름을 별도로 구현하지 않았다. 전역 fetch는 실패 spy로 막고 각 fixture 종료에 실제 네트워크 시도 0을 확인한다.
- `test/ui/place-detail-and-optimized-course-flow.test.ts`: 선언만 한 route/pair/permission 0 카운터를 실행형 fixture로 대체하고, 외부 handoff 성공 후에도 현재 이동이라는 assertion으로 교체했다. JSON-safe·원천 fallback·marker·one-shot 순수 검증은 유지했다.

변경 이력: `active에서 카드 제거·고정 패널 padding·선언형 0-call → 실제 화면 실행에서 카드 소실/측정 미연결 및 반환 요청 잔존 확인 → 공통 표시 트리·실측 연동·실행형 연결 검증 → 승인된 탐색/명시 선택/단일 코스 흐름을 유지하기 위함 → 보완 구현 및 자동 검증 완료, QA 수락 대기`.

### 2. 유지한 계약 / 수정하지 않은 경계

- 엔진 exact `placeIds/stops/legs` 순서와 snapshot identity, 같은 Results/ScrollView, A0/A1/A2 controller, frozen seed와 session ledger 36회, one-stop 8회/명시 더보기 8회 및 기존 운영시간·최소 체류 정책을 변경하지 않았다. 관련 기존 two-stop 회귀도 모두 실행했다.
- 상세 open/close/interactive back/카카오 장소 정보는 추천·pair·route·connector·완료 저장·위치 권한 요청 0이다. 정보 외부 opener만 허용하며 명시 A 선택 후에만 기존 pair begin이 1회 실행된다. B 선택·삭제와 A 삭제는 결과/snapshot을 재사용한다.
- 시작은 메모리 active 생성일 뿐 저장·길찾기가 아니다. 외부 실패/invalid/연타는 진행을 유지하고, 사용자 명시 완료만 기존 로컬 completion repository를 사용한다. 같은 run의 중복 완료 차단·저장 실패 재시도 입력 identity·기록 없이 마치기를 보존했다. 좌표/사용자 ID/실제 체류 추정/서버 업로드를 completion에 추가하지 않았다.
- 이번 명령의 체류 분 비노출을 review/active 공통 표시 트리에 적용했다. short의 `가볍게 둘러보기`, 전체 코스 시간·구간 이동 분·도착 여유는 유지한다. 순수 snapshot/model의 stayMin이나 엔진 계산값은 바꾸지 않았다.
- 이 보완 세션은 `App.tsx`, nav, Home, AppFlow, 엔진, API adapter/Edge, DB/repository, catalog/build script, `.env*`, native dependency, Live Activity와 중앙 문서·보드·QA 파일을 수정하지 않았다. 시작 시 존재한 타 세션 수정·삭제는 되돌리지 않았으며 stage/commit/push하지 않았다.

### 3. 테스트 결과 / 실패 선행 / 세 항목 충족 근거

- **실패 선행:** 실제 CourseConfirm에서 B/A의 카카오 장소 링크·카드가 review에는 2개, 시작 직후 0개로 사라지는 assertion과 PlaceDetail `onLayout` 미연결 assertion이 **0 pass / 2 fail**이었다. 구현 뒤 같은 테스트가 통과했다. 추가로 2곳 transit gap fixture의 connector **6회 ≠ 허용 4회**, active native back 연결 부재, Results unmount 뒤 stale 선택 **true ≠ false**를 각각 재현한 뒤 보완했다.
- **공통 코스 증거:** 실제 `코스 시작하기` handler 연타는 start 1회·새 navigation 0이다. review/active 카드 및 사진은 B→A 그대로다. 1곳/2곳의 현재→체류→다음 구간→마지막 도착, app 실패/성공/연타, invalid 좌표 및 app/HTTPS/browser 전부 실패, 늦은 응답, Home에서 같은 run/단계 재진입, 완료 저장 실패/재시도/중복/기록 없이 마치기를 실행했다. 최초 필요한 connector 4회 뒤 렌더·시작·재진입의 신규 시도 증가 0도 기존 캐시 포트에 fake auth/edge를 주입해 확인했다.
- **패널 증거:** `320×568(top20/bottom0)`, `375×667(top20/bottom0)`, `390×844(top47/bottom34)` × 글씨 배율 `1/1.6/2` × 설명 없음/240자·여러 줄 운영시간/긴 주소 × 위치 fallback 유무 × 외부 오류 유무 = **72조합**이다. 실제 PlaceDetail 표시 코드를 실행하고 고정 native `onLayout` 입력을 주입해 bounds padding 일치, 최소 지도 공간, safe-bottom 선택 CTA, 정보 ScrollView 밖 CTA, 오류/fallback 문구를 확인했다. 별도 320×568/bottom16 fixture는 실측 입력 310→map bottom326을 확인한다. 이것은 Yoga/실기기 문자 높이를 측정한 결과가 아니라 고정 레이아웃 입력 검증이다.
- **연결 증거:** 실제 Results 카드 callback→PlaceDetail 명시 CTA→원래 Results focus를 실행했다. A0 상세 연타 navigation 1회, 닫기/interactive back 시 미선택, A 선택 focus 중복 begin 1회, B 닫기/선택/삭제, A 취소 목록·scroll720 복원, 다른 A branch 취소 중 late pair 응답 무시, stale/unmount 요청 거절을 확인했다. 선언만 한 0 카운터를 근거로 쓰지 않는다.
- 집중: `npx tsx --test test/ui/place-detail-and-optimized-course-flow.test.ts test/ui/place-course-screen-runtime.test.mjs` → **17/17 pass**. 로그 `/private/tmp/timefit-place-focused.log`.
- `npm run test:typecheck` → **exit 0**.
- `npm run test:ui` → **321 total / 320 pass / 기존 skip 1 / fail 0**. 로그 `/private/tmp/timefit-place-ui-tests.log`. 추가 skip은 없다.
- `npm test` → **129/129 pass**. 로그 `/private/tmp/timefit-place-core-tests.log`. 최초 실행에서 신규 mjs fixture의 plain Node TypeScript import 호환 오류가 나서, 설치된 `tsx/cjs` 등록과 동일 CJS module instance로 수정한 후 전체 재실행했다. tsx CLI의 sandbox IPC EPERM은 승인 환경에서 동일 명령을 재실행했다.
- `node --test test/map-transport-ui-contract.test.mjs` → **14/14 pass**. `git diff --check` → **exit 0**.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-place-course-ios.AqVUPF` → **exit 0**, iOS Hermes bundle 1개(4.7MB)·metadata 생성. 로그 `/private/tmp/timefit-place-ios-export.log`. Simulator/실기기/실제 API를 실행하지 않았으며 env 파일 변경·앱 삭제·원격 배포도 없다. 로그/번들은 임시 경로라 장기 보존 자료가 아니다.

### 4. 다음 결정·위험 / QA 실행 entry

- QA 자동 entry는 위 집중 명령의 `test/ui/place-course-screen-runtime.test.mjs`다. production 연결 11개 실행형 테스트와 순수/source 보조 6개를 구분해 검토한다. native host는 React Native/Yoga나 실제 iOS stack 구현을 대체하지 않는다.
- testID: `place-detail-close`, `place-detail-sheet`, **`place-detail-information`**, `place-detail-kakao`, `place-detail-select`; `verified-course-start`; **`course-stop-{placeId}`, `course-leg-{0..N}`**; `active-course-current`, `active-step-current|future|complete`, `verified-progress-primary`, `active-course-cancel`, `finish-without-record`. 현재 progress primary는 세로 코스 안에 정확히 하나다.
- QA 최종 자동 게이트 통과 뒤 **실기기 smoke 1회**를 요청한다. 작은 iPhone·큰 글씨에서 지도 marker/닫기/패널/CTA 가림과 정보 스크롤, 상세 interactive pop의 Results 복원, active native back→Home 이어가기, 카카오 복귀 후 B→A 카드/출발·도착 순서만 묶어 확인한다. 이번 세션은 native 픽셀 배치·VoiceOver·제스처 성공을 검증했다고 주장하지 않는다.
- 통합 역할 확인: 중앙 문서 일부는 아직 코스 확인의 맥락형 `둘러보기 약 N분`을 허용하지만 이번 보완 명령은 체류 분 재노출 금지를 명시한다. 이번 구현은 최신 명시 지시를 따랐으며 중앙 문구의 정합성 정리는 단일 작성자에게 남긴다. 공용 connector builder의 최대 6개 계약은 변경하지 않고 이 화면만 명시 상한 4개로 제한했다. 4개 이후 미보충 gap은 직선으로 메우지 않는다.
- 강제 종료 복원/Live Activity/실제 체류/서버 개인화는 여전히 후속이며, 이번 수락 범위를 확장하지 않는다.

## 현행 계약 복원 — 2026-09-05

### 근거·책임·범위

이 복원은 사용자가 승인한 기존 계약을 회복하는 작업이다. 새 기능이나 API 예산 증액 결정이 아니다. 통합 세션이 과거 전체 체류 분 비노출과 one-stop 전용 4개 한도를 재도입한 것이 원인이며 UIUX는 해당 지시대로 구현했다.

| 구분 | 원래 현행 근거 | 잘못된 보완 결과 | 복원 기준 |
| --- | --- | --- | --- |
| 체류 표시 | 추천로직의 2026-09-02 `출시 코스 카드·상세 시간 표현 재구성`, REC-30, 공통 규칙의 코스 확인 한정 표시 | 공통 카드에서 review까지 체류 분 제거 | review만 snapshot 선택 체류 표시. Results·PlaceDetail B·active는 비노출 |
| 도보 connector | 추천로직의 2곳 geometry 최대 6회, two-stop-limited-assembly의 2곳 3 legs 소비자 계약 | CourseConfirm `.slice(0, 4)`로 5·6번째 잘림 | 1곳 최대 4개 / 2곳 최대 6개, 필요한 누락 endpoint만 |

관계는 `REC-30`, `COURSE-03/11/15`, `UX-27`, `UXV-44/46`의 정합성 복원이다. `전체 비노출·일괄 4개 지시 → 현행 범위 오적용 → 모드별 표시·코스별 상한 복원 → 승인된 정책·경로 연속성 보존 → 복원 승인·구현 대기`로 기록한다. 예전 two-stop 문서의 카드 즉시 선택·B 전체시간 표시는 복원 대상이 아니다.

### UIUX 실행 명령

```text
U-PLACE-COURSE-FLOW-01의 “현행 계약 복원 — 2026-09-05”를 수행해. AGENTS.md, docs/README.md, 현재 UIUX 공통 규칙, UIUX 테스트명세의 UXV-44/46, docs/테스트.md의 REC-30·COURSE-03/11/15, 이 문서의 복원 기준을 먼저 대조해. 과거 작업명이나 가장 최근 완료 보고 하나만으로 기준을 선택하지 마. 아래 두 항목만 복원하고 이미 통과한 보완 3개는 유지해.

1. review에만 계획 체류 표시를 복원한다.
CourseConfirmScreen이 CourseV1VerticalDetail에 review/active 표시 모드를 명시적으로 전달하게 해. progress 유무만으로 review를 추정하면 active 상태 누락/복구 중 잘못 노출될 수 있으므로 명시 모드를 사용한다. 공유 컴포넌트의 다른 호출부도 검색해 영향을 확인하고 누락된 모드를 암묵적으로 review 처리하지 마.
review에서는 기존 courseV1CardDetailModel의 stop.stayLabel을 사용해 “둘러보기 약 N분”, short는 “가볍게 둘러보기 약 N분”을 표시한다. N은 각 stop의 검증 snapshot stayMin이며 30 상수, 카탈로그 최대, 남은 시간 또는 실제 관측 체류로 바꾸지 않는다. active에서는 분을 숨기고 short일 때만 “가볍게 둘러보기”를 유지한다. Results 카드와 선택 전 전체 지도형 PlaceDetail B에는 체류 분을 추가하지 않는다. 전체 코스 합계·구간 이동 분·여유시간은 기존대로 유지한다.
지도·세로 카드·ID·순서·사진·이동 구간은 그대로 유지하고 모드별 체류 문구만 바꾼다. 별도 진행 화면이나 두 벌의 코스 트리를 만들지 않는다.

2. 2곳 코스 endpoint walk 최대 6개 계약을 복원한다.
CourseConfirmScreen의 무조건 .slice(0, 4)를 제거하고 이미 존재하는 유효 1곳/2곳 snapshot builder와 loader를 재사용한다. builder가 1곳 최대 4, 2곳 최대 6을 보장하는지 먼저 테스트로 확인한다. 단순히 모든 요청을 6개로 자르거나 새 route 정책을 만들지 마. 손상 snapshot의 처리도 기존 fail-closed 계약을 유지한다.
1곳은 2 legs×양 endpoint=최대 4개, 2곳은 3 legs×양 endpoint=최대 6개다. 실제 transit endpoint와 geometry 사이가 50m를 초과하는 누락 부분만 요청하므로 최대치를 채우기 위해 호출하지 않는다. 상세 정보 B 진입은 0회이며 선택 후 최종 CourseConfirm에서만 실행한다. 동시 최대 2개, 기존 in-flight/10분 메모리·TTL·부분 실패를 유지한다. 캐시 유효 기간의 동일 코스 재진입/재렌더/review→active에서는 신규 provider 시도가 없어야 한다. TTL 만료 후 재진입은 기존 port 정책을 따르며 무기한 0회를 약속하지 않는다.
5·6번째 성공 connector도 올바른 마지막 leg 앞/뒤에 합성되는지 확인한다. 실패 구간은 부분 선과 안내를 유지하고 직선으로 채우지 않는다. 보충 시간은 추천 합계·순위·통과 판정에 더하지 않는다. 추천 session 36 attempt와 별도 geometry 예산을 섞거나 엔진/API port를 수정하지 않는다.

먼저 현재 코드에서 실패하는 두 fixture를 추가해: review의 서로 다른 stayMin(예: short 20, recommended 35) 표시, 2곳 세 transit legs의 누락 endpoint 6개 요청 및 5·6번째 성공선 합성. 예전 “체류 숫자 항상 없음”, “2곳도 4회” assertion은 철회한 지시 기반임을 기록하고 새 정책으로 교체한다. 테스트 삭제·skip 또는 숫자만 4→6으로 바꿔 통과시키지 않는다.
추가 반례는 review→active→Home 재진입 비노출, Results/B 비노출, 1곳 4·2곳 6·누락 0·50m/51m·walk-only 0, 성공/부분 실패·캐시 유효 재진입/TTL 만료·동시 최대 2·B→A 실제 순서다. 실제 production 연결 handler와 기존 fake port를 사용한다. 실제 네트워크/운영 DB 호출은 0이다.
기존 상세 후 선택·A/B 삭제 복원·실측 sheet·지도 pan 유지·현재 구간 단일 CTA·native back·handoff 실패/연타·완료 저장 멱등성 회귀를 보존한다. src/engine, API adapter/Edge, DB/repository, 데이터, .env, Live Activity, 공개 예산을 수정하지 않는다. QA 소유 테스트와 중앙 문서를 직접 수정하지 않는다.
집중 UI 테스트, npm run test:typecheck, npm run test:ui, npm test, node --test test/map-transport-ui-contract.test.mjs, git diff --check를 실행하고 iOS 번들 또는 고정 fixture E2E를 검증한다. 시뮬레이터 수동 순회·앱 삭제·원격 배포는 하지 마. 실기기 smoke는 QA 자동 통과 뒤 한 번 진행한다.
이 문서에 복원 완료 기록을 추가해: 변경 파일/목적, 보존 계약, 실패 선행과 최종 테스트 결과, review/active 표시와 1곳/2곳 호출·geometry 결과, QA entry와 미검증 실기기 항목. 커밋하지 마.
```

### 게이트

두 복원과 기존 세 보완 회귀가 통과하면 QA-PLACE-COURSE-FLOW-01을 진행한다. UIUX 작업은 단일 작성자로 수행하고 QA는 fixture 준비만 병렬 가능하다. 다른 역할의 기능 작업은 열지 않는다.

## 현행 계약 복원 완료 인수인계 — 2026-09-05 UIUX

### 1. 변경 파일 / 목적

- `src/ui/CourseConfirmScreen.tsx`: 공통 세로 코스에 명시적인 `mode={mode}`를 전달한다. 무조건 `.slice(0, 4)` 하던 화면 제한을 제거하고 기존 유효 snapshot connector builder/loader를 그대로 사용한다. 새 상한·조회 정책이나 포트를 만들지 않았다.
- `src/ui/recommendation/CourseV1VerticalDetail.tsx`: 필수 `mode: 'review' | 'active'`를 받는다. `mode === 'review'`일 때만 기존 `stop.stayLabel`을 표시한다. active 및 런타임 mode 누락은 분을 숨기며 short의 `가볍게 둘러보기`만 유지한다. production 호출부 검색 결과 CourseConfirm 한 곳이며 명시 모드 전달을 확인했다. progress 유무로 review를 추정하지 않는다.
- `test/ui/place-course-screen-runtime.test.mjs`: 철회된 일괄 4회 assertion을 1곳/2곳 × 전체 성공/부분 실패의 실제 CourseConfirm 실행형 검증으로 교체했다. 숫자만 바꾸지 않고 마지막 connector 앞뒤 합성·최종 endpoint·동시성·캐시·TTL·시간 snapshot 불변을 확인한다. 서로 다른 체류 20/35분의 review→active→Home 복원, mode 누락/active progress 부재, Results 요약 카드·PlaceDetail B 비노출, 필요한 gap만 호출하는 반례를 추가했다.
- 이 작업 문서만 상태와 완료 인계를 갱신했다. 이전 기록의 review 전체 비노출·모든 코스 4개 한도는 철회 이력으로 보존한다.

이력: `잘못된 보완 지시의 review 비노출·일괄 4개 → 계획 체류 정보와 두 번째 장소 이후 연결선 누락 → 명시 모드별 표시·기존 1곳4/2곳6 builder 재사용 → 사용자 승인 현행 계약 회복 → 복원 구현·자동 검증 완료, QA 최종 수락 대기`.

### 2. 보존 계약

- review의 short 20분은 `가볍게 둘러보기 약 20분`, recommended 35분은 `둘러보기 약 35분`으로 원본 snapshot대로 표시한다. Results·장소 정보 상세 B·active에서는 계획 체류 분을 표시하지 않는다. 총 코스 합계·각 이동 분·도착 여유·사진·카드 ID·B→A 순서와 동일 지도/세로 트리는 유지한다.
- 기존 builder는 유효 1곳의 2 legs에서 최대 4개, 유효 2곳의 3 legs에서 최대 6개를 반환한다. 50m 초과인 transit 누락 endpoint만 요청한다. walk-only/누락 없음/손상 snapshot은 해당 기존 fail-closed 계약을 유지하며 quota를 채우지 않는다.
- 2곳의 5·6번째 성공선은 마지막 leg의 앞/뒤 `2:start → transit → 2:end`로 합성되고 마지막 선 끝은 실제 도착 endpoint와 일치한다. 부분 실패선은 생략하고 안내·나머지 검증 선·카드는 유지한다. 직선 대체나 connector 분을 추천 합계에 추가하지 않는다.
- 동시 최대 2, 기존 private port in-flight/10분 메모리/TTL을 그대로 쓴다. 유효 캐시 재렌더·시작·재진입은 신규 provider 시도 0이다. TTL 만료 뒤 재진입은 기존 포트 정책대로 필요한 4/6개를 다시 시도할 수 있다. 추천 session 36 attempt와 geometry 예산을 섞지 않았다.
- 상세 후 명시 선택, A/B 삭제·scroll 복원, 실측 sheet와 72개 레이아웃 조합, 지도 pan 보존, 현재 구간 단일 CTA, native back, handoff 실패/연타, 완료 멱등성과 기록 실패 복구를 보존했다. 카드 즉시 선택·별도 진행 화면은 복원하지 않았다.
- 엔진/API adapter/Edge/DB repository/데이터/.env/Live Activity/공개 예산·중앙 문서·보드·QA 파일은 수정하지 않았다. 타 세션 변경을 되돌리거나 stage/commit/push하지 않았다. 실제 네트워크·운영 DB 호출 0, Simulator 조작·앱 삭제·배포 0이다.

### 3. 실패 선행 / 최종 검증

- 코드 수정 전 `node --test test/ui/place-course-screen-runtime.test.mjs` → **15 total / 12 pass / 3 fail**. review short20 문구 없음, 2곳 전체 성공/부분 실패에서 **4 ≠ 6**으로 실패했다. 1곳 4개와 기존 흐름은 통과했다. 실패 로그: `/private/tmp/timefit-restore-first.log`.
- 실제 화면 연결 테스트 최종 **17/17 pass**. review 20/35분·active/Home/mode 누락 비노출, 1곳 4/2곳 6 요청, 마지막 leg 성공선·부분 실패, 최대 동시 2, 유효 캐시 시도 증가 0, TTL 만료 후 누적 8/12회, walk/intact/damaged 0·단일 gap 1회를 확인했다.
- 집중: `npx tsx --test test/ui/place-course-screen-runtime.test.mjs test/ui/place-detail-and-optimized-course-flow.test.ts test/ui/course-v1-route-geometry.test.ts test/ui/course-v1-card-detail.test.ts` → **44/44 pass**. 기존 builder의 50m/51m·왕복·손상·순서·상한과 기존 보완도 포함한다. 로그 `/private/tmp/timefit-restore-contract.log`.
- 기존 포트 계약 추가 확인: `npx tsx --test test/private-walk-connector.test.ts` → **6/6 pass**. in-flight/10분 cache/만료 등 기존 계약을 확인했으며 해당 파일은 수정하지 않았다. 로그 `/private/tmp/timefit-restore-port.log`.
- `npm run test:typecheck` → **exit 0**.
- `npm run test:ui` → **327 total / 326 pass / 기존 skip 1 / fail 0**. 로그 `/private/tmp/timefit-restore-ui.log`.
- `npm test` → **135/135 pass**. 로그 `/private/tmp/timefit-restore-core.log`.
- `node --test test/map-transport-ui-contract.test.mjs` → **14/14 pass**. 로그 `/private/tmp/timefit-restore-map.log`.
- `git diff --check` → **exit 0**. 추가 skip이나 검증 삭제는 없다.
- `npx expo export --platform ios --output-dir /private/tmp/timefit-restore-ios.RBfgkM` → **exit 0**, iOS Hermes bundle 1개(4.7MB), metadata 생성. 로그 `/private/tmp/timefit-restore-export.log`. 임시 로그/번들은 장기 보존·실기기 확인을 뜻하지 않는다.

### 4. QA entry / 다음 위험

- QA는 위 집중 명령과 `PF restore` 이름의 실행형 fixture를 사용할 수 있다. 기존 `course-stop-{placeId}`, `course-leg-{index}`, `verified-course-start`, `verified-progress-primary`, `place-detail-sheet`, `place-detail-information`, `place-detail-select` entry는 유지한다.
- 자동 게이트 후 실기기 smoke 1회에서 review 계획 체류→시작 후 비노출, 동일 카드/지도 유지, 2곳 마지막 transit 앞뒤 파란 도보선과 실제 endpoint, 작은 화면/큰 글씨의 패널·CTA·native 복귀만 묶어 확인한다. 이번 native host와 bundle export는 실제 Yoga 픽셀 배치·지도 SDK·제스처·VoiceOver 검증을 대체하지 않는다.
- 새 제품 결정은 필요하지 않다. 앞선 인계에 남긴 체류 문구·connector 상한 정합성 문제는 이번 현행 계약 복원으로 해소됐다. 최종 수락과 실기기 판정은 QA 후행이다.
