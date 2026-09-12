import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { nativeLiveActivityPort } from './liveActivity/nativeLiveActivityPort';

export type ProfilePermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'error';

export type ProfilePermissionSnapshot = Readonly<{
  notification: ProfilePermissionState;
  liveActivity: ProfilePermissionState;
}>;

type PermissionResponseLike = Readonly<{ status?: string; granted?: boolean }>;

type PermissionDependencies = Readonly<{
  getLocationPermission?: () => Promise<PermissionResponseLike>;
  getNotificationPermission?: () => Promise<PermissionResponseLike>;
  getLiveActivitySupport?: () => Promise<Readonly<{ supported: boolean; enabled: boolean }>>;
}>;

type SettingsDependencies = Readonly<{
  openSettings?: () => Promise<void>;
}>;

export function profilePermissionState(response: PermissionResponseLike | null | undefined): ProfilePermissionState {
  if (!response) return 'unavailable';
  if (response.granted || response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  if (response.status === 'undetermined') return 'undetermined';
  return 'unavailable';
}

async function readOne(read: (() => Promise<PermissionResponseLike>) | undefined): Promise<ProfilePermissionState> {
  if (!read || Platform.OS === 'web') return 'unavailable';
  try {
    return profilePermissionState(await read());
  } catch {
    return 'error';
  }
}

/** 권한 prompt를 띄우지 않는 내정보 전용 조회 경계다. */
export async function readProfilePermissionSnapshot(
  dependencies: PermissionDependencies = {
    getNotificationPermission: Notifications.getPermissionsAsync,
    getLiveActivitySupport: nativeLiveActivityPort.activitySupport,
  },
): Promise<ProfilePermissionSnapshot> {
  const [notification, liveActivity] = await Promise.all([
    readOne(dependencies.getNotificationPermission),
    Platform.OS === 'web' || !dependencies.getLiveActivitySupport ? Promise.resolve('unavailable' as const) : dependencies.getLiveActivitySupport()
      .then(value => value.supported ? value.enabled ? 'granted' as const : 'denied' as const : 'unavailable' as const)
      .catch(() => 'error' as const),
  ]);
  return { notification, liveActivity };
}

export async function openProfileSystemSettings(
  dependencies: SettingsDependencies = { openSettings: Linking.openSettings },
): Promise<void> {
  if (!dependencies.openSettings) throw new Error('settings_unavailable');
  await dependencies.openSettings();
}
