# UIUX CAPTCHA·Route Proxy

## 범위

`U-1-CAP-*`: Turnstile WebView, anonymous session, Proxy 오류를 일반 사용자 문구와 internal 진단으로 분리한 워크스트림이다.

## 유지 계약

- token은 화면 state·로그·저장에 남기지 않는다.
- exact challenge URL과 Cloudflare/about 보조 frame만 허용하며 실패는 typed fail-closed다.
- CAPTCHA/Proxy 세부 reason은 internal diagnostics에서만 보이고, legacy fallback으로 우회하지 않는다.

## 상세 이력

[2026-08 archive](archive/2026-08-history.md)
