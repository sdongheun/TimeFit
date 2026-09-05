# QA-PROGRESS-RESUME-01 — V1 진행 코스 재진입 검증

> 상태: **완료 — 자동 게이트 및 비로그인 iOS 실기기 1회 통과**  
> 대상 구현: `U-PROGRESS-RESUME-01` 완료본

## 목적

같은 앱 프로세스에서 V1 활성 코스가 Home 왕복과 카카오맵 전환 뒤에도 마지막 확정 단계로 이어지는지 검증한다. 비로그인과 로그인은 같은 `activeVerifiedCourse` 경계를 사용하므로 자동 fixture에서 둘을 함께 확인하고, iOS 실기기 수동 smoke는 비로그인 한 번으로 제한한다.

## 자동 게이트

다음을 현재 작업 트리에서 실행한다.

```bash
npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/verified-course-progress.test.ts test/ui/course-progress-contract.test.mjs test/ui/release-visual-polish.test.ts
npm run test:typecheck
npm run test:ui
npm test
git diff --check
```

반드시 확인할 계약은 다음과 같다.

- Home 표시 우선순위는 `V1 active → legacy active → placeholder`다.
- 로그인·비로그인은 같은 runtime 상태와 화면 연결을 사용한다.
- 현재 단계와 `routeOpened`가 Home 왕복 뒤 유지된다.
- route 실패·잘못된 identity·빠른 중복 tap은 진행 상태를 바꾸지 않는다.
- 명시 완료는 같은 identity를 한 번만 제거한다.
- 추천 엔진, route adapter, Supabase, Auth, AsyncStorage, App Group 호출을 추가하지 않는다.

## 비로그인 iOS 실기기 제한 smoke

한 번만 다음 순서로 확인한다.

1. 비로그인 상태에서 V1 코스를 선택하고 `코스 시작하기`를 누른다.
2. 첫 `카카오맵에서 길찾기`를 열고 TimeFit으로 돌아온다.
3. 앱 프로세스를 강제 종료하지 않은 채 메인 탭으로 이동한다.
4. 메인에 `진행 중인 코스` 카드와 선택한 장소명이 표시되는지 확인한다.
5. 카드를 눌러 새 추천이나 첫 단계가 아니라 직전 단계와 CTA로 돌아가는지 확인한다.
6. 명시 `코스 마치기` 뒤 메인으로 이동해 활성 카드가 사라졌는지 확인한다.

강제 종료·OS eviction·재부팅 뒤 복구는 실행하지 않는다. 이는 `U-LIVE-ACTIVITY-01`의 App Group·안정적 `courseRunId` 후속 범위다.

## 완료 기록 형식

1. 변경 파일과 변경 목적 — QA는 제품 코드를 수정하지 않는다.
2. 변경하지 않은 추천/API/DB/영속 저장 경계
3. 각 자동 명령의 통과 수와 비로그인 실기기 6단계 결과
4. 실패 시 정확한 단계·화면 문구·강제 종료 여부와 다음 소유 역할

## 2026-09-05 실행 기록 — 자동 게이트 및 신규 실기기 6단계 통과

### 1. 변경 파일과 변경 목적

- 이 작업 문서만 수정해 현재 작업 트리의 자동 게이트 결과와 비로그인 iOS 실기기 6단계 판정 상태를 기록했다.
- 제품 코드와 테스트 fixture는 수정하지 않았다. 기존 비로그인 실기기 관찰은 재현 참고로만 보았고 이번 QA의 실기기 통과 근거로 재사용하지 않았다.

### 2. 변경하지 않은 추천/API/DB/영속 저장 경계

- 추천 snapshot, one-stop/two-stop 정책, route adapter와 카카오맵 handoff, Supabase/Auth/AsyncStorage/App Group 계약을 변경하지 않았다.
- 강제 종료·OS eviction·재부팅 뒤 복구를 검증 또는 지원한다고 판정하지 않았다. 이는 `U-LIVE-ACTIVITY-01` 후속 범위다.
- Simulator·실기기·Metro·Xcode·실제 외부 API·운영 Supabase는 자동 게이트에서 조작하지 않았다. stage·commit·push도 수행하지 않았다.

### 3. 자동 명령 결과

- `npx tsx --test test/ui/active-verified-course-resume.test.ts test/ui/verified-course-progress.test.ts test/ui/course-progress-contract.test.mjs test/ui/release-visual-polish.test.ts` — **32/32 통과**.
- `npm run test:typecheck` — **통과**.
- `npm run test:ui` — **278개 중 277 통과, 기존 의도 skip 1, 실패 0**.
- `npm test` — **117/117 통과**.
- `git diff --check` — **통과**.
- 자동 fixture에서 `V1 active → legacy active → placeholder`, 로그인 공통 runtime, 단계·`routeOpened` 보존, 실패·identity 불일치·중복 tap 무전이, 같은 identity 완료 1회 제거, 추천/API/DB/storage 호출 추가 0을 확인했다.

### 4. 비로그인 iOS 실기기 6단계 결과

사용자가 비로그인 iOS 실기기에서 앱 프로세스를 강제 종료하지 않고 신규 1회 관찰을 수행했다. 과거 관찰은 참고로만 두고 아래 신규 결과로 판정했다.

1. 비로그인 V1 선택 후 `코스 시작하기`: **통과**
2. 첫 `카카오맵에서 길찾기` 실행 후 TimeFit 복귀: **통과**
3. 강제 종료 없이 메인 탭 이동: **통과**
4. `진행 중인 코스` 카드와 선택 장소명 표시: **통과**
5. 카드 재진입 후 직전 단계와 CTA 유지: **통과**
6. 명시 `코스 마치기` 후 메인 활성 카드 제거: **통과**

QA-PROGRESS-RESUME-01은 **완료**다. 자동 게이트와 명시된 비로그인 실기기 6단계를 모두 통과했으며 `U-PROGRESS-RESUME-01`로 반환할 실패는 없다. 강제 종료·OS eviction·재부팅 뒤 복구는 검증하지 않았고 `U-LIVE-ACTIVITY-01` 후속 범위로 유지한다.
