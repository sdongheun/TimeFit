# DB-GUEST-IMPORT-01 — 로그인 후 비로그인 방문 기록 가져오기 실패

상태: 2026-09-08 통합 작성, DB 세션 실행 가능. 첫 작업만 활성화한다.

> **최신 DB 실행 결과 — 제한 복구 로컬 구현 완료 (2026-09-08):** 아래 통합 명령을 구현했다. 집중25/25, typecheck PASS, UI589 PASS/1 skip, 기본274/274 PASS. 실기기 가져오기 성공은 아직 미확인이다. 이전의 ‘복구 미완료/미구현’ 기록은 당시 상태이며, 현행 구현·반환 계약과 남은 확인은 문서 마지막 인수인계를 따른다. 이번 작업에서 운영 import·migration·기기 저장소 직접 편집은 하지 않았다.

## 통합 검토·다음 실행 — 기존 잘못된 pending 제한 복구 (2026-09-08)

### 후속 실기기 관찰·UIUX 인계 (2026-09-08 02:48 화면)

사용자가 가져오기 후 계정 목록에 기록과 ‘직접 가져온 방문 기록’ 표시를 확인했다. **실기기 계정 기록 표시 성공**으로 기록하되, 화면만으로 모든 원본 정리/서버 중복 없음까지 확정하지 않는다. 추가 가져오기 실행은 필요하지 않다.

기존 통계 UI 대신 목록만 보이는 원인은 읽기 전용 코드 추적에서 확인했다. `ActivityRecordScreen.tsx`는 로그인 subject가 있으면 summary 로드를 건너뛰고 `AccountRecordsPanel`만 렌더링한다. 활동 비율·활용한 시간·장소 수 UI는 비로그인 분기에만 있다. 따라서 이번 pending 복구가 화면을 목록으로 변경한 것이 아니라 기존 계정 전용 표시 경로가 노출된 것이다.

화면 하단 React duplicate-key 경고도 별도 결함이다. `AccountRecordsPanel.tsx`의 같은 부모 아래 `CompletedPlacesMapButton`과 `GuestImportPanel`이 모두 `key={subject}`를 사용한다. 코드상 충돌을 확인했지만 전체 경고 stack은 미수집이므로 다른 충돌 가능성까지 배제하지 않는다. 경고만으로 DB 중복 저장을 단정하지 않는다.

UIUX 담당 최소 수정 계약: 계정/guest 소유권 격리를 유지하며 계정 기록에도 기존 통계 레이아웃을 연결하고 sibling key를 용도별로 구분한다. 가져온 방문의 완료 분·장소·분류는 기존 공개 계정 조회로 사용하되, payload에 없는 실제 체류시간을 추정하거나 계획값으로 채우지 말고 미측정 처리한다. 가져온 과거 기록의 개인화 학습0을 유지한다. 계정 전환·같은 장소 여러 방문·import 후 reload에서 통계 및 key 회귀를 검증한다.

이번 후속 변경 파일은 본 문서뿐이다. UI/제품 코드·서버는 수정하지 않았다. 검증은 사용자 화면과 UI 두 파일의 읽기 전용 경로 대조이며 자동 테스트 재실행은 하지 않았다. 다음 담당은 UIUX의 계정 기록 표현 연결/중복 key 보완, 이후 QA 실기기 표시 확인이다.

**현행: 신규 UUID 생성 보완 수락, 기존 실패 요청 복구는 미완료. DB 세션은 이 절을 다음 작업으로 실행한다.** 통합은 변경된 두 서비스 파일과 production fixture를 확인하고 집중 테스트19/19 PASS를 재실행했다. 아래 로그에서 확인된400/22P02는 UUID 인수 파싱 실패로,017 digest 문제와 구분한다. 로그의 개별 계정 대조·기기 pending 구조 확인은 아직 하지 않았으므로 무조건 교체하지 않는다.

### 목적·범위

새 요청의 비UUID 생성은 막았으나 기존 요청을 재사용하는 정상 멱등 로직 때문에 사용자는 업데이트 후에도 실패한다. 원본을 삭제하지 않고 **서버 UUID 인수로 수락될 수 없는 구형 요청만** 명시 가져오기/재시도 경로에서 일회성 복구한다. 새 작업 ID나 진단 UI를 먼저 늘리지 말고 본 작업의 미완료 기준으로 마감한다.

이전 구형 pending 무조건 보존 → 같은 파싱 오류 반복 → 제한 조건을 만족하는 prepared 요청의 ID만 추적 가능한 UUID로 교체 → 이미 승인한 방문 기록 이관을 안전하게 재개 → 구현 전. 정상 UUID 요청의 동일 ID 재시도 정책은 변하지 않는다.

### 구현 지시

1. 기존 요청을 읽기 전용으로 검사하는 공통 판별을 먼저 만든다. 실제 이전 생성기의 `import-<timestamp>-<random>` 형식, 비UUID, prepared, acceptedSourceIds 빈 배열, 유효한 items, 현재 검증 account와 targetSubject 일치를 모두 요구한다. 상태 불명·손상·다른 owner·acknowledged·정상 UUID는 변경하지 않는다. uuid 입력 파싱 전 거절되는 구조와 로그 근거를 미수락 판단으로 사용하며 단순한 HTTP 실패만으로 재발급하지 않는다.
2. 사용자 명시 가져오기/재시도 경로에만 복구를 연결한다. 로그인·source 조회·앱 시작만으로 pending을 변경하거나 서버로 보내지 않는다. 항목/대상/source는 그대로 두고 native secure UUID로 ID만 교체한다. 구형 ID↔새 ID 대응은 기기의 동일 pending 레코드 안에 최소 메타데이터로 보존하고 정상 정리 때 함께 제거한다. 로그/서버 payload에 복구 메타데이터를 추가하지 않는다.
3. 기존 저장소 경계에서 읽기-판별-교체를 직렬화하고, standalone/runtime이 같은 storage key를 쓰는 점을 반영한다. clear→새 prepare를 금지한다. 저장 완료 확인 전 RPC0, 저장 실패는 원본 유지/안전 실패, 앱 재시작·연타는 이미 저장된 새 ID 재사용이어야 한다. 저장 후 결과가 불명확하면 재조회로 확인하고 또 새 ID를 발급하지 않는다.
4. 기존 UI의 메모리 pending ref가 구형 ID를 갖고 continue를 호출하는 상황을 반드시 포함한다. 검증된 동일 pending의 복구 대응으로만 이어서 처리하고 임의 오래된 ID를 현재 요청의 권한처럼 허용하지 않는다. 가능하면 기존 공개 prepare/continue와 응답 계약을 유지해 UI 수정 없이 해결한다. UI 변경이 정말 필요하면 원인·최소 연결 계약만 인계한다.
5. owner는 저장/원격 호출/원본 정리 경계에서 재확인한다. 계정 전환·로그아웃 때 서버 실행과 source 정리를 막는 기존 계약 유지. 정상 UUID 응답 유실은 교체하지 않고 같은 ID로 복구한다. 서버 accepted 원본만 정리하며 rejected 원본과 과거 체류 학습0을 유지한다.

### 실패 우선 fixture·완료 기준

- 유효한 구형 prepared의 복구1회, 기존 UI가 들고 있던 구형 ID로 명시 continue, 새 모듈 로드/재시작 뒤 동일 UUID 재사용.
- 정상 UUID, acknowledged, accepted 존재, 손상 items, 다른 owner, 임의 비UUID는 무변경. 실제 구형 생성 형식이 아닌 테스트 가짜 문자열을 복구 대상의 근거로 삼지 않는다.
- 연타/두 composition 경합, 저장 실패/저장 결과 불명, 응답 유실, ack 후 로컬 정리 실패/부분 승인, owner 변경, imported 학습0.
- 기존 'malformed pending 보존' 테스트는 무조건 삭제하지 않는다. 복구 대상과 무변경 대상을 나누어 확정한 조건만 기대값을 바꾼다. 실제 production factory/default 조합을 거치는 테스트를 유지한다.
- 집중 회귀, `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 별도 SQL/native dependency 변경은 기대하지 않으며 필요하면 근거를 반환한다.

### 실행 권한·인수인계

이번 명령은 DB 소유 코드의 제한 복구 구현·고정 fixture 검증까지다. 작업자가 사용자 기기 storage를 직접 편집하거나 운영 import를 호출하는 권한은 아니다. 원격 migration·전체 초기화·C 재실행·commit/push0.

구현 후 같은 문서에 변경 파일/유지 계약/테스트/남은 실기기 확인을 기록하고 다음 확인을 짧게 안내한다: 수정 번들을 반영한 같은 앱에서 원본을 보존한 채 명시 재시도1회 → 계정 기록 반영 → accepted 원본만 이관 → 중복/과거 체류 학습0. 일반 가져오기는 계정 기록을 실제 생성하며 accepted 원본을 로컬 source에서 정리한다는 점을 안내한다. 담당자가 직접 운영 검증을 실행할 경우 대상과 범위를 별도 승인받는다. 원래 사용자 실패 해소 전 다음 테스트 시각 작업으로 넘어가지 않는다.

> **현행 DB 결과:** native production UUID 주입 누락 및 비UUID fallback을 로컬 production 조합에서 재현·최소 보완했다. 기존 pending/원본은 변경하지 않는다. **사용자 기기의 실패 원인 대응·기존 잘못된 pending 복구·실기기 성공은 미확인**이다. 하단 인수인계가 최신이며 개인화 C PASS는 유지한다.

> **최신 진단 — 사용자 새 빌드 후 현재 시각 실패 대응 확인:** 2026-09-08 02:26~02:32 KST의 기존 gateway/Postgres 로그에서 guest import11건 모두 HTTP400/SQLSTATE22P02, 잘못된 UUID 값이 이전 `import-…` 형식임을 확인했다. 아래 최신 로그 인계에 따라 원인은 구형 요청 ID 형식으로 좁혀졌다. 기존 pending 복구는 아직 실행하지 않았고 초기화/자동 재발급은 금지한다.

## 목적·현행 계약

사용자가 로그인 후 비로그인 이전 기록 가져오기 실패를 보고했다. 정확한 문구·발생 시각·기록 생성 버전은 아직 미확인이다. 기존 DEC-GUEST-MEMBER-BENEFIT-01 및 계정 기록 이관 계약의 **보완/결함 진단**이며 새 정책이 아니다.

이전: 승인된 방문 기록 가져오기 구현·로컬 회귀 통과 → 관찰: 실기기 실패 보고, 원인 미확정 → 이번: 실제 공개 호출 경계를 재현하고 원인이 확인된 최소 수정만 수행 → 이유: 원본 보존 및 계정 격리를 유지하면서 정상 이관 복구 → 상태: 진단 전. 체류 개인화 C PASS는 유지하며 guest import 실기기 성공으로 확대 해석하지 않는다.

## 읽기 범위

- AGENTS.md, docs/README.md, 본 문서.
- `release-identity-personalization.md`의 guest import 계약/현재 runtime 인계만, `personalization-finalization.md`의 상단 017·C 완료 결과만.
- `src/services/guestCompletionImportRepository.ts`, `releaseIdentityPersonalizationRuntime.ts`의 guest source/prepare/continue 및 pending storage, `releaseIdentitySupabase.ts`의 guest RPC 연결, `courseCompletionRepository.ts`의 source 삭제.
- UI는 `src/ui/GuestImportPanel.tsx`, `ownedCourseLifecycle.ts`를 읽기 전용으로 추적한다. 서버는 015의 import 함수와 017의 한정 변경을 확인한다. 전체 과거 이력 재독 금지.

## 확정 관찰과 가설

- 화면은 prepare 실패, continue 실패, 예외를 일반 문구로 표시한다. RPC adapter도 원래 error를 `import_unavailable`로 축약한다. 현재 문구만으로 UI/DB 원인을 확정할 수 없다.
- 017은 import 함수의 digest 호출 2곳도 수정했지만 운영 C의 완료/표본 저장 성공은 guest import 성공 증거가 아니다. digest 재발로 단정하지 않는다.
- repository 기본 import ID는 crypto.randomUUID 부재 시 `import-...` 문자열이며 RPC 첫 인수는 uuid다. 실제 앱 composition의 생성기 주입, 해당 런타임 crypto 가용성, 저장된 pending 형식을 확인하라. **가능한 가설이지 확정 원인이 아니다.** UUID를 주입하는 기존 fixture만 통과하는 것으로 배포 런타임을 검증했다고 하지 않는다.

## 작업 순서

1. 무호출 코드 추적과 고정 fixture로 source 조회 → 승인/prepare → pending → RPC → ack → 원본 정리 → 계정 조회 단계를 분리한다. 최근 guest, legacy_unassigned, unverified, 다른 account 기록을 혼동하지 않는다.
2. 식별자 형식/필수 필드/완료시각 단위/장소 배열·세부분류/인증/원격 함수 응답/부분 성공/pending 복구를 검증한다. 실제 production factory와 기본 생성기 경계를 통과하는 실패 재현을 먼저 만든다. 외부 API·운영 DB를 반복 호출하지 않는다.
3. 실제 오류 확인이 필요하면 사용자에게 실패 문구·대략 발생 시각·최근 또는 과거 기록 여부만 한 번에 요청한다. 기존 허용된 읽기 전용 서버 로그/함수 정의에서 HTTP·SQLSTATE·실패 단계만 확인한다. 새 재현이 필요하면 대상/최대 요청 수/쓰기 영향부터 안내하고 승인받는다. 계정·원본 ID·JWT·위치·payload 전문은 문서/채팅/fixture에 남기지 않는다.
4. 원인이 DB 소유 repository/adapter에 확인되면 같은 작업에서 실패 회귀 → 최소 수정 → 관련 테스트를 완료한다. UI 원인이면 UI 파일을 수정하지 말고 정확한 원인·필요한 소비 계약·재현 fixture를 인계한다. 새 공개 계약 또는 SQL 변경이 필요하면 호환성/기존 pending 보존을 제시한다. 이미 적용한 015~017은 수정하지 않는다. 원격 migration 적용은 별도 승인이다.
5. 실패했던 pending이 남아 있는 상태에서 업데이트 후 재시도가 가능한지 확인한다. pending 초기화·새 importId 발급으로 오류를 숨기지 않는다. 잘못된 ID를 교체해야 한다면 서버 미수락 근거와 중복 방지·원본 보존 조건을 먼저 제시한다.

## 불변·필수 반례

- 명시 승인만 이관. guest/허용 legacy 방문만 이동, 과거 체류 학습 0. 다른 회원/unverified 소유권 추정 이관 금지.
- 준비/인증/RPC 실패에서는 원본 유지. 서버 accepted source만 제거하고 rejected source는 보존한다. 응답 유실은 같은 요청으로 복구하며 중복 생성 금지.
- 최근 guest 및 legacy, crypto UUID 유무, 기존 pending 재시작, 연타, 응답 유실, ack 후 로컬 정리 실패, 부분 승인, A→B 전환/로그아웃 중 응답을 고정 fixture로 확인한다. 가입·로그인·기본 추천은 import 실패로 막히지 않아야 한다.
- 앱 삭제/스토리지 전체 초기화/사용자 원본 삭제/관리자 강제 귀속/운영 승인 없는 쓰기 금지. C 재실행·시간 상한·시장 UI·테스트 시각 수정은 범위 밖이다.

## 검증·완료 인수인계

- 관련 repository/runtime 테스트와 필요 시 격리 로컬 PostgreSQL import 회귀를 실행한다. 제품 코드 수정 시 `npm run test:typecheck`, `npm run test:ui`, `npm test`, `git diff --check`를 실행한다. 기존 C 운영 검증은 반복하지 않는다.
- 원인 확정 근거(실패 단계·안전한 오류 코드·재현 조건), 변경 파일/목적, 유지 계약, 실행 테스트/결과, UI 인계 필요 여부와 남은 실기기 확인을 본 문서 하단에 기록한다.
- 로컬 통과와 원래 사용자 실패 해소를 구분한다. 승인된 제한 실기기 확인에서 계정 기록 반영·accepted 원본 정리·학습 0을 확인하기 전 실기기 완료로 쓰지 않는다. commit/push는 요청되지 않았다.

## 후속 순서 — 아직 실행하지 않음

1. 본 guest import 실패를 진단·해결·검토한다.
2. 테스트 시각 추천 실패: 일반 추천 실패와 실제 시각 10~18시 조건부 노출을 분리 진단한다.
3. 시장 등 조건부 카드: 검증 차이/확인 절차를 유지한 시각 통일.
4. 120분 → 180/240분은 영향 조사 후 사용자 결정. 3시간 권고는 아직 승인된 정책 변경이 아니다.

## DB 진단·최소 수정 인수인계 — 2026-09-08

### 1. 실패 재현과 원인 확정 수준

무호출 경로 추적: GuestImportPanel → approveGuestCompletionImport → runtime의 guest/legacy source 선별 → repository.prepare → durable pending → continue → repository.import → production guest RPC → acknowledged pending → finalize → accepted 원본만 제거 → UI의 onChanged로 계정 목록 재조회. ownedCourseLifecycle은 해당 서비스 공개 export 소비 경계이며 가져오기 성공을 로그인 성공의 선행 조건으로 만들지 않는다. 과거 guest 체류값은 payload에 포함하지 않는다.

**코드 결함 확정:** repository 기본 생성기는 crypto.randomUUID 부재 시 `import-<time>-<random>`을 만들었다. RPC `p_import_id`는 uuid이고, 실제 releaseIdentitySupabase의 standalone repository 및 앱 runtime 둘 다 createImportId 주입이 없었다. global crypto가 없는 fixture에서 **실제 production 모듈을 로드해 공개 approve를 호출하면 비UUID가 pending에 저장**됐다. native/storage/Auth/transport만 fixture로 대체했으며 repository/실제 runtime은 그대로 실행했다. createImportId 자체를 테스트에서 주입해 결함을 우회하지 않았다. 수정 전2개 RED: 불능 환경에서 prepared를 반환, production 결과가 native UUID 대신 import-… 문자열. 기존 malformed pending 보존 fixture는 처음부터 PASS.

이는 **해당 런타임 조건의 결함 확정**이지 사용자 기기에서 crypto가 없었다거나 당시 로그가22P02였다는 확인은 아니다. 이번 원래 실패 문구/시각/최근 guest 또는 과거 legacy 여부는 아직 답변을 받지 못했다. 위 정보를 한 번에 요청했으며 재현 버튼을 누르거나 원문 기록/계정/토큰을 보내도록 요구하지 않았다. 운영 로그·기기 pending은 아직 읽지 않았고 017 digest 재발로 단정하지 않는다. 잘못된 UUID를 받은 RPC fixture는22P02 경계를 모델링하지만 실제 사용자 서버 로그 증거로 사용하지 않는다.

### 2. 변경 파일·유지 계약

- `src/services/guestCompletionImportRepository.ts`: 비UUID Date.now/Math.random fallback 제거. 기본 secure randomUUID가 없거나 반환 형식이 부적합하면 생성 단계에서 unavailable로 닫고 pending을 쓰지 않는다. 기존 pending이 있으면 생성기를 호출하지 않는 기존 순서를 유지했다. 다른 기존 pending/ack/cleanup 동작은 수정하지 않았다.
- `src/services/releaseIdentitySupabase.ts`: 이미 쓰는 `expo-modules-core`의 uuid.v4를 **standalone guest repository와 production runtime 두 곳에 createImportId로 주입**했다. 신규 dependency·UI·native 코드·서버/RPC/SQL 변경 없음.
- `test/guest-import-release-fix.test.ts`: 신규5개 회귀. 실제 production 조합/native UUID 경계·global crypto 없음·cold pending 재사용·원본 부분 정리·응답 유실·cleanup 실패·계정 전환/로그아웃을 검증한다.
- 본 문서: 원인 확정 수준·복구 한계와 인수인계를 기록한다.

이전 비UUID fallback → UUID RPC에 맞지 않는 pending 생성 → native UUID를 production에서 주입하고 생성 능력 없는 기본 경로는 무쓰기 실패 → 새 손상 요청을 예방하면서 기존 요청을 보존 → **로컬 구현 완료, 실기기 해소 미확인**. 기존 importId를 재발급하거나 정상 UUID로 추정 치환하지 않았다. pending/source 전체 초기화·동의 변경·원격 쓰기/migration·개인화 C 반복·추천/시장/시간 정책 변경·stage/commit/push0.

### 3. 테스트 근거

| 검증 | 결과 |
| --- | --- |
| 신규 production/default/pending 회귀 | 5 PASS (수정 전2 RED 확인) |
| 신규 + release-owned-completion + release-identity-device-flow | **19 PASS** |
| 타입 검사 | PASS (신규 회귀 추가 후 재검사 포함) |
| UI 전체 | **589 PASS / 1 기존 SKIP** |
| 기본 `npm test` | **274 PASS** |
| `git diff --check` | PASS |

production fixture는 global crypto 없음에서 native UUID만 사용하며 runtime approve→pending→새 모듈 로드→같은 pending 재사용→실제 adapter RPC 인수 변환→accepted source 정리까지 통과했다. completedAt은 ms에서 minute로 변환, 장소 필드만 전달, actual/planned dwell payload 부재를 확인한다. secure UUID가 있는 기본 경로도 검증했다. 응답 소실은 같은 ID로 복구, rejected 원본 유지, ack 후 저장소 실패는 cleanup_pending과 acknowledged pending 유지, A→B/로그아웃 중 원격 응답은 후속 source 정리 금지다. 기존 runtime 회귀는 최근 guest source·legacy 경계/명시 승인/원본 보존/소유권 분리 경로를 유지한다. 전체 로그인·가입·기본 추천 정책은 수정하지 않았다.

native/운영 네트워크는 fixture로 대체했다. 새로운 실제 import 성공이나 서버 목록 반영·실제 학습0을 확인한 것으로 기록하지 않는다. 이번 UUID 수정은 별도 SQL을 요구하지 않으므로 로컬 PostgreSQL017/C 회귀를 반복하지 않았다. 동시 다중 runtime의 prepare 경쟁까지 해결했다고 주장하지 않으며, UI의 단일 act 잠금은 유지된다. 이번 수정은 UUID 생성 경계에 한정한다.

### 4. 기존 pending 복구·UIUX 계약·다음 단계

- **정상 UUID pending:** 업데이트 후에도 prepare가 기존 importId/items/target을 그대로 반환한다. 같은 요청으로 continue 가능하며 응답 유실/부분 ack/cleanup 실패 경계는 위 fixture로 검증했다. 새 요청 생성으로 우회하지 않는다.
- **이미 비UUID인 pending:** 이번 업데이트도 그대로 보존하며 continue는 기존 RPC에서 실패할 수 있다. 자동 초기화/ID 교체는 하지 않았다. 이 상태를 ‘해결 완료’라고 안내하면 안 된다. 서버 uuid 인수로 수락 불가능한 형식인지와 실제 pending state가 prepared인지부터 **로컬 읽기 전용**으로 확인해야 한다. acknowledged 또는 손상된 구조면 자동 복구를 금지한다. ID 교체가 필요하면 owner 고정·원본/items 불변·기존 요청 미수락 근거·단일 교체의 원자적 보존·중복 방지 조건을 먼저 별도 제안한다. 이번에는 그 교체를 구현/실행하지 않았다.
- **UIUX 원인 확정 없음:** 현재 일반 실패 문구는 단계 구분을 숨기지만 이것만으로 UI가 원인이라고 판정하지 않는다. 필요 소비 계약은 실패 단계(source/prepare/RPC/ack/cleanup), safe status, pendingPresent boolean, pendingIdFormat(uuid/non_uuid), pendingState(prepared/acknowledged/invalid), sameOwner boolean 정도다. 원문 ID/owner/items/토큰은 표시/전달하지 않는다. 해당 readonly 관찰 getter/패널이 필요하면 후속 최소 작업으로 제시하며 이번 UI 파일은 수정하지 않았다.
- 다음은 요청한 실패 문구·대략 시각·기록 종류를 받아 기존 읽기 전용 로그와 대응시키는 진단이다. 같은 UUID 형식 실패면 사용자 기기 기존 pending의 비민감 상태를 확인해 제한 복구안을 확정한다. 원격 재현이 필요할 경우 이번 승인에 포함되지 않으므로 owner/최대 요청 수/실제 쓰기/accepted 원본 정리 영향을 먼저 제시한다. 실기기 계정 기록 반영·accepted 원본 정리·학습0이 확인되기 전 **DB-GUEST-IMPORT-01 전체 실기기 완료로 표시하지 않는다.**

## 최신 로그 인계 — 구형 pending 요청 ID의 UUID 변환 실패 확인

1. **근거/진단:** 사용자는 새 빌드 후 현재 시각에도 `가져오기 결과를 확인하지 못했어요. 원본을 유지하며 같은 요청으로 재시도합니다`를 보고했다. 조회 시작 시각은 UTC17:31:35, 조회 범위는2026-09-07T17:26:00Z~17:32:00Z(KST 다음날02:26~02:32)로 제한했다. 기존 Management API gateway11행/Postgres11행을 읽었으며 모두 import_guest_course_completions 경로의 HTTP400 및SQLSTATE22P02다. 첫 DB 오류02:26:26.142, 마지막02:30:34.390. 원문은 출력하지 않고 오류가 `invalid input syntax for type uuid`이고 값의 형식이 구형 `import-…`인지 boolean으로 확인했다(11행 모두 true). 정확한 사용자 ID별 대조는 하지 않았지만 사용자 보고 구간·해당 RPC·오류 형식을 대조했다. digest 미발견/권한 거절/모호한 컬럼 오류는 이 행에서 관찰되지 않았다.
2. **의미/보존:** 이 요청들은 UUID 인수 파싱 단계에서 거절돼 import 함수 본문이 실행되지 않는 형식이다. 계정 생성 시점 때문이라는 근거는 없다. repository는 기존 pending을 우선 재사용하므로 새 UUID 생성기 수정/새 빌드만으로 구형 pending은 교체되지 않는다. 기기의 raw pending 자체를 읽지는 않았으므로 그 state/items/owner 무결성까지 확인했다고 주장하지 않는다. 해당 요청11개 외 모든 과거 작업이 미수락됐다는 포괄적 보장도 하지 않는다.
3. **최소 후속 복구안(미구현):** 먼저 해당 기기의 pending이 prepared·acceptedSourceIds 빈 배열·구형 import ID·현재 정상 owner 일치인지 로컬 readonly 검사한다. 정상 UUID/acknowledged/손상/다른 owner이면 변경하지 않는다. 형식상 서버에 수락될 수 없었던 구형 요청만 대상으로, items/target/source는 불변 유지하고 원래 요청↔새 UUID 대응을 원자적으로 보존하는 일회성 로컬 복구를 별도 구현·fixture 검증한다. 단순 clear 후 새 prepare/재발급으로 숨기지 않는다. 원본 삭제·서버 import는 그 로컬 복구와 분리하고, 원격 명시 실행은 승인된 대상/요청 수/실제 계정 기록 반영·accepted 정리 범위를 먼저 확정한다. 이번에는 이 교체나 원격 실행을 수행하지 않았다.
4. **변경/검증/다음 담당:** 공유 변경은 본 문서뿐, repo 밖 `/private/tmp/timefit-guest-import-logs.cjs`는 기존 CLI 인증을 메모리에서만 사용해 과거 로그를 조회했다. 최초 gateway/DB 조회 후 동일 DB 로그의 오류 값 형식만 추가 판정했으며 사용자에게 추가 실패 클릭을 요구하지 않았다. 원문 오류·ID/계정/토큰/본문은 채팅/문서/fixture에 남기지 않았다. 제품 수정/원격 쓰기/migration/C 반복/초기화/commit/push0. 앞선19개 집중·UI589·기본274/typecheck PASS는 유지, 이번은 로그 진단이라 반복하지 않았다. 다음 담당은 DB의 위 제한 로컬 pending 복구 설계·실패 fixture 및 필요한 UI readonly 소비 계약 인계다. 현재 상태는 **사용자 보고 원인 확인, 기존 pending 복구·실기기 이관 성공 대기**다.

## DB 제한 pending 복구 완료 인수인계 — 2026-09-08 (현행)

### 1. 변경 파일·이력

- `src/services/guestCompletionImportRepository.ts`: readonly 복구 판별, 동일 pending 안의 최소 이전 ID 대응, 저장 확인, 이전 UI ID 해석, 공유 guest 직렬화, 경계별 owner 재확인. acknowledged 요청은 RPC 재전송 없이 기존 승인 결과로 로컬 정리를 이어간다.
- `src/services/releaseIdentityPersonalizationRuntime.ts`, `releaseIdentitySupabase.ts`: 같은 pending key를 사용하는 runtime/standalone에 동일 `serializationKey`(실제 releaseDeviceStorage 객체)를 연결. 기존 native UUID 생성기 주입을 재사용한다.
- `test/guest-import-pending-recovery.test.ts`: 신규6개 복구 회귀. `test/guest-import-release-fix.test.ts`: 실제 production factory를 통한 구형 pending 복구·두 composition 경합 검증 추가. 본 문서에 결과 기록. 다른 세션의 README 변경은 손대지 않았다.

이전 모든 구형 pending 불변 → UUID 파싱 실패가 업데이트 뒤에도 반복 → 명시 재시도에서 동일 owner·정확한 구형 형식·prepared·accepted 빈 배열·유효 items인 경우에만 ID 치환 → 미수락 요청을 항목 보존한 채 재개 → **로컬 구현 완료/실기기 확인 대기**. 무조건 clear 후 새 prepare 방식은 채택하지 않았다.

### 2. 유지 계약·정확한 공개 연결

- `isRecoverableLegacyGuestImport(pending, subject): boolean`: 저장/인증/RPC 없는 순수 판별. 필드 집합, 이전 생성기 형식, 항목 수·식별자·완료 분·장소 필드/순서/길이·중복 source를 검사한다. 정상 UUID, acknowledged, accepted 존재, 손상, 다른 target, 임의 비UUID는 복구하지 않는다.
- 앱은 기존 `approveGuestCompletionImport({sourceCompletionIds})` → `continueGuestCompletionImport({importId})`를 그대로 사용한다. prepare/로그인/앱 시작만으로 복구하지 않는다. UI 메모리가 구형 ID를 보유해도 동일 pending의 `recovery: {version: 1, legacyImportId}`로만 새 UUID에 연결한다. 무관한 이전 ID는 거절한다. 해당 메타데이터는 pending 내부에만 보관하고 RPC에는 기존 `{importId, items}`만 전달한다.
- repository `importGuestCourseCompletions`는 저장 확인 실패 `unavailable`, 요청 불일치 `invalid_input`, owner 변경 `account_changed`, 인증 실패는 기존 resolver status를 반환한다. 승인 완료는 `acknowledged`/`already_acknowledged`; `finalizeGuestCompletionImport`의 성공은 `source_removed`, 정리 실패/미승인은 `cleanup_pending`. UI용 별도 복구 요청·새 ID 수동 입력은 필요 없다.
- UUID 교체는 clear 없이 단일 pending 쓰기로 items/target/source를 유지한다. 쓰기 예외도 재조회로 정확한 저장값을 확인하기 전 RPC를 하지 않는다. 저장됐으나 조회가 실패하면 중단하고 다음 명시 재시도에서 저장된 UUID를 재사용한다. 전혀 저장되지 않은 실패는 구형 pending을 유지하며 이후 명시 재시도에서 다시 복구 가능하다. 서버 응답 유실은 UUID를 바꾸지 않는다.
- 직렬화는 같은 guest pending 저장소의 prepare/import/finalize에 한정한다. 두 composition과 연타는 같은 큐를 사용하며 필수 코스 완료용 공유 잠금을 점유하지 않는다. 서버 응답 대기 중 자동 재시도 없음. 승인된 source만 정리하며 rejected 보존, 과거 체류 학습0, 동의/추천/RPC/SQL/권한/UI/native 정책 불변.

### 3. 실행한 테스트·결과

- 실패 우선: 신규 복구 회귀의 처음2개가 수정 전 실패, 비대상 보존은 통과. 구현 후 아래 집중25개 통과.
- `npx tsx --test test/guest-import-pending-recovery.test.ts test/guest-import-release-fix.test.ts test/release-owned-completion.test.ts test/release-identity-device-flow.test.ts`: **25/25 PASS**. 구형 UI ID·cold 재생성·실제 production composition 공유 키·연타·저장 전 실패/commit 후 예외/재조회 실패·응답 유실·부분 승인/정리 실패·계정 전환/로그아웃·무관한 ID 거절·학습 payload 제외 검증.
- `npm run test:typecheck`: 최초 implicit-any2건을 타입 표기로 보완한 후 **PASS**.
- `npm run test:ui`: **589 PASS, 1 skip, 0 fail**. `npm test`: **274 PASS**. `git diff --check`: **PASS**.
- 고정 synthetic Auth/storage/RPC fixture만 사용했다. 실기기·운영 DB 성공 증거로 확대하지 않는다. 원격 로그 재조회/쓰기/migration/C 반복/초기화/stage/commit/push0.

### 4. 남은 위험·실기기 확인·다음 담당

UIUX 수정 없이 기존 공개 호출로 재시도할 수 있다. 수정 JS 번들을 **기존 앱에 업데이트**한 뒤 같은 계정으로 기존 가져오기/재시도 버튼을 **한 번만** 누른다. 앱 삭제·재설치로 원본 저장소를 지우거나 로그아웃/새 요청으로 우회하지 않는다. 이 동작은 실제 계정 방문 기록을 생성하고 서버가 accepted한 guest 원본만 로컬 source에서 정리한다. 사용자에게 완료 문구와 계정 기록 표시 여부만 확인받고 원문 pending·토큰 전송은 요구하지 않는다.

기기 pending이 좁은 복구 조건을 만족하는지는 아직 확인하지 않았다. 재시도 후에도 실패하면 반복 클릭하지 않고 문구·발생 시각을 DB에 인계한다. 정상 UUID의 별도 서버 오류나 손상 pending을 이 보완으로 해결했다고 간주하지 않는다. 동일 JS 실행 환경의 공유 큐로 검증했으며 다른 프로세스/외부 저장소 편집과의 분산 트랜잭션을 보장하지 않는다. 실제 이관 성공/중복 없음/accepted 원본 정리 확인 후 통합·QA가 사용자 실패 해소를 수락한다.
