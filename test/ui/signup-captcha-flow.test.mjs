import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const docs=['terms-of-service','privacy-policy'].map(documentId=>({documentId,documentVersion:'1.0',url:'https://fixture.example.test/doc'}));
async function fixture({ready=false, failure=false, delayDocs=false}={}) {
  let authKind='anonymous', backs=0, reads=0, release;
  const calls=[],alerts=[],listeners={};
  const host=screenRuntime({'./AuthContext':{useAuth:()=>({authKind,signUp:async input=>{calls.push(input);if(failure)throw {status:'rejected',reason:'signup_unavailable',failure:{code:'captcha_failed',httpStatus:400,stage:'auth'}};return ready;}})},'./CaptchaVerificationSheet':{CaptchaVerificationSheet:'Captcha'},'expo-modules-core':{uuid:{v4:()=> 'fixture-request'}},__process:{env:{EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL:'https://captcha.example.test/'}}});
  host.native.Linking.openURL=async()=>{};host.native.Alert.alert=(...args)=>alerts.push(args);
  const screen=host.mount(host.load('src/ui/LoginScreen.tsx').LoginScreen,{navigation:{goBack(){backs++;},addListener(name,fn){listeners[name]=fn;return()=>{};}},readDocuments:async()=>{reads++;if(delayDocs&&reads>1)await new Promise(r=>release=r);return {status:'ok',documents:docs};}});
  screen.press('login-mode-signup');screen.render();await tick();
  screen.get('login-email').props.onChangeText('fixture@example.test');screen.get('login-password').props.onChangeText('fixture-password');screen.get('signup-password-confirm').props.onChangeText('fixture-password');
  for(const d of docs){await screen.press(`signup-document-${d.documentId}`);screen.press(`signup-consent-${d.documentId}`);}screen.press('signup-age-confirm');
  return {screen,calls,alerts,listeners,captcha:()=>screen.nodes(n=>n.type==='Captcha')[0],account(){authKind='account';screen.render();},backs:()=>backs,release:()=>release?.()};
}
for(const ready of [false,true])test(`signup fresh token once and distinct session readiness ${ready}`,async()=>{
  const f=await fixture({ready});const submit=f.screen.get('login-submit').props.onPress;submit();submit();assert.equal(f.calls.length,0);
  const callbacks=f.captcha().props;assert.equal(callbacks.purpose,'signup');callbacks.onVerified('fresh-fixture');callbacks.onVerified('duplicate-fixture');callbacks.onClose();await tick();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].captchaToken,'fresh-fixture');assert.equal(f.calls[0].requiredConsents.terms.accepted,true);
  assert.equal(f.backs(),0);assert.equal(f.alerts.length,ready?0:1);assert.equal(f.screen.get('login-password').props.value,'');
  if(ready){f.account();f.account();assert.equal(f.backs(),1);}else assert.equal(f.alerts[0][0],'이메일 확인');f.screen.unmount();
});
for(const exit of ['cancel','blur','unmount'])test(`signup ${exit} discards late callback`,async()=>{
  const f=await fixture();f.screen.press('login-submit');const old=f.captcha().props;
  if(exit==='cancel')old.onClose();else if(exit==='blur')f.listeners.blur();else f.screen.unmount();
  old.onVerified('late-fixture');await tick();assert.equal(f.calls.length,0);if(exit!=='unmount')f.screen.unmount();
});
test('signup API expiry/failure requires new challenge and never reuses old callback',async()=>{
  const f=await fixture({failure:true});f.screen.press('login-submit');const old=f.captcha().props;old.onVerified('expired-fixture');await tick();
  assert.match(f.screen.get('auth-form-error').props.children,/안전 확인/);assert.equal(f.calls.length,1);assert.equal(f.captcha(),undefined);
  f.screen.press('login-submit');old.onVerified('old-fixture');assert.equal(f.calls.length,1);f.captcha().props.onVerified('new-fixture');await tick();
  assert.deepEqual(f.calls.map(c=>c.captchaToken),['expired-fixture','new-fixture']);f.screen.unmount();
});
test('signup navigation during final document read prevents auth request',async()=>{
  const f=await fixture({delayDocs:true});f.screen.press('login-submit');f.captcha().props.onVerified('fresh-fixture');f.listeners.blur();f.release();await tick();assert.equal(f.calls.length,0);f.screen.unmount();
});
test('signup actual sheet failure/expiry → explicit fresh WebView retry → one screen signup',async()=>{
  const f=await fixture();f.screen.press('login-submit');
  const runtime=screenRuntime({'react-native-webview':{WebView:'WebView'}});
  const sheet=runtime.mount(runtime.load('src/ui/CaptchaVerificationSheet.tsx').CaptchaVerificationSheet,f.captcha().props);
  const message=(type,token)=>({nativeEvent:{url:'https://captcha.example.test/',data:JSON.stringify({type,token})}});
  const old=sheet.get('captcha-webview').props;old.onMessage(message('error'));old.onMessage(message('token','expired-fixture'));await tick();assert.equal(f.calls.length,0);
  sheet.press('captcha-retry');old.onMessage(message('token','stale-fixture'));assert.equal(f.calls.length,0);
  const fresh=sheet.get('captcha-webview').props;fresh.onMessage(message('token','new-fixture'));fresh.onMessage(message('token','duplicate-fixture'));await tick();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].captchaToken,'new-fixture');sheet.unmount();f.screen.unmount();
});
test('production AuthProvider consumes accepted repository success and nested safe failures',async()=>{
  const calls=[];let result={status:'email_confirmation_pending'};
  const runtime=screenRuntime({
    '../services/supabase':{supabase:{auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}},
    '../services/releaseIdentitySupabase':{supabaseAccountRegistrationRepository:{signUpAccount:async input=>{calls.push(input);return result;}}},
    './personalizationComposition':{personalizationSession:{setAccount(){}}},
    './liveActivity/learningEvidenceComposition':{liveLearningEvidence:{clearInvalidatedNative:async()=>{}}},
  });
  Object.assign(runtime.react,{createContext:()=>({Provider:'AuthProviderValue'})});
  Object.assign(runtime.native.Linking,{getInitialURL:async()=>null,addEventListener:()=>({remove(){}})});
  const screen=runtime.mount(runtime.load('src/ui/AuthContext.tsx').AuthProvider,{});await tick();
  const auth=screen.nodes(n=>n.type==='AuthProviderValue')[0].props.value;
  const input={captchaToken:'fresh-fixture'};
  assert.equal(await auth.signUp(input),false);result={status:'account_session_ready'};assert.equal(await auth.signUp(input),true);
  result={status:'rejected',reason:'signup_unavailable',failure:{code:'captcha_failed',httpStatus:400,stage:'auth',message:'private-fixture'}};
  await assert.rejects(()=>auth.signUp(input),e=>e.code==='captcha_failed'&&e.status===400&&e.stage==='auth'&&!JSON.stringify(e).includes('private-fixture'));
  assert.equal(calls.length,3);assert.equal(calls[0],input);screen.unmount();
});
