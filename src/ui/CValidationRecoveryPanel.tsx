import {useEffect,useRef,useState} from 'react';
import {Text,TextInput,View,StyleSheet} from 'react-native';
import {useAuth} from './AuthContext';
import {accountSessionFor} from './authStateModel';
import {AnimatedPressable as Pressable} from './AnimatedPressable';
import {C} from './theme';

export const cRecoveryInternalEnabled=()=>process.env.EXPO_PUBLIC_C_VALIDATION_INTERNAL==='true';
type Summary={status:string;phase?:'active'|'pending'|'retired';runClaimed?:boolean;pendingRequests?:number;storedKeyCount?:number};
const failures=new Set(['not_found','owner_changed','account_required','session_expired','corrupt','unavailable']);
function safeSummary(value:unknown):Summary{
  const r=value as Partial<Summary>|null;
  if(r?.status!=='found')return {status:typeof r?.status==='string'&&failures.has(r.status)?r.status:'unavailable'};
  if(!['active','pending','retired'].includes(r.phase??'')||typeof r.runClaimed!=='boolean'||!Number.isSafeInteger(r.pendingRequests)||r.pendingRequests!<0||!Number.isSafeInteger(r.storedKeyCount)||r.storedKeyCount!<0)return {status:'unavailable'};
  return {status:'found',phase:r.pendingRequests!>0?'pending':r.phase,runClaimed:r.runClaimed,pendingRequests:r.pendingRequests,storedKeyCount:r.storedKeyCount};
}

/** Read-only, independent of CValidationPanel/controls: no runner, UUID, prepare, run or retirement. */
export function CValidationRecoveryPanel(){
  const auth=useAuth();
  const owner=useRef<string|null>(null);
  owner.current=auth.authKind==='account'?auth.accountSession?.user.id??null:null;
  const generation=useRef(0),mounted=useRef(false),lock=useRef(false);
  const [executionId,setExecutionId]=useState('');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Summary>({status:'idle'});
  useEffect(()=>{
    if(!cRecoveryInternalEnabled())return;
    mounted.current=true;
    const {supabase}=require('../services/supabase') as typeof import('../services/supabase');
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      const next=event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'?null:accountSessionFor(session,false)?.user.id??null;
      if(next!==owner.current||event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'){
        generation.current++;setResult({status:'owner_changed'});setExecutionId('');
      }
      owner.current=next;
    });
    return()=>{mounted.current=false;generation.current++;data.subscription.unsubscribe();};
  },[]);
  const inspect=async()=>{
    if(!cRecoveryInternalEnabled()||!mounted.current||lock.current)return;
    const expectedOwner=owner.current,id=executionId.trim();
    if(!expectedOwner){setResult({status:'account_required'});return;}
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id)){setResult({status:'invalid_execution_id'});return;}
    lock.current=true;setBusy(true);setResult({status:'reading'});
    const version=generation.current;
    const currentAppOwner=()=>mounted.current&&version===generation.current?owner.current:null;
    try{
      const {inspectAppCValidationExecution}=require('../services/cValidationSupabase') as typeof import('../services/cValidationSupabase');
      const response=await inspectAppCValidationExecution({executionId:id,expectedOwner,currentAppOwner});
      if(currentAppOwner()===expectedOwner)setResult(safeSummary(response));
    }catch{if(currentAppOwner()===expectedOwner)setResult({status:'unavailable'});}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  };
  if(!cRecoveryInternalEnabled())return null;
  return <View testID="c-recovery-panel" style={s.box}>
    <Text style={s.title}>내부 개발 · 이전 C 실행 조회</Text>
    <Text style={s.text}>DB 담당이 보존한 이전 executionId만 로컬로 전달받아 붙여넣으세요. 계정·receipt·전체 JSON은 입력하지 않습니다. 새 실행은 만들지 않습니다.</Text>
    <TextInput testID="c-recovery-id" accessibilityLabel="이전 C executionId" value={executionId} editable={!busy} maxLength={80} autoCorrect={false} autoCapitalize="none" style={s.input} onChangeText={value=>{if(!lock.current){setExecutionId(value);setResult({status:'idle'});}}}/>
    <Pressable testID="c-recovery-inspect" disabled={busy||!owner.current||!executionId.trim()} style={s.button} onPress={()=>void inspect()}><Text style={s.text}>{busy?'조회 중':'이전 C 실행 상태 확인'}</Text></Pressable>
    {!owner.current?<Text style={s.text}>기존 실행과 같은 일반 계정으로 로그인한 상태에서 확인하세요.</Text>:null}
    <Text testID="c-recovery-result" selectable accessibilityLiveRegion="polite" style={s.text}>{JSON.stringify(result)}</Text>
    <Text style={s.text}>조회 시점의 상태만 표시합니다. pending이면 새 실행·삭제 금지, active도 자동 재개하지 않습니다. retired는 C 통과나 관리자 정리 완료가 아닙니다. not_found·corrupt도 미실행으로 판단하지 말고 DB 담당에게 이 상태 요약만 전달하세요.</Text>
  </View>;
}
const s=StyleSheet.create({box:{padding:16,gap:12,borderWidth:1,borderColor:C.line,borderRadius:12},title:{color:C.txt,fontSize:16,fontWeight:'700'},text:{color:C.txt,fontSize:13,lineHeight:19},button:{minHeight:44,padding:12,backgroundColor:C.panel2,borderRadius:12},input:{minHeight:44,color:C.txt,borderWidth:1,borderColor:C.line,padding:10}});
