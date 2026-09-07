import AsyncStorage from '@react-native-async-storage/async-storage';
import {uuid} from 'expo-modules-core';
import {supabase} from './supabase';
import {createCValidationRunner} from './cValidationRunner';
import {createCValidationPreparation} from './cValidationPreparation';

// Import is inert: no baseline, Auth request, or C write until UI explicitly invokes prepare/run.
const storage={getItem:(k:string)=>AsyncStorage.getItem(k),setItem:(k:string,v:string)=>AsyncStorage.setItem(k,v),removeItem:(k:string)=>AsyncStorage.removeItem(k)};
/** Exact old execution ID only; no new runner, namespace, RPC, or admin action. */
export async function inspectAppCValidationExecution(input:Readonly<{executionId:string;expectedOwner:string;currentAppOwner():string|null}>) {
  try {
    const recovery=createCValidationPreparation({...input,auth:supabase.auth,storage,createOwnerClient:()=>{throw Error('recovery_has_no_remote_write_client');}});
    return await recovery.inspectExistingExecution({expectedOwner:input.expectedOwner});
  }catch{return {status:'unavailable' as const};}
}
export function createAppCValidationRunner(input:Readonly<{executionId:string;currentAppOwner():string|null}>) {
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL,publicKey=process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if(!url || !publicKey)throw Error('c_configuration_missing');
  return createCValidationRunner({...input,url,publicKey,auth:supabase.auth,storage,createToken:()=>uuid.v4()});
}
