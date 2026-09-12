import { useEffect, useRef, useState } from 'react';
import { liveLearningEvidence } from './liveActivity/learningEvidenceComposition';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { personalizationSession } from './personalizationComposition';
import type { DwellConsentStateV1 } from '../services/dwellPersonalizationRepository';
import { C } from './theme';
import { uuid } from 'expo-modules-core';
import { profileDisplayChanges } from './profileDisplayModel';

const productionPorts = async () => import('../services/releaseIdentitySupabase');
type Props = { subject: string; profile?: boolean; getPorts?: typeof productionPorts };
const requestId = () => uuid.v4();

export function AccountPersonalizationPanel({ subject, profile = false, getPorts = productionPorts }: Props) {
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState<DwellConsentStateV1 | null>(null);
  const [groups, setGroups] = useState<readonly [string, number][]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const epoch = useRef(0), lock = useRef(false);
  const mutation = useRef<{ kind: string; id: string } | null>(null);
  const idFor = (kind: string) => { if (mutation.current?.kind !== kind) mutation.current = { kind, id: requestId() }; return mutation.current.id; };
  useEffect(() => {
    const token = ++epoch.current;
    setLoading(true); setConsent(null); setNickname(''); setGroups([]); setMessage('');
    void getPorts().then(async ports => {
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (identity.status !== 'account' || identity.identity.subject !== subject || token !== epoch.current) throw Error('scope');
      if (profile) {
        const result = await ports.supabaseAccountProfileRepository.readAccountProfile();
        if (token !== epoch.current) return;
        if (result.status !== 'ok') throw Error('profile');
        setNickname(result.profile.nickname ?? '');
      } else {
        const result = await ports.supabaseDwellPersonalizationRepository.readDwellPersonalizationConsent();
        if (token !== epoch.current) return;
        if (result.status !== 'ok') throw Error('consent');
        setConsent(result.consent);
        if (result.consent.enabled) {
          const sample = await ports.supabaseDwellPersonalizationRepository.readDwellPersonalizationSamples();
          if (token !== epoch.current) return;
          const counts = new Map<string, number>();
          for (const value of sample.samples) if (value.category && value.subCategory && Number.isFinite(value.dwellMin) && value.dwellMin > 0) {
            const key = `${value.category} · ${value.subCategory}`; counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          setGroups([...counts]);
        }
      }
    }).catch(() => { if (token === epoch.current) setMessage('정보를 확인하지 못했어요. 잠시 후 화면을 다시 열어주세요.'); })
      .finally(() => { if (token === epoch.current) setLoading(false); });
    return () => { epoch.current++; };
  }, [subject, profile, getPorts]);

  const change = async (kind: 'nickname' | 'toggle' | 'reset') => {
    if (lock.current || loading || (kind !== 'nickname' && !consent)) return;
    lock.current = true; setBusy(true); setMessage('');
    const token = epoch.current;
    if (kind !== 'nickname') { personalizationSession.invalidate(); void liveLearningEvidence.clearInvalidatedNative().catch(() => undefined); }
    try {
      const ports = await getPorts();
      if (token !== epoch.current) return;
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (identity.status !== 'account' || identity.identity.subject !== subject || token !== epoch.current) return;
      if (kind === 'nickname') {
        const result = await ports.supabaseAccountProfileRepository.updateAccountNickname({ mutationId: idFor(`nickname:${nickname}`), nickname: nickname.trim() ? nickname : null });
        if (token !== epoch.current) return;
        if (result.status !== 'updated' && result.status !== 'unchanged') { setMessage(result.status === 'invalid_nickname' ? '닉네임은 줄바꿈 없이 1~20자로 입력해주세요.' : '저장하지 못했어요. 다시 시도해주세요.'); return; }
        setNickname(result.profile.nickname ?? '');
        profileDisplayChanges.notify(subject);
      } else {
        const repo = ports.supabaseDwellPersonalizationRepository;
        const result = kind === 'reset'
          ? await ports.resetOwnedDwellPersonalization({ requestId: idFor('reset'), expectedRevision: consent!.revision })
          : await repo.setDwellPersonalizationConsent({ requestId: idFor(`toggle:${!consent!.enabled}`), expectedRevision: consent!.revision, enabled: !consent!.enabled });
        if (token !== epoch.current) return;
        if (result.status === 'local_cleanup_pending') {
          personalizationSession.invalidate(); setConsent(result.serverResult.consent); setGroups([]);
          setMessage('맞춤 추천은 껐지만 기기 정리가 남았어요. 다시 확인해주세요.'); return;
        }
        if (result.status !== 'updated' && result.status !== 'reset') { setMessage('변경하지 못했어요. 상태를 다시 확인한 후 시도해주세요.'); return; }
        personalizationSession.invalidate();
        setConsent(result.consent); setGroups([]);
        if (!result.consent.enabled) await ports.supabaseDwellPersonalizationOutbox.discardOwner(subject);
      }
      mutation.current = null; if (token === epoch.current) setMessage(kind === 'nickname' ? '닉네임을 저장했어요.' : '저장했어요. 변경 사항은 다음 추천부터 적용됩니다.');
    } catch { if (token === epoch.current) setMessage('연결을 확인하고 다시 시도해주세요.'); }
    finally { lock.current = false; if (token === epoch.current) setBusy(false); }
  };
  return <View>{loading ? <ActivityIndicator color={C.accent} /> : profile ? <>
    <Text style={s.copy}>닉네임은 선택 사항이에요. 비우고 저장하면 삭제됩니다.</Text>
    <TextInput testID="profile-nickname" value={nickname} editable={!busy} onChangeText={setNickname} style={s.input} placeholder="닉네임" placeholderTextColor={C.muted} />
    <Pressable testID="profile-nickname-save" disabled={busy} style={[s.button, s.saveButton]} onPress={() => void change('nickname')}><Text style={s.saveText}>저장</Text></Pressable>
  </> : <>
    <Text style={s.text}>체류 기록으로 맞춤 추천</Text>
    <Text style={s.copy}>동의한 뒤 코스에서 직접 확인한 체류만 사용해요. 같은 활동의 유효 기록이 3개부터 모이면 다음 추천에 제한적으로 반영합니다. 이전 기기 기록을 가져와도 학습에는 쓰지 않아요.</Text>
    <Pressable testID="profile-dwell-consent" accessibilityRole="switch" accessibilityState={{ checked: consent?.enabled === true, disabled: busy || !consent }} disabled={busy || !consent} style={s.button} onPress={() => void change('toggle')}><Text style={s.text}>{consent?.enabled ? '사용 중 · 끄기' : '동의하고 사용하기'}</Text></Pressable>
    {consent?.enabled ? <><Text style={s.copy}>{groups.length ? groups.map(([key, count]) => `${key}: ${count < 3 ? `${count}/3개 준비 중` : '추천에 활용 가능한 기록 있음'}`).join('\n') : '아직 추천에 사용할 기록이 없어요.'}</Text><Pressable testID="profile-dwell-reset" disabled={busy} style={s.button} onPress={() => Alert.alert('맞춤 추천 기록을 초기화할까요?', '체류 학습 기록을 삭제하고 사용을 끕니다. 방문 기록은 유지됩니다.', [{ text: '취소', style: 'cancel' }, { text: '초기화', style: 'destructive', onPress: () => void change('reset') }])}><Text style={s.text}>맞춤 추천 초기화</Text></Pressable></> : null}
  </>}{message ? <Text accessibilityLiveRegion="polite" style={s.copy}>{message}</Text> : null}</View>;
}

const s = StyleSheet.create({ copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginVertical: 10 }, text: { color: C.txt, fontSize: 14 }, input: { color: C.txt, backgroundColor: C.panel, fontSize: 16, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, minHeight: 52 }, button: { minHeight: 48, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: C.line, borderRadius: 10, marginTop: 10 }, saveButton: { minHeight: 52, backgroundColor: C.accent, borderColor: C.accent, borderRadius: 12, alignItems: 'center', marginTop: 12 }, saveText: { color: C.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' } });
