# U-PROGRESS-01 — 검증 코스 진행·다음 길찾기 UX

## 상태

보완 구현 완료. Live Activity, 백그라운드 위치, DB 저장·개인화보다 먼저 V1 검증 코스를 실제로 따라갈 수 있게 만든다.

## 문제와 교체 방식

현재 `CourseConfirm`은 `VerifiedCourseV1`의 실제 시간 여정을 읽기 전용으로 보여 주고 끝난다. 반면 기존 `ExecutionScreen`은 길찾기·다음 단계 UI가 있지만, 철회된 legacy `Course`와 근사 경로 hydration·저장 코스 변경에 의존한다. V1 결과에 이를 억지 변환하면 실제 검증 legs와 시간표를 다시 계산하거나 정책이 되돌아갈 위험이 있다.

`CourseConfirm → V1 진행 화면`을 별도 V1 모델로 연결한다. 진행 화면은 검증 당시 스냅샷의 순서·구간·선택 체류·도착 여유만 사용하고, 현재 단계의 카카오맵 길찾기와 다음 단계 전환을 제공한다.

## 사용자 흐름

```text
결과의 코스 확인
  → 코스 확인: [코스 시작 · 첫 장소 길찾기]
  → 진행: 현재 이동 목적지와 예정 시각
  → [카카오맵에서 길찾기]
  → 앱 복귀 후 [다음 장소 길찾기]
  → 마지막에는 [약속 장소/출발지로 길찾기]
  → [코스 마치기]
```

- 첫 CTA가 카카오맵을 열었더라도 이동·도착·체류를 자동 기록하거나 완료로 추정하지 않는다.
- 각 장소의 체류는 검증 스냅샷의 `stayMin`과 `stayState`를 안내로만 표시한다. 사용자가 실제로 머문 시간을 저장·개인화하지 않는다.
- 카카오맵 앱 scheme 우선, HTTPS fallback은 기존 검증된 adapter 규칙을 재사용한다. 새 Kakao REST·Route Proxy·엔진 호출은 0회다.
- 앱이 외부 카카오맵에서 foreground로 돌아오면 현재 단계와 CTA를 유지한다. 앱 강제 종료 뒤 복원·알림·Live Activity는 이번 범위 밖이다.

## 구현 지시

1. `CourseConfirm`의 대표 CTA를 추가하고, V1 전용 진행 route/parameter를 만든다. `VerifiedCourseV1`과 `RecommendationSession`에서 진행에 필요한 공개 직렬화 값만 전달한다. `Date`, 함수, provider/route port, CAPTCHA token을 navigation state에 넣지 않는다.
2. 순수 V1 진행 model을 만든다.
   - 최초 출발 → stop 1 → … → stop N → 도착지 또는 출발지 복귀의 단계와 검증 스냅샷 time journey를 순서대로 만든다.
   - 1·2·3 stop, 왕복/도착지, 권장/짧게 가능, 남는 시간·도착 여유를 재계산 없이 표현한다.
   - 현재 단계·다음 목적지·완료 상태는 화면 메모리 상태로만 관리한다. 임의 step 건너뛰기, 동일 단계 두 번 완료, 마지막 뒤 추가 길찾기는 fail-closed 한다.
3. 진행 화면을 구현한다.
   - 상단에는 약속/복귀 목표와 도착 여유, 본문에는 지금 해야 할 한 행동과 다음 목적지·이동 수단·검증 시간, 아래에는 간결한 전체 순서를 둔다.
   - 이동 중에는 `카카오맵에서 길찾기`, 장소 단계에서는 `다음 장소 길찾기`, 마지막 이동 후에는 `코스 마치기`를 유일한 primary CTA로 한다.
   - 카카오맵을 연 뒤 앱이 돌아왔을 때 자동 도착 확인 sheet·푸시·GPS 권한을 띄우지 않는다. 사용자가 다음 길찾기를 누르는 흐름만 유지한다.
   - 뒤로가기는 `내 코스` 최상위로 가는 공통 규칙을 적용한다. safe area·접근성 label·외부 전환 실패 메시지를 제공한다.
4. legacy `ExecutionScreen`의 TMAP hydration, 근사 `planTimeFit`, 코스 재계획, notification 저장 흐름을 V1에 복사하거나 호출하지 않는다. legacy 화면/저장 기능은 이번에 삭제·개조하지 않는다.
5. `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`의 V1 코스 확인/진행 규칙을 갱신한다. 이전 방식 → 문제 → V1 진행 방식 → 이유 → 상태를 남기며, 자동 체류·Live Activity·저장은 구현 완료처럼 기록하지 않는다.

## 필수 검증

- 순수 model: 1·2·3 stop, 왕복/도착지, recommended/short, 첫/중간/마지막 CTA, 중복/건너뛰기 차단, 시간 여정 불변.
- UI: `CourseConfirm` CTA, 진행 화면의 단계별 핵심 행동 하나, 외부 카카오맵 app/web/failure mock, 앱 foreground 복귀 상태 보존, navigation 직렬화, safe-area/접근성 label.
- 카카오맵 길찾기 action은 기존 scheme/HTTPS fallback adapter를 mock으로 검증하며 API/Route Proxy 호출이 0회여야 한다.
- 최소 `npm run test:typecheck`, 관련 UI fixture, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 새 iOS internal build로 1곳·2곳 코스 각각 한 번, 카카오맵 열기→복귀→다음 단계 및 완료를 확인한다.

## 경계·다음 작업

- 수정 가능: `src/ui/`, 화면 테스트, UIUX 기준/테스트 문서, 이 문서와 UIUX README.
- 수정 금지: `src/engine/`, `src/services/`·Route Proxy, API secret·cache, runtime 카탈로그·데이터, Supabase migration/repository, 작업 조정 보드.
- 다음은 `RD-SUPPLY-01`의 제한된 실기기 공급량 게이트다. Live Activity는 이 작업 수락과 Apple Developer Program 활성화 뒤, 위치·DB·푸시 없이 다음 장소/예정 시각을 표시하는 최소 범위로만 시작한다.

## 완료 인계

1. 변경 파일과 V1 진행 공개 타입/상태 전이
2. 유지한 engine/API/legacy/DB/자동 위치 경계
3. 실행한 순수·UI·전체 회귀 및 iOS 확인 결과
4. Live Activity가 소비할 상태, 외부 지도 복귀·앱 강제 종료·저장 관련 남은 위험

### U-PROGRESS-01 완료 인계 (2026-08-31)

1. **변경 파일 / V1 진행 공개 타입·상태 전이**
   - `src/ui/nav.ts`, `App.tsx`: 직렬화 가능한 `RecommendationSession + VerifiedCourseV1`만 받는 `VerifiedCourseProgress` route를 등록했다. Date·함수·route port·token은 navigation state에 넣지 않았다.
   - `src/ui/CourseConfirmScreen.tsx`: 검증 snapshot 검토 뒤 `코스 시작 · 첫 장소 길찾기` CTA로 새 V1 진행 route만 연다.
   - `src/ui/recommendation/verifiedCourseProgressModel.ts`: snapshot의 `legs/stops/placeIds`가 모두 맞을 때만 `이동 → 체류 → … → 마지막 이동` 단계를 만들며, `길찾기 열기 → 명시 다음 단계`만 허용한다. 이동 전 건너뛰기, 중복 완료, 손상 snapshot은 fail-closed다.
   - `src/ui/VerifiedCourseProgressScreen.tsx`: 현재 한 행동, 목적지·수단·검증 분/정해진 stop 시각, 도착 여유와 간결한 전체 순서를 표시한다. 마지막 길찾기 뒤 `코스 마치기`는 내 코스 최상위로 돌아가며 저장·완료 기록을 만들지 않는다.
   - `src/ui/execution/schedule.ts`: 기존 카카오맵 scheme→HTTPS fallback의 대상 타입을 최소 `name + point`로 일반화해 V1도 같은 opener를 재사용했다. legacy 실행 동작은 바꾸지 않았다.
   - `test/ui/verified-course-progress.test.ts`, `test/map-transport-ui-contract.test.mjs`: 1·2·3곳, 왕복/도착지, 추천·짧게 가능, 단계 차단·손상 snapshot, legacy 자동화 미호출을 고정했다.

2. **유지한 계약·정책 경계**
   - V1 진행은 검증 당시 `VerifiedCourseV1`의 장소 순서·legs·`stayMin`/`stayState`·도착 여유만 표시하며 시간·경로·체류를 재계산하지 않는다. Route Proxy·엔진·Kakao REST/API 호출은 추가하지 않았다.
   - Live Activity, 알림, 자동/백그라운드 위치, GPS 권한, DB 저장·개인화·완료 기록, 강제 종료 뒤 복원은 도입하지 않았다. 외부 카카오맵 foreground 복귀는 React 화면 메모리 상태를 그대로 유지하며 자동 도착/체류 완료를 추정하지 않는다.
   - legacy `ExecutionScreen`의 hydration·코스 변경·알림 저장 흐름은 호출·개조·삭제하지 않았다. 보드와 제품 기준 문서는 현 사용자 지시의 수정 범위 밖이어서 변경하지 않았다.

3. **실행 테스트 / 결과**
   - `npm run test:typecheck` — 통과.
   - `npx tsx --test test/ui/verified-course-progress.test.ts` — 6개 통과.
   - `node --test test/map-transport-ui-contract.test.mjs` — 14개 통과.
   - `npm run test:ui` — 159개 중 158개 통과, 기존 철회 시나리오 1개 skip, 실패 0.
   - `npm test` — 110개 통과.
   - `git diff --check` — 통과. 모든 검증은 고정 fixture이며 새 API/Route Proxy 요청은 0회다.

4. **다음 결정·위험·재현 조건**
   - 새 iOS internal build에서 1곳·2곳 V1 코스로 `코스 시작 → 카카오맵 열기 → 앱 복귀 → 명시 다음 단계 → 마지막 길찾기 → 코스 마치기`를 각각 1회 확인해야 한다. 카카오맵 미설치/열기 실패도 일반 오류와 같은 단계 유지가 필요하다.
   - 앱 강제 종료 뒤 진행 상태 복원과 내 코스 목록 노출은 의도적으로 없다. 저장 계약이 확정되기 전에는 이를 추가하거나 완료를 기록하지 않는다.
   - 후속 Live Activity가 필요하면 이 모델의 `current step`과 snapshot 예정 시각만 읽고, 위치·DB·푸시·추천 재호출을 결합하지 않는 별도 작업으로 결정해야 한다.

### U-PROGRESS-01 보완 인계 (2026-08-31)

1. **변경 파일 / 목적**
   - `src/ui/VerifiedCourseProgressScreen.tsx`, `src/ui/recommendation/verifiedCourseProgressModel.ts`: 체류의 `다음 장소 길찾기`가 다음 travel을 단순 전환하지 않고, 동일 탭에서 해당 travel의 기존 Kakao app-scheme→HTTPS fallback을 실행하도록 바꿨다. 성공 때만 travel 단계와 `routeOpened=true`로 전이하며, 실패는 체류 단계·일반 오류·재시도 CTA를 유지한다. in-flight lock으로 same-tick 중복 실행도 막는다.
   - `src/ui/CourseConfirmScreen.tsx`: 외부 지도를 열지 않는 화면 전환 CTA를 `코스 시작하기`로 바로잡았다. 마지막 travel을 연 뒤 CTA는 `도착 후 코스 마치기`다.
   - `test/ui/verified-course-progress.test.ts`, `test/map-transport-ui-contract.test.mjs`: 1·2·3곳의 다음 길찾기 한 번 호출·성공 전이, app/web 실패 상태 유지, 중복 lock, CTA 문구를 추가 검증했다.
   - `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`: 이전 단순 단계 전환의 문제와 V1 app/HTTPS 성공 전이 규칙, iOS 수동 검증 UXV-43을 현행으로 기록했다.

2. **유지한 계약·정책 경계**
   - `VerifiedCourseV1` snapshot의 순서·legs·체류·도착 여유를 재계산하지 않았고, app/HTTPS opener 외 Route Proxy·엔진·Kakao REST/API 호출은 추가하지 않았다.
   - Live Activity, 자동·백그라운드 위치, GPS 권한, DB 저장·개인화·완료 기록, legacy hydration/알림/코스 변경은 여전히 범위 밖이다. 보드는 수정하지 않았다.

3. **실행 테스트 / 결과**
   - `npm run test:typecheck` — 통과.
   - `npx tsx --test test/ui/verified-course-progress.test.ts` — 11개 통과.
   - `node --test test/map-transport-ui-contract.test.mjs` — 14개 통과.
   - `npm run test:ui` — 164개 중 163개 통과, 기존 철회 시나리오 1개 skip, 실패 0. `npm test` — 110개 통과. `git diff --check` — 통과. 모든 fixture는 로컬 mock이며 API/Route Proxy 요청은 0회다.

4. **다음 결정·위험·재현 조건**
   - 새 iOS internal build에서 1곳·2곳 코스 각각 첫 길찾기와 체류의 다음 길찾기가 카카오맵 app 또는 HTTPS로 실제 한 번 열리고, 복귀 뒤 다음 travel CTA가 유지되는지 확인한다. 앱/HTTPS 모두 실패하면 체류 화면·오류·재시도 CTA가 남아야 한다.
   - foreground 복귀는 자동 도착·체류 완료·GPS 권한·알림을 만들지 않는다. 강제 종료 복원, 저장, Live Activity는 별도 정책·작업 없이는 추가하지 않는다.

### DEC-KAKAO-ROUTE-01 구현 인계 (2026-08-31)

1. **변경 파일 / 목적**
   - `src/ui/execution/schedule.ts`: 공용 길찾기 입력을 `from + to` 구간으로 교체했다. app route는 `sp`·`ep`·`by=foot|publictransit|car`, web route는 `link/by/walk|traffic|car/<출발>/<도착>`을 만들며, invalid 좌표는 URL 생성 전 `invalid_stage`로 fail-closed한다. app→HTTPS→browser를 각 한 번만 시도한다.
   - `src/ui/recommendation/verifiedCourseProgressModel.ts`, `src/ui/VerifiedCourseProgressScreen.tsx`: 모든 V1 travel에 검증 snapshot의 직전 장소/출발지 `from`을 보존하고 이 구간을 shared opener에 전달했다. app·HTTPS·browser 중 하나가 열리면 기존 `routeOpened` 성공 전이로 처리하며, 전부 실패/invalid는 현재 체류와 재시도를 유지한다.
   - `src/ui/ExecutionScreen.tsx`: legacy도 현재 stop→다음 stop의 같은 구간 타입과 browser fallback을 전달해 기존 길찾기 동작을 함께 보완했다.
   - `test/ui/execution-schedule.test.ts`, `test/ui/verified-course-progress.test.ts`, `test/map-transport-ui-contract.test.mjs`: walk/transit/car `sp`·`ep`, web `link/by`·`traffic`, app/HTTPS/browser 성공·전부 실패·invalid 좌표, 1·2·3곳의 직전 지점 source를 고정했다.
   - `docs/03_product/UIUX_공통규칙.md`, `docs/03_product/UIUX_테스트명세.md`: URL 조립 결함의 이전 방식→문제→교체 방식·이유·현행 상태와 UXV-43 실기기 gate를 반영했다.

2. **유지한 계약·정책 경계**
   - V1/legacy 모두 기존 검증 snapshot 또는 기존 화면 stop의 좌표만 소비하며, 현재 GPS 추정·추천 재계산·Route Proxy·Kakao REST·DB/저장·Live Activity를 추가하지 않았다.
   - 화면·일반 로그·receipt에 route URL, 좌표, raw provider 오류를 표시하지 않는다. 보드와 통합·결정 원문은 수정하지 않았다.

3. **실행 테스트 / 결과**
   - `npm run test:typecheck` — 통과.
   - `npx tsx --test test/ui/execution-schedule.test.ts test/ui/verified-course-progress.test.ts` — 14개 통과.
   - `node --test test/map-transport-ui-contract.test.mjs` — 14개 통과.
   - `npm run test:ui` — 164개 중 163개 통과, 기존 철회 시나리오 1개 skip, 실패 0. `npm test` — 110개 통과. `git diff --check` — 통과. 모든 fixture는 로컬 mock이며 Route Proxy·Kakao REST·추천 엔진·DB 호출은 0회다.

4. **다음 결정·위험·재현 조건**
   - 새 iOS internal build에서 카카오맵 설치 기기로 1곳·2곳 코스의 첫 travel과 체류 뒤 다음 travel을 각각 열어, 카카오맵 길찾기 화면에 출발·도착이 모두 채워지는지 확인해야 한다.
   - 카카오맵 미설치/거부는 HTTPS route, HTTPS 실패는 browser route로 정확히 한 번 넘어가야 한다. 세 handoff가 모두 실패하면 V1은 현재 체류와 오류 재시도 CTA를 유지해야 한다.
