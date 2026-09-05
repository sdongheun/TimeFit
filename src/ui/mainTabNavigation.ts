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

export function resetToMyCourses(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'MyCourses' }],
  }));
}

/** visible top-level destination; MyCourses remains a separate legacy saved-course route. */
export function resetToNearbyBrowse(navigation: NavigationProp<RootStackParamList>) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'NearbyBrowse' }],
  }));
}

export function resetToBasket(
  navigation: NavigationProp<RootStackParamList>,
  params: RootStackParamList['LegacyResults'],
) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'LegacyResults', params }],
  }));
}
