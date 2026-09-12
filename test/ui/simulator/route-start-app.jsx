// Isolated Simulator fixture entry, never imported by index.ts or production App.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, Button, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CourseConfirmScreen } from '../../../src/ui/CourseConfirmScreen';
import { fixture, useFixture, resetFixture, emit } from './route-start-ports';
global.fetch = async () => { throw Error('ROUTESTART fixture network prohibited'); };
const session = { nowIso: '2026-09-09T06:00:00Z', remainingMin: 180, arrivalBufferMin: 10, origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.1 }, destination: { id: 'destination', label: '최종 목적지', lat: 35.2, lon: 129.2 } };
function makeCourse(count) {
  const ids = count === 2 ? ['A', 'B'] : ['A'];
  return { id: ids.join('-'), placeIds: ids, stops: ids.map(placeId => ({ placeId, stayMin: 20, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: '2026-09-09T06:05:00Z', departureAt: '2026-09-09T06:25:00Z' })), legs: Array.from({ length: count + 1 }, (_, i) => ({ fromId: i ? ids[i - 1] : 'origin', toId: ids[i] ?? 'destination', mode: 'walk', min: 5 })), travelMin: (count + 1) * 5, stayMin: count * 20, totalMin: (count + 1) * 5 + count * 20 + 10, arrivalBufferMin: 10, remainingAfterCourseMin: 90, remainingAfterArrivalBufferMin: 80 };
}
function App() {
  useFixture(); const [config, setConfig] = useState({ key: 0, count: 1, course: makeCourse(1) });
  const [params, setParams] = useState({ session, course: config.course });
  function reset(count, mode) { resetFixture(); fixture.mode = mode; const course = makeCourse(count); setConfig({ key: config.key + 1, count, course }); setParams({ session, course }); }
  const navigation = { setParams(next) { setParams(value => ({ ...value, ...next })); }, addListener() { return () => {}; }, goBack() {} };
  return <SafeAreaProvider><View style={{ flex: 1, backgroundColor: '#151517', paddingTop: 55 }}>
    <Text style={{ color: '#fff', textAlign: 'center' }}>ROUTE START 02 · 격리 fixture · 운영 호출 0</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}><Button title="1곳 웹" onPress={() => reset(1, 'web')} /><Button title="2곳 앱" onPress={() => reset(2, 'app')} /><Button title="전체 실패" onPress={() => reset(1, 'failed')} /></View>
    <Text style={{ color: '#fff', fontSize: 10 }}>{fixture.calls.join(' → ')}</Text>
    <CourseConfirmScreen key={config.key} route={{ params }} navigation={navigation} />
    <Modal visible={fixture.browser} animationType="none"><View style={{ flex: 1, justifyContent: 'center', padding: 30 }}><Text>웹 열기 fixture (실제 카카오 웹 아님)</Text><Text>앱 열기 팝업 취소 / 설치없이 보기 / 닫기 모두 정상 종료값</Text><Button title="웹 닫고 짜투리 복귀" onPress={() => fixture.close?.()} /></View></Modal>
  </View></SafeAreaProvider>;
}
registerRootComponent(App);
