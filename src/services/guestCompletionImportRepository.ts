import type { CourseCompletionRecordV1 } from './courseCompletionRepository';
import type { AccountIdentityResolver } from './accountIdentity';
import type { AccountCompletionPlaceV1 } from './accountCourseCompletionRepository';

export type GuestCompletionImportItemV1 = Readonly<{ sourceCompletionId: string; courseRunId: string; completedAtMinute: number; places: readonly AccountCompletionPlaceV1[] }>;
export type PendingGuestCompletionImportV1 = Readonly<{ importId: string; targetSubject: string; state: 'prepared' | 'acknowledged'; items: readonly GuestCompletionImportItemV1[]; acceptedSourceIds: readonly string[]; recovery?: Readonly<{version:1;legacyImportId:string}> }>;
export interface GuestImportStore { readonly serializationKey?:object; read(): Promise<PendingGuestCompletionImportV1 | null>; write(value: PendingGuestCompletionImportV1): Promise<void>; clear(): Promise<void> }

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const legacyPattern=/^import-[1-9][0-9]{12}-[a-z0-9]{1,20}$/;
const text=(x:unknown,max:number)=>typeof x==='string'&&x.length>0&&x.length<=max;
const exactKeys=(x:object,keys:string[])=>Object.keys(x).sort().join(',')===keys.sort().join(',');
function validItems(items:readonly GuestCompletionImportItemV1[]):boolean {
  return Array.isArray(items)&&items.length>0&&items.length<=1000
    &&new Set(items.map(x=>x?.sourceCompletionId)).size===items.length
    &&items.every(x=>!!x&&exactKeys(x,['sourceCompletionId','courseRunId','completedAtMinute','places'])&&text(x.sourceCompletionId,200)&&text(x.courseRunId,200)
      &&Number.isSafeInteger(x.completedAtMinute)&&x.completedAtMinute>0&&Array.isArray(x.places)&&[1,2].includes(x.places.length)
      &&x.places.every((p:AccountCompletionPlaceV1,i:number)=>!!p&&exactKeys(p,['stopOrdinal','contentId','title','category','subCategory'])&&p.stopOrdinal===i+1
        &&text(p.contentId,160)&&text(p.title,240)&&text(p.category,120)&&(p.subCategory===null||text(p.subCategory,120))));
}
/** Read-only classification. Does not create IDs, access storage or contact the server. */
export function isRecoverableLegacyGuestImport(p:PendingGuestCompletionImportV1,subject:string):boolean {
  return !!p&&exactKeys(p,['importId','targetSubject','state','items','acceptedSourceIds'])&&p.targetSubject===subject
    &&legacyPattern.test(p.importId)&&p.state==='prepared'&&Array.isArray(p.acceptedSourceIds)&&p.acceptedSourceIds.length===0&&validItems(p.items);
}
const queues=new WeakMap<object,Promise<unknown>>();
function serialized<T>(key:object,work:()=>Promise<T>):Promise<T>{const prior=queues.get(key)??Promise.resolve();const next=prior.catch(()=>{}).then(work);queues.set(key,next);void next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});return next;}
function matchesRequest(p:PendingGuestCompletionImportV1,id:string){
  return p.importId===id || (!!p.recovery&&p.recovery.version===1&&exactKeys(p.recovery,['version','legacyImportId'])
    &&p.recovery.legacyImportId===id&&legacyPattern.test(id)&&uuidPattern.test(p.importId)&&validItems(p.items));
}

export function createMemoryGuestImportStore(): GuestImportStore {
  let value: PendingGuestCompletionImportV1 | null = null;
  return { async read() { return value; }, async write(next) { value = next; }, async clear() { value = null; } };
}

type RemoteReply = Readonly<{ status: 'acknowledged' | 'already_acknowledged'; importId: string; acceptedSourceIds: readonly string[]; rejectedSourceIds: readonly string[] }>;
type Dependencies = Readonly<{
  identity: AccountIdentityResolver;
  pending: GuestImportStore;
  source: Readonly<{ removeByIds(ids: readonly string[]): Promise<void> }>;
  remote: Readonly<{ import(input: Readonly<{ importId: string; items: readonly GuestCompletionImportItemV1[] }>): Promise<RemoteReply> }>;
  createImportId?: () => string;
}>;

const defaultImportId = () => {
  const value=globalThis.crypto?.randomUUID?.();
  if(!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error('import_uuid_unavailable');
  return value;
};

export function createGuestCompletionImportRepository(deps: Dependencies) {
  const key=deps.pending.serializationKey??deps.pending;
  const sameOwner=async(subject:string)=>{const r=await deps.identity.resolve();return r.status==='account'&&r.identity.subject===subject;};
  const methods={
    async prepareGuestCompletionImport(input: Readonly<{ records: readonly CourseCompletionRecordV1[] }>) {
      if (!Array.isArray(input?.records) || !input.records.length) return { status: 'empty' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const existing = await deps.pending.read();
        if (existing) return existing.targetSubject === identity.identity.subject ? { status: 'prepared' as const, importId: existing.importId } : { status: 'blocked' as const, reason: 'pending_for_other_account' as const };
        const importId = (deps.createImportId ?? defaultImportId)();
        const records: readonly CourseCompletionRecordV1[] = input.records;
        const items = records.map((record) => ({
          sourceCompletionId: record.completionId, courseRunId: record.courseRunId, completedAtMinute: Math.floor(record.completedAt / 60_000),
          places: record.places.map((place, index) => ({ stopOrdinal: (index + 1) as 1 | 2, contentId: place.contentId, title: place.title, category: place.category, subCategory: place.subCategory })),
        }));
        if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
        await deps.pending.write({ importId, targetSubject: identity.identity.subject, state: 'prepared', items, acceptedSourceIds: [] });
        return { status: 'prepared' as const, importId };
      } catch { return { status: 'unavailable' as const }; }
    },
    async importGuestCourseCompletions(input: Readonly<{ importId: string }>) {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        let pending = await deps.pending.read();
        if (!pending || !matchesRequest(pending,input.importId)) return { status: 'invalid_input' as const };
        if (pending.targetSubject !== identity.identity.subject) return { status: 'account_changed' as const };
        if(isRecoverableLegacyGuestImport(pending,identity.identity.subject)){
          const importId=(deps.createImportId??defaultImportId)();if(!uuidPattern.test(importId))return {status:'unavailable' as const};
          const replacement:PendingGuestCompletionImportV1={...pending,importId,recovery:{version:1,legacyImportId:pending.importId}};
          if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
          if(JSON.stringify(await deps.pending.read())!==JSON.stringify(pending))return {status:'unavailable' as const};
          try{await deps.pending.write(replacement);}catch{/* A write may have committed before reporting failure. Read back; never clear or blindly issue another ID. */}
          const confirmed=await deps.pending.read();
          if(JSON.stringify(confirmed)!==JSON.stringify(replacement))return {status:'unavailable' as const};
          pending=confirmed!;
        }
        if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
        if(pending.state==='acknowledged')return {status:'already_acknowledged' as const,importId:pending.importId,acceptedSourceIds:pending.acceptedSourceIds,rejectedSourceIds:pending.items.map(x=>x.sourceCompletionId).filter(x=>!pending!.acceptedSourceIds.includes(x))};
        const reply = await deps.remote.import({ importId: pending.importId, items: pending.items });
        const known = new Set(pending.items.map((item) => item.sourceCompletionId));
        if (reply.importId !== pending.importId || reply.acceptedSourceIds.some((id) => !known.has(id))) return { status: 'unavailable' as const };
        if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
        if(JSON.stringify(await deps.pending.read())!==JSON.stringify(pending))return {status:'unavailable' as const};
        await deps.pending.write({ ...pending, state: 'acknowledged', acceptedSourceIds: [...reply.acceptedSourceIds] });
        return reply;
      } catch { return { status: 'unavailable' as const }; }
    },
    async finalizeGuestCompletionImport(input: Readonly<{ importId: string }>) {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const pending = await deps.pending.read();
        if (!pending || !matchesRequest(pending,input.importId)) return { status: 'cleanup_pending' as const };
        if (pending.targetSubject !== identity.identity.subject) return { status: 'account_changed' as const };
        if (pending.state !== 'acknowledged') return { status: 'cleanup_pending' as const };
        if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
        await deps.source.removeByIds(pending.acceptedSourceIds);
        if(!await sameOwner(identity.identity.subject))return {status:'account_changed' as const};
        if(JSON.stringify(await deps.pending.read())!==JSON.stringify(pending))return {status:'cleanup_pending' as const};
        await deps.pending.clear();
        return { status: 'source_removed' as const };
      } catch { return { status: 'cleanup_pending' as const }; }
    },
  };
  return {
    prepareGuestCompletionImport:(input:Parameters<typeof methods.prepareGuestCompletionImport>[0])=>serialized(key,()=>methods.prepareGuestCompletionImport(input)),
    importGuestCourseCompletions:(input:Parameters<typeof methods.importGuestCourseCompletions>[0])=>serialized(key,()=>methods.importGuestCourseCompletions(input)),
    finalizeGuestCompletionImport:(input:Parameters<typeof methods.finalizeGuestCompletionImport>[0])=>serialized(key,()=>methods.finalizeGuestCompletionImport(input)),
  };
}
