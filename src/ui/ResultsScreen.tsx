import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OneStopResultsScreen } from './OneStopResultsScreen';
import { RootStackParamList } from './nav';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

// 결과 진입점은 단일 장소 추천 화면만 유지한다. 이전 다중 장소 화면은 Git 이력에 보존한다.
export function ResultsScreen(props: Props) {
  return <OneStopResultsScreen {...props} />;
}
