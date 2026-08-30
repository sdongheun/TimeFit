# 외부 API Route Proxy·Kakao 활성화

## 범위

`API-4-*`: ODsay 의존을 제거하고 Kakao 서버 secret·Supabase route cache/lease·Cloudflare CAPTCHA를 거치는 Route Proxy를 연결한 워크스트림이다.

## 유지 계약

- 앱 번들에는 Kakao 서버 secret을 두지 않는다.
- provider attempt·mode·방향·카탈로그 버전을 cache/lease/budget 경계로 분리한다.
- non-2xx·transport·provider 실패는 typed receipt로 fail-closed하며, 실제 호출 반복이나 legacy fallback을 만들지 않는다.

## 현재 관계

B12 internal 비교는 API 계약을 바꾸지 않는다. 실기기 RD-B12는 기존 안전 경로를 두 번만 사용한다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
