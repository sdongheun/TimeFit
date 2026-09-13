import { CommonActions, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from './nav';

export function resetToMain(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'Home' }],
  }));
}

export function resetToProfile(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'Profile' }],
  }));
}

export function resetToActivityRecord(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'ActivityRecord' }],
  }));
}

/** 주변 둘러보기 탭으로 이동한다. */
export function resetToNearbyBrowse(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'NearbyBrowse' }],
  }));
}
