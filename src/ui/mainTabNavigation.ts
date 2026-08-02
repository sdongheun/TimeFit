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

export function resetToMyCourse(
  navigation: NavigationProp<RootStackParamList>,
  params: RootStackParamList['Detail'],
) {
  navigation.dispatch(CommonActions.reset({
    index: 0,
    routes: [{ name: 'Detail', params }],
  }));
}
