# WAVE-FOUNDATION-01 — 완료 기록·체류 개인화·시각 정리 병렬 운영

> 상태: **실행 준비 완료**  
> 작성자: 통합·결정 세션  
> 동시 작업 한도: 통합 세션 포함 4개, 작업 에이전트 최대 3개

## 1. 지금 동시에 실행할 작업

| 슬롯 | 역할 | 작업 | 병렬 상태 |
| --- | --- | --- | --- |
| A | DB·개인화 | `DB-COMPLETION-RECORD-01` | B·C와 병렬 가능 |
| B | 추천 엔진 | `2-AB` | A·C와 병렬 가능 |
| C | UIUX | `U-RELEASE-VISUAL-01` | A·B와 병렬 가능 |
| root | 통합·결정 | diff 감시·계약 충돌 판정·최종 통합 테스트 | 제품 코드 수정 안 함 |

QA는 세 작업이 모두 끝난 뒤 `QA-FOUNDATION-WAVE-01`을 실행한다. 외부 API·데이터 정제 세션은 현재 활성 구현이 없으므로 대기한다.

## 2. 파일 잠금표

| 역할 | 쓰기 허용 | 쓰기 금지/주의 |
| --- | --- | --- |
| DB | 새 완료 repository·projection, 관련 service 테스트, DB 설계·자기 작업 문서 | UI, engine, migration, 중앙 문서 |
| 엔진 | `src/engine/**`, 관련 순수 테스트, 자기 작업 문서 | UI, DB, 중앙 문서, route/API adapter |
| UIUX | U-RELEASE-VISUAL-01의 명시 allowlist와 UI 테스트, 진행 화면의 빈 header spacer 스타일만 | App/nav/tab, 진행 상태·CTA·handoff, record/profile, engine, DB, 중앙 문서 |
| QA | 세 작업 완료 뒤 QA 문서와 fixture/검증 | 제품 코드와 중앙 문서 |
| root | 중앙 기준 문서·보드, 최종 수락 | 각 역할 구현 파일은 수락 전 직접 수정하지 않음 |

모든 작업자가 같은 working tree를 공유한다. 다른 작업의 변경을 reset/checkout/stash/삭제하거나 전체 파일을 자기 버전으로 덮어쓰면 안 된다. `git add`, commit, push도 작업 에이전트가 수행하지 않는다.

## 3. 세션별 복사 명령

### DB·개인화 세션

```text
docs/작업조정_보드.md를 읽고 DB-COMPLETION-RECORD-01을 진행해.
상세 명령 docs/work/db-personalization/course-completion-record.md를 처음부터 끝까지 읽고 실패 테스트부터 구현해.
문서의 legacy 후기 실제체류 비승격, courseRunId 멱등성, 로컬 전용·민감필드 금지, storage 손상/실패 경계를 하나도 생략하지 마.
UI·engine·Supabase migration·중앙 문서는 수정하지 말고, 다른 세션 변경을 되돌리거나 stage/commit/push하지 마.
완료 인수인계 4항목을 자기 작업 문서에 남겨.
```

### 추천 엔진 세션

```text
docs/작업조정_보드.md를 읽고 2-AB를 진행해.
상세 명령 docs/work/recommendation-engine/dwell-personalization.md를 처음부터 끝까지 읽고 순수 실패 fixture부터 구현해.
최근 최대 5개 중앙값, 5분 반올림, 기본 대비 ±10분, min/max clamp, category+subCategory 격리와 one-stop/pair fail-safe를 모두 검증해.
개인화 때문에 후보를 탈락시키거나 route/API 호출·attempt 예산을 바꾸지 마.
추천로직.md·테스트.md·작업 보드는 수정하지 말고 필요한 중앙 문서 변경은 인수인계에만 적어. 다른 세션 변경을 되돌리거나 stage/commit/push하지 마.
```

### UIUX 세션

```text
docs/작업조정_보드.md를 읽고 U-RELEASE-VISUAL-01을 진행해.
상세 명령 docs/work/uiux/release-visual-polish.md를 처음부터 끝까지 읽고 명시된 allowlist 안에서 실패 계약부터 구현해.
다크·파란 테마, 메인 그룹 간격, 실제 runtime에 연결된 loading 상태, 작은 결과 카드, 코스 확인 full-bleed 지도·읽기 쉬운 세로 순서, 비시각 header spacer만 다뤄.
진행 복원·설정 병합·탭 교체·완료 기록 UI·Live Activity는 구현하지 마. App.tsx/nav/tab/record/profile과 progress의 상태·CTA·handoff, engine, DB, 중앙 문서를 수정하지 마. VerifiedCourseProgressScreen은 행동 없는 우측 header spacer 스타일만 허용돼.
다른 세션 변경을 되돌리거나 stage/commit/push하지 말고 완료 인수인계 4항목을 자기 작업 문서에 남겨.
```

### QA·출시 세션 — 아직 실행하지 않음

```text
DB-COMPLETION-RECORD-01, 2-AB, U-RELEASE-VISUAL-01 세 작업의 완료 인수인계가 모두 기록될 때까지 대기해.
그 뒤 docs/work/qa-release/foundation-wave-validation.md의 QA-FOUNDATION-WAVE-01을 실행해.
제품 코드를 직접 고치지 말고 실패를 표의 소유 작업 ID로 반환해. Simulator 반복 조작이나 실제 외부 API 호출은 하지 마.
```

### 외부 API·데이터 정제 세션

```text
현재 WAVE-FOUNDATION-01에는 활성 작업이 없다. 새 API 호출·배포·카탈로그 변경을 하지 말고 대기해.
통합 QA가 기존 계약 회귀를 소유 재현으로 확인하거나 통합 세션이 새 작업 ID를 발급할 때만 재개해.
```

## 4. 통합 순서

1. 세 에이전트를 동시에 시작한다.
2. 각 에이전트는 집중 테스트까지만 실행하고 완료 인수인계를 남긴다.
3. 통합 세션이 `git diff --name-only`로 파일 잠금 위반과 교집합을 확인한다.
4. 잠금 위반이 없으면 QA-FOUNDATION-WAVE-01이 전체 테스트를 한 번 실행한다.
5. 실패는 해당 원 작업으로 반환하고, 세 작업이 모두 수락되기 전 역할별 commit을 만들지 않는다.
6. 수락 뒤 통합 세션이 중앙 문서 상태를 갱신하고 역할별 의미 단위로 commit한다.
7. 다음 Wave는 `DB-DWELL-01`과 구조 UI 작업을 분리해 결정하며, `U-LIVE-ACTIVITY-01`은 DB·엔진 공개 계약 뒤 단독 UI writer로 실행한다.
