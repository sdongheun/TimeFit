# U-GUEST-IMPORT-01 — 가져온 계정 기록 표시 보완

상태: 2026-09-08 UI 표시 보완·자동 검증 완료, 이미 가져온 기록의 실기기 표시 확인 대기. DB 복구 재구현 금지.

## 통합 수락 — 2026-09-08

사용자가 U-GUEST-IMPORT-01 완료 및 실기기 정상 확인을 보고했다. 아래 인수인계의 자동 검증(typecheck, UI593 PASS/1 skip, core274 PASS, iOS export)과 사용자 표시 확인을 근거로 이 UI 보완을 수락한다. 위/아래 실기기 대기는 당시 이력이다. 통합은 문서만 갱신했으며 제품 코드·서버 변경 및 테스트 재실행0. 이는 기록 표시 수락이며 원격 전체 중복 감사나 원본 정리 검증으로 확대하지 않는다. 다음은 테스트 시각 추천 실패 진단이다.

## 원인·목적

DB 문서의 02:48 사용자 관찰에서 가져온 계정 기록 및 ‘직접 가져온 방문 기록’ 표시를 확인했다. 통합은 집중25/25 PASS를 재실행했다. 실기기 원본 정리·서버 중복 없음까지 화면만으로 증명한 것은 아니다. 추가 import 실행이나 C 재테스트를 요구하지 않는다.

확인된 UI 코드: ActivityRecordScreen은 account subject가 있으면 summary 로드를 건너뛰고 AccountRecordsPanel만 렌더링한다. 통계 레이아웃은 guest 분기에만 있다. AccountRecordsPanel의 같은 부모 아래 CompletedPlacesMapButton과 GuestImportPanel은 같은 key={subject}를 사용한다. 따라서 목록만 보이는 현상과 sibling key 충돌은 UI 경계이며 DB 중복 저장으로 단정하지 않는다.

기존 guest 통계/account 목록 분리 → 가져오기 성공 후 기존 통계가 사라진 것처럼 보이고 key 경고 발생 → 소유권을 유지하며 기존 통계 표현 재사용·용도별 key 구분 → 일관된 기록 화면 → 구현 전. 기존 방문 기록·미측정 표현 요구의 보완이며 학습/보유/소유권 정책은 변경하지 않는다.

## 실행

1. AGENTS.md, docs/README.md, 본 문서, DB guest-import-release-fix.md의 최신 UI 인계만 읽는다. ActivityRecordScreen.tsx, AccountRecordsPanel.tsx, ownedRecordsModel.ts, activity/activitySummary.ts, CompletedPlacesMapButton.tsx를 추적한다.
2. 실패 fixture부터 작성한다. 계정 기록이 있어도 통계가 없는 분기와 동일 부모 key 충돌을 실제 컴포넌트 렌더링으로 재현한다.
3. 기존 활동 비율·활용 시간·완료 장소 수·활동 유형 레이아웃을 계정 분기에서도 재사용한다. 계정 데이터는 기존 owner 검증 및 local/remote completionId 병합 결과만 사용한다. guest 저장소 전체를 합치거나 다른 계정 데이터로 fallback하지 않는다. 기존 계정 목록·지도·가져오기·삭제 기능도 유지한다.
4. 집계는 UI 순수 모델/표시 컴포넌트로 분리한다. 현재 guest의 이번 달 및 계정 목록의 기존 조회 범위를 조용히 변경하지 말고 집계 범위를 문구로 명시한다. 방문 횟수와 고유 장소 수, 지도 마커 중복 제거를 혼동하지 않고 기존 집계 정의를 확인해 재사용한다. 기간 필터/새 통계 기능은 추가하지 않는다.
5. 서버 계정 기록에 없는 actualDwellMin을 30분 등 계획값/중앙값으로 채우지 않는다. imported 기록은 방문·분류에는 포함하되 시간 미측정으로 표현하며 과거 체류 학습0 유지. 일부 측정값만 확보되면 합산 범위·미측정 건수를 드러낸다. 시간 표시를 위해 새 DB 필드/API를 만들지 않는다.
6. sibling key를 map/import/delete 등 용도별로 구분하거나 불필요한 key만 제거한다. 계정 전환 시 초기화 목적은 유지한다. 배열 index나 임의 랜덤 key로 경고를 숨기지 않는다.
7. account A→B/로그아웃·늦은 조회 응답, local/remote 같은 완료, 동일 장소 여러 방문, imported 미측정, 빈 상태·조회 실패, import 완료 reload·삭제 후 갱신을 고정 fixture로 확인한다. 이전 계정 통계/지도 노출0, 중복 집계0을 검증한다.

## 검증·인계

- UI 집중 회귀, npm run test:typecheck, npm run test:ui, npm test, git diff --check. UI 번들/E2E는 기존 경량 경로로 확인하며 Simulator 반복 클릭 금지.
- 사용자 확인은 이미 가져온 기록으로 통계·미측정·계정 전환·경고 해소만 확인한다. 실제 가져오기를 또 실행할 필요 없다.
- 변경 파일/목적, 유지한 DB·학습·추천 계약, 테스트/결과, 남은 실기기 항목을 본 문서에 기록한다. DB 원본/pending 수정·서버 쓰기·migration·commit/push 금지.
- 이 표시 보완 뒤 다음 순서는 테스트 시각 추천 실패 진단, 조건부 시장 카드 시각 통일, 시간 상한 확장 영향 조사다. 120분 제한과 실제 시각 10~18시 조건부 노출은 이번에 변경하지 않는다.

## U-GUEST-IMPORT-01 완료 인수인계 — 2026-09-08

### 1. 변경 파일·목적·이력

- 이전 guest 전용 통계/account 목록 → 가져온 계정 기록의 통계 누락과 map/import sibling key 중복을 실제 컴포넌트 fixture에서 함께 RED로 재현 → 기존 카드/도넛/활용시간/완료 장소/활동 유형을 `ActivityStatistics`로 추출하여 두 분기에서 재사용 → 같은 기록 탭의 표현 일관성과 key 안정성 확보 → **현행 구현·자동 검증 완료**.
- `src/ui/activity/ActivityStatistics.tsx`: 기존 통계 JSX/스타일과 완료 장소 지도 버튼을 공유 표시 컴포넌트로 추출. 기간/소유 범위를 호출자가 표시한다.
- `src/ui/activity/activitySummary.ts`: 기존 완료 방문 집계에서 순수 `summarizeActivityVisits` 추출. guest의 이번 달 필터와 방문 횟수 기반 활동 비율을 유지.
- `src/ui/ownedRecordsModel.ts`: `summarizeOwnedRecords` 추가. owner 검증 후 completionId 병합 결과만 집계하며 imported는 값이 우연히 존재해도 체류시간을 사용하지 않는다.
- `src/ui/AccountRecordsPanel.tsx`: 목록 위에 통계 표시. statistics/import/delete 및 통계 내부 map에 용도별 owner key 적용. 기존 identity/local/remote 조회·import/delete onChanged 및 lifecycle reload 유지.
- `src/ui/ActivityRecordScreen.tsx`: guest 통계 표시를 같은 컴포넌트로 위임. guest 읽기/기간/오류/legacy 표시/탭 흐름 유지.
- `test/ui/guest-import-record-display.test.ts`: 신규4개 실행형 fixture. `test/ui/course-completion-history.test.ts`, `test/ui/release-personalization-panels.test.mjs`: 추출된 통계의 소스 경계와 native 도넛 mock에 맞춘 기존 회귀 조정.

### 2. 유지한 계약·집계 의미

- 계정은 **현재 조회된 계정 기록**, guest는 **이번 달 기기 완료 기록**이라는 범위를 명시한다. 기존 서버 조회 범위/제한과 guest 월 필터를 바꾸거나 전체 계정 기록 조회로 확장하지 않았다. 원격 조회 실패 시 기존 owner-local 결과만 유지하고 오류를 표시하며 guest/다른 계정 fallback은 없다.
- 동일 completionId의 local/remote는 기존 remote 우선 병합으로 한 번만 집계한다. 서버 기록에 없는 체류는 local 계획/중앙값으로 보충하지 않는다. 기존 merge가 보존하는 owner-local pending의 실제 측정값만 일부 합산할 수 있고, 이때 측정/미측정 건수를 표시한다.
- 완료한 장소 수는 **완료 방문 횟수**다. 같은 장소를 다른 완료에서 방문하면 각각 포함한다. 활동 비율은 방문 건수 기준, 활동 유형은 category 종류 수다. 지도는 기존 contentId 중복 제거 및 좌표 없는 장소 제외 규칙을 그대로 사용한다. 고유 마커 수를 통계 방문 횟수로 대체하지 않는다.
- guest_import는 방문·category에는 포함하되 actualDwellMin 미측정으로 취급한다. 측정이 없으면 `체류시간 미측정`, 일부만 있으면 실제 확보값 합계와 측정/미측정 건수를 표시한다. 학습 payload·DB 동의·표본·추천 정책과 연결하지 않는다.
- 기존 계정 목록·가져온 기록 provenance·완료 장소 지도 열기/닫기·가져오기/삭제 callback 및 계정 전환 초기화 유지. `statistics:<owner>`, `import:<owner>`, `delete:<owner>`, 내부 `map:<owner>`로 의미를 구분하며 random/index key는 사용하지 않는다.
- DB/service/repository/원본/pending/migration/개인화 C/엔진/120분/조건부 노출/Live Activity는 수정하지 않았다. 실제 가져오기·DB 쓰기/수정·운영 조회·C 재검증·Simulator·commit/push0. import/delete 갱신 테스트는 stub callback만 실행하며 운영 가져오기/삭제가 아니다.

### 3. 고정 검증 결과

- failure-first: 실제 AccountRecordsPanel 렌더에서 `missing_statistics`, `sibling_key_collision` 두 실패를 동시에 확인한 뒤 구현했다.
- 신규4개 PASS: 계정 통계/미측정·purpose key, local/remote 중복·같은 장소 반복 방문·imported 오염값 제외·부분 측정·빈 집계, A→B/늦은 응답·import/delete 완료 후 reload·조회 실패, 로그아웃 unmount 후 늦은 계정 응답과 guest 표시 격리.
- 기존 지도 열기/닫기·완료 기록·계정 패널 집중 회귀21 PASS 뒤 로그아웃 반례1개 추가 PASS. 실제 Yoga/native key 경고 캡처 대신 컴포넌트 렌더의 sibling key 집합을 검사했으며 실기기 경고 소멸 관찰은 별도다.
- typecheck PASS, `npm run test:ui` **593 PASS / 1 기존 SKIP / 0 FAIL**(총594), 기본 `npm test` 274 PASS, iOS export PASS(`/private/tmp/timefit-guest-display-export`), diff check PASS.
- 로그: `/private/tmp/timefit-guest-display-ui.log`, `/private/tmp/timefit-guest-display-all.log`, `/private/tmp/timefit-guest-display-export.log`. tsx IPC 권한 제한은 승인된 권한으로 재실행했다.

### 4. 사용자 표시 확인·남은 항목

변경 반영 앱에서 **이미 가져온 기록이 있는 계정의 기록 탭을 열기만** 한다. 추가 가져오기/재시도·삭제 버튼은 누르지 않는다.

1. 목록 위 활동 비율·활용한 시간·완료한 장소 수·활동 유형 및 `현재 조회된 계정 기록` 범위가 보이는지 확인.
2. 가져온 기록만 있고 측정값이 없다면 시간은 숫자 추정값이 아니라 `체류시간 미측정`인지 확인. 기존 `직접 가져온 방문 기록` 목록을 유지하는지 확인.
3. 완료한 장소 카드를 눌러 기존 방문 마커 지도와 닫기가 동작하는지 확인. 반복 방문 횟수보다 마커 수가 적을 수 있다.
4. 원래 계정 전환/로그아웃으로 화면을 볼 경우 이전 계정 통계·지도가 남지 않는지, sibling key 경고가 없어졌는지 확인. 실기기 결과는 아직 미확인이다.

이 확인은 표시 수락만이며 원본 정리/서버 중복 없음/학습 적격성을 새로 증명하지 않는다. DB 가져오기 복구나 개인화 C를 다시 실행하지 않는다.
