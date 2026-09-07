import { AppState, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { openKakaoRouteWithFallback } from '../execution/schedule';
import { createLiveActivityA3VerificationController } from './a3VerificationModel';
import { nativeLiveActivityPort } from './nativeLiveActivityPort';
import { createLiveActivityLifecycleController, isManagedTestFixture } from './lifecyclePolicy';
import { nativeLiveActivityLifecyclePort } from './nativeLiveActivityPort';

const A3_ROUTE = {
  from: { name: '서면역', point: { lat: 35.1578, lon: 129.0594 } },
  to: { name: '부산시민공원', point: { lat: 35.1681, lon: 129.0571 } },
} as const;

export function createAppLiveActivityA3Controller() {
  return createLiveActivityA3VerificationController({
    support: nativeLiveActivityPort.activitySupport,
    fixtureExists: async () => (await nativeLiveActivityLifecyclePort.listActivities()).some(isManagedTestFixture),
    openRoute: () => openKakaoRouteWithFallback(A3_ROUTE, 'walk', {
      canOpenApp: Linking.canOpenURL,
      openApp: Linking.openURL,
      openWeb: Linking.openURL,
      openBrowser: WebBrowser.openBrowserAsync,
      observeAppState: listener => { const subscription = AppState.addEventListener('change', listener); return () => subscription.remove(); },
    }),
    startActivity: nativeLiveActivityPort.startFixture,
  });
}

export function createAppLiveActivityA3CleanupController() {
  return createLiveActivityLifecycleController(nativeLiveActivityLifecyclePort);
}
