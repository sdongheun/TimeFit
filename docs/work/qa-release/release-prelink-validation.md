# QA-RELEASE-PRELINK-01 — 연결 전 자동 게이트·최종 확인 계획

2026-09-09. **현재 자동 검증 PASS, 체크리스트 준비 완료. 최종 후보·실기기·실제 탈퇴 수락은 미실행.**

## 1. 기준과 변경 식별

`../integration-decision/release-parallel-verification.md`의 QA 범위로 수행했다. AGENTS.md·docs/README.md·QA README, `release-execution-wave.md`의 QA-RELEASE-FINAL-01, UIUX `release-age-check.md`·`release-icon-final.md`, DB `release-facts-final.md`의 8절D/10절C/12절, `../../05_release/release-document-session.md`의 DOCS-08을 대조했다.

- AGE: 기본 미선택·handler 재검사·문서 동의 필요·이탈 초기화 구현 완료. 실제 나이 인증/서버 나이 저장과 구별한다.
- ICON: 승인 파란 시계1024 아이콘/생성 asset 연결 완료. 기존 native artifact에 자동 반영됐다고 보지 않는다.
- DELETE: DEPLOY-05 운영 함수 배포·무인증401 확인 완료. 정상 계정 JWT/AMR·실제 삭제/cascade·기기 정리는 아직 별도다. README의 배포 대기 등 옛 문구보다 최신12절을 우선한다.
- DOCS-08: 로컬 공개 페이지 validator와 게시 인계 준비 완료. 공개 URL·registry/UI 연결, 문의 답변/게시 승인은 완료가 아니다. 사용자 확정 이름·연락처·Connect 저장 사항은 재질문하지 않는다.
- 기존 개인화 C·학습·guest 가져오기·FINAL02 사용자 실기기 수락은 재사용한다. 이번에 재실행하거나 새로운 후보 실기기 성공으로 바꾸지 않았다.

검증 식별:

| 항목 | 시작 | 종료 |
| --- | --- | --- |
| 시각(KST) | 2026-09-09 05:51:17 | 2026-09-09 05:53:36 |
| HEAD | d3ac8f7ed1ad7360a1215def0b02c2726b96e47f | 동일 |
| 검사 파일 수 | 587 | 587 |
| 정렬 경로/내용 SHA256 manifest digest | 83e22bafba1f54085d2e3908a1b2ee3e681e8174ab0138ba18ef310328fd2bdd | 동일 |

추적 및 비무시 untracked의 `src/`, `test/`, `plugins/`, `scripts/`, `supabase/`, `assets/`, `ios/`, App.tsx/app.json/package*.json/tsconfig*.json 중 존재하는 파일을 해시 비교했다. 시작·종료 차이0. 공유 dirty 상태이며 App.tsx/app.json/LoginScreen/releaseIdentitySupabase/delete-account index 등 기존 변경을 포함한다. `.env`·무시된 생성물·의존성·원격 상태·문서 전체를 인증하는 manifest는 아니다. 생성된 최종 Archive도 없으므로 **동일 입력 범위의 현재 worktree 자동 결과**이며 최종 출시 후보 수락이 아니다.

근거는 `/private/tmp/qa-prelink-start.json`(파일별 digest), `/private/tmp/qa-prelink-comparison.json`(시작/종료 요약·차이). 키/토큰/계정 원문을 저장하지 않았다.

## 2. 현재 자동 게이트

QA 단일 실행자로 아래 명령을 각각 **1회** 실행했다. 코드·기대값 수정, 신규 fixture, 전체 반복 실행 없음.

| 명령 | 결과 | 로그 |
| --- | --- | --- |
| `npm run test:typecheck` | exit0 / PASS | /private/tmp/qa-prelink-type.log |
| `npm run test:ui` | 713건:712 PASS / 0 FAIL / 기존1 SKIP, exit0 | /private/tmp/qa-prelink-ui.log |
| `npm test` | 401 PASS / 0 FAIL / 0 SKIP, exit0 | /private/tmp/qa-prelink-core.log |

UI는 기존 tsx IPC sandbox 제한을 고려해 승인된 권한으로 최초부터 실행했다. 기존 skip은 `철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다`이며 철회된 동작 이력 보존이다. 신규 실패/skip 없음. UI와 기본 wrapper의 중복을 합산해 고유 사례 수로 표시하지 않는다. 기존 AGE/ICON/삭제 실패·180분·2곳·익일·guest/계정·진행 회귀가 포함된 현재 suite를 재사용했다. 실제 API·DB, Simulator, export/Archive는 실행하지 않았다.

## 3. 최종 후보 실기기 체크리스트 — 지금은 모두 미실행

전제: 실제 HTTPS URL3개와 승인 문서 version/시행일/hash → DB registry → UI 연결 완료 후, 통합이 **동일 public 후보**의 revision/dirty manifest·버전/build·artifact hash·서명·설치 기기/OS를 전달한다. 예전 internal build로 대체하지 않는다. 아래를 한 묶음으로 전달하고 기존 전체 시나리오/C를 반복하지 않는다.

| 확인 | 최소 절차·합격 조건 |
| --- | --- |
| 후보·공개 UI | 설치 홈 아이콘=승인 파란 시계, 앱명 짜투리. cold start 및 내정보/설정 진입에서 개발 시계·QA/LA 진단·C 도구 없음. main/extension·iPhone/iOS17·App Group/권한/서명/privacy manifest는 빌드 담당의 같은 Archive 검사 근거를 연결. |
| 공개 링크3개 | 개인정보 처리방침·이용약관·문의/지원 페이지를 앱의 실제 진입에서 각1회 열어 HTTPS·최종 본문·문의 수단 확인. 앱으로 복귀. 앱/registry/Connect의 URL 및 문서 version 일치. 임시 URL이나 DOCS-08 로컬 validator PASS로 대체하지 않음. |
| 가입14+·문서 | 신규 가입 화면에서14+ 기본 미선택/해제 시 제출 불가, 선택만으로 문서 동의를 우회하지 못함. 문서 링크와 승인 version 대조. 로그인 전환/화면 이탈 후 미선택 복원, VoiceOver checked 및 작은 화면/큰 글씨에서 항목·CTA 접근 확인. **실제 가입 제출은 별도 승인 전 하지 않음.** 기존 로그인에는 연령 재요구 없음. |
| 로그인·guest 경계 | 승인된 사용 계정에서 guest 기록이 자동으로 계정에 합쳐지지 않고 명시 가져오기만 허용됨을 확인. 계정 기록과 guest 표시 구별, 로그아웃 후 이전 계정 기록 노출 없음. 기존 성공 이관을 반복해 데이터 생성하지 않음. 계정 전환·중복·응답 유실은 자동 fixture 재사용. |
| 1곳·2곳/지도 | 고정 부산 수동 출발·목적지와 후보 시각을 기록. GPS 거절에서도 수동 선택 가능. 1곳 확인, 검증된 두번째 장소가 있을 때 명시 선택해2곳 최종 순서/지도·세로 순서 일치 확인. 작은 화면 CTA/취소 복귀 접근 가능. 결과가 없으면 장소 수를 부풀리거나 반복 요청하지 말고 입력·결과만 인계. |
| 앱·카카오·LA 공유 | 위 코스 중 변경 영향이 있는 최소 진행1회에 합친다. 현재 구간 길찾기→카카오→앱 복귀, 앱/LA의 동일 다음 장소·도착/출발·마지막 목적지 복귀 단계 일치. 최종 완료 뒤 기록1회·active 정리 및 기존5분 뒤 제거 결정 확인. 이미 수락된 FINAL02 전항목을 새로 전수 재실행하지 않음. |
| 실패 복귀 | 같은 후보에서 권한 거절/네트워크 실패 시 성공으로 넘어가지 않고 안내·뒤로/재개 접근 가능. 화면 복귀로 중복 저장·자동 재요청이 생기지 않는지 확인. 저장 장애/중복/AMR/계정 전환은 고정 fixture 근거로 보충하고 운영 장애를 인위적으로 만들지 않음. |

결과 양식: 항목/후보·기기·OS/입력·시각/기대·관찰/PASS·FAIL·미확인/담당. 개인정보나 토큰 캡처 불필요. 신규 실패 시 동일 조작 반복하지 않고 재현 조건을 UIUX/API/DB에 반환한다. 대중교통 예정 시각 미전달 한계는 남으므로 미래·익일 실제 운행 보장으로 판정하지 않는다.

## 4. 전용 계정 탈퇴1회 — 승인 전 실행 금지

원본 계획은 [DB 사실 문서 8절D](../db-personalization/release-facts-final.md#d-전용-계정-탈퇴1회--실행-전-승인-묶음). DEPLOY-05 배포 완료를 계정 생성·삭제 승인으로 확장하지 않는다.

1. **대상/승인:** 사용자 소유·통제 가능한 전용 신규 계정 정확히1개만 지정. 기존 사용자·현재 실사용 계정·심사 계정 금지. 공개 registry2종 연결/정상 가입 가능·후보/대상 서버 일치·증거 담당 DB의 읽기 권한 확인 후, 생성/메일확인/필요 데이터 상한/앱 탈퇴1회/owner 한정 사전사후 조회를 별도 승인받는다. 비밀번호·JWT·이메일/owner ID 원문은 채팅/작업 문서에 남기지 않고 보호 manifest에서만 대응한다.
2. **최소 데이터:** 완료기록 최대1개. cascade 검증에 꼭 필요한 경우에만 별도 동의1상태·체류 표본 최대1개, 저장 graph가 미확인인 경우에만 합성 위치 저장코스 최대1개를 각각 승인 범위에 명시한다. **이번 작업에서는 동의/표본을 포함한 운영 데이터 생성0.** 기존 C/3표본 학습 재실행0. 실제 경로 호출 대신 기존 고정 fixture를 사용하되 출시 앱에 주입할 승인 경계가 없으면 임의 주입하지 않고 해당 증거를 미확인으로 남긴다.
3. **기준선(DB):** 해당 owner의 Auth 존재와 profiles/가입동의/완료·방문/체류 표본·개인화/저장 graph·관련 claim/import 관계별 건수 및 기기 namespace/outbox/evidence/pending 상태를 보호 ID로 대응한다. 다른 계정 내용 조회·전역0 확인 금지. 원래0인 표본 관계를 ‘표본 삭제 성공’으로 쓰지 않는다. 개인정보 조회가 필요하면 기존 승인 범위를 먼저 확인한다.
4. **사용자 탈퇴:** 정상 앱에서 비밀번호 재인증 후 password AMR600초 안에 동일 requestId의 탈퇴를1회만 누른다. DB가 Admin API로 대체 삭제하지 않는다. 연타·위조 요청·만료 AMR 실패는 자동 fixture로 대체한다.
5. **성공 확인:** DB 담당은 해당 Auth user 부재, 해당 owner의 public cascade·연결 자식 정리, 표본이 기준선에 있었다면 사후0을 확인한다. 사용자/QA는 이전 계정 세션·기록 접근 불가와 owner 완료/outbox/evidence/pending 정리·재등록 없음, 앱 재진입 상태를 확인한다. 무관 guest/다른 계정 기록은 삭제하지 않는다. 서버 `deleted` 응답만으로 로컬까지 완료 처리하지 않는다. 사진·공개 registry·POI cache·비개인 집계·백업/로그 전역 삭제는 대상이 아니며 보관 고지는 별도다.
6. **중단/부분 실패:** reauth_required·rejected·retryable_failure(stage)·timeout·응답불명·owner 변경·대상 불일치·잔여행·기기 정리 실패이면 즉시 중단. 자동 재시도/새 request/재가입/Admin 보정 삭제 금지. DB는 해당 owner의 Auth 존재→관계별 잔여→claim 진행 근거만 제한 읽기로 판별하고, QA는 로컬 정리 상태를 분리한다. Auth 삭제 후 재인증 불가/서버 성공·로컬 실패도 부분 실패로 기록. `recheckOwnedAccountDeletion`은 기존 계약과 승인 범위가 확인될 때만 사용하며 재삭제를 숨겨 실행하지 않는다. 원인과 이미 완료된 단계/잔여 전용 데이터/다음 담당을 통합에 반환하고 잔여 정리는 정확한 별도 승인 후 시행한다.

탈퇴 증거 표는 `Auth / public 관계별 건수 / 표본 / 기기 정리 / 무관 데이터 보호` 각각 기대·관찰·확인자를 둔다. 실제 함수 배포/무인증401·자동 adapter PASS는 이 표의 성공 결과를 대신하지 않는다. 로그·백업의 물리 삭제를 Auth cascade의 즉시 삭제 범위로 약속하지 않는다.

## 5. 완료 인수인계

- **변경:** 본 문서 신규 작성만. 제품·fixture·DB·중앙 문서·env 수정0. 공유 dirty 변경 보존, stage/commit/push0.
- **유지:** 180분/최대2곳·날짜 보존·동의 기반 학습·guest 격리·14+ 자기확인·사진 권리 gate·public/internal 분리·삭제 실패 계약. 보안/심사/법적 수락을 자동 PASS로 대체하지 않음.
- **검증:** 지정 자동 명령 각1회 PASS, 검사 대상 시작/종료 digest 동일. 기대값 완화/새 skip 없음. 원격 API/DB·실제 계정 생성/삭제·C·Simulator 조작0.
- **다음:** 통합이 DOCS-08 답변/게시 승인→실제 URL→DB→UI 연결 후 동일 후보를 제공하면 QA-RELEASE-FINAL-01로 위 최소 목록을 실행한다. API Kakao 등록 검토·UIUX 캡처 준비 인계는 각 역할 결과를 합류하며 여기서 대신 수락하지 않는다. **PRELINK 자동/계획 완료, 최종 후보 기술 수락·탈퇴 E2E·제출/공개는 대기**다. 지금 사용자에게 실제 계정 조작을 요청하지 않는다.
