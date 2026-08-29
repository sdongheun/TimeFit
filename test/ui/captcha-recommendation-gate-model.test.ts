import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteProxyUnavailableError } from '../../src/services/routeProxyActivatedCourseAdapter';
import { recommendationFailureDisplay, recommendationFailureMessage, recommendationGateDecision } from '../../src/ui/captchaRecommendationGateModel';

test('UCAP03-01/02: legacy는 flag false에서만, proxy는 기존 session에서만 CAPTCHA 없이 시작한다', () => {
  assert.deepEqual(recommendationGateDecision({ routeProxyEnabled: false, hasSession: false, hasValidChallengeUrl: false }), { kind: 'start_legacy' });
  assert.deepEqual(recommendationGateDecision({ routeProxyEnabled: true, hasSession: true, hasValidChallengeUrl: false }), { kind: 'start_proxy' });
});

test('UCAP03-03/04: proxy의 첫 요청은 valid Worker URL에서만 CAPTCHA를 열며, 비정상 설정은 시작하지 않는다', () => {
  assert.deepEqual(recommendationGateDecision({ routeProxyEnabled: true, hasSession: false, hasValidChallengeUrl: true }), { kind: 'show_captcha' });
  assert.deepEqual(recommendationGateDecision({ routeProxyEnabled: true, hasSession: false, hasValidChallengeUrl: false }), { kind: 'fail_missing_challenge' });
});

test('UCAP03-05: proxy typed unavailable은 legacy fallback 대신 재시도 가능한 안전 확인 오류로 표시한다', () => {
  assert.equal(recommendationFailureMessage(new RouteProxyUnavailableError()), '안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.');
  assert.match(recommendationFailureMessage(new Error('fixture')), /fixture/);
});

test('UCAP-09: internal diagnostics만 typed Proxy reason을 보이고 일반 오류의 detail은 표시하지 않는다', () => {
  const typed = new RouteProxyUnavailableError('anonymous_auth_failed');
  assert.deepEqual(recommendationFailureDisplay(typed, true), { message: '안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.', diagnostic: 'anonymous_auth_failed' });
  assert.deepEqual(recommendationFailureDisplay(typed, false), { message: '안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.', diagnostic: null });
  assert.equal(recommendationFailureDisplay(new Error('do-not-display'), true).diagnostic, null);
});
