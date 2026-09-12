import test from 'node:test';
import assert from 'node:assert/strict';
import { safeSignupFailure, signupFailureMessage } from '../../src/ui/signupFailureModel';

test('signup failures preserve only allowlisted code/status, never raw credentials or messages', () => {
  for (const [code,kind] of [['captcha_failed','captcha'],['weak_password','password'],['over_email_send_rate_limit','mail_limit'],['document_version_stale','consent'],['unexpected_failure','server']] as const) {
    const failure = safeSignupFailure({code,status:422,message:'private-fixture',email:'private-fixture',token:'private-fixture'});
    assert.equal(failure.kind,kind);assert.equal(failure.code,code);assert.equal(failure.status,422);
    assert.doesNotMatch(JSON.stringify(failure),/private-fixture/);assert.ok(signupFailureMessage(failure));
  }
});
test('collapsed signup_unavailable does not pretend to identify CAPTCHA or DB cause', () => {
  const failure=safeSignupFailure({status:'rejected',reason:'signup_unavailable'});
  assert.equal(failure.kind,'unavailable');assert.equal(failure.status,null);
  assert.equal(safeSignupFailure({code:'sensitive-unknown',status:900}).code,'unrecognized');
  assert.equal(safeSignupFailure({status:'retryable_failure'}).kind,'retryable');
});
test('accepted repository nested failure wins over compatibility reason and preserves safe stage',()=>{
  for(const stage of ['registry','auth'] as const){
    const failure=safeSignupFailure({status:'rejected',reason:'signup_unavailable',failure:{code:'captcha_failed',httpStatus:400,stage,message:'private-fixture'}});
    assert.equal(failure.code,'captcha_failed');assert.equal(failure.status,400);assert.equal(failure.stage,stage);assert.equal(failure.kind,'captcha');assert.doesNotMatch(JSON.stringify(failure),/private-fixture/);
  }
});
