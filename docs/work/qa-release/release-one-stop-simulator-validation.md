# QA-RELEASE-ONESTOP-01 — 출시 1곳 추천 빠른 Simulator 검증

## 상태와 선행 조건

**전체 실행 완료·조건부 수락.** 단계 A는 통합 수락됐고, 단계 B는 사용자와 QA가 launcher 8개를 각 1회 실행해 공급 게이트를 통과했다. 단계 C의 화면 외형은 확인했으나 receipt 회수와 코스 확인·뒤로가기 한 경로가 남았다. 같은 8개를 반복하지 않고 출시 후보 빌드의 단일 시나리오 1회에서 두 항목을 함께 확인한다.

`2-U`와 `U-RELEASE-ONESTOP-01`은 이미 수락됐다. 이 작업은 `REC-30`, `TEST-04`, `UXV-02`, `UXV-03`의 **보완**이며 추천 정책을 새로 정하지 않는다.

## 1. 방식 변경 이력

### 이전 방식 — 철회

- QA가 시나리오마다 장소 검색, 도착지/복귀 선택, 테스트 시각·도착 시각 설정, 결과 스크롤을 직접 반복했다.
- 같은 8개 입력을 다시 검증할 때도 버튼을 처음부터 눌러야 했다.

### 발생한 문제

- 추천 엔진과 UX가 바뀔 때마다 동일 조작을 반복해야 했다.
- 버튼을 눌러 앱을 이해하는 시간이 결과 판정 시간보다 길고, 입력 실수·기록 누락 때문에 실행 간 비교가 어려웠다.
- 기존 `npm run test:qa:scenario`는 180분·다장소 과거 fixture를 사용하므로 현행 120분 one-stop 출시 검증으로 볼 수 없다.

### 교체 방식 — 현행

1. 현행 one-stop 전용 고정 fixture 8개를 CLI에서 한 번에 검증한다.
2. 개발 전용 launcher로 실제 Proxy 시나리오 8개를 장소 검색·시간 휠 없이 각각 한 번 실행한다.
3. 결과는 `[qa-release-one-stop]` 구조화 로그로 수집해 자동 집계한다.
4. 화면을 직접 만지는 smoke는 대표적인 2개 시나리오로 제한한다.
5. 실제 GPS·설치 카카오맵 handoff처럼 Simulator가 증명할 수 없는 항목만 사용자에게 요청한다.

Maestro는 현재 설치·flow가 없고 이번 8개 검증만을 위해 도입하면 준비 비용이 더 크므로 이번 활성 작업의 완료 조건에서 제외한다. 같은 회귀가 이후에도 계속 늘어날 때 별도 결정으로 도입한다.

## 2. 먼저 읽을 파일

1. 루트 `AGENTS.md`, `docs/README.md`, `docs/작업조정_보드.md`
2. `docs/work/qa-release/README.md`
3. [출시 1곳 추천 개발용 실행기](../uiux/qa-release-one-stop-launcher.md)의 **수락된 완료 인계**
4. [출시용 1곳 실제 검증 전환](../recommendation-engine/release-one-stop-verified-course.md)
5. [출시 1곳 추천 UI 연결](../uiux/release-one-stop-results.md)
6. `docs/03_product/추천로직.md`의 2026-09-02 출시 파이프라인
7. `docs/테스트.md`의 `REC-30`, `TEST-04`

과거 다장소, B12, continuation, 전체 archive는 읽지 않는다.

## 3. 단계 A — 무호출 일괄 fixture

### 3.1 QA 소유 구현

QA는 기존 과거 `qa02` fixture를 억지로 수정하지 않고 현행 출시 전용 파일을 추가한다.

- `test/fixtures/release-one-stop-scenarios.fixture.ts`
- `test/qa-release-one-stop-harness.test.ts`
- `package.json` script `test:qa:release-one-stop`

fixture에는 아래 8개 ID와 `15:00`, 도착 전 여유 10분, 표의 remaining minute를 넣는다. 장소·경로는 실제 네트워크가 아닌 결정적 adapter fixture를 주입하되, 공개 실행 entry는 `buildReleaseOneStopRepresentativeCourseV1` 또는 현행 production runtime builder 경계를 호출한다.

| ID | 출발지 → 도착지 | 입력 시간 |
| --- | --- | ---: |
| SIM-ONE-01 | 서면역 → 출발지 복귀 | 45분 |
| SIM-ONE-02 | 서면역 → 출발지 복귀 | 120분 |
| SIM-ONE-03 | 사상역 → 서면역 | 90분 |
| SIM-ONE-04 | 부산역 → 남포역 | 120분 |
| SIM-ONE-05 | 광안리해수욕장 → 출발지 복귀 | 75분 |
| SIM-ONE-06 | 센텀시티역 → 해운대역 | 120분 |
| SIM-ONE-07 | 동래역 → 출발지 복귀 | 60분 |
| SIM-ONE-08 | 다대포해수욕장역 → 출발지 복귀 | 120분 |

### 3.2 fixture가 자동 판정할 값

- 대표 0~1, 대안 0~3.
- 반환 course의 `placeIds.length === 1`.
- 대표·대안 ID 중복 0.
- `remainingMin`이 1~120이고 총 계산값이 예산과 도착 여유를 넘지 않는다.
- 체류 최소 20분, 20~29분만 short 상태이며 최대 체류로 자동 연장하지 않는다.
- provider 신규 attempt 8 이하.
- cache/session 재사용은 신규 attempt로 세지 않는다.
- 운영시간 불가·route 실패·빈 후보는 검증 course로 승격되지 않는다.
- 2·3곳 생성, continuation, candidate-to-candidate route 요청 0.
- 동일 fixture 재실행 결과가 ID·상태·집계 기준으로 동일하다.

### 3.3 필수 반례

1. 정확히 120분 통과, 121분과 0분은 추천·adapter 호출 전에 거절.
2. 대표 없음과 대표만 있음, 대표+대안 3개.
3. 첫 후보 route 실패 뒤 다음 one-stop 후보 검증.
4. 모든 route 실패와 provider typed unavailable을 서로 다른 상태로 기록.
5. 동일 장소 이름 변형/동일 ID 중복 제거.
6. 느린 이전 실행 결과가 최근 결과를 덮지 않는 UI launcher 계약은 UIUX 테스트 결과를 재사용한다.

fixture는 실제 부산 공급량이나 실제 경로 정확도를 증명한다고 쓰지 않는다. 목적은 정책·상태 전이·반복 가능성이다.

## 4. 단계 B — 실제 Proxy 8회 빠른 실행

### 4.1 환경 확인

- `EXPO_PUBLIC_ROUTE_PROXY_ENABLED=true`
- `EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS=true`
- `EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12=false`
- 새 환경변수는 추가하지 않는다.
- QA용 익명 세션 하나를 유지한다. 앱 데이터·익명 사용자를 시나리오마다 초기화하지 않는다.
- 이미 올바른 Metro가 실행 중이면 `--clear`하지 않는다. 환경/bundle stale 근거가 있을 때 한 번만 재시작한다.

### 4.2 실행 순서

1. Simulator·Metro의 기존 프로세스를 확인하고 QA 자신이 시작한 PID/UDID만 기록한다.
2. launcher에 `SIM-ONE-01`부터 `08`까지 8개가 보이는지 확인한다. 없으면 수동 조작으로 대체하지 않고 `U-QA-HARNESS-01` 미반영으로 중단한다.
3. 각 시나리오 버튼을 순서대로 한 번만 탭한다. 첫 익명 인증에 CAPTCHA가 필요하면 정상 완료하되 우회하지 않는다.
4. 결과 확인 후 앱의 제공된 QA 복귀 동작으로 launcher로 돌아온다. 장소를 다시 검색하거나 시간 휠을 조작하지 않는다.
5. 터미널에서 `[qa-release-one-stop]` 8줄을 수집한다. token·JWT·좌표·URL이 섞이면 즉시 로그를 폐기하고 UIUX 보완으로 중단한다.
6. provider 호출 뒤 결과가 적거나 실패했다는 이유로 같은 ID를 재실행하지 않는다.
7. 8줄을 아래 표로 옮기고 집계한다. 화면을 직접 읽은 값보다 receipt를 우선하며, 불일치가 있으면 둘 다 보존하고 UI 결함으로 분리한다.

| ID | 상태 | 대표 | 대안 | 고유 장소 수 | 신규 attempt | cache/reuse | 탈락/실패 enum | 화면과 일치 |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |

### 4.3 실제 결과 판정

필수 안전 게이트:

- crash·무한 loading·navigation 복원 실패 0.
- 예산 초과·도착 여유 누락·운영 불가 자동 추천 0.
- 같은 장소 중복, 2·3곳 course, continuation CTA, 체류 분 숫자 노출 0.
- 신규 provider attempt 8회 초과 0.
- CAPTCHA/Proxy 실패를 추천 0개로 평탄화한 사례 0.

공급·체감 게이트:

- 8개 중 대표 성공 6개 이상.
- 대표 포함 서로 다른 선택지가 2개 이상인 시나리오 4개 이상.
- 8개 전체 표시 고유 장소명 8개 이상.
- 같은 한 장소가 서로 다른 시나리오 4개 이상에서 대표로 반복되지 않는다.

수치 미달은 결과를 얻기 위한 재호출 이유가 아니다. receipt로 확인한 `원천 후보 없음 / 운영시간 탈락 / 시간 예산 탈락 / 실제 경로 불가 / provider 실패`만 기록한다.

## 5. 단계 C — 수동 화면 smoke 2건

실제 8회를 다시 실행하지 않는다. 단계 B에서 이미 나온 결과 중 다음 두 화면을 사용한다.

1. `SIM-ONE-01`: 짧은 예산, 대표/short 문구, 빈 대안 가능성.
2. `SIM-ONE-06`: 별도 도착지, 대표+대안, 이동/여유/남는 시간.

확인 범위:

- 첫 화면과 끝까지 스크롤했을 때 잘림·겹침·무한 loading이 없는가.
- 대표와 대안 선택이 해당 `CourseConfirm`으로 이동하는가.
- 뒤로 가기 후 결과와 선택 대상이 보존되는가.
- 빈 결과라면 원인별 사용자 문구가 있고 단순 오류처럼 보이지 않는가.

장소 검색, 지도 선택, 키보드, 시간 wheel의 전체 기능을 이 두 smoke에서 다시 검사하지 않는다. 해당 UI가 별도로 변경됐을 때만 소유 작업의 회귀를 사용한다.

## 6. 사용자에게 요청할 수 있는 범위

Simulator로 증명할 수 없는 다음 항목만 한 번 요청한다.

1. 실제 iPhone GPS와 위치 권한 허용/거절.
2. 설치된 카카오맵 앱 handoff와 TimeFit 복귀.
3. Simulator와 다른 실기기 WebView/CAPTCHA 실패.
4. 알림·Live Activity·백그라운드 OS 동작.

요청 전 자동 fixture, Simulator 로그, 실패 enum을 먼저 확인한다. 요청에는 불가능한 이유, 누를 단계, 기대 결과, 1회 실행 여부를 함께 적는다.

## 7. 수정·중단 경계

QA가 수정할 수 있는 것은 `test/`의 fixture/E2E, `package.json`의 QA script, 이 QA 문서와 비밀 없는 증거 기록이다.

수정하지 않는다:

- `src/engine/`, `src/ui/`, `src/services/`, `src/data/`
- `App.tsx`, navigation 파일
- `.env*`, native 권한, Supabase/Cloudflare 배포 설정
- 제품 기준 문서와 `docs/작업조정_보드.md`

결함을 발견하면 기능 코드를 고치지 않고 입력 ID, receipt, 화면 관찰, 기대값, 담당 역할을 인계한다. 아래 조건에서는 남은 실제 호출을 중단한다.

- launcher 비노출/시나리오 값 불일치.
- release policy가 아닌 B12/A8 표시.
- 인증/Proxy 공통 실패가 두 연속 시나리오에서 재현.
- 로그에 비밀·좌표·전체 URL 노출.
- crash, 무한 loading, provider 상한 초과.

## 8. 검증 명령과 합격값

```bash
npm run test:qa:release-one-stop
npx tsx --test test/ui/qa-release-one-stop-launcher.test.ts test/ui/recommendation-runtime-boundary.test.ts test/ui/time-setup-clock.test.ts
npx tsx --test test/release-one-stop-verified-course.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

- 자동 테스트 신규 실패 0, 기존 명시 skip 수 기록.
- 자동 테스트의 실제 Kakao/TMAP/Supabase/CAPTCHA/GPS 호출 0.
- Simulator 실제 추천은 총 8개 시나리오, 각 신규 provider attempt 최대 8.
- 경계/fixture 확인 때문에 실제 API를 추가 호출하지 않는다.

## 9. 완료 인수인계

1. 변경 파일과 목적
2. 유지한 one-stop/120분/8회/보안·개인정보 계약
3. 자동 테스트 통과 수, 실제 8개 receipt 표, smoke 2건, 캡처·로그 위치
4. 수락/조건부 수락/보완 필요/중단 판정과 정확한 다음 담당

완료 기준을 충족하지 못하면 `완료`라고만 쓰지 않는다. QA 세션은 보드를 수정하지 않는다.

---

## 2026-09-02 — 단계 A 완료 인계

### 1. 변경 파일과 목적

- `test/fixtures/release-one-stop-scenarios.fixture.ts`: `SIM-ONE-01`~`08`, 개발 테스트 시각 15:00, 도착 여유 10분, 45~120분 입력과 결정적 receipt adapter를 출시 one-stop 전용 fixture로 추가했다.
- `test/qa-release-one-stop-harness.test.ts`: one-stop 형태·예산·체류 상태·중복 제거·attempt/reuse 계수·typed 실패·결정성을 자동 판정하는 단계 A 회귀를 추가했다.
- `package.json`: 위 회귀만 실행하는 `test:qa:release-one-stop` 스크립트를 추가했다.
- 이 문서: 단계 A 결과와 단계 B/C 미실행 상태를 기록했다.

### 2. 유지한 공개 계약·정책 경계

- 현행 `buildReleaseOneStopRepresentativeCourseV1` 공개 entry만 호출했다. 엔진, UI, API/service, 카탈로그, DB, 환경값과 제품 기준 문서는 수정하지 않았다.
- 최대 120분, 대표 0~1·서로 다른 one-stop 대안 0~3, 최소 체류 20분, 20~29분만 `short`, provider 신규 attempt 최대 8 계약을 유지했다.
- 2·3곳 조립, candidate-to-candidate route, continuation, 운영 불가·route 실패·시간 초과 후보의 자동 승격은 fixture에서 0으로 고정했다.
- 121분과 0분은 release preflight에서 builder·adapter 호출 전에 차단했다. cache/session reuse는 신규 attempt와 분리했다.
- fixture는 주입 adapter만 사용했으며 실제 Kakao/TMAP/Supabase/CAPTCHA/GPS 호출은 0회였다. 실제 부산 공급량이나 실제 경로 정확도의 근거로 사용하지 않는다.

### 3. 실행 테스트와 결과

- `npm run test:qa:release-one-stop`: **8/8 통과**.
- `npx tsx --test test/ui/qa-release-one-stop-launcher.test.ts test/ui/recommendation-runtime-boundary.test.ts test/ui/time-setup-clock.test.ts`: **13/13 통과**. 느린 이전 실행이 최신 상태를 덮지 않는 launcher 계약은 UIUX 소유 fixture 결과를 재사용했다.
- `npx tsx --test test/release-one-stop-verified-course.test.ts`: **5/5 통과**.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **176 통과, 실패 0, 기존 skip 1**(총 177).
- `npm test`: **113/113 통과**.
- `git diff --check`: 통과.
- 검증 중 UIUX launcher fixture가 작성되는 순간의 중간 상태에서 타입 오류 3건을 한 번 관찰했으나 QA가 역할 밖 파일을 수정하지 않았다. UIUX 소유 변경 반영 후 위 최종 명령을 다시 실행해 모두 통과했다.

### 4. 판정·남은 위험·다음 담당

- **단계 A 구현 세션의 당시 판정:** 로직 테스트는 수락 가능했으며 실제 Route Proxy 추천 호출, `[qa-release-one-stop]` receipt, Simulator 결과 화면 smoke와 실기기 요청은 모두 0회였다.
- `U-QA-HARNESS-01` 수락 선행은 이후 충족됐다. 다만 아래 통합·결정 검토에서 고정 좌표 불일치가 발견됐으므로, 현재 실행 기준은 단계 A 입력 동기화 보완 뒤 B/C 진행이다.
- 단계 B에서만 실제 8개 ID를 각각 1회 실행하고 공급·안전 게이트를 집계해야 한다. 단계 C는 그 결과 중 `SIM-ONE-01`, `SIM-ONE-06`을 재호출하지 않고 화면 smoke에 재사용한다.

### 2026-09-02 통합·결정 단계 A 검토

- `npm run test:qa:release-one-stop`을 독립 재실행해 8/8 통과했다. 최초 sandbox 실행의 임시 IPC `EPERM`은 테스트 결함이 아니며 권한 있는 동일 명령에서 정상 통과했다.
- `U-QA-HARNESS-01` 대상 14/14, 타입 검사, UI 176 통과·기존 1 skip, 전체 113/113도 통합 재검증했다.
- 고정 입력 교차 대조에서 QA fixture와 UI launcher의 부산역·남포역·센텀시티역·동래역·다대포해수욕장역 좌표가 다름을 확인했다. 합성 route 결과에는 영향이 없지만 자동 fixture와 실제 Proxy가 같은 입력이라는 비교 계약을 충족하지 못한다.
- 판정: **단계 A 입력 동기화 보완 필요**. 새 작업 ID를 만들지 않고 같은 단계 A에서 아래 항목만 보완한다.

#### 단계 A 입력 동기화 보완 명령

1. `test/fixtures/release-one-stop-scenarios.fixture.ts`의 좌표를 수락된 `src/ui/qaReleaseOneStopLauncherModel.ts`와 정확히 맞춘다.
   - 부산역 `35.1152, 129.0422`
   - 남포역 `35.0976, 129.0347`
   - 센텀시티역 `35.1691, 129.1305`
   - 동래역 `35.2057, 129.0785`
   - 다대포해수욕장역 `35.0484, 128.9658`
2. `test/qa-release-one-stop-harness.test.ts`에서 UI launcher의 8개 공개 QA preset과 QA fixture를 ID로 결합해 출발·도착 label/lat/lon, destination null 여부, remainingMin, arrivalBufferMin이 모두 정확히 같은지 검증한다. 날짜 문자열 자체는 fixture 재현성을 위해 고정할 수 있지만 시각은 양쪽 모두 15:00이어야 한다.
3. 엔진·UI·API·카탈로그와 launcher 상수는 수정하지 않는다. 실제 외부 호출도 하지 않는다.
4. `npm run test:qa:release-one-stop`, launcher 대상 테스트, `npm run test:typecheck`, `git diff --check`를 다시 실행해 통과 수를 이 문서에 남긴다.
5. 이 네 항목 통과 뒤에만 단계 B/C를 시작한다.

---

## 2026-09-02 — 단계 A 입력 동기화 보완 완료 인계

### 1. 변경 파일과 목적

- `test/fixtures/release-one-stop-scenarios.fixture.ts`: 부산역·남포역·센텀시티역·동래역·다대포해수욕장역의 고정 좌표를 수락된 UI launcher preset과 정확히 일치시켰다.
- `test/qa-release-one-stop-harness.test.ts`: 시나리오 ID로 QA fixture 8개와 `QA_RELEASE_ONE_STOP_SCENARIOS`를 결합해 출발·도착 label/lat/lon, destination null 여부, `remainingMin`, `arrivalBufferMin`, 양쪽 15:00을 비교하는 교차 계약 테스트 1건을 추가했다.
- 이 문서: 입력 동기화 변경과 지정 회귀 결과를 기록했다.

기존 단계 A fixture adapter, one-stop 결과 판정, package script는 재작성하거나 변경하지 않았다. 엔진·UI·API·카탈로그와 launcher 상수, 보드도 수정하지 않았다.

### 2. 지정 회귀 결과

- `npm run test:qa:release-one-stop`: **9/9 통과**. 신규 8개 preset 교차 계약 포함.
- `npx tsx --test test/ui/qa-release-one-stop-launcher.test.ts test/ui/recommendation-runtime-boundary.test.ts test/ui/time-setup-clock.test.ts`: **14/14 통과**.
- `npm run test:typecheck`: 통과.
- `git diff --check`: 통과.
- 모든 회귀는 고정 fixture와 주입 adapter만 사용했다. 실제 Kakao/TMAP/Supabase/CAPTCHA/GPS 및 Route Proxy 호출은 **0회**다.

### 3. 판정과 다음 단계

- **단계 A 입력 동기화 보완 완료·수락 가능.** QA fixture와 UI launcher의 8개 preset 입력이 동일하다는 비교 계약을 확보했다.
- 단계 B의 실제 Proxy 8회와 단계 C의 화면 smoke는 이번 보완에서 시작하지 않았다. 통합·결정의 다음 진행 지시 전까지 실제 시나리오 버튼을 누르지 않는다.

### 2026-09-02 통합·결정 최종 검토

- 지정된 5개 지점 좌표가 수락된 UI launcher와 정확히 일치함을 확인했다.
- 8개 preset의 출발·도착 label/lat/lon, 왕복 여부, 입력 시간, 도착 여유, 15:00 시각을 비교하는 교차 계약 테스트가 추가됐다.
- `npm run test:qa:release-one-stop` **9/9**, launcher 관련 테스트 **14/14**, 타입 검사와 `git diff --check`를 독립 재실행해 모두 통과했다.
- 판정: **단계 A 수락.** QA는 단계 A와 수동 장소 검색·시간 wheel을 반복하지 않고, 단계 B 실제 Proxy 8회 후 단계 C 기존 결과 smoke 2건을 수행한다. 단계 B의 중단 조건이 발생하면 단계 C를 억지로 진행하지 않고 안전한 receipt와 담당 역할을 기록한다.

---

## 2026-09-02 — 단계 B/C Simulator 실행 인계

### 1. 실행 범위와 변경 파일

- iPhone 17 Simulator(iOS 26.5)에 현재 internal build를 앱 데이터 삭제 없이 덮어 설치했다. 환경은 Route Proxy 활성, 추천 진단 활성, 내부 B12 비활성으로 확인했다.
- 장소 검색, 시간 wheel, 단계 A fixture는 반복하지 않았다. launcher의 8개 버튼을 각 1회만 실행했으며 실제 실행 순서는 자동화 `01 → 02`, 수동 인계 `06 → 03 → 04 → 05 → 07 → 08`이었다. 순서 이탈 뒤에도 호출을 맞추기 위한 재실행은 하지 않았다.
- 변경 파일은 이 문서 하나다. `src/`, 엔진, API/service, 카탈로그, 환경 파일, 보드는 수정하지 않았다.
- `/private/tmp/timefit-onestop-ui`의 임시 XCUITest는 launcher 노출과 화면 증거 수집에만 사용했으며 저장소 변경 파일이 아니다.

### 2. 단계 B 화면 기반 실제 결과

앱이 기존의 다른 Metro 세션에 연결돼 `[qa-release-one-stop]` 콘솔 receipt를 QA 세션에서 회수하지 못했다. 아래 표의 대표·대안·고유 장소 수는 결과 화면과 개발용 진단 화면에서 읽은 값이며, receipt 우선 비교는 수행하지 못했다. `—`는 0이 아니라 **미수집**을 뜻한다.

| ID | 상태 | 대표 | 대안 | 고유 장소 수 | 신규 attempt | cache/reuse | 화면 진단의 탈락/실패 | receipt와 일치 |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| SIM-ONE-01 | empty | 없음 | 없음 | 0 | — | — | 원인별 빈 결과 문구 노출, enum 미수집 | 비교 불가 |
| SIM-ONE-02 | verified | 포셋 전포 | 아비베르컴퍼니, 롯데백화점 부산본점 | 3 | — | — | 경로 확인 불가 1 | 비교 불가 |
| SIM-ONE-03 | verified | 부산 수학문화관 | 사상문화원 | 2 | — | — | 미수집 | 비교 불가 |
| SIM-ONE-04 | verified | 백구당 | 40계단 | 2 | — | — | 미수집 | 비교 불가 |
| SIM-ONE-05 | verified | 광안리해변 테마거리 | 책방오월, 포디움다이브엠 | 3 | — | — | 미수집 | 비교 불가 |
| SIM-ONE-06 | verified | 머그디저트랩 | 부산 영화의 거리 | 2 | — | — | 미수집 | 비교 불가 |
| SIM-ONE-07 | verified | 롯데백화점 동래점 | 한국기독교선교박물관, 동래읍성 임진왜란 역사관 | 3 | — | — | 미수집 | 비교 불가 |
| SIM-ONE-08 | verified | 아미산전망대 | 없음 | 1 | — | — | 시간 예산 초과 1 | 비교 불가 |

화면 기반 공급 집계는 대표 성공 **7/8**, 서로 다른 선택지 2개 이상 **6/8**, 전체 표시 고유 장소명 **16개**, 같은 대표가 4개 이상 시나리오에서 반복된 사례 **0개**로 공급·체감 게이트를 충족했다. 표시된 모든 결과는 `내부 정책: 출시 1곳`, course당 장소 1개, 도착 여유 10분이었고 화면에 보인 검증 시간은 각 시나리오 예산 이내였다. 같은 화면 안 중복, 2·3곳 course, continuation CTA, crash, 무한 loading은 관찰되지 않았다.

다만 receipt가 **0/8**이므로 신규 provider attempt 최대 8, adapter 호출 수, cache/session reuse, 전체 typed 탈락 enum, CAPTCHA/Proxy 실패 평탄화 여부는 판정할 수 없다. 따라서 화면 기반 공급 게이트 통과만으로 단계 B 전체를 수락하지 않는다.

### 3. 단계 C smoke 결과

- `SIM-ONE-01`: 첫 실행의 빈 결과 화면을 상단과 끝까지 확인했다. 원인별 사용자 문구가 노출됐고 잘림·겹침·무한 loading은 없었다. 선택 가능한 course가 없어 `CourseConfirm` 항목은 해당 없음이다.
- `SIM-ONE-06`: 첫 실행의 대표·대안과 스크롤 화면은 확인했다. 잘림·겹침·무한 loading은 관찰되지 않았다. 사용자가 대표·대안의 `추천 확인 → CourseConfirm → 뒤로 가기`를 **확인하지 않았음**을 명시했으며, 재실행 금지에 따라 다시 호출하지 않았다. 선택 대상 보존과 navigation 복원은 미검증이다.
- 자동화된 `SIM-ONE-01`, `02`의 추천 호출과 화면 캡처는 완료됐지만 결과 화면을 아래로 스크롤한 뒤 상단 뒤로가기 접근을 복구하지 못해 XCUITest 자체는 실패했다. 이는 앱 crash가 아니라 임시 QA 자동화의 스크롤 복원 결함이며 같은 시나리오를 재실행하지 않았다.

### 4. 실행 증거와 결과

- internal build: iPhone 17 Simulator 설치·실행 성공, 빌드 오류 0·경고 0.
- 호출 없는 launcher 사전 점검: `SIM-ONE-01`~`08`과 `qa-next-scenario` 노출 확인, XCUITest **1/1 통과**. 증거: `/private/tmp/timefit-onestop-ui/launcher-stage-b.xcresult`.
- `SIM-ONE-01`: 실제 버튼 탭 1회, 빈 결과·원인 문구 화면 확보. 결과 화면 뒤로가기 자동화 단계 실패. 증거: `/private/tmp/timefit-onestop-ui/SIM-ONE-01.xcresult`.
- `SIM-ONE-02`: 실제 버튼 탭 1회, 대표 1·대안 2 화면 확보. 결과 화면 뒤로가기 자동화 단계 실패. 증거: `/private/tmp/timefit-onestop-ui/SIM-ONE-02.xcresult`.
- `SIM-ONE-03`~`08`: 사용자가 각 버튼을 1회 실행해 대화 첨부 화면으로 결과를 제공했다. `SIM-ONE-06`은 `03`보다 먼저 실행됐으나 어떤 ID도 재실행하지 않았다.
- 화면과 receipt 어디에도 token·JWT·주소·좌표·키·전체 URL을 문서로 옮기지 않았다.

### 5. 판정과 담당 역할

- 판정: **단계 B 공급 게이트 통과, 안전·receipt 게이트 미판정 / 단계 C 부분 완료. 전체 QA-RELEASE-ONESTOP-01은 보완 필요.**
- 직접 원인: 앱이 QA가 시작한 Metro가 아니라 기존 Metro에 다시 연결돼 휘발성 console receipt가 현재 QA 세션으로 전달되지 않았다. 실행 전 연결 포트 고정을 끝까지 증명하지 못한 부분은 **QA·출시 역할**의 하네스/실행 책임이다.
- 구조적 위험: receipt가 화면·파일·내보내기 경로 없이 단일 console line에만 의존해, 올바른 결과 화면이 있어도 사후 회수가 불가능했다. 재호출 없이 receipt를 내보내거나 launcher에서 안전한 허용 목록 receipt를 조회할 계약은 **UIUX 역할**이 보완하고, 저장 위치·보존 범위 결정은 **통합·결정 역할**이 확정해야 한다.
- `SIM-ONE-06` CourseConfirm 이동·뒤로가기·선택 보존 미검증은 **QA·출시 역할**의 남은 화면 smoke다. 이 작업의 1회 호출 제한 때문에 현재 결과를 재호출해 메우지 않는다. 다음 검증은 receipt 보완과 함께 새로 승인된 실행 회차에서만 한다.
- 기능 코드 수정, 실제 호출 재시도, 보드 수정은 수행하지 않았다.

### 2026-09-02 통합·결정 최종 판정

- 화면 기반 공급 게이트는 대표 성공 **7/8**, 선택지 2개 이상 **6/8**, 전체 고유 장소 **16개**, 대표 과다 반복 **0개**로 모두 통과했다. 사용자가 launcher 버튼을 누르고 QA가 캡처를 판독·기록한 방식은 고정 입력을 훼손하지 않았으므로 유효한 수동 Simulator 증거로 인정한다.
- crash·무한 loading·화면 중복·다장소 노출·continuation 노출은 관찰되지 않았고, 표시된 코스는 모두 출시 1곳 정책과 입력 예산을 지켰다.
- 구조화 receipt 0/8과 `SIM-ONE-06`의 코스 확인·뒤로가기 보존 미검증 때문에 완전 수락으로 과장하지 않는다. 반대로 자동 계약과 실제 공급 결과가 이미 확보된 상태에서 8개 전체를 다시 호출하는 것도 요구하지 않는다.
- 판정: **조건부 수락·다음 제품 작업 진행 가능.** 출시 후보 빌드에서 새 단일 시나리오 1회만 올바른 Metro에 연결해 안전 receipt의 attempt/reuse를 회수하고, 같은 결과에서 `추천 확인 → CourseConfirm → 뒤로가기`를 확인한다. 이 확인은 새 기능 작업으로 분기하지 않고 최종 출시 smoke에 포함한다.
