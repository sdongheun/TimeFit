// @ts-nocheck Deno Edge entrypoint; contract logic is tested in Node through handler.ts.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLiveProviderBudgetPort } from '../_shared/liveProviderBudget.ts';
import { createTourApiLiveHandler } from './handler.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const budget = createLiveProviderBudgetPort({ rpc: (name, args) => supabase.rpc(name, args) });
const handler = createTourApiLiveHandler({
  fetch,
  serviceKey: Deno.env.get('TOURAPI_KEY') ?? '',
  reserveProviderAttempt: (operation) => budget.reserve('tourapi', operation),
  authenticate: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    return !error && !!data.user;
  },
});

Deno.serve(handler);
