import test from 'node:test';
import assert from 'node:assert/strict';
import {createCValidationPreparation} from '../src/services/cValidationPreparation';

function fixture(){
 const values=new Map<string,string>();let writes=0,owner='account-a';
 const deps={executionId:'recovery-fixture-01',currentAppOwner:()=>owner,
  auth:{async getSession(){return {data:{session:{access_token:'fixture-secret',expires_at:9999999999}},error:null};},async getUser(){return {data:{user:{id:owner,is_anonymous:false}},error:null};}},
  storage:{async getItem(k:string){return values.get(k)??null;},async setItem(k:string,v:string){writes++;values.set(k,v);},async removeItem(k:string){writes++;values.delete(k);}},createOwnerClient:()=>({})};
 return {deps,values,writes:()=>writes,owner(v:string){owner=v;}};
}
test('C cold recovery: missing is readonly, never creates a fresh execution',async()=>{
 const f=fixture();const r=await createCValidationPreparation(f.deps).inspectExistingExecution({expectedOwner:'account-a'});
 assert.deepEqual(r,{status:'not_found'});assert.equal(f.writes(),0);
});
test('C cold recovery: active/claimed/retired summaries do not expose local payload or mutate',async()=>{
 const f=fixture(),p=createCValidationPreparation(f.deps);await p.prepare({expectedOwner:'account-a'});await p.claimExecution();
 await p.scopedStorage.setItem('private-evidence','private-value');const before=f.writes();
 const cold=createCValidationPreparation(f.deps);const r=await cold.inspectExistingExecution({expectedOwner:'account-a'});
 assert.deepEqual(r,{status:'found',phase:'active',runClaimed:true,pendingRequests:0,storedKeyCount:2});assert.equal(f.writes(),before);
 assert.equal(JSON.stringify(r).includes('private'),false);await p.retire();const retiredWrites=f.writes();
 assert.equal((await cold.inspectExistingExecution({expectedOwner:'account-a'})).phase,'retired');assert.equal(f.writes(),retiredWrites);
});
test('C cold recovery: crash pending remains pending even if retired marker exists',async()=>{
 const f=fixture(),p=createCValidationPreparation(f.deps);await p.prepare({expectedOwner:'account-a'});
 const key=[...f.values.keys()][0],state=JSON.parse(f.values.get(key)!);f.values.set(key,JSON.stringify({...state,retired:true,pending:1}));
 const before=f.writes();assert.equal((await p.inspectExistingExecution({expectedOwner:'account-a'})).phase,'pending');assert.equal(f.writes(),before);
});
test('C cold recovery: owner mismatch/corrupt/unavailable fail closed without repair',async()=>{
 const f=fixture(),p=createCValidationPreparation(f.deps);await p.prepare({expectedOwner:'account-a'});const before=f.writes();
 f.owner('account-b');assert.equal((await p.inspectExistingExecution({expectedOwner:'account-b'})).status,'owner_changed');
 f.owner('account-a');const key=[...f.values.keys()][0];f.values.set(key,'{bad');assert.equal((await p.inspectExistingExecution({expectedOwner:'account-a'})).status,'corrupt');
 f.deps.storage.getItem=async()=>{throw Error('disk');};assert.equal((await p.inspectExistingExecution({expectedOwner:'account-a'})).status,'unavailable');assert.equal(f.writes(),before);
});
