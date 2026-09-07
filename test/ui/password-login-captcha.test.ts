import test from 'node:test';
import assert from 'node:assert/strict';
import { signInWithFreshCaptcha, safePasswordLoginFailure } from '../../src/ui/passwordLoginModel';

test('password login passes a fresh captcha only in SDK options and refuses missing tokens', async () => {
  let calls=0;
  await signInWithFreshCaptcha(async input=>{calls++;assert.deepEqual(input,{email:'fixture@example.test',password:'fixture-password',options:{captchaToken:'fresh-fixture'}});return {error:null};},' fixture@example.test ','fixture-password','fresh-fixture');
  await assert.rejects(()=>signInWithFreshCaptcha(async()=>{calls++;return {error:null};},'fixture@example.test','fixture-password',''));
  assert.equal(calls,1);
});
test('safe login errors preserve allowlisted code/status without raw account/password/token text', () => {
  for(const [code,status,kind] of [['captcha_failed',400,'captcha'],['invalid_credentials',400,'input'],['email_not_confirmed',400,'email_confirmation'],['unexpected_failure',500,'server'],['over_request_rate_limit',429,'rate_limit']] as const){
    const error=safePasswordLoginFailure({code,status,message:'sensitive-fixture',body:'sensitive-fixture'},true);
    assert.equal(error.kind,kind);assert.equal(error.code,code);assert.equal(error.status,status);
    assert.doesNotMatch(JSON.stringify(error),/sensitive-fixture/);
  }
  assert.equal(safePasswordLoginFailure({name:'AuthRetryableFetchError',status:0},true).kind,'network');
  assert.equal(safePasswordLoginFailure({code:'sensitive-fixture',status:400},true).code,'unrecognized');
});
