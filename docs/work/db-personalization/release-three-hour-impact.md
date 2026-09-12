# DB-RELEASE-180-CHECK — 최대 180분·2곳 저장 계약 영향 확인

2026-09-08. **DB 읽기 전용 영향 확인 완료, 제품·migration 변경 불필요.**

기준: [DEC-RELEASE-180-01](../integration-decision/release-three-hour-two-stop.md). 기존 120분 이하 코스·완료 기록은 계속 유효하다. 이번 문서는 이전 대화로만 전달한 완료 근거를 공유 저장소에 남기는 인수인계다. 전체 출시·실기기·운영 DB 검증 완료를 의미하지 않는다.

## 1. 실제 작업 경로·기존 기록 확인

- 작업 경로: `/Users/shindongheun/Desktop/myProject/TimeFit`.
- `docs/work/`에서 작업 ID와 보고서 이름을 검색했다. API 보고서와 통합 작업 명령, UI의 DB 인계 미발견 기록만 있었고 DB 완료 보고서는 없었다. 이전 답변에서 ‘변경 없이 종료’하며 결과를 대화에만 남긴 것이 누락 원인이다.
- 기존 테스트 결과는 해당 대화의 실행 도구 결과에 남아 있다. 별도 파일 로그나 고정 commit/revision 증거는 생성하지 않았다. 따라서 과거 테스트 통과를 현재 변경 중인 전체 공유 트리의 검증 결과로 승격하지 않는다.

## 2. 저장·RPC 제약 근거

아래 경로는 저장소 루트 기준이다. 로컬 소스와 migration 정의를 읽었으며 원격 DB 조회·호출은 하지 않았다.

| 경계 | 정확한 근거 경로·검증 | 판정 |
| --- | --- | --- |
| 기기 완료 기록 | `src/services/courseCompletionRepository.ts`의 `isMinute`, `isCompletedAt`, `isCompletionRecord`: 체류 정수0~1440분, 완료 epoch ms는 양의 안전 정수/Date 범위, 장소1~2곳 | 180분·2곳 및 익일 완료 허용. 전체 코스120분 제한 없음 |
| 계정 완료 저장 | `src/services/accountCourseCompletionRepository.ts`의 `writeAccountCourseCompletion`: 완료 ms를 `Math.floor(completedAt / 60000)`으로 전달. `supabase/migrations/202609070015_release_account_identity_records.sql`의 `write_account_course_completion`: 장소1~2곳, 완료 epoch minute>0, 서버 현재+5분 이하, 소유권 generation 검사 | 날짜를 포함한 완료시각. 익일에 실제 완료한 기록 허용. 아직 오지 않은 도착 예정 시각을 완료시각으로 보내는 것은 기존 미래 완료 차단에 해당 |
| guest 가져오기 | 같은015의 `import_guest_course_completions`, `src/services/guestCompletionImportRepository.ts`: 날짜 포함 완료 분과 장소1~2곳; 과거 체류는 학습 payload에 포함하지 않음 | 시간 상한 변경 불필요. 기존 pending·멱등성·원본 보존 불변 |
| 체류 표본 | `src/services/dwellPersonalizationRepository.ts`, `supabase/migrations/202609070016_dwell_personalization_storage.sql`의 `submit_dwell_completion_sample`: 실제 체류 정수1~1440, stopOrdinal1/2, 완료시각 미래+5분/과거180일 경계 | 180분이 표본 입력을 막지 않음. 180일은 보관·표본 유효기간이지 코스 분 상한 아님. 동의·증거·소유권 적격성은 별도 유지 |
| 로컬 outbox/소유권 snapshot | `src/services/dwellPersonalizationOutbox.ts`: epoch 완료 분, queuedAt ms, 기본7일/32건. `releaseIdentityPersonalizationRuntime.ts`의 envelope decode: owner·run·stopOrdinal·동의·학습 상태 검증 | 자정/120분 제한 없음. TTL·상한·재등록 방지는 변경하지 않음 |
| 진행 snapshot | `src/ui/liveActivity/courseProgressRuntimeModel.ts`의 `buildLiveCoursePlan`: `Date.parse(session.nowIso) + remainingMin * 60000`, 장소1~2곳. `localProgressModel.ts`는 finalArrivalAtMs/도착·출발 epoch ms를 저장·복구 | 날짜 포함 익일 계산이며23:59 clamp 없음. UI 소유 경계를 읽기 전용 확인 |
| 코스 테이블·생성 RPC | `supabase/migrations/202608110003_create_courses.sql`: starts_at/ends_at timestamptz, ends_at>starts_at, 이동/체류/여유 분은 비음수. 015의 `create_course_plan`은 이 필드와 JSON snapshot/장소/구간을 저장 | 전체120분/동일 날짜 제약 없음. 2곳 저장 가능. 이 legacy RPC 자체가 최대2곳 정책을 강제한다고 주장하지 않음 |
| 코스 변경 RPC | `supabase/migrations/202608150009_replace_course_plan.sql`: 최초 starts_at/ends_at 유지, 변경 시각 별도 기록 | 기존 코스 시간·데이터를 새 상한 때문에 무효화하지 않음 |

category/subCategory/document_version/catalog_version의 `char_length(...120)`은 문자열 길이다. 경도 ±180 역시 분 제한이 아니다. route cache의 구간1~1440분과24시간 만료는 총 코스 상한과 별개다. 017의 digest 보완을 재적용하거나 extension·권한을 변경할 필요가 없다.

### 현행 snapshot 복구 차이 — 문서화 시 재확인

이전 조사 때 `src/ui/activeVerifiedCourseStorage.ts`에는 remainingMin 상한이 없었다. 문서화 시 공유 트리에는 UI 작업으로 `1 <= remainingMin <= RELEASE_MAX_MINUTES` 검증이 추가되어 있고 `src/ui/timeSetup/releaseTimeBoundary.ts`의 상수는180이다. **현재 복구는180 허용,181 거절이며 기존120도 유효**하다. 이 변경은 DB 작업이 아니고, 과거43개 테스트가 해당 신규 변경까지 검증했다고 표현하지 않는다.

## 3. 발견한 기존 날짜 위험·최소 인계

`src/services/courseRepository.ts`의 `dateAtMinute()`는 `new Date()`에 startMin 시·분을 설정한다. `saveCourseToRepository()`는 그 startsAt에 remainingMin을 더해 endsAt을 만든다. 따라서 **저장하는 날에 시작한 23시 코스를180분으로 저장하면 익일02시를 올바르게 생성**한다.

반면 **전날 시작 snapshot을 자정 이후 이 legacy 저장 함수로 전달하면** 시작 날짜를 저장 당일로 다시 붙일 수 있다. 이는 DB의 익일 금지나180분 한도가 아닌 기존 날짜 전달 위험이며120분에도 존재한다. 실제 출시 V1에서 이 legacy 저장 경로에 도달하는지는 이번 DB 감사에서 확정하지 않았다.

다음 담당: UIUX/통합이 해당 경로 사용 여부를 확인한다. 사용한다면 snapshot의 원래 날짜 포함 시작시각을 repository에 전달·우선 사용하고, 과거 날짜 없는 입력의 호환 처리를 명시하는 최소 계약 보완이 필요하다. 익일 저장/복구 fixture로 검증하며 기존 데이터를 일괄 변환하거나 무효화하지 않는다. 신규 migration은 불필요하고 이번에는 코드를 수정하지 않았다.

## 4. 테스트 결과·완료 경계

기존 조사에서 실제 실행한 명령:

```sh
npx tsx --test test/course-completion-repository.test.ts test/release-owned-completion.test.ts test/dwell-personalization.test.ts test/dwell-storage-contract.test.ts test/ui/active-verified-course-resume.test.ts
```

결과: **43 tests /43 pass /0 fail /0 skipped**, exit0. 최초 sandbox 실행은 tsx 로컬 IPC `EPERM`으로 시작하지 못했고 권한 승인 경로로 동일 테스트를 실행해 통과했다. 운영 API/DB fixture가 아닌 기존 로컬 단위·계약 fixture다. 이43개 전부가180분·익일 전용 사례라는 뜻은 아니며,180분 호환 판정은 위 validator/migration 코드 조사와 기존 회귀를 합친 결과다.

이번 후속은 경로·기존 결과 확인 및 문서화만 수행했다. 테스트를 재실행하지 않았고 typecheck/UI 전체/npm test 신규 실행 결과도 주장하지 않는다. 엔진/UI 완료 뒤 QA가 고정 revision에서180/181·익일·기존120 복구를 최종 검증한다.

## 5. 네 항목 인수인계

1. **변경 파일:** 본 보고서 신규 작성, `docs/work/db-personalization/README.md`에 링크 추가. 기존 조사에서는 파일 변경0이었다. 다른 세션의 공유 변경은 유지했다.
2. **유지 계약:** 저장 schema·RPC·RLS·동의·소유권·체류 적격성·멱등성·기존120분 기록 불변. DB 차단 제약이 없어 제품 코드/migration 변경0.
3. **검증:** 기존43개 PASS 결과 위 기록. 이번에는 읽기 전용 소스/문서 검색과 문서 diff 검사만 수행. 운영 조회/쓰기·백업·017 적용·개인화 C 재실행·commit/push0.
4. **다음 위험/담당:** 통합은 이 문서를 DB 영향 확인 완료 근거로 사용한다. legacy 날짜 전달 위험은 위 조건으로 UIUX/통합에 인계한다. 전체180분 출시 수락·실기기·서버 실행은 QA 별도 게이트다.
