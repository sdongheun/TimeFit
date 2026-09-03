# U-COURSE-CARD-DETAIL-01 — 출시 코스 카드·세로 상세 재구성

## 상태

**진행 가능.** `2-U`, `U-RELEASE-ONESTOP-01`, `QA-RELEASE-ONESTOP-01`의 출시 1곳 추천 결과를 바꾸지 않고 결과 카드와 `CourseConfirm`의 정보 구조만 재구성한다. 이 작업이 끝난 뒤 사용자가 실제 화면을 보고 다음 UIUX 수정 방향을 결정한다. 따라서 이번 작업에서 홈·시간 설정·하단 탭·진행 화면 전체를 함께 재디자인하지 않는다.

## 1. 목적과 사용자 관찰

### 이전 방식

- 결과의 대표·대안 카드 안에 전체 시간 막대, 이동·활동·여유, 장소 미리보기, 카카오맵 링크, 별도 `추천 확인` 버튼을 함께 넣었다.
- 코스 확인은 카드형 시간 막대와 장소 미리보기를 다시 나열했으며, 출발지·장소·도착지의 공간 관계를 먼저 보여 주지 않았다.
- 체류 분은 모든 출시 화면에서 숨겼다.

### 발생한 문제

- 사용자는 결과 목록에서 여러 장소를 빠르게 비교하기보다 카드마다 상세 시간표를 먼저 읽어야 했다.
- 카드를 눌러 상세로 이동하는데도 결과 카드와 상세가 비슷한 정보를 반복했다.
- 총 코스 시간이 표시되면서 상세에서 이동시간만 숫자로 보이면, 합계에서 빠진 체류 부분을 사용자가 이해하기 어렵다.
- 현 체류값은 장소별 정밀 관측으로 단정할 수 없지만, 상세에서도 완전히 숨기면 시간 안에 가능한 이유를 설명하기 어렵다.

### 교체 방식 — 이번 현행

1. 결과 카드는 `사진 + 장소명 + 활동 카테고리 + 이동·선택 체류 합계`만 빠르게 읽는 요약으로 만든다.
2. 카드 전체를 누르면 `CourseConfirm`으로 이동한다. 결과 카드 안에서는 상세 시간표와 카카오맵 링크, 별도 `추천 확인` 버튼을 제거한다.
3. 코스 확인 상단에는 출발·추천 장소·도착/복귀 마커의 위치 관계를 보여 주는 지도를 둔다. 검증 snapshot에 실제 경로 geometry가 없으므로 직선·추정 경로선을 실제 경로처럼 그리지 않는다.
4. 지도 아래에는 `출발지 → 이동 → 장소 → 이동 → 도착지/복귀 → 도착 전 여유`를 세로 순서로 표시한다.
5. 카드에는 체류를 따로 노출하지 않고 총 `약 N분 코스`만 보인다. 상세 장소 단계에서만 snapshot의 선택 체류를 `둘러보기 약 N분`으로 표시하며, `short`이면 `가볍게 둘러보기 약 N분`으로 표시한다.

이 변경은 2026-09-02의 “체류 분 전체 비노출”을 **부분 교체**한다. 체류 최솟값·최댓값·조절 UI는 계속 노출하지 않으며, 진행 화면의 체류 표시도 이번 범위에서 바꾸지 않는다.

## 2. 먼저 읽을 파일

1. 루트 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/work/uiux/README.md`
3. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`
4. `docs/03_product/추천로직.md`의 2026-09-02 출시 1곳·체류 표시 결정
5. `docs/테스트.md`의 `REC-30`, `UX-26`, `COURSE-03`, `COURSE-10`
6. [출시 1곳 추천 UI 연결](release-one-stop-results.md)의 수락된 공개 경계
7. `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`, `src/ui/KakaoRouteMap.tsx`
8. `src/ui/recommendation/CourseV1Journey.tsx`, `courseV1JourneyModel.ts`, `CourseV1PlacePreview.tsx`, `courseV1ResultListModel.ts`, `courseV1DiscoveryContext.ts`

과거 다장소·장바구니·legacy 결과 archive와 추천 엔진 전체는 읽지 않는다.

## 3. 확정 구현 계약

### 3.1 결과 카드

1. `Results`의 대표와 실제 검증 대안은 같은 요약 카드 컴포넌트·표시 model을 사용한다. 대표/대안 섹션 라벨은 유지하되 카드 내부 정보는 아래로 제한한다.
   - 장소 사진. 유효한 사진이 없거나 로드 실패면 활동 카테고리 기반 대체 화면.
   - 장소명.
   - 카탈로그 `shortStay.type`의 기존 사용자용 활동명. 없으면 확인 가능한 카탈로그 category를 사용하며 새 분류를 추정하지 않는다.
   - `약 N분 코스`.
   - `stayState=short`일 때만 작은 `가볍게 둘러보기` 상태. 이는 카테고리 줄과 합쳐도 되며 별도 큰 설명 영역을 만들지 않는다.
2. `N`은 검증 snapshot의 `travelMin + stayMin`이다. 도착 전 여유와 사용하지 않고 남는 시간은 포함하지 않는다. `course.totalMin`은 도착 여유를 포함하므로 카드 시간으로 그대로 쓰지 않는다.
3. 표시 model은 `travelMin === legs 분 합계`, `stayMin === stops 분 합계`, `totalMin === travelMin + stayMin + arrivalBufferMin`의 정수·음수 아님 계약을 확인한다. 손상된 snapshot을 임의 보정하거나 일부 값만 표시하지 않고 기존 안전한 제외/빈 상태로 보낸다.
4. 카드 전체가 하나의 `Pressable`이며 `CourseConfirm`으로 동일한 `session`과 원본 `VerifiedCourseV1`을 전달한다. 내부에 중첩된 `추천 확인` 버튼이나 카카오맵 링크를 두지 않는다. 접근성 label은 대표/대안 여부, 장소명, 활동 카테고리, 약 N분 코스, short 상태를 한 번만 읽는다.
5. 목록에서 가로 시간 rail, 개별 이동 구간, 도착/출발 예정 시각, 도착 여유, 남는 시간, 사진 출처 문구를 반복하지 않는다. 해당 정보는 상세 또는 기존 정책 위치에서 확인한다.
6. 대표·대안 개수, 순서, 중복 제거, 조건부 시장 영역, 실제 route/API 호출, diagnostics는 변경하지 않는다. 조건부 카드는 이 요약 카드로 자동 변환하지 않는다.

### 3.2 코스 확인 상단 지도

1. `CourseConfirm` 콘텐츠 상단 약 30% 높이에 기존 `KakaoRouteMap`을 사용한 요약 지도를 배치한다. safe area 아래 뒤로가기와 화면 제목은 접근 가능해야 하며 지도나 Dynamic Island에 가려지지 않는다.
2. 지도 마커 순서는 session origin, course place IDs, session destination이다. destination이 `null`이면 마지막 지점은 origin과 같은 `복귀`이며, 같은 좌표에 중복 핀을 겹치지 않고 `출발·복귀` 의미를 하나의 마커/라벨로 전달한다.
3. 장소 마커는 `1` 순서와 장소명을 식별할 수 있어야 한다. 현재 출시는 1곳이지만, internal snapshot이 구조상 여러 장소를 가진 경우에도 같은 검증 순서를 훼손하지 않는다. production의 다장소 노출 금지 계약은 그대로다.
4. `VerifiedCourseV1`에는 실제 경로 geometry가 없으므로 `line=[]` 또는 동등한 marker-only 표현을 사용한다. 직선, 근사선, Kakao가 새로 계산한 선을 검증 경로로 표현하지 않는다. 이를 위해 Route Proxy/Kakao REST를 추가 호출하거나 engine/API 타입을 넓히지 않는다.
5. 지도 키 없음·WebView 실패에서도 아래 세로 순서와 CTA는 사용할 수 있어야 한다. 지도 실패를 코스 검증 실패로 바꾸거나 재추천하지 않는다.

### 3.3 세로 코스 순서

1. 지도 아래에 가로 rail 대신 세로 timeline/list를 둔다. 읽기 순서는 다음과 같다.
   - 출발지 label.
   - 첫 실제 이동: `도보 N분` 또는 `대중교통 N분`.
   - 추천 장소: 사진/대체 화면, 장소명, 활동 카테고리, `둘러보기 약 N분`; short면 `가볍게 둘러보기 약 N분`.
   - 마지막 실제 이동: 수단과 N분.
   - destination label 또는 `출발지로 복귀`.
   - `도착 전 N분 여유`.
2. 모든 분 값은 원본 `course.legs`, `course.stops`, `course.arrivalBufferMin`을 읽는다. UI에서 이동수단·방문 순서·체류값·총 시간을 다시 선택하거나 엔진 규칙으로 재계산하지 않는다.
3. 상세 상단 또는 timeline 시작에 카드와 같은 `약 N분 코스`를 표시한다. 이는 이동+선택 체류 합계이고 도착 여유는 바로 아래에서 별도 설명한다.
4. `추천 체류`, `최소 N분`, `최대 N분`, `N~M분`, 체류 조절기와 장소별 이동수단 선택은 만들지 않는다. `약`과 `둘러보기` 표현으로 템플릿 기반 안내임을 단정적 실제 체류와 구분한다.
5. 장소 단계에는 기존 카카오맵 장소 확인 행동을 유지한다. 하단 `코스 시작하기`와 `VerifiedCourseProgress` navigation payload·동작도 유지한다.
6. 뒤로가기는 결과 목록과 스크롤/선택 대상을 보존한다. 카드를 누를 때 route/API를 다시 호출하지 않는다.

### 3.4 범위 밖

- 홈, 시간 설정, 경로 검색, 하단 탭, 기록, 내 정보의 전면 재디자인.
- `VerifiedCourseProgressScreen`의 체류 문구 변경, Live Activity, 자동 GPS 도착 판정.
- 실제 지도 경로 geometry 저장·표시, 새로운 외부 API 호출.
- 추천 순위·후보 수·8회 상한·운영시간·체류 산정값 변경.
- 조건부 시장·거리 카드의 정책 또는 계산 흐름 변경.
- legacy `OneStopResultsScreen`·`ExecutionScreen`을 새 V1처럼 전면 개편.

## 4. 필수 fixture와 반례

1. 대표 1+대안 3: 네 카드가 각각 사진/대체 화면, 고유 장소명, 활동 카테고리, 이동+체류 합계만 표시하고 전체 카드 tap이 정확한 원본 course를 연다.
2. `travelMin=22`, `stayMin=30`, `arrivalBufferMin=10`, `totalMin=62`: 카드와 상세 제목은 `약 52분 코스`, 상세는 두 leg 합계 22분·`둘러보기 약 30분`·`도착 전 10분 여유`를 각각 표시한다.
3. short `stayMin=20`: 카드에는 총 소요와 `가볍게 둘러보기`, 상세에는 정확히 `가볍게 둘러보기 약 20분`; recommended 30은 `둘러보기 약 30분`이다.
4. 사진 URL 없음/이미지 오류: 카드와 상세 모두 레이아웃이 무너지지 않고 같은 활동 카테고리 대체 화면을 보인다.
5. 왕복: 지도는 겹친 출발·도착 핀 두 개를 만들지 않으며 세로 순서의 마지막은 `출발지로 복귀`다. 별도 destination은 실제 label을 표시한다.
6. 지도 key 없음/WebView 오류: fallback 뒤에도 세로 timeline, 카카오맵 장소 확인, `코스 시작하기`가 남는다.
7. 손상 snapshot: leg/stops/placeIds 불일치, 음수·비정수 분, 합계 불일치는 부분 렌더링·NaN·임의 보정 없이 안전 상태가 된다. route/API 호출은 0회다.
8. 카드 tap·CourseConfirm 렌더·뒤로가기에서 Route Proxy/Kakao REST/추천 engine 호출 0회. Kakao JavaScript 지도 로드는 기존 지도 표시 경계만 사용한다.
9. 조건부 카드와 internal diagnostics의 기존 fixture가 그대로 통과한다.

## 5. 소유·수정 경계

### 수정 가능

- `src/ui/ResultsScreen.tsx`, `src/ui/CourseConfirmScreen.tsx`
- 위 두 화면이 직접 쓰는 `src/ui/recommendation/` 표시 model/component
- UI 단위·계약 테스트(`test/ui/`)
- 이 작업 문서의 완료 인수인계

### 수정 금지

- `src/engine/`, `src/services/`, `src/data/`, `data/`
- `supabase/`, `.env*`, native 프로젝트 설정
- 추천 결과·후보·route/cache/CAPTCHA 계약
- `docs/03_product/*`, `docs/테스트.md`, `docs/작업조정_보드.md`

`App.tsx`, `src/ui/nav.ts`, `src/ui/mainTabNavigation.ts`는 이번 변경에 필요하지 않다. 다른 UIUX 세션과 동시에 같은 소유 파일을 수정하지 않는다.

## 6. 검증 명령과 완료 기준

최소 다음을 실행한다.

```bash
npx tsx --test test/ui/course-v1-journey.test.ts test/ui/course-v1-dwell-state.test.ts test/ui/verified-course-results.test.ts test/ui/recommendation-runtime-boundary.test.ts
npx tsx --test test/ui/verified-course-progress.test.ts test/ui/qa-release-one-stop-launcher.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

완료 조건:

- 카드의 정보 제한과 전체 tap, 이동+체류 합계, 상세 세로 순서, marker-only 지도, 왕복/도착지, 사진 실패, 손상 snapshot 반례가 행위 기반 테스트로 통과한다.
- 지도·카드·상세를 여는 동안 새 추천·route/provider 호출은 0회다.
- 기존 one-stop 대표/대안, 조건부 시장, 카카오맵 장소 확인, `코스 시작하기`, 진행 화면, diagnostics 회귀에 새 실패가 없다.
- 타입·전체 UI·전체 테스트 실패 0이며 기존 명시 skip 수를 기록한다.

## 7. 완료 인수인계

1. 변경 파일과 각 파일의 목적
2. 변경하지 않은 엔진·API·데이터·출시 one-stop 계약
3. 실행한 테스트와 통과/실패/기존 skip 수
4. 결과 카드, 사진 없음, 왕복, 별도 목적지, 지도 실패의 캡처 또는 재현 설명
5. 사용자가 다음 UIUX 방향을 판단할 수 있도록 남은 시각적 아쉬움만 기록하고, 범위 밖 기능을 임의 구현하지 않는다.

## 8. 완료 인수인계 (2026-09-02)

### 1. 변경 파일과 변경 목적

- `src/ui/ResultsScreen.tsx`: 대표·대안을 같은 요약 카드로 투영하고 카드 전체 tap이 선택한 원본 course/session을 `CourseConfirm`으로 전달하도록 변경했다. 조건부 장소 영역과 diagnostics 흐름은 기존 컴포넌트 경계에 남겼다.
- `src/ui/CourseConfirmScreen.tsx`: safe area 아래 header, marker-only 지도, 세로 코스 순서, 기존 카카오맵 장소 확인과 `코스 시작하기`를 연결했다. 손상 snapshot은 CTA 없이 안전 상태로 닫고, 지도 좌표만 불가한 경우에는 상세과 CTA를 유지한다.
- `src/ui/KakaoRouteMap.tsx`: marker-only 사용처가 실제/추정 경로 legend를 표시하지 않도록 기본값이 기존 동작인 `showRouteLegend` 표시 옵션을 추가했다.
- `src/ui/recommendation/courseV1CardDetailModel.ts`: 분 값의 정수·음수 아님, leg/stop/place 순서, 이동·체류·전체 합계를 검증하고 카드 합계·상세 순서·왕복/도착지 marker를 snapshot-only로 투영한다.
- `src/ui/recommendation/CourseV1SummaryCard.tsx`: 사진/활동 대체 화면, 장소명, 활동, `약 N분 코스`, short 상태만 가진 단일 `Pressable` 카드다.
- `src/ui/recommendation/CourseV1VerticalDetail.tsx`: 출발 → 실제 이동 → 장소/선택 체류 → 실제 이동 → 도착/복귀 → 도착 여유를 세로로 표시하고 장소의 기존 카카오맵 행동을 유지한다.
- `src/ui/recommendation/courseV1DiscoveryContext.ts`, `courseV1PlacePreviewModel.ts`: 기존 `shortStay.type` 사용자용 이름을 재사용하고 없을 때만 카탈로그 category를 쓰도록 표시 타입을 보완했다.
- `test/ui/course-v1-card-detail.test.ts`: 대표 1+대안 3, 52분 합계, short/recommended, 사진 없음·실패, 왕복·도착지, 손상 snapshot, marker-only/route 호출 비추가 계약 7건을 추가했다.

### 2. 유지한 공개 계약·정책 경계

- `src/engine/`, `src/services/`, `src/data/`, `data/`, Supabase, Expo/iOS 설정을 수정하지 않았다. 추천 순위·one-stop 대표/대안 수와 순서·8회 상한·운영시간·체류 산정값·route/cache/CAPTCHA 계약도 바꾸지 않았다.
- 홈, 시간 설정, 하단 탭, `VerifiedCourseProgressScreen`, legacy 결과/실행 화면을 수정하지 않았다.
- 카드/상세 모델은 원본 `VerifiedCourseV1` identity와 `legs`, `stops`, `arrivalBufferMin`을 읽기만 한다. `N`은 `travelMin + stayMin`이며 `totalMin`·도착 여유·남는 시간을 카드 합계에 넣지 않는다.
- 조건부 시장 카드는 새 요약 카드로 변환하지 않았고 기존 수동 확인·카카오맵·diagnostics 동작을 유지했다. 지도는 기존 Kakao JavaScript WebView만 사용하며 새 REST/Route Proxy/추천 호출을 추가하지 않았다.

### 3. 테스트 결과

- 필수 핵심 묶음 + 새 카드/상세 fixture: 27건 중 26 통과, 기존 철회 이력 1 skip, 실패 0.
- 진행/QA launcher 회귀: 17/17 통과, 실패·skip 0.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: 184건 중 183 통과, 기존 철회 이력 1 skip, 실패 0.
- `npm test`: 113/113 통과, 실패·skip 0.
- `git diff --check`: 통과.
- 모든 자동 검증은 고정 fixture/정적 UI 계약으로 수행했고 실제 추천 engine, Route Proxy, Kakao REST, DB 호출은 0회다.

### 4. 캡처 또는 재현 설명

- 결과 카드: `course-v1-card-detail.test.ts`의 A~D 대표/대안 fixture에서 서로 다른 원본 course identity, 활동명과 `약 52분 코스`를 확인했다. 카드 컴포넌트의 `Pressable`은 1개이며 시간 rail·카카오 링크·별도 확인 버튼이 없음을 정적 계약으로 확인했다.
- 사진 없음/오류: B의 `imageUrl=null`, C의 비-HTTPS URL, A의 `imageFailed=true`가 모두 각 활동 카테고리 placeholder로 전환됨을 재현했다.
- 왕복/별도 목적지: `destination=null`은 `출발·복귀`+장소의 2개 marker와 마지막 `출발지로 복귀`, 부산역 fixture는 출발+장소+부산역 3개 marker와 실제 목적지 label을 확인했다.
- 지도 실패: 좌표 불가 시 지도 대체 영역 아래에 세로 상세와 CTA가 계속 렌더되는 source 경계를 확인했다. 지도 키 없음·WebView 오류도 `KakaoRouteMap` 내부 fallback/오류 overlay에만 머물러 형제 상세·카카오맵 장소 확인·시작 CTA를 제거하지 않는다.
- 이번 세션에서는 Simulator/실기기 화면 캡처와 실제 WebView 네트워크 실패 주입을 실행하지 않았다.

### 5. 다음 결정·시각적 위험

- iOS 소형/대형 기기에서 250pt 지도가 실제 화면의 약 30%로 읽히는지, 긴 장소명·Dynamic Type에서 카드 높이와 세로 timeline 연결감이 유지되는지 시각 확인이 남았다.
- 실제 지도 키 없음과 WebView 실패 overlay가 긴 오류 문구에서도 지도 영역 안에 머무는지, VoiceOver가 카드 요약을 한 번만 읽고 상세의 카카오맵 link를 별도 행동으로 읽는지 실기기 확인이 남았다.
- 이 확인 전까지 홈·시간 설정·진행 화면을 함께 재디자인하거나 지도 geometry/API를 추가하지 않는다.

---

## 2026-09-03 후속 결정

이 작업이 수락한 카드·세로 시간표·체류 표현은 유지한다. 당시 route geometry 부재 때문에 정한 marker-only 범위만 사용자 결정 `DEC-COURSE-GEOMETRY-01`로 교체됐다. 실제 형상 전달과 지도 표시는 새 [U-COURSE-GEOMETRY-01](course-confirm-route-geometry.md)에서 수행하며 이 완료 기록을 소급 수정하지 않는다.
