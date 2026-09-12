import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { profileDisplayChanges, recordTitle } from './profileDisplayModel';
const productionPorts = () => import('../services/releaseIdentitySupabase');

export function useRecordTitle(subject: string | null, getPorts = productionPorts) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ subject: string | null; title: string }>({ subject: null, title: recordTitle(null) });
  useEffect(() => profileDisplayChanges.subscribe(owner => { if (owner === subject) setRevision(n => n + 1); }), [subject]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ subject, title: recordTitle(null) });
    if (subject) void getPorts().then(async ports => {
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (!active || identity.status !== 'account' || identity.identity.subject !== subject) return;
      const result = await ports.supabaseAccountProfileRepository.readAccountProfile();
      const after = await ports.supabaseAccountIdentityResolver.resolve();
      if (active && after.status === 'account' && after.identity.subject === subject && result.status === 'ok') setState({ subject, title: recordTitle(result.profile.nickname) });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [subject, revision, getPorts]));
  return subject && state.subject === subject ? state.title : recordTitle(null);
}
