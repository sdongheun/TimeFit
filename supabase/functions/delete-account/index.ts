// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createDeleteAccountHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(createDeleteAccountHandler({
  now: () => Math.floor(Date.now() / 1000),
  async authenticate(token) {
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, isAnonymous: data.user.is_anonymous === true };
  },
  async verifiedClaims(token) {
    const { data, error } = await auth.auth.getClaims(token);
    return error ? null : data?.claims ?? null;
  },
  async claim(userId, requestId) {
    const { data, error } = await admin.rpc('claim_account_deletion', { p_user_id: userId, p_request_id: requestId });
    if (error) throw error;
    return data;
  },
  async deleteStorage() { return true; },
  async deleteAuthUser(userId) { const { error } = await admin.auth.admin.deleteUser(userId); return !error; },
  async countUserRows(userId) {
    const { data, error } = await admin.rpc('count_account_owned_rows', { p_user_id: userId });
    if (error) throw error;
    return Number(data);
  },
}));
