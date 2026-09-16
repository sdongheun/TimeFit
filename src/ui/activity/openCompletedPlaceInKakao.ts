import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { openKakaoPlaceWithAppFallback, type CourseV1DisplayPlace } from '../recommendation/courseV1PlacePreviewModel';

export async function openCompletedPlaceInKakao(place: CourseV1DisplayPlace): Promise<boolean> {
  const result = await openKakaoPlaceWithAppFallback(place, {
    canOpenApp: Linking.canOpenURL,
    openApp: Linking.openURL,
    openExternal: Linking.openURL,
    openBrowser: WebBrowser.openBrowserAsync,
  });
  return result === 'app_opened' || result === 'external_opened' || result === 'browser_fallback_opened';
}
