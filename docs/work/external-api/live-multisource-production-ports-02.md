# API-LIVE-PRODUCTION-PORTS-02 — live multisource production composition

2026-09-22. 기존 Supabase session과 Functions 호출 경계를 TourAPI·부산 live facade에 조립하는 production port를 추가했다.

상태: **production composition·고정 fixture 완료 / UI 연결·flag 활성화·Edge 배포 전**. 실제 API, 원격 설정, secret을 사용하거나 변경하지 않았다.

## 변경 파일 / 변경 목적

| 파일 | 목적 |
| --- | --- |
| `src/services/liveMultiSourceProductionFactory.ts` | 현재 session을 한 번 읽고, 인증 TourAPI/Busan invoker와 기존 adapter를 동일 `createLiveMultiSourceSessionFacade` 수명으로 조립한다. |
| `src/services/liveMultiSourceProductionReceipt.ts` | Functions non-2xx 본문 중 schema-valid typed unavailable만 새 객체로 재구성한다. 임의 필드는 폐기한다. |
| `src/services/liveMultiSourceSupabaseProduction.ts` | 기존 `supabase` client의 `auth.getSession()`과 `functions.invoke()`를 factory에 연결하고 UUID 기반 opaque snapshot ID를 주입한다. |
| `test/live-multisource-production-ports.test.ts` | session 유무·만료·조회 실패, 함수명, Authorization, facade 단일 수명, 안전 오류 복원을 검증한다. |
| `test/live-multisource-production-safety.test.mjs` | 별도 sign-in·CAPTCHA·로그·영속 저장·약한 ID 생성 부재와 public 미연결을 검증한다. |
| 본 문서 | 유지 계약, 검증 결과, 다음 연결 조건을 인계한다. |

## production 계약

통합 caller는 route proxy/Auth 준비가 완료된 뒤 `createSupabaseLiveMultiSourceFacade()`를 한 추천 세션에 한 번 호출한다. 이 함수는 현재 Supabase session만 조회하며 별도 anonymous sign-in이나 CAPTCHA를 실행하지 않는다.

- 유효 session: access token을 반환값에 넣지 않고 인증 invoker 두 개에만 전달한다. `tourapi-live`와 `busan-live`는 동일 token과 동일 facade 수명을 사용한다.
- session 없음·조회 예외·명시 만료: `{ status: 'unavailable', reason: 'auth_session_unavailable' }`만 반환하고 Functions/provider 호출은0이다.
- 성공: `{ status: 'ready', facade }`를 반환한다. UI는 Supabase client, access token, adapter별 retry API를 받지 않는다.
- opaque ID: `live-${uuid.v4()}`만 사용한다. 이메일·좌표·검색어·시간 원문·token을 ID에 포함하지 않는다.
- non-2xx: `FunctionsHttpError`의 context에서 Tour/Busan typed unavailable enum만 읽어 새 객체로 만든다. 원문 body의 추가 필드는 반환하지 않으며 손상·미허용 본문은 transport error로 남아 기존 adapter가 unavailable로 닫는다.

factory에 주입 가능한 auth/edge/idFactory는 fixture와 composition 검증을 위한 포트다. production export는 기존 `src/services/supabase.ts` client와 UUID만 사용한다.

## 유지한 계약

- facade의 동일 snapshot, exact 승인 ID·사진, Tour 12→6·누적30, Busan 최대6 provider calls, 자동 retry0, close/cancel terminal 계약을 변경하지 않았다.
- access token은 현재 session에서만 읽는다. factory가 session 생성·갱신 UI·CAPTCHA를 중복 실행하지 않는다.
- key·token·원문 body·좌표·검색어·이메일을 로그, DB, 파일, cache, trace에 저장하지 않는다.
- data projection, 추천 판단, UI 상태·화면, App entry, DB/migration, env/secret, Edge handler를 수정하지 않았다.
- 실제 공급자 호출·배포·원격 변경·commit/push 없음. public UI import도0이다.

## 테스트 결과

- production port 집중 테스트: **5/5 PASS**.
- 보안·public 미연결 검사: **2/2 PASS**.
- engine + facade + production composition 결합 집중 실행: **36/36 PASS**.
- `npm run test:typecheck`: **PASS**.
- `npm test`: **591/591 PASS**, fail0, skip0.
- `npm run test:ui`: sandbox의 tsx IPC `EPERM`으로 시작 전 실패. 같은 UI glob을 `node --import tsx --test`로 실행해 **824건 중 823 PASS / fail0 / 기존 skip1**. 원래 npm 명령 성공으로 기록하지 않는다.
- `git diff --check` 및 신규 파일 trailing whitespace 검사: **PASS**.

## 다음 결정·위험

1. UIUX/통합 소유자는 기존 route proxy/Auth 준비가 성공한 뒤 production factory를 한 번 호출하고, `ready.facade`를 세션 controller가 소유하게 해야 한다. UI가 token이나 Supabase client를 직접 받으면 안 된다.
2. `auth_session_unavailable`은 로그인 UI 정책을 지시하지 않는 safe error다. 기존 이메일 또는 anonymous session 준비 흐름이 재인증·CAPTCHA 여부를 결정해야 한다.
3. background/foreground와 명시 재시도는 기존 facade를 재활성화하지 않고 새 추천 세션에서 factory부터 다시 시작해야 한다. batch별 factory 재생성은 호출 예산을 초기화하므로 금지한다.
4. Supabase SDK의 안전 non-2xx body 복원은 unavailable enum만 보존한다. 원문 진단이 필요한 운영 관찰성은 client 반환값을 넓히지 말고 별도 서버 안전 집계 계약으로 결정해야 한다.
5. public 활성화, 실제 session/Edge 연결, 운영 지연·한도, 배포, 실기기 검증은 이번 fixture 완료에 포함되지 않는다.

## 최종 완료 인계 — 2026-09-22

1. **변경 파일:** 위 service3, 직접 테스트2, 본 문서1. 기존 dirty 작업은 보존했다.
2. **유지 계약:** 현재 session만 사용, token 비노출, provider 호출 예산·snapshot·승인 ID·자동 retry0 유지. 타 역할 코드와 운영 상태 변경0.
3. **테스트:** 집중 **36/36 PASS**, typecheck **PASS**, core **591/591 PASS**. UI npm wrapper는 sandbox IPC `EPERM`; 동일 glob 대체 실행은 **823 PASS / fail0 / 기존 skip1**. diff/공백 검사 **PASS**.
4. **다음 결정·위험:** public 연결은 미실행이다. 통합 caller는 Auth 준비 뒤 factory1회 → facade initialize1회 → 동일 facade detail 수명을 지켜야 하며, session 없음은 기존 Auth 흐름으로 돌려야 한다.
