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
