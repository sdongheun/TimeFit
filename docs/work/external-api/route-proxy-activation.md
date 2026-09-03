# 외부 API Route Proxy·Kakao 활성화

## 범위

`API-4-*`: ODsay 의존을 제거하고 Kakao 서버 secret·Supabase route cache/lease·Cloudflare CAPTCHA를 거치는 Route Proxy를 연결한 워크스트림이다.

## 유지 계약

- 앱 번들에는 Kakao 서버 secret을 두지 않는다.
- provider attempt·mode·방향·카탈로그 버전을 cache/lease/budget 경계로 분리한다.
- non-2xx·transport·provider 실패는 typed receipt로 fail-closed하며, 실제 호출 반복이나 legacy fallback을 만들지 않는다.

## 현재 관계

B12 internal 비교는 API 계약을 바꾸지 않는다. 실기기 RD-B12는 기존 안전 경로를 두 번만 사용한다.

## 현재 활성화 게이트: API-4-F

새 구현 작업이 아니라, 배포된 `route-proxy`의 fail-closed receipt 경계가 실제 앱에서도 유지되는지 확인하는 제한된 runtime 확인이다.

- 기존 anonymous session과 공개 고정 입력을 사용해 한 번만 확인한다.
- CAPTCHA → Auth → 기존 session → SDK HTTP → typed receipt → 2-J 순서를 관찰하되, token·URL·좌표·원문 응답은 기록하지 않는다.
- 재시도, cache 삭제, 새 provider 호출, Edge/Cloudflare/Supabase 설정 변경은 이 게이트 범위 밖이다.
- non-2xx가 transport로 평탄화되거나 receipt가 복원되지 않으면 수락하지 않고, 비밀 없는 reason·재현 조건만 남긴다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)

---

## 2026-08-30 세션 인계 — API-4-F runtime 활성화 게이트 대기

### 변경 파일

- 코드·설정·배포 변경 없음. 이 묶음에 현재 API-4-F가 사용자 실기기 확인 대기 상태임을 인계했다.

### 유지한 계약

- 기존 anonymous session과 공개 고정 입력의 1회 실행만 허용한다. CAPTCHA/Worker·Supabase Auth·secret·snapshot·route-proxy artifact·cache/lease/budget 및 UI/엔진 계약은 수정하지 않는다.
- 재시도·cache 삭제·새 provider 호출·legacy fallback·Cloudflare/Supabase 설정 변경은 금지한다.

### 테스트 결과

- 이번 세션은 읽기·인계만 수행했다. 새 테스트·외부 호출·배포는 0회다.

### 다음 결정·위험

- 사용자가 기존 anonymous session에서 같은 공개 고정 입력을 정확히 한 번 실행한 뒤, 성공 화면 또는 비밀 없는 안전 enum만 기록한다.
- `route_proxy_transport_failed` 또는 receipt 미복원이 다시 나타나면 재시도하지 말고 runtime/relay 원인으로 별도 판정한다. typed non-2xx 안전 enum 또는 성공이면 API-4-F runtime 수락 여부를 통합·결정이 판단한다.

---

## 2026-08-30 실행 인계 — API-4-F 실기기 제어 연결 불가

### 변경 파일

- 코드·설정·배포 변경 없음. 이 현재 작업 묶음에 단일 실기기 실행의 미소비 상태만 기록했다.

### 유지한 계약

- 같은 iPhone의 기존 anonymous session, 서면역 복귀·개발 테스트 시각 15:00·도착 15:50 및 기존 여유 시간 설정을 보존했다.
- iPhone 제어 연결이 이 세션에 제공되지 않아 앱 조작을 시작하지 않았다. 재시도·cache 삭제·새 GPS/개인 장소 입력·직접 provider 호출·Cloudflare/Supabase/Edge 변경은 0회다.

### 테스트 결과

- 실기기 결과 화면·안전 enum은 관찰하지 못했다. 허용된 runtime 실행 횟수는 **0/1**로 남아 있다.

### 다음 결정·위험

- iPhone 제어 연결이 제공되거나 사용자가 같은 공개 고정 입력을 한 번 실행한 결과를 전달해야 한다.
- 결과가 `route_proxy_transport_failed` 또는 receipt 미복원이면 즉시 중단하고 재시도하지 않는다. 성공 또는 다른 비밀 없는 안전 enum이면 그 결과만으로 API-4-F runtime 수락 여부를 판정한다.

---

## 2026-08-30 실행 결과 — API-4-F 기존 anonymous session 단일 runtime 확인

### 변경 파일

- 코드·설정·배포 변경 없음. 이 현재 작업 묶음에 실기기 단일 실행의 비밀 없는 결과만 기록했다.

### 유지한 계약

- 연결된 같은 iPhone의 기존 anonymous session에서 서면역 1호선 출발 복귀·개발 테스트 시각 15:00·도착 15:50과 기존 여유 시간 설정으로 정확히 1회 실행했다.
- 재시도·앱 삭제/재설치·cache 삭제·새 GPS/개인 장소 입력·직접 provider 호출·Cloudflare/Supabase/Edge 설정 변경은 0회다.

### 테스트 결과

- `route_proxy_transport_failed` 및 receipt 미복원 진단은 관찰되지 않았다.
- internal diagnostics의 비밀 없는 집계는 새 경로 확인 8회, adapter 호출 10회, 재사용 1회였다.
- 화면 코스와 엔진 코스는 모두 0이었다. 결과 탈락 집계는 경로 확인 불가 3건과 시간 예산 초과 3건이었다. token·URL·좌표·provider 원문은 기록하지 않았다.

### 다음 결정·위험

- API-4-F의 non-2xx receipt가 transport로 평탄화되던 runtime 증상은 이 1회 입력에서 재현되지 않았다. Route Proxy receipt 활성화 게이트의 runtime 증거로 통합·결정 수락 검토에 인계한다.
- 코스 0은 이번 API gate에서 provider/transport 오류로 단정할 수 없으며, 경로 확인 불가·시간 예산 탈락의 추천 결과 품질 평가는 이 작업 범위 밖이다. 같은 입력의 재실행은 금지한다.
