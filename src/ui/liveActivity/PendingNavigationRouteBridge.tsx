import { useEffect, useRef } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useAppFlow } from '../AppFlowContext';
import type { RootStackParamList } from '../nav';
import { createPendingNavigationRouteGate } from './pendingNavigationRouteModel';

export function PendingNavigationRouteBridge({
  navigation,
  ready,
}: Readonly<{ navigation: NavigationContainerRefWithCurrent<RootStackParamList>; ready: boolean }>) {
  const { activeVerifiedCourse, pendingNavigationAction } = useAppFlow();
  const routeGate = useRef(createPendingNavigationRouteGate()).current;

  useEffect(() => {
    if (!ready) return;
    const target = routeGate.next(activeVerifiedCourse, pendingNavigationAction, navigation.getCurrentRoute());
    if (!target) return;
    navigation.navigate('CourseConfirm', target);
  }, [activeVerifiedCourse, navigation, pendingNavigationAction, ready, routeGate]);

  return null;
}
