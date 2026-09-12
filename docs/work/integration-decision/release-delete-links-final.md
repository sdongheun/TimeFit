# RELEASE-DELETE-LINKS-FINAL-01 — 탈퇴 최소 보완·공개 문서 연결 마감

2026-09-09. 사용자 작업 명령 작성 요청. 제품 정책 변경 없음. 기존 RELEASE-DEPLOY-PREP-01과 RELEASE-LINKS-01의 **보완**이며 원격 실행 승인 아님.

## 현행 상태·순서

2026-09-09 완료 검토: FIX-04 로컬 보완 수락(통합 focused35/35 재실행 PASS), DOCS-04 문서 정리 수락. 아래 ‘보완이 남음/병렬 진행’은 최초 명령 시점 이력이다. 다음 현행은 **DB-RELEASE-DELETE-DEPLOY-05**이며 원격 실행 전 승인 필요. DOCS-04의 ‘FIX-04 보완 중’은 병렬 작성 시점의 상태로, 로컬 완료·운영 미배포로 읽는다. 추가 로컬 재감사/C 반복 지시가 아니다.

## DB-RELEASE-DELETE-DEPLOY-05 — DB 세션, 승인 후 함수1개 배포

목표: 검증된 delete-account만 운영에 신규 배포하고 배포 동일성·인증 없는 요청 거절을 확인한다. 실제 계정 탈퇴 성공 검증과 구분한다.

읽기: AGENTS.md, docs/README.md, release-facts-final.md §10 최신 소스와 §9D 배포/복구 계약. §9A 옛 hash 사용 금지. FIX-04 테스트·의존성 준비·백업/C를 반복하지 않는다.

### 1. 승인 경계

**2026-09-09 운영 배포 승인 완료.** 통합 대화에서 탈퇴 기능의 서버 적용이며 계정 삭제 테스트/앱스토어 제출이 아님을 설명한 뒤 사용자가 **“승인한다”**고 답했다. 아래 범위의 승인을 기록하며 DB 세션은 동일 승인 질문을 반복하지 않고 사전 조건 확인부터 재개한다. 최초 ‘승인 필요’ 표시는 승인 전 이력이다. 이 기록은 배포 실행/성공 증거가 아니다.

승인 범위: 프로젝트 hwfsslihmmendxigklrx에 delete-account1개 신규 배포1회, verify_jwt=true 유지, 사후 읽기 검증 및 무인증 요청1회. 검증 실패 시 이번에 생성한 동일 endpoint만 조건부 제거. 배포 자체는 계정을 삭제하지 않지만 기존 앱의 유효한 탈퇴 요청을 실제 처리할 수 있게 된다. 계정 생성/삭제 테스트·다른 함수·SQL·registry·secret·스케줄러 변경은 제외한다.

### 2. 실행

1. 로컬 linked ref·명시 ref·원격 프로젝트 metadata가 일치하고 함수가 아직 없는지 읽기 확인한다. §10의4파일 hash/frozen lock과 승인 소스를 대조한다. 기존 claim/count RPC 정의·ACL 및 필요한 기본 env 활성 여부만 확인한다. 키 값·사용자 행은 출력하지 않는다. 함수가 이미 있거나 승인 소스/권한이 다르면 덮어쓰지 말고 반환한다.
2. 사전 조건 통과 후 repo 루트에서 다음 명령을1회 실행한다. 함수명 생략·--prune·--no-verify-jwt 금지.

```sh
npx supabase@2.116.0 functions deploy delete-account --project-ref hwfsslihmmendxigklrx --use-api
```

3. slug/status/version/verify_jwt/배포시각/deployment ID를 확인한다. 원격 소스는 별도 임시 경로에 받아 §10 소스·exact SDK/의존성 해석과 대조한다. 원본/번들 형식 차이는 대응 관계로 설명하고 metadata만으로 소스 일치 PASS를 만들지 않는다. lock 해석이나 배포 동일성을 확인하지 못하면 미확인으로 반환하고 반복 배포하지 않는다.
4. 해당 endpoint에 Authorization/apikey 없는 POST1회로 gateway401 거절을 확인한다. 사용자 토큰·실제 requestId 사용 금지. 이 검증을 정상 JWT·AMR·cascade·앱 탈퇴 성공으로 기록하지 않는다.
5. 실패/timeout/응답 불명은 먼저 원격 상태와 이번 생성 여부를 확인한다. 조건부 복구 승인에 포함되고 이번 생성물로 확정되며 타 세션 변경이 없을 때만 아래 제거를 실행하고 부재를 확인한다. 그 외는 중단·보고한다.

```sh
npx supabase@2.116.0 functions delete delete-account --project-ref hwfsslihmmendxigklrx
```

함수 제거는 탈퇴 endpoint를 다시 비활성화하는 것이며 이미 삭제된 사용자 데이터를 복구하지 않는다. 사용자 삭제 발생/잔여행 등 별도 사건이 있으면 임의 DB 복원하지 않고 반환한다.

### 3. 완료·인수인계

release-facts-final.md에 DEPLOY-05 결과를 추가한다: 변경 대상·목적 / 유지 계약 / 실제 사전·배포·사후 검증 / 남은 위험과 다음 단계. 배포 소스 식별값과 실제 결과만 기록하고 credentials·응답 원문·사용자 개인정보는 제외한다. 제품 변경이 없으면 전체 테스트/Archive 반복 없음. commit/push 없음.

완료 기준은 함수 ACTIVE·verify_jwt=true·승인 소스/의존성 대조·무인증 거절 확인이다. 다음 전용 계정 탈퇴1회는 공개 문서/registry 및 계정 생성 준비 후 §8D에 따라 별도 승인한다. 지금 개인화 C나 실제 계정 삭제를 실행하지 않는다. 출시 문서 사용자 결정 정리는 이 작업과 병렬 가능하다.

EXIT-03은 코드 확인 및 보고된 자동 검증 기준 수락(실기기는 최종 후보에서 확인). SIGNING-PREP-03은 절차 준비 완료이며 IPA 생성 아님. DELETE-PREP-03은 배포 준비 조사 완료이나 의존성 시작 검증·실패 전달 보완이 남았다.

이전: 준비 완료 후 바로 함수 배포/링크 연결 가능으로 오해할 여지 → 관찰: 가변 Edge SDK와 실패 축약, 미승인 공개 URL → 교체: 아래 두 로컬 마감 작업 병렬, 승인 후 운영 실행 → 이유: 기존 검증을 반복하지 않고 확인된 공백만 닫음 → 상태: 명령 작성·실행 전.

1. **DB-RELEASE-DELETE-FIX-04**와 **RELEASE-DOCS-04**는 병렬 가능.
2. DOCS-04의 사용자 확인·게시 승인 후 실제 privacy/terms/support 게시. 그 뒤 기존 **RELEASE-LINKS-01**의 DB registry → UI 연결 순서. DB 세션은 FIX-04와 registry를 동시에 편집하지 않는다.
3. FIX-04 수락 후 함수1개 배포 승인 → 전용 탈퇴 검증 별도 승인. 개인화 C 재실행 없음.
4. 최종 링크·아이콘·코드 확정 후 새 공개 Archive/배포 서명·최종 QA. 지금 동일 Archive를 다시 만들지 않는다.

## DB-RELEASE-DELETE-FIX-04 — DB 세션

읽기: AGENTS.md, docs/README.md, 데이터베이스설계.md의 계정 삭제 계약, release-facts-final.md §9와 그곳의 직접 연결 근거만. 과거 C/백업 작업 전체 재감사 금지.

소유: supabase/functions/delete-account/ 및 해당 함수 범위 의존성 설정·lock, src/services/releaseIdentitySupabase.ts의 탈퇴 호출 경계와 관련 repository 테스트. 이 작업 동안 해당 서비스 파일은 DB 단일 작성자이며 API/UI 세션은 수정하지 않는다. 다른 API 메서드·화면·SQL은 수정하지 않는다.

1. 먼저 고정 fixture로 현재 실패를 재현한다. functions.invoke 비2xx 오류가 재인증/충돌/서버 실패를 일반 database로 축약하는 경로를 실제 adapter→repository 호출로 검사한다. 테스트는 정상 삭제를 실행하는 운영 요청이 아니라 합성 응답을 사용한다.
2. 함수의 가변 @supabase/supabase-js@2 import를 실제 호환성이 확인된 exact 버전으로 고정한다. 해당 함수만 재현 가능한 의존성 해석/lock과 검증 명령을 마련한다. 다른 함수 SDK 일괄 갱신 금지. getClaims 존재·entry 로드·서버 client 초기화를 로컬 Edge 호환 환경에서 검증하고, 합성 자격/네트워크 mock을 사용한다. 단순 handler 단위 테스트를 Edge 시작 검증으로 부르지 않는다. 런타임 설치 등 환경 권한이 필요하면 필요한 단계만 승인 요청한다.
3. 비2xx 응답은 SDK가 제공하는 오류 context를 통해 제한적으로 읽고 기존 계약의 허용된 status/stage만 검증·변환한다. 원문 Error/body/토큰을 로그·UI에 노출하지 않는다. malformed/빈 응답/네트워크 실패는 안전한 기존 실패로 처리하며 HTTP 성공만 보고 deleted로 만들지 않는다. 401/403/409/503의 기존 repository 의미를 보존한다. 새 공개 상태가 필요하면 임의 UI 변경 대신 계약 차이를 반환한다.
4. password AMR600초·owner 검증·requestId·claim→Storage→Auth→검증 순서 유지. 응답 유실 후 삭제 자동 재시도나 성공 추정 금지. Storage no-op의 현재 한계는 기록하되 새 업로드/Storage 삭제 기능을 만들지 않는다.
5. focused fixture: 정상 성공, 재인증 필요, 인증 거절, 충돌, 서버 단계 실패, 손상 응답, 통신 실패, 민감 원문 비노출. 기존 handler/마이그레이션 계약과 npm run test:typecheck, npm run test:ui, npm test 실행. 별도 변경 없는 native Archive·개인화 C·운영 API/계정 생성/삭제는 실행하지 않는다.
6. release-facts-final.md에 FIX-04 결과를 추가하고 §9의 승인 소스 hash/manifest·의존성 고정 근거·시작 검증·실패 계약을 최신화한다. 옛 hash는 과거 기준으로 구분하고 새 배포안이 옛 hash를 참조하지 않게 한다. 추가 미확인이 있으면 배포를 막는 실제 조건인지와 최소 해결 방법을 한 묶음으로 반환한다.

완료: 두 보완 구현·재현 테스트 통과·배포할 소스 식별 가능. 실제 deploy/secrets/registry/migration/계정 삭제/commit/push 금지. 기존 함수1개 승인안의 대상·verify_jwt·조건부 복구 경계는 유지한다.

## RELEASE-DOCS-04 — 출시 문서 세션

읽기: AGENTS.md, docs/README.md, release-document-session.md의 DOCS-03, publish/의 기존6개 문서. 사실 대조는 release-build-final.md의 NATIVE-02/SIGNING-PREP-03, release-exit-final.md, DB release-facts-final.md §8~9, API release-facts-final.md OPS-02, DATA release-assets-final.md를 필요한 범위만 읽는다.

소유: docs/05_release/만. DB 함수/registry·앱 링크·UI·중앙 요구사항을 직접 수정하지 않는다. FIX-04 실행 중 문서의 중간 상태를 완료로 읽지 않는다.

1. 기존 게시 초안을 재사용해 오래된 차단 상태만 갱신한다. native manifest/clock 로컬 보완은 완료, Distribution IPA/최종 검증은 미실행. delete-account는 미배포, 함수 보완 중. 기록 없이 종료→MyCourses 경로는 닫혔으나 모든 legacy 저장/전송이 제거된 것은 아니다. 확인된 사실보다 수집/삭제 범위를 축소하지 않는다.
2. 운영자 신동흔·앱명 짜투리·지원 sdongheun@gmail.com, 한국/iPhone 범위를 유지한다. 위치 신고 문의 답변은 대기이며 법적 공개 가능으로 승격하지 않는다. 사실 불명 보유기간/처리국가/신고 지위를 임의 기입하지 않는다. 새 법적 판단이 필요할 때만 현행 공식 출처를 확인한다.
3. 공개를 위해 사용자에게 받아야 하는 값/결정을 기존 목록과 합쳐 중복 없이 한 묶음으로 작성한다. 개인정보 책임자·권리요청 메일, 시행일/version, 연령 정책 등 각각 기존 확정 여부를 확인하고 미확정만 질문 후보로 남긴다. 지원 SLA 등 선택사항을 필수 차단으로 늘리지 않는다. 이미 답한 이름/메일을 다시 묻지 말고 다른 법적 용도로의 사용 승인만 구분한다.
4. privacy/terms/support의 게시 대상과 문서 ID/version→registry→내정보/가입 동의 연결표를 작성한다. 실제 승인 URL이 없으면 미정으로 표시하고 가짜 URL을 앱/DB에 넣지 않는다. Cloudflare 계정·게시 주소·게시 승인이 필요한 지점을 명확히 한다. 이번 작업은 문서 정리이며 웹사이트 구축·게시를 실행하지 않는다.
5. 기존 RELEASE-LINKS-01을 대체하지 않고 바로 실행 가능한 역할별 인계를 작성한다: 게시 담당의 승인된 문서만 공개/모바일 HTTPS 검증 → DB의 승인된 registry 행만 갱신·과거 동의 보존 → UI의 기존 링크 연결·초기 미동의/stale/실패 가입 우회 금지. 원격 게시와 registry 적용은 사용자 승인 후다. URL만 정하면 미확정 법적 내용을 자동 게시하는 지시 금지.
6. 산출물 링크/용어/버전 일관성·미확정 placeholder와 공개본/내부본 구분을 검사한다. release-document-session.md에 DOCS-04 결과, 사용자 결정 묶음, 다음 담당별 연결 인계를 남긴다. 문서만 변경하면 전체 앱 테스트 반복 없음.

## 공통 인수인계

변경 파일·목적 / 유지한 공개 계약·정책 / 실행 테스트와 실제 결과 / 다음 결정·위험·재현 조건의 네 항목을 기록한다. 구현 완료·준비 완료·운영 적용 완료를 구분한다. 외부 게시·서명 자격 생성·업로드·계정 삭제 승인은 이번 명령에 포함되지 않는다.
