# DB-RELEASE-MANUAL-LOCATION-CHECK-01 — 수동 장소 전환 DB 영향

2026-09-09. **DB 영향 확인 완료·제품 코드 변경0. 과거 진행 좌표의 UI 재전송 방지는 별도 확인 필요.** [실행 명령](../integration-decision/release-manual-location.md), `docs/테스트.md`의 DEC-RELEASE-MANUAL-LOCATION-01 기준이다. 전체 수동 위치 전환/출시 QA PASS를 뜻하지 않는다.

## 1. 판단과 이력

이전 GPS 자동 출발지·재추천 → 자동 측위를 없애는 사용자 결정 → 검색/지도에서 명시 선택한 장소를 입력하되 완료·체류 계약 유지 → 기존 최소 payload는 GPS를 요구하지 않으므로 DB 변경 불필요. **현행 인계**다. 원본 좌표의 출처를 알 수 없다는 사실은 남으며, 과거 좌표를 모두 GPS 또는 모두 수동이라고 재분류하지 않는다.

기존 `release-facts-final.md`의 저장/삭제/C 수락 및 `release-notice-facts.md`의 공급자 처리 경계를 재사용했다. DB 설계 문서의 과거 비로그인 저장 불가·원격 미적용·보유 미정 표기를 현행으로 복원하지 않는다. 일반 완료/표본을 삭제하거나 새 origin 출처 필드·migration을 추가할 이유는 발견하지 못했다.

## 2. 완료·가져오기·학습 payload

경로는 저장소 루트 기준이며 아래 서비스는 GPS API를 요구하지 않는다. 장소 ID/명칭은 선택 장소의 기록이지 실제 방문 위치를 센서로 인증했다는 뜻이 아니다.

| 경계 | 실제 공개 연결·저장 필드 | 판정 |
| --- | --- | --- |
| 기기 완료 | `courseCompletionRepository.ts`의 `complete` → `sanitizePlace`: run/completion ID, 명시 `explicit_course_finish`, 완료 시각, 장소 ID/명칭/분류·계획체류·nullable 실제체류 | 좌표·주소·경로·provider receipt·인증 필드는 직렬화하지 않음. 실제체류 미확인은 null, 계획값/legacy 후기를 측정값으로 승격하지 않음 |
| 계정 완료 | `accountCourseCompletionRepository.ts:writeAccountCourseCompletion` → `releaseIdentitySupabasePorts.ts:createAccountCompletionWritePort` → `write_account_course_completion` | completion/run·분 단위 완료·owner generation·장소 ordinal/ID/명칭/분류만. 좌표 및 계획/실제 체류는 이 RPC payload에 없음 |
| guest 가져오기/pending | `guestCompletionImportRepository.ts:prepareGuestCompletionImport/importGuestCourseCompletions` → `releaseIdentitySupabase.ts:guestImportRemote` | source completion/run·완료분·최소 장소 목록. pending은 target owner/import ID/state/ack 목록과 제한 복구 이력. 좌표·실제체류는 투영하지 않으며 guest_import를 학습으로 승격하지 않음. 승인 전 원본 삭제 금지·같은 요청 재시도 유지 |
| 학습 증거 | `liveLearningEvidence.ts`와 `releaseIdentityPersonalizationRuntime.ts`의 증거 소비 | owner/run/stop·동의 epoch/revision·증거 generation/event 연결. 앱/LA의 허용된 명시 확인 증거가 필요하며 GPS 위치검증이나 일반 알림을 학습 증거로 대체하지 않음 |
| 체류 표본/outbox | runtime 완료 서버 동기화 확인 → 최소 item 생성 → `dwellPersonalizationOutbox.ts` → `dwellPersonalizationRepository.ts:submitDwellCompletionSample` → `createDwellSamplePort` | event/run/stop/content/category/subCategory·정수 actualDwellMin·완료분·owner/consent만 전달. outbox는 exact key 검증. 서버016의 `arrival_source=user_confirmed` 제약 유지. GPS·정확 도착/출발시각·geometry는 서버 payload에 없음 |

체류 분의 UI 상류 근거는 `src/ui/liveActivity/courseProgressRuntimeModel.ts:138`의 유효 `departedAtMs-arrivedAtMs` 분 계산이다. DB가 GPS로 체류를 계산하거나 버튼 클릭만으로 위치 방문 인증을 수행하지 않는다. DB repository 자체는 입력한 체류값을 검증하므로 **명시 증거와 시간 차의 production 연결은 기존 runtime/증거 fixture와 함께 판단**했다. UI/네이티브 이번 변경의 전체 실행 성공을 대신하지 않는다.

로그인 소유권, consent epoch/revision, 완료 멱등, 완료 저장 확인 후 표본 제출, 서버180일 유효범위·outbox7일/32건 및 evicted/expired 재등록 방지, 기존 삭제 정책은 그대로다.

## 3. 과거 좌표 보존과 재전송 경로 — UI/API 인계

| 경로·조건 | 관찰/위험 | 최소 처리안·담당 |
| --- | --- | --- |
| `courseRepository.ts:paramsFromRows` → `listSavedCoursesFromRepository` | DB `origin_lat/lon`, destination, stop 좌표·snapshot을 읽어 반환. 조회 자체는 write RPC/경로 API를 호출하지 않음. 출처 구별 정보는 없음 | **DB 원본/반환 계약 유지.** 조회·목록 보존과 외부 전송을 구분. 날짜 손상 기록도 기존 표시·명시 오류 계약 유지 |
| `MyCoursesScreen.tsx:97` → `Execution`에 `item.origin/ctx/course` 전달 | legacy 화면에 도달하면 저장 당시 좌표가 그대로 넘어감. 정상 출시 전체 도달성은 UI 담당 판단 | UI는 legacy/deep link 복원 entry를 포함해 확인. 단순 목록 표시 때문에 기록 삭제 금지 |
| `ExecutionScreen.tsx:78~124`의 geometry hydration effect | geo 없거나 길이≤1인 leg가 있으면 mount 후 저장 origin→stop 및 최종 target으로 `precompute/precomputeTransit(... retryFallback:true)` 수행. 왕복이면 target도 저장 origin. **사용자 새 선택 전 자동 외부 요청 가능 경로** | UI는 자동 hydration을 차단하거나 명시 수동 선택 이후에만 허용하는 최소 경계를 검토. API는 cache miss 시 실제 provider 도달/왕복 마지막 구간까지 확인. GPS API 제거만으로 이 경로가 사라진다고 보지 않음 |
| `ExecutionScreen.tsx`의 GPS 코스 변경 → baseline/planTimeFit → LegacyResults | 조사 시점 소스에 `position.coords`에서 새 origin을 만드는 재추천 본문 존재. UI 작업 중 변경될 수 있음 | 기존 명령대로 UI가 entry 차단. DB가 이 기능을 새 수동 재추천 기능으로 확장하지 않음 |
| `saveCourseToRepository` / `replaceCoursePlanInRepository` | 명시 호출 시 전달받은 origin을 create/replace RPC에 재전송. 함수는 위치 획득/출처 추정하지 않음. replace의 label 기본값 `현재 위치`는 텍스트일 뿐 GPS 증거 아님 | UI가 새 요청에 확정 수동 좌표와 정확한 label을 전달. 과거 origin을 무조건 재사용하지 않음. DB에서 원본을 덮어쓰거나 문자열만 보고 차단하지 않음 |
| `activeVerifiedCourseStorage.ts` decode/read/write와 V1 session 복원 | 전체 active 객체/session을 로컬 보존. `v1Session.ts:buildRecommendationEngineInput`은 session.origin/destination을 계산 입력으로 사용. 서버 완료/outbox와 다른 저장소 | UI/AppGroup 담당은 cold 복원→길찾기/계산 시 과거 origin 또는 왕복 목적지의 재사용 여부를 확인. DB가 AppGroup을 읽거나 지우지 않음. GPS 출처 불명이라는 이유로 활성 코스 강제 종료 금지 |

**통합에 반환할 최소 선택:** 출처 불명 과거 진행 데이터는 이력/완료/학습을 보존하고, 자동 네트워크 복원은 막은 채 좌표를 외부로 다시 보내는 행동 앞에서 사용자가 수동 기준점을 확인/선택하도록 하는 방안이 최소다. 기존 활성 코스의 진행·시간/경로 일치에 영향을 줄 수 있으므로 이를 DB가 임의 구현·확정하지 않는다. UI가 기존 경계로 해당 entry의 비도달/미전송을 입증하면 추가 작업 불필요. 새 서버 originSource 필드나 전체 초기화는 요구하지 않는다.

## 4. 고정 fixture 결과

운영 Auth/DB/API/GPS 호출0. 합성 메모리 저장소와 fake Supabase port만 사용했다. 이번 신규 fixture는 결함을 수정해 PASS로 만든 테스트가 아니라 **기존 보존·명시 재전송 동작을 재현하는 감사 증거**다.

| 명령 | 결과·범위 |
| --- | --- |
| `node --import tsx --test test/course-completion-repository.test.ts test/release-owned-completion.test.ts test/guest-import-release-fix.test.ts test/guest-import-pending-recovery.test.ts test/dwell-storage-contract.test.ts test/live-learning-evidence.test.ts test/course-date-repository.test.mjs` | **87/87 PASS**, fail/skip0. 민감필드 투영 제거, guest pending 보존/계정전환/제한복구, owner/동의/180일/outbox 경계, 앱·LA 증거/완료→표본, 날짜 보존 |
| `node --test test/db-manual-location-contract.test.mjs` | **2/2 PASS**, fail/skip0. 실제 repository를 로드해 출처 불명 합성 origin의 조회 보존·조회만으로 write0, 명시 replace가 과거 또는 수동 선택 origin을 그대로 RPC로 전달함을 확인 |

합계 **89 PASS**. 위 기존 live-learning fixture는 격리 자동 테스트이며 완료된 운영 개인화 C를 재실행한 것이 아니다. 신규 fixture는 legacy UI mount/GPS/WebView/native 전체를 실행하지 않았으므로 과거 GPS 재전송0의 최종 QA 증거로 쓸 수 없다. typecheck/test:ui/npm test/iOS 전체 게이트는 이번 명령의 단일 실행자 QA에 남긴다.

## 5. 네 항목 인수인계

1. **변경 파일:** 이 문서 신규, `test/db-manual-location-contract.test.mjs` 감사 fixture2개 신규. DB 제품 코드·schema·migration 변경0. 기존 타 세션 변경 보존.
2. **유지 계약:** 기록/표본/동의/owner·멱등·날짜·삭제 정책, 선택 장소 기반 완료와 버튼 체류, 180분/2곳 불변. UI/native/API/중앙 문서 수정0. 원본 좌표 임의 분류·삭제·새 필드 요구0.
3. **검증:** 기존87+신규2 PASS, 로컬 diff 공백/문서 링크 검사. 운영 쓰기/SQL/배포/백업/계정 조작/C 재실행0. 신고 면제나 법적 적합성 판정 아님.
4. **다음 담당·위험:** UI/API는3절 자동 geometry hydration·legacy entry·active snapshot/왕복 origin 복원 위험을 자기 작업에 반영. 통합은 출처 불명 진행 데이터의 최소 처리안만 판단. QA는 수정 동결 후보에서 GPS0 및 과거 좌표 자동 재전송0을 실행 검증. DB 완료를 전체 GPS 제거 완료로 표시하지 않음.
