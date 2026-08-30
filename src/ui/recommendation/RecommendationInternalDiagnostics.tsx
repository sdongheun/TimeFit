import { StyleSheet, Text, View } from 'react-native';
import type { RecommendationDiagnosticValue, RecommendationInternalDiagnostics } from './recommendationInternalDiagnosticsModel';
import { C } from '../theme';

function Values({ values }: { values: readonly RecommendationDiagnosticValue[] }) {
  return <>{values.map((item) => <Text key={item.label} style={s.copy}>{item.label} {item.value}</Text>)}</>;
}

/** No actions or external details: this panel is rendered only by the exact internal feature flag. */
export function RecommendationInternalDiagnosticsPanel({ diagnostics }: { diagnostics: RecommendationInternalDiagnostics }) {
  return <View accessibilityLabel="개발용 추천 진단" style={s.panel}><Text style={s.title}>개발용 추천 진단</Text><Values values={diagnostics.courseCounts} /><Values values={diagnostics.candidateCounts} />{diagnostics.requestCounts.length ? <Values values={diagnostics.requestCounts} /> : null}{diagnostics.tiers.map((tier) => <View key={tier.tier} style={s.tier}><Text style={s.tierTitle}>{tier.tier}</Text><Values values={tier.values} /><Values values={tier.stopReasons} /></View>)}{diagnostics.outcomeReasons.length ? <View style={s.tier}><Text style={s.tierTitle}>결과 탈락</Text><Values values={diagnostics.outcomeReasons} /></View> : null}</View>;
}

const s = StyleSheet.create({ panel: { gap: 4, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#675d3f', backgroundColor: '#292719' }, title: { color: '#f0d57b', fontSize: 14, fontWeight: '800' }, tier: { gap: 3, paddingTop: 6 }, tierTitle: { color: '#eadb9d', fontSize: 13, fontWeight: '800' }, copy: { color: C.muted, fontSize: 12, lineHeight: 18 } });
