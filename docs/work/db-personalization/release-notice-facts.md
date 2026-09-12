# DB-RELEASE-NOTICE-01 — Supabase 계약·처리 사실 인계

2026-09-09(KST). **공개자료 확인·기존 운영 근거 대조 완료. 계정별 계약 적용·일부 설정 확인은 남음.** 법적 적합성 보장이나 공개 게시 승인이 아니다. [실행 명령](../integration-decision/release-notice-closeout.md)의 DB 범위만 수행했다.

## 1. 결론과 기존 근거 재사용

- 현재 공개 서비스 계약의 법인은 **SUPABASE PTE. LTD.**다. `Supabase, Inc.`라는 Privacy/사이트 표기를 서비스 계약 당사자로 그대로 옮기면 안 된다. 다만 이 계정에 별도 Order/서면 계약이 적용되는지는 제공된 증거로 확인되지 않았다.
- 공개 표준 약관은 DPA를 편입한다. 따라서 **별도 서명 PDF가 없다는 이유만으로 DPA 미적용이라고 단정하지 않는다.** 반대로 공개 DPA 열람을 이 계정의 개별 서명·체결 증거로 쓰지도 않는다. 남은 확인은 아래4절의 계약 적용 유형·버전이다.
- 서울 프로젝트 배치, 저장 항목, 삭제 구현·배포, 개인화 C는 [기존 사실표](release-facts-final.md)의2~5·8·12절을 재사용했다. 과거8절의 delete-account 미배포는12절 완료로 대체된 이력이다. 이번 재조회·재실행은 없다.
- 기존 메타데이터 확인일09-08: `ap-northeast-2`, `ACTIVE_HEALTHY`; 백업 `walg_enabled=true`, `pitr_enabled=false`, 목록0건, schedule조회402. 목록0건을 백업 전무로,402를 요금제로 해석하지 않는다.
- delete-account는09-09 01:27 KST 배포 ACTIVE/v1/verify_jwt=true 및 무인증401 확인을 재사용한다. 실제 전용 계정 탈퇴 E2E 완료가 아니다. C의 저장·동일 owner 조회·추천 반영·exact 정리 PASS를 탈퇴 검증으로 승격하지 않는다.

## 2. 공개자료로 닫힌 필드와 변경 이력

아래 공식 자료 확인일은 모두 **2026-09-09**다. 표준 계약 설명과 해당 조직에 실제 적용되는 계약 증거는 별도다.

| 근거 | 확인 내용·적용 한계 |
| --- | --- |
| [S1 서비스 약관](https://supabase.com/terms), 서문·정의·7(b) | 계약 당사자 SUPABASE PTE. LTD., Singapore. 공시 주소 `65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513`. 표준 약관은 동의 또는 서비스 사용에 따른 적용 및 별도 계약 예외를 설명하고 DPA를 편입한다. 현재 HTML의 버전 시행일은 확인하지 못했으므로 계정의 수락일을 만들지 않는다. |
| [S2 DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), Version1 — August1,2026, 서문·2·6·11.2·Schedule3 | Supabase는 고객 데이터 처리자(고객이 처리자면 하위처리자). 지정 지역에 저장·주로 처리하되 서비스 제공 등 예외가 있다. 계약 종료 후30일은 반환 요청기간 및 이후 삭제 조항이지 앱 회원 탈퇴 후30일 보유가 아니다. |
| [S3 하위처리자 목록](https://supabase.com/legal/customer-resources/subprocessor-list), June1,2026 [PDF](https://supabase.com/legal/subprocessor-list/June-1-2026.pdf), Name/Description 표 | Supabase, Inc.는 지원 업무, AWS·Cloudflare·Google·Fly.io 등은 hosting, Sentry 등은 monitoring/tracing으로 열거된다. 목록 자체에는 국가·항목별 보유기간이 없다. 모든 업체가 짜투리 사용자의 모든 데이터를 받는다는 증거는 아니다. |
| [S4 Privacy](https://supabase.com/privacy), 적용 범위·Contact us | Supabase, Inc.의 서비스/사이트 이용자 정보 설명과 고객이 맡긴 앱 end-user Customer Data의 DPA 경계를 구분한다. 공개 개인정보 연락처 `privacy@supabase.com`. 이 문서의 사이트 처리 국가를 앱 DB의 실제 저장 국가로 대체하지 않는다. |
| [S5 지역 경계](https://supabase.com/docs/guides/security/gdpr-compliance), Data residency | 주 DB·Auth·Storage의 프로젝트 지역과 Edge·로그·백업 등 별도 처리 경계를 구분한다. 기존 서울 메타데이터와 결합한 Auth 핵심 호스팅 판단은 공식 구조에 근거한 추론이며 별도의 Auth 메일 경로 증거가 아니다. |
| [S6 Edge 지역](https://supabase.com/docs/guides/functions/regional-invocation), 기본 동작·지정 실행 | 기본은 요청자 가까운 지역 실행이며 명시적 지역 선택이 가능하다. DB 서울만으로 함수 실행 지역을 확정할 수 없다. 응답/로그 지역 필드가 실행별 근거이며 이번 신규 호출은 하지 않았다. |
| [S7 로그](https://supabase.com/docs/guides/observability/logs), log types·retention | Auth·Postgres·API Gateway·Edge 등의 로그는 별개이며 조회 보유범위는 plan에 의존한다. 앱 console 억제를 플랫폼 로그 미수집으로 설명하지 않는다. |
| [S8 Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp), default/custom SMTP | 기본 SMTP는 production 용도가 아닌 제한 서비스이고 custom SMTP는 별도 공급자 연결이다. 기본/사용자 지정 여부와 공급자는 실제 설정이 필요하다. S3의 Postmark는 Authorized Users 연락 설명이므로 앱 회원 인증 메일 공급자라는 근거로 대체하지 않는다. |
| [S9 백업](https://supabase.com/docs/guides/platform/backups), daily backups·backup types | 공개 daily backup 접근 범위는 Pro7/Team14/Enterprise최대30일이고 실제 plan/PITR 설정과 구분해야 한다. DB 백업은 Storage 객체 본체를 포함하지 않는다. 이 수치를 현재 계정의 보유기간으로 채우지 않는다. |

이전 방식 → 문제/관찰 → 교체 방식 → 이유·상태:

- `Supabase, Inc.`만을 수탁 계약 법인 후보로 사용 → 현재 S1/S2는 PTE. LTD., S4와 S3는 다른 업무의 Inc. 표기 → **표준 서비스 계약 법인·지원 하위처리자·사이트 개인정보 주체를 분리** → 업무별 근거를 맞춤. 현행 인계이며 publish 본문은 문서 담당 소유다.
- 과거 DPA 파일/별도 서명 여부만으로 계약 판단 → 현행 S2 HTML은2026-08-01 표기, S1은 DPA 편입 구조 → **현재 표준 내용은 확인 완료, 개별 적용 유형만 별도 확인** → 옛 파일을 현행으로 복원하거나 불필요한 서명 절차를 새 선행조건으로 만들지 않음. 현행.
- 서울 리전을 모든 처리 국가로 확대하거나 불명 로그 기간을 하나의 숫자로 보완 → 서비스별 처리 경계·설정이 다름 → 아래 분리표와 정확한 미확인 필드 사용 → 근거 없는 국내 한정/즉시 전량 삭제 고지 방지. 현행.

## 3. 출시 문서 전달용 처리 사실표

`S1~S9`는 위 공식 출처, `F`는 [기존 사실표](release-facts-final.md)의 해당 절이다. 받는 주체의 표준 계약 표기는 개별 계정의 별도 계약 없음이 확인되는 조건으로 사용한다. 지역은 처리 위치이지 법인 설립 국가와 동일하지 않다.

| 처리 업무 | 받는 주체 | 전송·처리 항목 | 확인 지역·보유·삭제 | 근거 | 정확한 미확인 필드 |
| --- | --- | --- | --- | --- | --- |
| Auth 핵심 인증·계정 | 표준 계약상 Supabase Pte. Ltd.; 관련 hosting 하위처리자 | 이메일·인증 요청, 세션, 회원ID; 비밀번호는 정상 Auth 경로 전송이며 앱 자체 비밀번호 저장 아님 | 프로젝트 서울. Auth 핵심 호스팅도 S5와 기존 지역에 근거. 최근10분 비밀번호 재인증 후 탈퇴 처리 계약, 서버 소유행 cascade. 로그·백업은 별도 | F2~4·12, S1·S2·S5 | 이 조직 계약 적용; 메일은 다음 행 |
| 계정 기록·동의·개인화 저장 | 같은 서비스 계약 처리자 | 선택 닉네임, 문서 version·동의시각, 완료/장소ID·명칭·분류·시각, 별도 동의 체류 표본/집계. legacy 저장 코스는 출발·목적 좌표/label·시간·snapshot도 포함 | DB 서울. 코스/기록의 일괄 TTL 없음. 체류 표본 유효180일, 해당 owner 조회 시 만료행 purge. 동의OFF는 적용 차단이지 즉시 표본 삭제가 아님. 삭제/초기화 경계 유지 | F2~4·8, S5 | 전역 purge 외부 scheduler 실제 운용 여부 |
| Auth 메일 전달 | Supabase 및 실제 SMTP 공급자(미확인) | 인증용 수신 이메일·인증 링크/메일 내용; 종류별 실제 발송 설정에 한함 | Auth DB 서울만으로 SMTP 처리국가·메일 로그 보유를 확정 못함 | S8, S3 | default/custom, 실제 SMTP 공급자·처리국가·보유/삭제 |
| Edge route-proxy·delete-account | Supabase 및 적용 runtime 하위처리자 | 인증 JWT/요청 메타데이터, 경로 좌표 등 요청 항목; 탈퇴 인증·요청ID. 외부 경로 공급자 항목은 API 인계 | delete-account 배포 사실 확인됨. 함수별 실행국가·요청 로그 보유 별도. JWT 전송을 로그에 JWT 원문 보관한다는 뜻으로 쓰지 않음 | F8·12, S6·S7; [API 기존 사실표](../external-api/release-facts-final.md) | region 강제 여부·기존 실행 지역 근거, 서비스별 로그 설정 |
| 관리형 로그·보안·지원 | Supabase 및 해당 logging/support 하위처리자 | Auth 이벤트·DB/게이트웨이/Edge 오류·접속/실행 메타데이터 등 서비스별 로그. 실제 본문/민감필드 저장 유무는 추정 금지 | 프로젝트 DB와 별도 관측 시스템일 수 있음. 현재 plan·drain·각 보유기간 미확인. 계정 삭제가 로그 전량 즉시 삭제를 뜻하지 않음 | F8, S2 Schedule1, S3·S7 | plan/로그별 retention, drain 목적지·국가·보유, 계약상 별도 보존 조건 |
| 관리형 DB 백업 | Supabase 및 해당 저장 하위처리자 | 백업 시점 DB/Auth 데이터; Storage 객체 본체와 구분 | 기존 백업 응답 region 서울, PITR false·목록0. 다른 복제/내부 백업까지 국내 한정하거나 없다고 보장 못함. 실시간 계정 삭제와 백업 복사본 만료는 별도 | F8, S9 | 실제 복원 가능 범위/retention·계약상 복제 지역. 기존 실패 조회 반복 없음 |
| 운영자 보호 백업 | 사용자 보관 책임의 로컬 보호 저장소; Supabase 재위탁 수신자 아님 |09-07 20:20:48 KST Auth/public/migration snapshot | repo 밖 AES-256 APFS 보호, 격리 복원 수락 재사용. 자동 만료 아님. 장치 물리국가는 추정하지 않음 | F4·8; [A/C 수락](personalization-finalization.md) | 보관 종료/폐기일·필요 시 실제 보관국가. 파일/암호 전달 불필요 |

기기 전용 guest·outbox의1000건/32건·7일 경계를 공급자 서버 보유기간으로 합치지 않는다. 익명 Auth30일은 cleanup 미배포/pg_cron 부재 및 외부 scheduler 미확인인 기존 증거 상태를 유지한다. 전량 정기 삭제 성공으로 쓰지 않는다. 현재 Storage 삭제 함수의 no-op을 향후 사용자 업로드 삭제 보장으로 확대하지 않는다.

## 4. 계정 확인이 필요한 최소 한 묶음

새 문의 발송·계약 동의·유료 변경을 요청하는 목록이 아니다. **기존 조직/프로젝트 소유자가 접근 가능한 화면의 아래 비민감 필드만 한 번에 확인**하면 된다. 화면에 없는 필드는 `표시 없음`으로 남기며 원문 계약·키·토큰·SMTP 비밀번호·메일 본문·사용자 로그를 보내지 않는다. 메뉴명은 제품 UI 변경에 따라 다를 수 있다.

| 확인 화면/기존 자료 | 필드 | 필요한 이유 |
| --- | --- | --- |
| 조직 Settings/Legal 또는 기존 Order·DPA 기록 | 연결 프로젝트가 속한 조직과 계약의 일치 여부, 온라인 표준/별도 계약 여부, 적용 법인·버전/효력일(표시되는 경우만) | S1/S2를 실제 계정에 연결. **새 별도 서명이나 수락 버튼 클릭은 필요조건으로 요청하지 않음** |
| 조직 Billing/Subscription 및 프로젝트 Logs/Log Drains 설정 | plan, Auth/Postgres/Edge/API별 조회 retention, 추가 보관 조건, drain 사용 여부·서비스/국가/보유기간(있을 때만) | 공개 일반 retention과 이 계정 보유 구별. 실제 사용자 로그 열람 불필요 |
| Authentication의 Email/SMTP 설정 및 해당 공급자 기존 계약 안내 | custom SMTP 활성 여부, 공급자명 또는 host 도메인만, 처리국가·보유/삭제 안내 | 기본/별도 메일 수신자 구분. 시험메일 발송 불필요 |
| 기존 함수 배포/호출 설정 또는 이미 확보한 비민감 실행 메타데이터 | 함수별 지역 고정 여부, 알려진 실행 region, 계약 지역 제한 유무 | Edge 국가를 DB로 추정하지 않기 위함. 신규 요청/원문 로그 수집 불필요; API 담당 기존 증거 우선 |
| Database/Backups의 보관 설명 및 기존 외부 정기 작업 설정 | 실제 retention/복원 범위, 추가 복제 지역 제한; 외부 cleanup scheduler 유무·주기·마지막 성공 상태 | 기존 PITR false/목록0/pg_cron 부재를 재수집하지 않고 아직 없는 필드만 보완 |
| 사용자 보호 백업 관리 기록 | 폐기 예정일·보관국가 확인(필요 시) | live 삭제 뒤 별도 복사본 보유 설명. 백업 생성·열기·이동·삭제 요청 아님 |

계정 전용 화면/계약 적용 증거는 이번에 확보하지 않았다. 따라서 표준 자료만으로 개별 계약 법인 확정을 완료 표시하지 않는다. 현재 계약 법인의 공개자료 확인 자체는 끝났으며 이를 다시 조사할 필요는 없다.

## 5. 문서·통합 판단에 남기는 경계

- 문서 담당은 R1의 `Supabase, Inc.` 후보를 S1~S4의 업무별 법인으로 구분하고, **별도 계약 없음/표준 적용 확인 뒤** 실제 수탁자 문구를 확정한다. DB가 publish 파일을 직접 고치지 않았다.
- 국가·수신자 연락처·전송 시기/방법·항목·보유 등 국외 이전 고지는 실제 처리 사실과 적용 법적 근거를 결합해 확정할 사항이다. Pte. Ltd.의 Singapore 소재를 모든 데이터의 Singapore 저장으로, 서울을 국외 처리 없음으로 쓰지 않는다. SCC/DPA가 한국의 고지·동의 요건을 자동 충족한다는 판단도 하지 않는다.
- 위치 문의 답변이 계약 법인·SMTP·로그 설정까지 답한 것으로 취급하지 않는다. 반대로 모든 미확인 기간을 일괄 게시 차단하지 않는다. 문서/통합은 필수 법인 적용 확인, 처리 확인 후 필요한 국가/보유 필드, 단순 추가 관측 공백을 나눠 판단한다.
- 가입 문서 registry 등록, 전용 탈퇴 E2E, 게시/배포는 기존 후속 순서를 유지한다. 이 조사로 승인 범위를 늘리지 않는다.

## 6. 완료 인수인계 — 네 항목

1. **변경 파일·목적:** 이 파일만 신규 작성. 공개 Supabase 계약 법인/DPA·하위처리자와 실제 운영 근거의 차이, 공급자 처리표, 최소 설정 확인 묶음을 인계했다.
2. **유지 계약:** owner 격리·명시 guest 가져오기·동의/삭제/체류180일·가입 문서 연결 및 기존015~017/C/탈퇴 함수 배포 수락 유지. 제품·UI·SQL·정책·README·공개 문서 변경0. 타 세션 변경 보존.
3. **확인 방법·결과:** 기존 사실표/공개 R1/실행 명령 대조와 S1~S9 공식 자료 확인. PDF 읽기 지침을 적용해 하위처리자 표의 업무 범위를 확인했으며 공개 목록을 실제 전송 입증으로 확대하지 않았다. 로컬 링크 존재·diff 공백 검사 수행. 문서만이므로 앱 테스트0, 운영 사용자 DB/API 검증0, 운영 메타데이터 신규 조회0, 운영 쓰기0, C/탈퇴/백업 반복0.
4. **남은 위험·다음 담당:** 운영자는4절의 비민감 계정 필드만 제공. API는 Edge/외부 공급자의 기존 증거와 통합. 출시 문서는 확인된 표준 사실부터 반영하고 계정 적용/조건부 이전 고지를 분리해 DOCS-06 B 수행. 통합은 실제 답변 범위와 게시 조건만 결정. 조사 완료를 전체 계약·보유 설정 확인이나 법률 적합성 PASS로 바꾸지 않는다.
