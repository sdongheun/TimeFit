import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { CourseCompletionRecordV1 } from '../services/courseCompletionRepository';
import { loadOwnedCoursePorts } from './ownedCourseLifecycle';
import { C } from './theme';

/** Preserves the old unassigned device history without declaring it guest/account owned. */
export function LegacyCompletionPanel() {
  const [records, setRecords] = useState<readonly CourseCompletionRecordV1[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const ports = await loadOwnedCoursePorts();
      if ((await ports.supabaseAccountIdentityResolver.resolve()).status !== 'account_required') return;
      const { courseCompletionRepository } = await import('../services/courseCompletionAsyncStorage');
      const result = await courseCompletionRepository.read();
      if (active && (await ports.supabaseAccountIdentityResolver.resolve()).status === 'account_required' && result.status === 'ok') setRecords(result.records);
    })().catch(() => undefined);
    return () => { active = false; };
  }, []);
  return records.length ? <View style={{ marginTop: 20 }}><Text style={{ color: C.txt }}>이전 방식으로 남긴 기기 기록</Text><Text style={{ color: C.muted, marginVertical: 8 }}>계정 소유가 확인되지 않은 기록입니다. 로그인 후 직접 가져올 수 있으며 체류 학습에는 사용하지 않아요.</Text>{records.map(record => <Text key={record.completionId} style={{ color: C.txt, paddingVertical: 8 }}>{record.places.map(place => place.title).join(' → ')}</Text>)}</View> : null;
}
