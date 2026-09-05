# QA-FOUNDATION-WAVE-01 — 완료 기록·체류 개인화·시각 정리 통합 게이트

> 상태: **자동 게이트 통과·수동 2/3 확인 — active-course 연결은 U-PROGRESS-RESUME-01로 이관**  
> 선행: `DB-COMPLETION-RECORD-01`, `2-AB`, `U-RELEASE-VISUAL-01`  
> 담당: **QA·출시 세션**

## 목적

세 병렬 작업의 변경이 저장·추천·화면 경계를 침범하지 않았는지 고정 fixture로 한 번에 확인한다. QA 세션은 실패를 제품 코드에서 직접 고치지 않고 소유 작업 ID로 반환한다.

## 시작 조건

- 세 작업 문서에 완료 인수인계 4항목이 모두 기록돼 있어야 한다.
- 통합 세션이 세 작업의 수정 파일 교집합과 금지 파일 변경을 먼저 확인해야 한다.
- 하나라도 미완료이거나 중앙 문서를 작업 세션이 수정했다면 QA를 시작하지 않는다.

## 자동 검증

1. 완료 repository: 후기 없는 1/2곳 명시 완료, 순차/동시 중복, 취소/route open 0건, storage 실패/손상, legacy 후기 보존, 실제 체류 미확인 `null`, 민감 필드·network 0.
2. 개인화 엔진: 3개 첫 적용, 최신 최대 5개 중앙값, 5분 반올림, ±10분·min/max clamp, 복합 category/subCategory 격리, one-stop/pair fallback, route/API 0.
3. UI 시각 경계: 실제 progress 순서, 장식 timer/API 추가 0, header 빈 버튼 0, 카드 표시값/접근성 유지, 지도 geometry/marker/CTA 불변.
4. 기존 회귀: one-stop initial/page, two-stop 선택/취소/역선택, route geometry, global interaction/haptic, CAPTCHA/proxy 오류 매핑.
5. `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 한 번씩 실행하고 정확한 통과/실패 수를 기록한다.

## 역할 반환 기준

| 실패 | 반환 대상 |
| --- | --- |
| 완료 저장·legacy projection·storage 오류 | `DB-COMPLETION-RECORD-01` |
| 중앙값·clamp·후보/시간 안전성 | `2-AB` |
| 카드·지도·header·loading presentation | `U-RELEASE-VISUAL-01` |
| 기존 API receipt/cache/route regression | 통합 세션이 재현을 확인한 뒤에만 외부 API 역할 재개 |
| 문서 계약 충돌 | 통합·결정 세션 |

보완은 새 suffix 작업을 만들지 않고 원래 작업의 완료 기준으로 돌려보낸다.

## 실기기 범위

이 게이트에서 QA 세션이 Simulator 버튼을 하나씩 조작하지 않는다. 자동 게이트 통과 뒤 사용자가 새 internal build에서 다음 세 화면만 한 번 확인한다.

1. 메인 CTA와 진행/빈 카드 간격
2. 대표·대안 카드 밀도
3. 코스 확인 full-bleed 지도와 세로 순서

완료 기록의 실제 UI 연결과 Live Activity는 아직 구현 전이므로 이 smoke에서 요구하지 않는다.

## 수정 금지

- 제품 코드·원본 데이터·migration·중앙 기준 문서를 수정하지 않는다.
- 실제 외부 API·운영 Supabase·실사용자 데이터를 테스트 입력으로 쓰지 않는다.
- 테스트 실패를 숨기기 위해 snapshot/기대값만 변경하지 않는다.
- commit·push하지 않는다.

완료 인수인계에는 시나리오/fixture, 실행 명령과 통과 수, 실패의 소유 작업, 사용자에게 필요한 수동 확인 3개만 기록한다.

## 2026-09-04 실행 인수인계 — 자동 게이트 실패 반환

### 1. 변경 파일과 검증 목적

- 이 작업 문서만 수정해 세 역할의 파일 잠금 감사, 고정 fixture 실행 결과와 기존 작업 ID 반환 조건을 기록했다.
- QA fixture와 제품 코드는 수정하지 않았다. 기존 fixture의 기대값을 완화하거나 현재 동작에 맞춰 덮어쓰지 않았다.
- `DB-COMPLETION-RECORD-01`, `2-AB`, `U-RELEASE-VISUAL-01` 완료 인수인계의 선언 파일과 실제 작업 트리를 대조했다. 세 역할의 제품 소유 파일 집합은 각각 `src/services/courseCompletion*`, `src/engine/**`, 명시된 `src/ui/**` allowlist로 분리돼 교집합이 없고, 각 작업의 금지 경계 침범도 확인되지 않았다. 공유 트리의 중앙 문서 변경은 통합·결정 역할 변경으로 분리돼 있으며 세 작업의 완료 인수인계에는 포함되지 않는다.

### 2. 공개 계약 집중 fixture 결과

- 완료 repository: **13/13 통과**. 1·2곳 순서, 순차/동시 멱등성, 취소·route-open 저장 0, 손상/실패 typed 결과, legacy 보존, 미측정 `null`, 민감 필드·network 0을 유지했다.
- 체류 개인화: **12/12 통과**. 3건 첫 적용, 최신 최대 5건 중앙값, 5분 반올림, ±10분→min/max clamp, 복합 키 격리, one-stop/pair fallback과 route/API 0을 유지했다.
- 출시 시각 fixture: **5/5 통과**, 지도·transport source contract **14/14 통과**. 실제 progress 순서, 장식 timer/API 추가 0, 비시각 header spacer, 카드 표시/접근성, 지도 marker/CTA 계약을 유지했다.
- 기존 two-stop·interaction·CAPTCHA 모델 fixture는 집중 묶음에서 통과했으나, 아래 기존 geometry/QA-05 회귀가 고립 재실행에서도 실패해 foundation gate 전체는 실패다.

### 3. 최초 실패와 기존 작업 ID 반환

1. `QA-COURSE-GEOMETRY-02` 고립 실행: **3개 중 2 통과·1 실패**.
   - fixture: `test/qa-course-geometry-connector-integration.test.ts:176`
   - 재현값: 의도적으로 5번째 요청을 넣었을 때 provider 호출 기대 4, 실제 5(`5 !== 4`).
   - 계약 충돌: 현행 one-stop `COURSE-11`/`UX-27`/`QA-COURSE-GEOMETRY-02`는 화면당 최대 4를 요구하지만, 이후 two-stop `QA-TWO-STOP-01`은 최대 6을 수락했다. 공통 loader가 5번째를 허용해 one-stop 회귀가 깨진 상태다.
   - 반환: **`U-COURSE-GEOMETRY-02` → `QA-COURSE-GEOMETRY-02`**. 통합·결정 역할이 one-stop 4와 two-stop 6을 입력 형태별로 함께 지키는 계약을 재확인한 뒤 UI 소유 구현과 기존 QA fixture를 같은 작업 ID로 재검증해야 한다. `U-RELEASE-VISUAL-01`의 시각 변경 실패로 분류하지 않는다.
2. `QA-05` 고립 실행: **0/5 통과·5 실패**.
   - fixture: `test/qa05-proxy-runtime-integration.test.ts:67` 이하.
   - 재현값: fixture `place()`가 현재 후보 계약의 `maxStayMin`을 넣지 않아 모든 representative 후보가 사전 제외된다. 그 결과 48 입력 첫 행 `sasang/45/return`에서 대표가 `undefined`, 뒤 후보 보충도 `undefined`, attempt-limit 기대 대신 `no_open_candidates`, 빈 상태 기대 `time_budget_exceeded` 대신 `no_open_candidates`가 반환된다.
   - 반환: **`QA-05`**. 제품 정책을 바꾸지 말고 고정 후보 fixture가 현행 min/recommended/max 계약을 완전하게 구성하는지 기존 QA-05 범위에서 재확인해야 한다.

두 실패는 `DB-COMPLETION-RECORD-01`, `2-AB`, `U-RELEASE-VISUAL-01`의 신규 집중 fixture에서는 재현되지 않았다. 따라서 세 작업의 구현 파일을 QA가 직접 수정하거나 해당 기대값을 완화하지 않는다.

### 4. 전체 명령 결과와 다음 확인 범위

- 집중 고정 fixture 묶음: **180개 중 174 통과·6 실패**. 실패 6개는 위 geometry 1개와 QA-05 5개다.
- `npm run test:typecheck`: **통과**.
- `npm run test:ui`: **264개 중 263 통과·기존 의도 skip 1·실패 0**.
- `npm test`: **117/117 통과**.
- `git diff --check`: **통과**.
- Simulator·실기기·Metro·Xcode·실제 외부 API·운영 Supabase·실사용자 호출은 모두 0회다. `git add`·stage·commit·push도 수행하지 않았다.
- QA-FOUNDATION-WAVE-01 상태: **실패 반환 / 통합 수락 및 사용자 화면 smoke 보류**. 위 두 기존 작업이 닫히고 같은 고정 fixture가 통과하기 전에는 사용자에게 화면 확인을 요청하지 않는다.
- 자동 게이트가 다시 통과한 뒤 사용자 확인은 문서대로 (1) 메인 CTA와 진행/빈 카드 간격, (2) 대표·대안 카드 밀도, (3) 코스 확인 full-bleed 지도와 `출발→이동→장소→이동→목적지/복귀→도착 여유` 세로 순서의 세 항목만 한 번 요청한다.

## 2026-09-05 실행 인수인계 — 오래된 fixture 계약 보완 및 자동 게이트 통과

### 1. 변경 파일과 변경 목적

- `test/qa-course-geometry-connector-integration.test.ts`: 1곳 course의 connector request 생성 상한 4개를 독립적으로 유지하고, 2곳 course의 3개 transit leg에서 request를 최대 6개 생성하는 fixture를 추가했다. 공통 loader에는 인위적인 7번째 request를 넣어 provider 호출이 6회로 제한되는지 분리 검증했다.
- `test/qa05-proxy-runtime-integration.test.ts`: `place()`의 체류 fixture를 `minStayMin: 10 → recommendedStayMin: 15 → maxStayMin: 60` 순서의 유효 범위로 완성했다. 후보가 유효해진 뒤에도 기존 혼합 실패 의도를 보존하도록 no-route 구간을 명시했고, A8 attempt 및 다섯 빈 상태 사유는 제품 entry의 가변 continuation과 섞이지 않는 고정 receipt 평가 경계에서 검증했다. 시간 초과 fixture의 왕복 30분 route와 기존 기대 사유는 유지했다.
- 이 작업 문서: 고립 재현, 전체 자동 게이트 결과와 다음 수동 확인 범위를 기록했다.

### 2. 변경하지 않은 공개 계약·정책 경계

- 1곳 connector request 생성은 실제 5회를 허용하지 않고 최대 4개로 유지했다. 2곳은 최대 6개이며 공통 loader만 6개 방어 상한을 적용한다.
- connector 동시성 2, 부분 실패 집계, 성공한 connector만 표시, 직선 fallback 금지 계약을 유지했다.
- `hasValidStayRange`와 엔진의 min/recommended/max 검증을 완화하지 않았다. 운영시간·시간 초과·no-route·provider unavailable의 결과 사유 기대값도 현재 실패값에 맞춰 덮어쓰지 않았다.
- 제품 코드, 엔진, UI, DB, migration, 원본 데이터, 중앙 기준 문서는 수정하지 않았다. 실제 외부 API·운영 Supabase·Simulator·실기기·Metro·Xcode는 사용하지 않았다.

### 3. 실행한 테스트와 결과

- 고립 실행 `npx tsx --test test/qa-course-geometry-connector-integration.test.ts test/qa05-proxy-runtime-integration.test.ts` — **9/9 통과**(geometry 4/4, QA05 5/5).
- QA-FOUNDATION-WAVE-01 집중 고정 fixture 묶음 — **223/223 통과**. 완료 저장, 체류 개인화, 출시 시각, one-stop initial/page, two-stop 선택·취소·역선택, route geometry/connector, interaction/haptic, CAPTCHA/Proxy 사유 경계를 함께 재검증했다.
- `npm run test:typecheck` — **통과**.
- `npm run test:ui` — **264개 중 263 통과, 기존 의도 skip 1, 실패 0**.
- `npm test` — **117/117 통과**.
- `git diff --check` — **통과**.
- `git add`·stage·commit·push는 수행하지 않았다.

### 4. 다음 확인 범위와 잔여 위험

- QA-FOUNDATION-WAVE-01 자동 게이트 상태는 **통과**다. 사용자 화면 smoke는 새 internal build에서 (1) 메인 CTA와 진행/빈 카드 간격, (2) 대표·대안 카드 밀도, (3) 코스 확인 full-bleed 지도와 `출발→이동→장소→이동→목적지/복귀→도착 여유` 세로 순서만 각각 한 번 확인한다.
- 위 세 시각 항목은 고정 fixture가 작은/큰 iPhone의 실제 촉감과 Dynamic Type 배치를 완전히 대체하지 못하는 잔여 범위다. 그 외 기능·외부 API·운영 DB 검증은 이번 작업에서 새로 요청하지 않는다.

## 2026-09-05 사용자 수동 smoke 결과

- 대표·대안 카드 밀도: **확인 완료**.
- 코스 확인 full-bleed 지도와 세로 순서: **확인 완료**.
- Home CTA와 진행/빈 영역: 간격 자체가 아니라, V1 코스를 시작한 뒤 Home에 `진행 중인 코스`가 나타나지 않는 기능 격차를 확인했다.
- 원인은 `U-RELEASE-VISUAL-01` 회귀가 아니다. 해당 작업은 진행 복원 로직을 수정하지 않는 범위였고, 현재 V1 진행 state는 화면 로컬이며 Home은 legacy active course만 읽는다.
- 자동 게이트와 확인된 두 시각 항목은 되돌리지 않는다. 미확인 1건은 [U-PROGRESS-RESUME-01](../uiux/active-verified-course-resume.md)에서 비로그인·로그인 공통 프로세스 내 이어가기로 구현하고, `QA-PROGRESS-RESUME-01`의 제한 smoke로 닫는다.

## 2026-09-05 후속 구현 상태

- 위 Home V1 active 미연결은 `U-PROGRESS-RESUME-01`에서 별도 runtime 상태와 이어가기 경계로 수정했다.
- 구현 자동 회귀는 통과했지만 [QA-PROGRESS-RESUME-01](progress-resume-validation.md)은 아직 실행하지 않았다.
- `QA-FOUNDATION-WAVE-01`의 이관 항목은 비로그인 iOS 실기기 제한 smoke가 끝난 뒤에만 닫는다. 강제 종료·재부팅 복구는 Foundation 범위가 아니라 `U-LIVE-ACTIVITY-01` 후속이다.
