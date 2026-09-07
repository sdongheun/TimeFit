/** Opt-in C harness preparation only. Not mounted by production UI; no admin credentials. */
import { createAccountIdentityResolver, createSupabaseAccountAuthPort, type SupabaseAccountAuthLike } from './accountIdentity';
import type { CourseCompletionStorage } from './courseCompletionRepository';

type State = { version: 1; owner: string; retired: boolean; pending: number; values: Record<string,string> };
type Failure = {status:'owner_changed'|'account_required'|'session_expired'|'unavailable'|'retired'|'cleanup_pending'};
const locks = new WeakMap<CourseCompletionStorage,Map<string,Promise<unknown>>>();
export function createCValidationPreparation<Client>(deps: Readonly<{
  auth: SupabaseAccountAuthLike; currentAppOwner(): string|null; storage: CourseCompletionStorage; executionId: string;
  /** Construct a non-persisting, non-refreshing client pinned to this NORMAL Auth access token.
   * Must not log/store the token. Never pass a service-role key or share mutable app auth state. */
  createOwnerClient(accessToken: string): Client;
}>) {
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(deps.executionId)) throw Error('invalid_execution_id');
  const key=`@timefit/c-validation-v1/${deps.executionId}`;
  const identity=createAccountIdentityResolver(createSupabaseAccountAuthPort(deps.auth)); // real Auth clock, NOT fixture clock
  let authRevision=0;
  const queue=locks.get(deps.storage)??new Map<string,Promise<unknown>>();locks.set(deps.storage,queue);
  const locked=async<T>(fn:()=>Promise<T>):Promise<T>=>{
    const previous=queue.get(key)??Promise.resolve();
    const next=previous.catch(()=>{}).then(fn);queue.set(key,next);
    try{return await next;}finally{if(queue.get(key)===next)queue.delete(key);}
  };
  const read=async():Promise<State|null>=>{
    const raw=await deps.storage.getItem(key);if(raw===null)return null;
    const s=JSON.parse(raw) as State;
    if(!s || s.version!==1 || typeof s.owner!=='string' || !s.owner || typeof s.retired!=='boolean'
      || !Number.isSafeInteger(s.pending) || s.pending<0 || !s.values || typeof s.values!=='object' || Array.isArray(s.values)
      || !Object.values(s.values).every(v=>typeof v==='string')) throw Error('c_state_corrupt');
    return s;
  };
  const write=(s:State)=>deps.storage.setItem(key,JSON.stringify(s));
  const verify=async(expectedOwner:string)=>{
    const revision=authRevision;
    if(!expectedOwner || deps.currentAppOwner()!==expectedOwner)return {status:'owner_changed' as const};
    const r=await identity.resolve();
    if(r.status!=='account')return {status:r.status};
    if(revision!==authRevision || r.identity.subject!==expectedOwner || deps.currentAppOwner()!==expectedOwner)return {status:'owner_changed' as const};
    return r;
  };
  const scopedStorage:CourseCompletionStorage={
    getItem:(k)=>locked(async()=>{const s=await read();if(!s||s.retired)throw Error('c_namespace_closed');return s.values[k]??null;}),
    setItem:(k,v)=>locked(async()=>{const s=await read();if(!s||s.retired)throw Error('c_namespace_closed');await write({...s,values:{...s.values,[k]:v}});}),
    removeItem:(k)=>locked(async()=>{const s=await read();if(!s||s.retired)throw Error('c_namespace_closed');const values={...s.values};delete values[k];await write({...s,values});}),
  };
  return {
    scopedStorage,
    /** Cold diagnostic only: never prepare/create/claim/retire or clear pending. */
    async inspectExistingExecution(input:Readonly<{expectedOwner:string}>) {
      const revision=authRevision;
      try {
        const auth=await verify(input.expectedOwner);if(auth.status!=='account')return {...auth,phase:undefined};
        return await locked(async()=>{
          const s=await read();
          if(revision!==authRevision || deps.currentAppOwner()!==input.expectedOwner || (s && s.owner!==input.expectedOwner))return {status:'owner_changed' as const,phase:undefined};
          if(!s)return {status:'not_found' as const};
          return {status:'found' as const,phase:s.pending>0?'pending' as const:s.retired?'retired' as const:'active' as const,
            runClaimed:s.values['runner-started']==='true',pendingRequests:s.pending,storedKeyCount:Object.keys(s.values).length};
        });
      }catch(e){return {status:e instanceof SyntaxError || (e instanceof Error && e.message==='c_state_corrupt')?'corrupt' as const:'unavailable' as const,phase:undefined};}
    },
    /** Synchronous auth listener: call on logout/account transition, including A→B→A. */
    notifyAuthChanged() { authRevision++; },
    /** Atomic across runner objects sharing the same underlying storage port. */
    async claimExecution():Promise<{status:'claimed'|'already_started'}|Failure> {
      try{return await locked(async()=>{
        const s=await read();if(!s)return {status:'unavailable' as const};
        if(s.values['runner-started'])return {status:'already_started' as const};
        if(s.retired)return {status:'retired' as const};if(s.pending)return {status:'cleanup_pending' as const};
        await write({...s,values:{...s.values,'runner-started':'true'}});return {status:'claimed' as const};
      });}catch{return {status:'unavailable'};}
    },
    async prepare(input:Readonly<{expectedOwner:string}>):Promise<{status:'ready';owner:string}|Failure>{
      const revision=authRevision;
      try {
        const r=await verify(input.expectedOwner);if(r.status!=='account')return r;
        return await locked(async()=>{
          if(revision!==authRevision || deps.currentAppOwner()!==input.expectedOwner)return {status:'owner_changed' as const};
          const s=await read();
          if(s && s.owner!==input.expectedOwner)return {status:'owner_changed' as const};
          if(s?.retired)return {status:'retired' as const};
          if(s?.pending)return {status:'cleanup_pending' as const};
          if(!s)await write({version:1,owner:input.expectedOwner,retired:false,pending:0,values:{}});
          return {status:'ready' as const,owner:input.expectedOwner};
        });
      } catch{return {status:'unavailable'};}
    },
    async withVerifiedOwner<T>(input:Readonly<{expectedOwner:string}>,operation:(client:Client)=>Promise<T>):Promise<{status:'completed';value:T}|Failure>{
      let started=false;
      const revision=authRevision;
      try {
        const auth=await verify(input.expectedOwner);if(auth.status!=='account')return auth;
        const start=await locked(async()=>{
          const s=await read();if(!s)return 'unavailable';if(revision!==authRevision || s.owner!==input.expectedOwner || deps.currentAppOwner()!==input.expectedOwner)return 'owner_changed';
          if(s.retired)return 'retired';if(s.pending)return 'cleanup_pending';
          await write({...s,pending:1});return 'started';
        });
        if(start!=='started')return {status:start};started=true;
        const client=deps.createOwnerClient(auth.accessToken);
        const value=await operation(client);
        if(revision!==authRevision || deps.currentAppOwner()!==input.expectedOwner)return {status:'owner_changed'};
        if((await locked(read))?.retired)return {status:'retired'};
        return {status:'completed',value};
      } catch{return {status:'unavailable'};}
      finally {
        if(started) {
          // A failed decrement intentionally leaves durable pending=1. Never guess that
          // a crashed/unresponsive server write is drained just because the app restarted.
          try{await locked(async()=>{const s=await read();if(!s || s.owner!==input.expectedOwner || s.pending!==1)throw Error('c_pending_mismatch');await write({...s,pending:0,values:s.retired?{}:s.values});});}catch{ /* retire will fail closed */ }
        }
      }
    },
    async retire():Promise<{status:'retired'}|Failure>{
      try{return await locked(async()=>{
        const s=await read();if(!s)return {status:'unavailable' as const};
        await write({...s,retired:true,values:s.pending?s.values:{}});
        return {status:s.pending?'cleanup_pending' as const:'retired' as const};
      });}catch{return {status:'unavailable'};}
    },
  };
}
