// @ts-nocheck
// Scheduler-only cleanup; returns aggregate counts and never logs or returns account identifiers.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const env = (name: string) => Deno.env.get(name) ?? '';

Deno.serve(async (request) => {
  if (request.method !== 'POST' || request.headers.get('x-cleanup-scheduler-secret') !== env('ANONYMOUS_AUTH_CLEANUP_SCHEDULER_SECRET') || !env('ANONYMOUS_AUTH_CLEANUP_SCHEDULER_SECRET')) return reply({ status: 'rejected' }, 401);
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply({ status: 'store_unavailable' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const date = new Date().toISOString().slice(0, 10); const inactiveBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const count = { candidate: 0, deleted: 0, skipped: 0, failed: 0 };
  try {
    const { data: claimed, error: claimError } = await db.rpc('claim_anonymous_auth_cleanup_run', { p_run_date: date });
    if (claimError) throw claimError;
    const run = claimed?.[0]; if (run?.state !== 'claimed' || !run.run_token) return reply({ status: 'already_claimed', counts: count });
    const audit = async (outcome: string, reason: string, value: number) => { if (value) await db.rpc('record_anonymous_auth_cleanup_audit', { p_run_date: date, p_run_token: run.run_token, p_outcome: outcome, p_reason_code: reason, p_count: value }); };
    const { data: candidates, error: listError } = await db.rpc('list_anonymous_auth_cleanup_candidates', { p_run_date: date, p_run_token: run.run_token, p_inactive_before: inactiveBefore, p_limit: 100 });
    if (listError) { await audit('failed', 'candidate_query_failed', 1); throw listError; }
    count.candidate = candidates?.length ?? 0; await audit('candidate', 'eligible', count.candidate);
    for (const candidate of candidates ?? []) {
      const { data: eligible } = await db.rpc('recheck_anonymous_auth_cleanup_candidate', { p_run_date: date, p_run_token: run.run_token, p_user_id: candidate.user_id, p_inactive_before: inactiveBefore });
      if (!eligible) { count.skipped += 1; continue; }
      const { error } = await db.auth.admin.deleteUser(candidate.user_id);
      if (error) count.failed += 1; else count.deleted += 1;
    }
    await audit('skipped', 'identity_changed', count.skipped); await audit('deleted', 'eligible', count.deleted); await audit('failed', 'admin_delete_failed', count.failed);
    await db.rpc('complete_anonymous_auth_cleanup_run', { p_run_date: date, p_run_token: run.run_token });
    return reply({ status: 'completed', counts: count });
  } catch { return reply({ status: 'store_unavailable', counts: count }, 503); }
});
