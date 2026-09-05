# QA-COMPLETION-HISTORY-01 — 명시 완료 기록·기록 탭 제한 검증

상태: 수락 — 자동 게이트 및 비로그인 iOS 실기기 제한 smoke 통과  
담당: QA·출시 세션 단독 writer  
대상 구현: U-COMPLETION-HISTORY-01 구현 수락본  
선행: DB-COMPLETION-RECORD-01, U-RUNTIME-GUARD-01, U-COMPLETION-HISTORY-01  
후속: 통합 세션 최종 수락 후 U-LIVE-ACTIVITY-01 선행 조건 해제 검토

## 1. 작업 목적

후기 없이 명시적으로 `코스 마치기`를 누른 한 번의 완료가 비로그인 iOS 실기기에서도 이 기기의 기록으로 즉시 나타나는지 확인한다. 자동 fixture가 이미 검증한 로그인 분기, 2곳 순서, 멱등성, 저장 실패를 실기기에서 반복하지 않는다.

이 QA는 기록 화면 디자인을 다시 구현하는 작업이 아니다. 현재 화면의 완료 장소 개수·카테고리 비율·실제 체류 미측정 상태가 production composition과 연결됐는지만 판정한다.

## 2. 먼저 읽을 파일

다음 파일만 읽고 과거 QA 전체 기록은 탐색하지 않는다.

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/work/uiux/course-completion-history.md`의 현재 계약과 완료 인수인계
4. `docs/work/db-personalization/course-completion-record.md`의 repository 완료 인수인계
5. `docs/work/integration-decision/course-completion-record.md`
6. `docs/테스트.md`의 `COURSE-14`
7. `docs/03_product/UIUX_테스트명세.md`의 `UXV-36`
8. `test/course-completion-repository.test.ts`
9. `test/ui/course-completion-history.test.ts`
10. `test/ui/active-verified-course-resume.test.ts`

작업 전 `rg`로 `courseCompletionRepository`, `courseRunId`, `코스 마치기`, `체류시간 미측정`의 실제 consumer를 확인한다. 같은 목적의 다른 storage key나 임시 완료 repository를 만들지 않는다.

## 3. 수정 경계

QA 세션이 수정할 수 있는 것은 이 작업 문서의 실행 기록뿐이다.

다음은 수정하지 않는다.

- `src/**`, `supabase/**`, `data/**`, `.env*`
- 추천 엔진, 장소 catalog, Kakao·Route Proxy·Supabase 계약
- 완료 repository schema/key/legacy 후기 저장소
- UI 문구·레이아웃·네비게이션
- App Group·ActivityKit·알림·GPS·실제 체류 개인화
- 중앙 문서, 작업 조정 보드, 통합 체크리스트
- git stage, commit, push

자동 또는 실기기 단계에서 실패하면 예외 처리로 통과시키지 않는다. 재현 조건과 예상/실제를 기록하고 아래 소유 역할로 반환한다.

- 완료 입력·멱등 저장·읽기 오류: DB·개인화
- 버튼·화면 이동·기록 표시·로그인 표시: UIUX
- 정책 또는 문서 충돌: 통합·결정
- 추천 결과 부재나 경로 계산 실패: 이 QA 실패와 분리해 추천 엔진 또는 외부 API에 반환

## 4. 자동 게이트

아래 명령을 현재 작업 트리에서 실행한다.

```bash
npx tsx --test test/course-completion-repository.test.ts test/ui/course-completion-history.test.ts test/ui/active-verified-course-resume.test.ts
node --test test/map-transport-ui-contract.test.mjs
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

반드시 결과에 다음을 별도로 기록한다.

1. 집중 fixture의 전체 통과 수
2. UI 전체 pass/fail/의도 skip 수
3. core 전체 통과 수
4. typecheck와 diff check 결과
5. 실패가 있다면 최초 실패 test 이름과 이번 구현에서 새로 발생했는지 여부

자동 합격 조건은 다음과 같다.

- 새 1곳·2곳 시작은 각각 opaque `courseRunId`를 한 번만 만든다.
- 같은 active 재진입·진행 갱신·외부 지도 왕복은 run ID를 바꾸지 않는다.
- route open, 뒤로가기, 취소, background는 완료 저장을 호출하지 않는다.
- 명시 완료의 `created`와 `already_completed`는 한 건으로 표시된다.
- 연타·재시도는 같은 run ID를 사용하고 중복 기록을 만들지 않는다.
- 저장 실패는 성공으로 표시하지 않으며 active를 유지한 재시도와 `기록 없이 마치기`를 구분한다.
- 로그인과 비로그인은 동일한 device-local 완료 경계를 사용하며 Auth user ID를 payload에 넣지 않는다.
- 실제 체류가 없으면 `actualDwellMin`은 `null`이고 계획 체류를 실제 체류로 승격하지 않는다.
- 완료 기록 읽기 손상·불가는 빈 기록으로 위장하지 않는다.
- 자동 게이트 중 실제 Kakao, Route Proxy, Supabase 호출은 0회다.

## 5. 비로그인 iOS 실기기 제한 smoke

자동 게이트가 통과한 뒤 사용자에게 아래 한 시나리오만 요청한다. Simulator에서 버튼을 하나씩 탐색하며 같은 검사를 반복하지 않는다.

### 사전 조건

- 일반 계정은 로그아웃 상태여야 한다. Route Proxy용 anonymous Supabase session이 내부에 존재하는 것은 정상이며 로그인으로 판정하지 않는다.
- 앱 삭제나 storage 초기화는 하지 않는다. 기존 기록이 있다면 시작 전에 `기록` 탭의 이번 달 완료 장소 수와 카테고리 상태를 메모하거나 캡처한다.
- 강제 종료·재부팅은 하지 않는다. force quit 복구는 U-LIVE-ACTIVITY-01의 App Group 후속 범위다.
- 실제 체류 측정과 Live Activity는 아직 없으므로 표시 기대값은 `체류시간 미측정`이다.

### 실행 순서

1. `내정보`에서 일반 계정이 비로그인으로 표시되는지 확인한다.
2. `기록` 탭에서 이번 달 완료 장소 수와 현재 카테고리 상태를 기록한다.
3. 메인에서 1곳짜리 검증 코스를 선택하고 `코스 시작하기`를 누른다.
4. 진행 화면의 필요한 길찾기를 순서대로 열고 TimeFit으로 돌아온다. Kakao handoff 자체가 실패하면 완료 기록 QA와 섞지 말고 별도 외부 API/UIUX 재현으로 기록한다.
5. 마지막 단계에서 명시적인 `도착 후 코스 마치기`를 한 번 누른다.
6. 별도 탭 조작 없이 `기록` 화면으로 이동하는지 확인한다.
7. 이번 달 완료 장소 수가 시작 전보다 정확히 1 증가하고, 완료 장소의 카테고리가 개수 기준 집계에 반영되는지 확인한다.
8. 실제 체류 측정값이 없으므로 `0분 활동`이나 계획 체류분이 아니라 `체류시간 미측정`으로 표시되는지 확인한다.
9. 다른 최상위 탭으로 이동했다가 `기록`으로 돌아와 같은 값이 유지되는지 확인한다.
10. 메인으로 돌아왔을 때 방금 마친 활성 코스 이어가기 카드가 남아 있지 않은지 확인한다.

### 사용자에게 받을 증거

- 시작 전 기록 탭의 완료 장소 수
- 완료 직후 기록 탭 캡처 한 장
- 완료 후 장소 수, 반영된 카테고리, `체류시간 미측정` 표시 여부
- 자동 기록 화면 이동 여부와 메인 active 카드 제거 여부
- 실패 시 정확한 단계, 화면 문구, 일반 로그인 여부, 강제 종료 여부

개별 장소명·완료 시각 목록이 현재 화면에 없는 것은 이 QA의 자동 실패로 판정하지 않는다. 실제 화면을 본 사용자가 `다녀간 기록`에 개별 목록까지 필요하다고 결정하면 통합 세션이 별도 UI 요구사항으로 확정한다.

## 6. 수행하지 않을 반복 검증

- 일반 로그인 실기기 완료 반복: 로그인 독립 fixture로 확인했으므로 생략
- 2곳 실기기 완료 반복: stop 순서·카테고리 count fixture로 확인했으므로 생략
- 빠른 연타, storage corrupt/unavailable, 저장 실패 재시도: 자동 fixture로만 확인
- 앱 삭제, Metro clear, Xcode 재빌드: 현재 설치본에 U-COMPLETION-HISTORY-01이 포함되지 않은 증거가 있을 때만 요청
- 실제 API 호출량 검증, 추천 수·다양성 평가, Kakao 링크 품질 평가
- force quit/relaunch, Live Activity, 알림, 실제 체류시간, 서버 개인화

## 7. 판정 기준

### 수락

- 자동 게이트가 모두 통과한다.
- 비로그인 1곳 완료가 기록 탭으로 즉시 이동한다.
- 완료 장소 수가 정확히 1 증가하고 카테고리가 반영된다.
- 실제 체류가 없을 때 `체류시간 미측정`으로 표시된다.
- 완료 후 active 코스가 제거되고 다른 탭 왕복 뒤 기록이 유지된다.

### 실패

- `코스 마치기`가 아닌 행동에서 기록이 생성된다.
- 명시 완료 후 기록이 없거나 2건 이상 증가한다.
- 일반 비로그인인데 완료를 막거나 account 로그인을 요구한다.
- 계획 체류분을 실제 활동 시간으로 표시한다.
- 저장 실패를 성공 기록처럼 표시하거나 active를 조용히 제거한다.
- 기록 읽기 오류를 빈 기록으로 표시한다.

### 범위 밖으로 분리

- 개별 장소명·완료 시각 목록을 추가할지에 대한 제품 결정
- 강제 종료 뒤 진행 복구
- Live Activity·알림·도착/출발 확인
- 로그인 계정 서버 동기화·기기 간 병합
- completion과 legacy 후기를 함께 지우는 전체 로컬 삭제

## 8. 완료 인수인계 형식

QA 세션은 이 문서 아래에 다음 네 항목으로만 실행 기록을 추가한다.

1. 변경 파일과 변경 목적
2. 변경하지 않은 제품 코드·추천/API/DB/App Group 경계
3. 자동 게이트별 통과 수와 비로그인 실기기 10단계 결과
4. 최종 판정, 실패 소유 역할, 남은 사용자 결정

수동 확인이 아직 수행되지 않았다면 자동 통과만으로 `수락`이라고 기록하지 않고 `자동 통과·비로그인 실기기 대기`로 남긴다.

## 9. 실행 기록 — 2026-09-05

### 1. 변경 파일과 변경 목적

- `docs/work/qa-release/completion-history-validation.md`: `QA-COMPLETION-HISTORY-01` 자동 게이트와 제한 실기기 결과 및 최종 판정을 기록했다.

### 2. 변경하지 않은 제품 코드·추천/API/DB/App Group 경계

- `src/**`, `supabase/**`, `data/**`, 환경변수, 중앙 기준 문서와 작업 조정 보드는 수정하지 않았다.
- 완료 repository schema/key/legacy 후기 저장소, 추천 엔진·catalog, Kakao·Route Proxy·Supabase, App Group·ActivityKit·알림·GPS·실제 체류 개인화 계약은 변경하거나 호출하지 않았다.
- 로그인·2곳·연타·저장 장애는 고정 fixture로만 검증했고 Simulator를 반복 조작하지 않았다. stage·commit·push하지 않았다.

### 3. 자동 게이트별 결과와 비로그인 실기기 상태

- `npx tsx --test test/course-completion-repository.test.ts test/ui/course-completion-history.test.ts test/ui/active-verified-course-resume.test.ts`: **41/41 통과**, fail·skip 0.
- `node --test test/map-transport-ui-contract.test.mjs`: **14/14 통과**, fail·skip 0.
- `npm run test:typecheck`: 통과.
- `npm run test:ui`: **304개 중 303 pass / 의도 skip 1 / fail 0**. 최초 전체 실행은 통과했으나 출력 집계가 잘려, 집계 재실행 중 sandbox의 `tsx` IPC socket `EPERM`이 테스트 시작 전에 발생했다. 동일 명령을 권한 확장해 재실행하여 위 합격값을 확인했으며 제품 회귀는 아니다.
- `npm test`: **117/117 통과**, fail·skip 0.
- `git diff --check`: 통과.
- 자동 fixture에서 실제 Kakao·Route Proxy·Supabase 호출은 **0회**다.
- 비로그인 iOS 실기기 10단계: **사용자 확인 통과**. 일반 계정 비로그인 상태에서 1곳 코스를 시작하고 필요한 Kakao 길찾기 왕복 뒤 `도착 후 코스 마치기`를 한 번 실행했다. 기록 탭 자동 이동, 이번 달 완료 장소 수 정확히 `+1`, 완료 장소 카테고리 반영, `체류시간 미측정` 표시, 다른 탭 왕복 뒤 값 유지, 메인의 완료 active 카드 제거를 모두 정상으로 확인했다. 사용자가 구체적인 시작 전·후 숫자와 캡처는 제공하지 않아 임의 수치나 증거 경로는 기록하지 않았다.

### 4. 최종 판정·실패 소유 역할·남은 사용자 결정

- 최종 판정: **수락 — 자동 게이트 및 비로그인 iOS 실기기 1곳 제한 smoke 통과**. 실패가 없어 반환할 소유 역할은 없다.
- 로그인·2곳·연타·저장 장애는 고정 fixture로 완료됐으며 반복 수동 확인은 남지 않았다. 강제 종료 복구, Live Activity·알림·실제 체류와 서버 개인화는 범위 밖 후속이다.
