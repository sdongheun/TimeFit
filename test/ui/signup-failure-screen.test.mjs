import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
for(const [code,copy] of [['weak_password','비밀번호가 보안 조건'],['over_email_send_rate_limit','인증 메일 요청'],['document_version_stale','가입 문서가 변경'],['signup_unavailable','지금은 가입']])test(`SIGNUP actual screen ${code} safe retry`,async()=>{
  let calls=0,backs=0;
  const host=screenRuntime({'./AuthContext':{useAuth:()=>({authKind:'guest',signUp:async()=>{calls++;throw {code,status:422,message:'private-original-fixture'};}})},'./CaptchaVerificationSheet':{CaptchaVerificationSheet:'Captcha'},'expo-modules-core':{uuid:{v4:()=> 'fixture-request'}}});
  host.native.Linking.openURL=async()=>{};
  const docs=['terms-of-service','privacy-policy'].map(documentId=>({documentId,documentVersion:'1.0',url:`https://fixture.example.test/${documentId}`}));
  const screen=host.mount(host.load('src/ui/LoginScreen.tsx').LoginScreen,{navigation:{goBack(){backs++;},addListener:()=>()=>{}},readDocuments:async()=>({status:'ok',documents:docs})});
  screen.press('login-mode-signup');screen.render();await tick();
  screen.get('login-email').props.onChangeText('fixture@example.test');screen.get('login-password').props.onChangeText('fixture-password');screen.get('signup-password-confirm').props.onChangeText('fixture-password');
  for(const d of docs){await screen.press(`signup-document-${d.documentId}`);screen.press(`signup-consent-${d.documentId}`);}
  screen.press('signup-age-confirm');await screen.press('login-submit');await tick();
  assert.equal(calls,0,'signup must wait for fresh CAPTCHA');
  const challenge=screen.nodes(n=>n.type==='Captcha')[0];
  challenge.props.onVerified('fresh-fixture');challenge.props.onVerified('duplicate-fixture');await tick();
  assert.equal(calls,1);assert.equal(backs,0);
  const text=screen.nodes(n=>n.type==='Text').map(n=>String(n.props.children)).join(' ');
  assert.ok(text.includes(copy));assert.ok(!text.includes('private-original-fixture'));
  if(code==='document_version_stale'){screen.render();await tick();assert.equal(screen.get('login-submit').props.disabled,true);}
  else {await screen.press('login-submit');screen.nodes(n=>n.type==='Captcha')[0].props.onVerified('retry-fixture');await tick();assert.equal(calls,2);}
  screen.unmount();
});
