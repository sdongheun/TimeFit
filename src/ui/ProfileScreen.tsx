import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const flow = useAppFlow();

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>내정보</Text>
        <Text style={s.sub}>개인화와 개발 확인 항목을 모아둘 공간입니다.</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>개인화 준비</Text>
          <Text style={s.row}>기본 이동수단</Text>
          <Text style={s.value}>추후 저장</Text>
          <Text style={s.row}>선호 카테고리</Text>
          <Text style={s.value}>카페, 쇼핑, 거리, 문화시설 등 선택 예정</Text>
          <Text style={s.row}>제외 카테고리</Text>
          <Text style={s.value}>숙박처럼 자투리 목적과 맞지 않는 항목 관리</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>개발 확인</Text>
          <Text style={s.value}>TMAP/ODsay 호출량, 마지막 추천 조건, 진행 중 코스 요약을 이 탭에 붙일 수 있습니다.</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="profile"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22, paddingTop: 64 },
  h1: { color: C.txt, fontSize: 30, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 5, marginBottom: 18 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { color: C.accent, fontSize: 15, fontWeight: '900', marginBottom: 10 },
  row: { color: C.txt2, fontSize: 13, fontWeight: '800', marginTop: 10 },
  value: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
});
