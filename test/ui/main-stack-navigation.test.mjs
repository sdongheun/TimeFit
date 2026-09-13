import assert from 'node:assert/strict';
import test from 'node:test';
import { StackRouter, CommonActions } from '@react-navigation/routers';
import { screenRuntime } from './support/screenRuntime.mjs';

test('STACK01 actual stack router preserves keys through detail/review back and terminal resets remove history', () => {
  const options = { routeNames: ['Home', 'TimeSetup', 'Results', 'PlaceDetail', 'CourseConfirm', 'NearbyBrowse', 'Profile', 'ActivityRecord'], routeParamList: {}, routeGetIdList: {} };
  const router = StackRouter({ initialRouteName: 'Home' });
  let state = router.getInitialState(options);
  const dispatch = action => {
    const next = router.getStateForAction(state, action, options);
    if (next) state = router.getRehydratedState(next, options);
  };
  const go = name => dispatch(CommonActions.navigate(name));
  go('TimeSetup'); const setupKey = state.routes.at(-1).key;
  go('Results'); const resultsKey = state.routes.at(-1).key;
  for (const name of ['PlaceDetail', 'CourseConfirm', 'PlaceDetail']) {
    go(name); dispatch(CommonActions.goBack());
    assert.equal(state.routes.at(-1).key, resultsKey);
    assert.equal(state.routes[1].key, setupKey);
  }
  dispatch(CommonActions.goBack()); assert.equal(state.routes.at(-1).key, setupKey);
  dispatch(CommonActions.goBack()); assert.equal(state.routes.at(-1).name, 'Home');
  const host = screenRuntime({ '@react-navigation/native': { CommonActions } });
  const tabs = host.load('src/ui/mainTabNavigation.ts');
  for (const reset of [tabs.resetToNearbyBrowse, tabs.resetToProfile, tabs.resetToActivityRecord, tabs.resetToMain]) {
    reset({ dispatch }); assert.equal(state.routes.length, 1);
    const key = state.routes[0].key;
    dispatch(CommonActions.goBack()); assert.equal(state.routes[0].key, key);
  }
  go('TimeSetup'); go('Results'); go('CourseConfirm');
  tabs.resetToMain({ dispatch });
  dispatch(CommonActions.goBack()); assert.deepEqual(state.routes.map(r => r.name), ['Home']);
  go('CourseConfirm'); tabs.resetToActivityRecord({ dispatch });
  dispatch(CommonActions.goBack()); assert.deepEqual(state.routes.map(r => r.name), ['ActivityRecord']);
});
