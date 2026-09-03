# DATA-DWELL-01 — 체류 범위 후보 전달

## 목적

`2-O`가 최소·권장·최대 체류 범위를 실제 코스 계산에 쓰려면, 런타임 카탈로그의 `shortStay.maxStayMin`이 `CourseV1Candidate`까지 손실 없이 전달돼야 한다. 이 작업은 데이터 재수집·등급 변경이 아니라 그 **순수 투영 계약**만 완성한다.

## 소유 범위

- 수정: `src/data/courseV1CandidateProvider.ts`, 데이터 provider 계약 테스트, 이 작업 묶음
- 수정 금지: `data/` 원천·정제 JSON, `src/engine/`, `src/ui/`, API adapter, 제품 정책 문서, 보드
- 선행: `2-O`가 `CourseV1Candidate.maxStayMin`과 범위 검증 계약을 먼저 제공한다.

## 구현·검증 기준

1. `candidateFor()`는 `place.shortStay.minStayMin`, `recommendedStayMin`, `maxStayMin`을 원본값 그대로 전달한다. 60/120을 이 레이어에서 정하거나 보정하지 않는다.
2. `createCourseV1CandidateProvider()`의 대표 후보 전체에서 `0 < min <= recommended <= max`를 만족하는지 고정 데이터 계약으로 검사한다. 값 누락·역전은 조용한 fallback이 아니라 테스트 실패가 되어야 한다.
3. 일반 활동 60분과 `compact_culture` 120분 예시를 각각 fixture로 확인한다. 단, 이 검사는 60/120분을 추천 체류로 승격하거나 UI에 노출하는 기능이 아니다.
4. classification·운영시간·review due date 필터, 후보 수, 정렬, 네트워크 미사용은 바꾸지 않는다.

## 완료 기준과 인계

- 관련 provider test, `npm run test:typecheck`, `npm test`, `git diff --check`를 실행한다.
- `2-O`에 전달할 공개 계약은 `CourseV1Candidate`의 세 체류값뿐이며, 추천 선택 규칙·API 호출 수는 변경하지 않았다고 명시한다.
- 변경 파일 / 유지한 경계 / 테스트 결과 / `2-O`와 UIUX가 수락 전 확인할 위험을 기록한다.

---

## 2026-08-30 — DATA-DWELL-01 완료 인계

### 변경 파일

- `src/data/courseV1CandidateProvider.ts`
  - `candidateFor()`가 런타임 카탈로그의 `shortStay.maxStayMin`을 별도 보정·fallback 없이 `CourseV1Candidate.maxStayMin`으로 전달한다.
- `test/course-v1-candidate-provider.test.ts`
  - 만료되지 않은 대표 190개 전원의 `minStayMin`·`recommendedStayMin`·`maxStayMin`이 카탈로그 원본과 정확히 같은지 검사한다.
  - 일반 활동 `poi_1`의 최대 60분과 `compact_culture` `poi_25`의 최대 120분을 고정해, 값 누락·역전을 테스트 실패로 만든다.

### 유지한 공개 계약

- 원천·정제 JSON, classification, 구조화 운영시간, review due date 필터, 후보 수(대표 190·조건부 178), 정렬, 네트워크 사용은 변경하지 않았다.
- provider는 세 체류값을 전달할 뿐 60/120분을 선택 체류로 승격하거나 자동으로 시간을 채우지 않는다. 추천 선택·실제 경로 호출·A8/B12 attempt/queue 정책도 바꾸지 않았다.

### 테스트 결과

- 변경 전: `npx tsx --test test/course-v1-candidate-provider.test.ts`에서 `poi_1`의 최대 체류가 `undefined`로 손실되는 실패를 재현했다.
- 변경 후: 같은 provider 계약 테스트 3/3 통과.
- `npm run test:typecheck` — 통과.
- `npm test` — 전체 테스트 진입점 1/1 통과.
- `git diff --check` — 통과.
- 실제 API·GPS·Auth·DB 호출 — 0회.

### 다음 결정·위험

- `2-O`가 요구한 `CourseV1Candidate`의 세 체류값 전달 계약은 충족됐다. `U-1-DWELL-01`은 엔진 snapshot의 선택 `stayMin`·`stayState`만 표시하고, 카탈로그 범위나 남은 시간으로 상태를 재계산하지 않아야 한다.
- `QA-DWELL-01`은 UI 수락 뒤 고정 fixture로 50분 short, 운영 종료 경계, 60/120분 비자동 확장, provider/adapter 호출 상한을 다시 확인한다. 이 작업만으로 production 전환이나 RD-B12 실기기 실행을 시작하지 않는다.
