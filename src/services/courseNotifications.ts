import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'course-departures';
const STORAGE_KEY = '@timefit/course-notification-ids';

export type CourseDepartureAlert = {
  min: number;
  msg: string;
};

export type ScheduleResult = {
  scheduled: number;
  skipped: number;
  permissionGranted: boolean;
};

let operation = Promise.resolve<unknown>(undefined);
let initialization: Promise<boolean> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '약속·복귀 출발 알림',
    description: 'TimeFit 코스를 마친 뒤 약속장소 또는 출발지로 이동할 시각을 알려줍니다.',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    vibrationPattern: [0, 250, 150, 250],
  });
}

async function initialize() {
  if (Platform.OS === 'web') return false;
  await configureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status !== 'undetermined') return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

export function initializeNotifications(): Promise<boolean> {
  if (!initialization) {
    initialization = initialize().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function readScheduledIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function cancelStoredNotifications() {
  const ids = await readScheduledIds();
  await Promise.all(ids.map(async (id) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // 이미 전달되었거나 운영체제가 제거한 알림은 취소할 필요가 없다.
    }
  }));
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function cancelCourseNotifications(): Promise<void> {
  operation = operation.then(cancelStoredNotifications, cancelStoredNotifications);
  return operation as Promise<void>;
}

function todayAtMinute(minuteOfDay: number) {
  const date = new Date();
  date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return date;
}

async function schedule(alerts: CourseDepartureAlert[]): Promise<ScheduleResult> {
  await cancelStoredNotifications();
  const permissionGranted = await initializeNotifications();
  if (!permissionGranted) return { scheduled: 0, skipped: alerts.length * 2, permissionGranted: false };

  const now = Date.now();
  const ids: string[] = [];
  let skipped = 0;

  for (const alert of alerts) {
    const departure = todayAtMinute(alert.min);
    const moments = [
      {
        date: new Date(departure.getTime() - 5 * 60_000),
        title: '출발 5분 전이에요',
        body: `5분 뒤 ${alert.msg}`,
        phase: 'five-minutes-before',
      },
      {
        date: departure,
        title: '지금 출발할 시간이에요',
        body: alert.msg,
        phase: 'departure-time',
      },
    ];

    for (const moment of moments) {
      if (moment.date.getTime() <= now) {
        skipped += 1;
        continue;
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: moment.title,
          body: moment.body,
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          data: { kind: 'course-departure', phase: moment.phase },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: moment.date,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    }
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  return { scheduled: ids.length, skipped, permissionGranted: true };
}

export function scheduleCourseNotifications(alerts: CourseDepartureAlert[]): Promise<ScheduleResult> {
  operation = operation.then(() => schedule(alerts), () => schedule(alerts));
  return operation as Promise<ScheduleResult>;
}
