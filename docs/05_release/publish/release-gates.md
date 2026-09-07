# TimeFit 최소 출시 게이트

기준일: 2026-09-07
범위: 지금 제출에 필요한 문서·개인정보·스토어·최종 artifact만 포함한다. 공개 게시·Connect 입력·업로드·제출은 별도 승인 전 수행하지 않는다.

## P0 — 제출 차단

| 게이트 | 담당 | 상태 | 합격 증거 |
| --- | --- | --- | --- |
| 운영자·개인정보 책임자·지원 연락처 확정 | 사용자/통합 | **차단** | 공개 상호/성명, 책임자, 지원·개인정보 이메일, 필요한 주소·전화 |
| 공개 privacy/support/terms URL | 운영/통합 | **차단** | 로그인 없는 HTTPS 접근, 최종 문구, privacy·support는 앱/Connect 연결 |
| 가입 문서 registry | DB/운영 | **차단** | 게시 URL·version과 active registry 일치, 두 unchecked 동의, stale version 거절, 신규 가입 성공 |
| 만 14세 미만 가입 정책 | 사용자/법률/계정 | **차단** | 검증 가능한 14세 미만 가입 차단 또는 법정대리인 동의·확인. 문구만으로 처리 금지 |
| 위치기반서비스 법적 지위 | 사용자/법률 | **차단** | 사업자 지위·신고/면제·약관 필수 항목·위치정보관리책임자 결정 |
| 국외 이전·수탁 공개 사실 | 운영/법률 | **차단** | Supabase·Cloudflare 계약 주체/연락처, 국가/region, 항목·시기·방법·목적·보유기간, 법적 근거 |
| 개인화 출시 분기 | 통합/DB/QA | **차단** | 아래 A 또는 B 중 하나를 최종 build·공개 문구·App Privacy와 함께 고정 |
| A. 개인화 포함 | DB/QA | 미확인 | 보호 backup·restore, exact 015/016 적용, 운영 RLS/ACL/Auth/삭제, 실제 visit ack→sample→same owner read→다음 추천, test data 정리 PASS |
| B. 개인화 제외 | UI/QA/DB | 미확인 | 가입/개인화 UI와 endpoint가 최종 build에서 비활성, 서버 신규 수집0, 공개/스토어 문구 제거 증거 |
| 계정 생성·삭제 E2E | DB/UI/QA | 미확인 | 전용 계정 생성→동의→로그인→소유 기록→앱 내 삭제→Auth/public 0건, 부분 실패·재확인 포함 |
| 최종 provider 범위 | API/UI/QA | 미확인 | proxy flag와 legacy Execution을 최종 Release에서 검사. TMAP/ODsay 가능 시 privacy·계약·표시 반영 |
| 정확 위치·로그·cache | API/QA | 미확인 | Release에서 좌표 원문 console 0, persistent stale coordinate key 0 또는 공개 보유정책, server log/cache 실제 TTL·purge 확인 |
| 사진·지도·경로 권리 | 데이터/UI/법률 | **차단** | 노출 사진별 이용허락·권리자·출처·변경/상업 조건, 화면 가시 출처, Kakao logo/copyright 비가림, route geometry 계약 |
| App Privacy 최종 답변 | 통합/운영 | **차단** | 최종 build 네트워크·SDK·서버 상태와 대응표 일치, Connect preview 검토·게시 |
| 앱 내 공개 링크 | UI/QA | **차단** | 현재 `준비 중`을 실제 privacy/support/terms 링크로 연결하고 오프라인/실패 동작 확인 |
| 앱 표시명·bundle metadata | 사용자/UI/QA | **차단** | TimeFit/다른 이름 결정, main·extension·스토어·icon 일치 |
| iPad 지원 분기 | 사용자/UI/QA | **차단** | 지원 유지+필수 iPad layout/screenshots/smoke 또는 지원 해제+device family artifact 확인 |
| signed final artifact | 출시/QA | **차단** | commit/build ID, main·extension version/build/signing/provisioning, MinimumOSVersion17, public diagnostics off, privacy manifests, Archive validation |
| 최종 실기기 smoke | QA/사용자 | 미확인 | 같은 signed build에서 미회수 항목만: Kakao 설치/미설치 fallback, 권한 거절, 2곳 다음 구간, cold 복귀·완료 cleanup |
| Connect 필수 metadata·자산 | 운영/출시 | **차단** | 이름·부제·설명·키워드·category·연령등급·가격/지역·privacy/support URL·1~10 screenshot·심사 연락처·build |
| 심사 backend·계정 | 운영/QA | 미확인 | 심사 기간 public backend 가용, 필요 시 비만료 전용 계정 정보를 Connect 비밀번호 필드로만 제공 |
| 제출 승인 | 사용자 | 미승인 | 위 P0 0건 확인 후 실제 업로드/제출에 대한 별도 명시 승인 |

## P1 — 출시 전 확인하되 기능 확장 금지

| 항목 | 담당 | 상태·최소 처리 |
| --- | --- | --- |
| 비로그인 로컬 기록 삭제·기간 | 통합/UI/법률 | 전체 삭제 UI가 없고 1,000건 상한만 있음. 공개 고지 수락 또는 최소 삭제 entry를 별도 역할에 반환 |
| Supabase backup·로그 보유와 삭제 반영 | 운영/DB | 실제 plan·region·retention·복원 정책을 기록. ‘계정 삭제 즉시 모든 backup 삭제’ 주장 금지 |
| 지원 응답 운영 | 사용자 | 지원 시간, 목표 답변 기간, 장애 공지 경로 결정 |
| export compliance | 출시 | Connect 질문에 따라 판정하고 최종 답변·필요 문서 기록 |
| App Store 배포 지역·사업자 정보 | 사용자/운영 | 한국 외 국가, EU trader 표기, 가격·세금 category 결정 |

## 이미 준비된 근거

- 공개 초안 3종, 데이터 사실표, App Privacy/스토어/심사 메모 초안 작성 완료.
- 계정 동의·삭제·기록 격리·개인화 코드는 로컬 fixture와 type/UI/core 테스트를 통과했다.
- 학습 자동 게이트 A는 집중 89/89, Swift 1/1, UI 549 pass/기존 skip 1, core 270/270로 인계됐다.
- 위 결과는 원격 migration, signed build, 실제 서버 학습, 공개 URL, App Store 제출을 증명하지 않는다.

## 제출 직전 최소 순서

1. 사용자 사실·법률 분기와 개인화 A/B 확정.
2. 문서 최종화·공개 후 가입 registry와 앱 링크 연결.
3. 운영 서버·RLS·삭제·provider·권리 확인.
4. 최종 signed artifact 생성 및 App Privacy/metadata/screenshots 대조.
5. 동일 artifact의 제한 실기기 smoke와 심사 시나리오 확인.
6. 사용자의 별도 승인 뒤에만 Connect 입력·업로드·제출.

공식 기준: Apple App Review Guidelines(https://developer.apple.com/app-store/review/guidelines/), App Privacy(https://developer.apple.com/app-store/app-privacy-details/), 계정 삭제 안내(https://developer.apple.com/support/offering-account-deletion-in-your-app/), 개인정보보호위원회 2026 처리방침 작성지침(https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885), 개인정보 보호법 제22조의2·제28조의8·제30조 및 위치정보법(https://www.law.go.kr/법령/위치정보의보호및이용등에관한법률). 확인일 2026-09-07.
