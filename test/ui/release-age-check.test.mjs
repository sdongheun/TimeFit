import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

const tick = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const documents = ['terms-of-service', 'privacy-policy'].map(documentId => ({ documentId, documentVersion:'1.0', url:`https://fixture.example.test/${documentId}` }));
async function fixture(docs = documents) {
  const calls=[], logins=[], listeners={};
  const runtime=screenRuntime({ './AuthContext':{useAuth:()=>({authKind:'guest',signUp:async input=>{calls.push(input);return false;},signIn:async(...args)=>{logins.push(args);}})}, './CaptchaVerificationSheet':{CaptchaVerificationSheet:'Captcha'}, 'expo-modules-core':{uuid:{v4:()=> 'fixture-request'}}, __process:{env:{EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL:'https://captcha.example.test/'}} });
  const {LoginScreen}=runtime.load('src/ui/LoginScreen.tsx');
  const screen=runtime.mount(LoginScreen,{navigation:{goBack(){},addListener(name,fn){listeners[name]=fn;return()=>{};}},readDocuments:async()=>({status:'ok',documents:docs})});
  runtime.native.Linking.openURL=async()=>{};
  screen.press('login-mode-signup'); screen.render(); await tick();
  const fill=(confirm='fixture-password')=>{screen.get('login-email').props.onChangeText('fixture@example.test');screen.get('login-password').props.onChangeText('fixture-password');screen.get('signup-password-confirm').props.onChangeText(confirm);};
  const consent=async()=>{for(const d of docs){await screen.press(`signup-document-${d.documentId}`);screen.press(`signup-consent-${d.documentId}`);}};
  fill();
  return {screen,calls,logins,listeners,fill,consent};
}
test('AGE missing self-confirmation blocks actual signup handler even with documents accepted',async()=>{
  const f=await fixture();await f.consent();
  await f.screen.get('login-submit').props.onPress();
  assert.equal(f.calls.length,0);assert.equal(f.screen.get('login-submit').props.disabled,true);
  assert.equal(f.screen.get('signup-age-confirm').props.accessibilityState.checked,false);f.screen.unmount();
});
test('AGE explicit selection preserves payload and deselection blocks stale submit',async()=>{
  const f=await fixture();await f.consent();f.screen.press('signup-age-confirm');
  const checkbox=f.screen.get('signup-age-confirm');assert.equal(checkbox.props.accessibilityRole,'checkbox');assert.equal(checkbox.props.accessibilityState.checked,true);
  const stale=f.screen.get('login-submit').props.onPress;
  f.screen.press('signup-age-confirm');await stale();assert.equal(f.calls.length,0);
  f.screen.press('signup-age-confirm');const submit=f.screen.get('login-submit').props.onPress;submit();submit();await tick();
  assert.equal(f.calls.length,0);f.screen.nodes(n=>n.type==='Captcha')[0].props.onVerified('fresh-fixture');await tick();
  assert.equal(f.calls.length,1);assert.deepEqual(Object.keys(f.calls[0]).sort(),['captchaToken','email','password','requestId','requiredConsents']);
  assert.equal(f.calls[0].requiredConsents.privacy.accepted,true);f.screen.unmount();
});
test('AGE selection never bypasses missing documents, missing consent or invalid inputs',async()=>{
  for(const docs of [[],documents]) {
    const f=await fixture(docs);f.screen.press('signup-age-confirm');await f.screen.get('login-submit').props.onPress();assert.equal(f.calls.length,0);
    if(docs.length){await f.consent();f.fill('different');await f.screen.get('login-submit').props.onPress();assert.equal(f.calls.length,0);f.fill();f.screen.get('login-email').props.onChangeText('');await f.screen.get('login-submit').props.onPress();assert.equal(f.calls.length,0);}
    f.screen.unmount();
  }
});
test('AGE resets across modes, blur/focus and fresh mount without affecting login CAPTCHA',async()=>{
  const f=await fixture();f.screen.press('signup-age-confirm');f.screen.press('login-mode-login');
  assert.equal(f.screen.nodes(n=>n.props.testID==='signup-age-confirm').length,0);
  f.screen.get('login-email').props.onChangeText('login@example.test');f.screen.get('login-password').props.onChangeText('login-fixture');f.screen.press('login-submit');
  const captcha=f.screen.nodes(n=>n.type==='Captcha')[0];captcha.props.onVerified('fresh-fixture');await tick();assert.equal(f.logins.length,1);assert.equal(f.calls.length,0);
  f.listeners.blur();f.listeners.focus();f.screen.press('login-mode-signup');await tick();assert.equal(f.screen.get('signup-age-confirm').props.accessibilityState.checked,false);
  f.screen.press('signup-age-confirm');f.listeners.blur();f.listeners.focus();assert.equal(f.screen.get('signup-age-confirm').props.accessibilityState.checked,false);f.screen.unmount();
  const next=await fixture();assert.equal(next.screen.get('signup-age-confirm').props.accessibilityState.checked,false);next.screen.unmount();
});
