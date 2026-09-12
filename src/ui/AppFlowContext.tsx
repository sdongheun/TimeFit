import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { uuid } from 'expo-modules-core';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from './nav';
import { listSavedCoursesFromRepository, removeCourseFromRepository, replaceCoursePlanInRepository, saveCourseToRepository } from '../services/courseRepository';
import { useAuth } from './AuthContext';
import { requireAccountSession } from './authStateModel';
import {
  clearActiveVerifiedCourse as clearActiveVerifiedCourseState,
  createActiveVerifiedCourseIdentityFactory,
  createOpaqueCourseRunIdFactory,
  startActiveVerifiedCourse as createActiveVerifiedCourse,
  updateActiveVerifiedCourse as updateActiveVerifiedCourseState,
  type ActiveVerifiedCourse,
} from './activeVerifiedCourseModel';
import type { VerifiedCourseProgressState } from './recommendation/verifiedCourseProgressModel';
import { activeVerifiedCourseStorage } from './activeVerifiedCourseStorage';
import { liveCourseProgressRuntime, retryPendingLiveCourseCleanup } from './liveActivity/courseProgressComposition';
import { projectVerifiedProgressFromLocal } from './liveActivity/courseProgressRuntimeModel';
import { localProgressEventFromNotificationResponse } from './liveActivity/courseProgressNotifications';
import { nativePendingNavigationPort } from './liveActivity/nativeLiveActivityPort';
import { createDiagnosticAttemptId, recordLiveActivityAppDiagnostic } from './liveActivity/liveActivityDiagnostics';
import type { PendingNavigationAction } from './liveActivity/pendingNavigationHandoffModel';
import { ownedCourseLifecycle } from './ownedCourseLifecycle';
import { liveLearningEvidence } from './liveActivity/learningEvidenceComposition';
import { GuestImportPanel } from './GuestImportPanel';
import { reconfirmActiveCourseLocations } from './activeVerifiedCourseModel';
import type { ManualReselection } from './manualLocationRestoreModel';

type ResultsParams = RootStackParamList['Results'];
type ExecutionParams = RootStackParamList['Execution'];

export type SavedCourse = ExecutionParams & { id: string; title: string; createdAt: number };

type AppFlowContextValue = {
  latestResults: ResultsParams | null;
  activeCourse: ExecutionParams | null;
  activeVerifiedCourse: ActiveVerifiedCourse | null;
  pendingNavigationAction: PendingNavigationAction | null;
  isActiveVerifiedCourseRun: (courseRunId: string) => boolean;
  savedCourses: SavedCourse[];
  isCoursesLoading: boolean;
  coursesError: string;
  setLatestResults: (params: ResultsParams) => void;
  setActiveCourse: (params: ExecutionParams | null) => void;
  startActiveVerifiedCourse: (params: RootStackParamList['CourseConfirm']) => ActiveVerifiedCourse;
  updateActiveVerifiedCourse: (identity: string, update: (progress: VerifiedCourseProgressState) => VerifiedCourseProgressState) => void;
  clearActiveVerifiedCourse: (identity: string) => void;
  reconfirmActiveLocations: (identity: string, session: RootStackParamList['CourseConfirm']['session'], origin: ManualReselection, destination: ManualReselection) => ActiveVerifiedCourse | null;
  refreshPendingNavigationAction: () => Promise<PendingNavigationAction | null>;
  refreshSavedCourses: () => Promise<void>;
  saveCourse: (params: ExecutionParams) => Promise<SavedCourse>;
  replaceCourse: (courseId: string, params: ExecutionParams) => Promise<ExecutionParams>;
  removeSavedCourse: (id: string) => Promise<void>;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const { accountSession } = useAuth();
  const accountSubject = accountSession?.user.id ?? null;
  const accountSubjectRef = useRef(accountSubject);
  accountSubjectRef.current = accountSubject;
  const [latestResults, setLatestResultsState] = useState<ResultsParams | null>(null);
  const [activeCourse, setActiveCourseState] = useState<ExecutionParams | null>(null);
  const [activeVerifiedCourse, setActiveVerifiedCourseState] = useState<ActiveVerifiedCourse | null>(null);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<PendingNavigationAction | null>(null);
  const activeVerifiedCourseRef = useRef<ActiveVerifiedCourse | null>(null);
  const [activeRestoreFinished, setActiveRestoreFinished] = useState(false);
  const verifiedIdentityFactory = useRef(createActiveVerifiedCourseIdentityFactory()).current;
  const verifiedCourseRunIdFactory = useRef(createOpaqueCourseRunIdFactory(uuid.v4)).current;
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [savedCoursesScope, setSavedCoursesScope] = useState<string | null>(null);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const pendingSyncRunningRef = useRef(false);
  const pendingSyncQueuedRef = useRef(false);
  const setLatestResults = useCallback((params: ResultsParams) => setLatestResultsState(params), []);
  const setActiveCourse = useCallback((params: ExecutionParams | null) => setActiveCourseState(params), []);
  const reconfirmActiveLocations = useCallback((identity: string, session: RootStackParamList['CourseConfirm']['session'], origin: ManualReselection, destination: ManualReselection) => {
    const next = reconfirmActiveCourseLocations(activeVerifiedCourseRef.current, identity, session, origin, destination, Date.now());
    if (!next) return null;
    activeVerifiedCourseRef.current = next;
    setActiveVerifiedCourseState(next);
    return next;
  }, []);
  const startActiveVerifiedCourse = useCallback((params: RootStackParamList['CourseConfirm']) => {
    const active = createActiveVerifiedCourse(params.session, params.course, verifiedIdentityFactory, undefined, verifiedCourseRunIdFactory);
    liveLearningEvidence.start(active.courseRunId);
    void ownedCourseLifecycle.begin(active.courseRunId).then(() => liveLearningEvidence.bootstrap(active.courseRunId,
      active.course.stops.map((stop, index) => ({ stopId: `stop:${index}:${stop.placeId}`, stopOrdinal: (index + 1) as 1 | 2, contentId: stop.placeId })))).catch(() => undefined);
    const previous = activeVerifiedCourseRef.current;
    if (previous && previous.courseRunId !== active.courseRunId) {
      void liveCourseProgressRuntime.finish({ courseRunId: previous.courseRunId, terminal: 'cancelled', occurredAtMs: Date.now(), eventId: uuid.v4() });
    }
    activeVerifiedCourseRef.current = active;
    setActiveVerifiedCourseState(active);
    return active;
  }, [verifiedCourseRunIdFactory, verifiedIdentityFactory]);
  const updateActiveVerifiedCourse = useCallback((identity: string, update: (progress: VerifiedCourseProgressState) => VerifiedCourseProgressState) => {
    setActiveVerifiedCourseState((active) => updateActiveVerifiedCourseState(active, identity, update));
  }, []);
  const clearActiveVerifiedCourse = useCallback((identity: string) => {
    if (activeVerifiedCourseRef.current?.identity === identity) {
      const clearedRun = activeVerifiedCourseRef.current.courseRunId;
      activeVerifiedCourseRef.current = null;
      setPendingNavigationAction(current => current?.courseRunId === clearedRun ? null : current);
    }
    setActiveVerifiedCourseState((active) => clearActiveVerifiedCourseState(active, identity));
  }, []);
  const refreshPendingNavigationAction = useCallback(async () => {
    const pending = await nativePendingNavigationPort.read();
    setPendingNavigationAction(pending);
    return pending;
  }, []);
  const reconcileAndRefreshPendingNavigation = useCallback(async (source: 'foreground' | 'pending_signal') => {
    pendingSyncQueuedRef.current = true;
    if (pendingSyncRunningRef.current) return;
    pendingSyncRunningRef.current = true;
    try {
      while (pendingSyncQueuedRef.current) {
        pendingSyncQueuedRef.current = false;
        const active = activeVerifiedCourseRef.current;
        if (!active) continue;
        const attemptId = createDiagnosticAttemptId();
        void recordLiveActivityAppDiagnostic({
          action: source === 'foreground' ? 'foreground' : 'pending', attemptId,
          stage: source === 'foreground' ? 'foreground_entered' : 'pending_signal_received', result: 'started',
        }).catch(() => undefined);
        const result = await liveCourseProgressRuntime.reconcile(active.courseRunId);
        void recordLiveActivityAppDiagnostic({
          action: source === 'foreground' ? 'foreground' : 'pending', attemptId,
          stage: 'app_reconcile_completed', result: result.status === 'ready' ? 'succeeded' : 'rejected',
          error: result.status === 'storage_unreadable' ? 'storage_unreadable' : (result.status === 'ready' ? 'none' : 'receipt_rejected'),
          ...(result.status === 'ready' ? { phase: result.state.phase, revision: result.state.revision } : {}),
        }).catch(() => undefined);
        if (result.status !== 'ready') continue;
        setActiveVerifiedCourseState(current => current?.courseRunId === active.courseRunId
          ? { ...current, progress: projectVerifiedProgressFromLocal(result.state) } : current);
        void recordLiveActivityAppDiagnostic({ action: 'screen', attemptId, stage: 'screen_progress_applied', result: 'succeeded', phase: result.state.phase, revision: result.state.revision }).catch(() => undefined);
        await refreshPendingNavigationAction().catch(() => null);
      }
    } catch {
      // foreground/native signal failures remain observable through the stage diagnostics.
    } finally {
      pendingSyncRunningRef.current = false;
    }
  }, [refreshPendingNavigationAction]);

  useEffect(() => {
    let mounted = true;
    const bootAttemptId = createDiagnosticAttemptId();
    void recordLiveActivityAppDiagnostic({ action: 'boot', attemptId: bootAttemptId, stage: 'boot_entered', result: 'started' }).catch(() => undefined);
    void retryPendingLiveCourseCleanup().catch(() => undefined);
    void liveLearningEvidence.retry().catch(() => undefined);
    activeVerifiedCourseStorage.read().then(async restored => {
      if (!mounted || !restored || activeVerifiedCourseRef.current) return;
      void liveLearningEvidence.restore(restored.courseRunId, restored.course.stops.map((s, i) => ({ stopId: `stop:${i}:${s.placeId}`, stopOrdinal: (i + 1) as 1 | 2, contentId: s.placeId }))).catch(() => undefined);
      const reconciled = await liveCourseProgressRuntime.reconcile(restored.courseRunId);
      void recordLiveActivityAppDiagnostic({ action: 'boot', attemptId: bootAttemptId, stage: 'app_reconcile_completed', result: reconciled.status === 'ready' ? 'succeeded' : 'rejected', error: reconciled.status === 'storage_unreadable' ? 'storage_unreadable' : (reconciled.status === 'ready' ? 'none' : 'receipt_rejected'), ...(reconciled.status === 'ready' ? { phase: reconciled.state.phase, revision: reconciled.state.revision } : {}) }).catch(() => undefined);
      if (reconciled.status === 'terminal_cleaned') { await activeVerifiedCourseStorage.clear(); return; }
      const progress = reconciled.status === 'ready' ? projectVerifiedProgressFromLocal(reconciled.state) : restored.progress;
      if (mounted) {
        setActiveVerifiedCourseState({ ...restored, progress });
        void recordLiveActivityAppDiagnostic({ action: 'screen', attemptId: bootAttemptId, stage: 'screen_progress_applied', result: 'succeeded', ...(reconciled.status === 'ready' ? { phase: reconciled.state.phase, revision: reconciled.state.revision } : {}) }).catch(() => undefined);
        await refreshPendingNavigationAction().catch(() => null);
      }
    }).catch(() => undefined).finally(() => { if (mounted) setActiveRestoreFinished(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const event = localProgressEventFromNotificationResponse(response);
      if (!event) return;
      void liveCourseProgressRuntime.reconcile(event.courseRunId)
        .then(() => liveCourseProgressRuntime.applyEvent(event))
        .then(() => liveCourseProgressRuntime.reconcile(event.courseRunId)).then(result => {
        if (result.status !== 'ready') return;
        setActiveVerifiedCourseState(current => current?.courseRunId === event.courseRunId
          ? { ...current, progress: projectVerifiedProgressFromLocal(result.state) } : current);
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    activeVerifiedCourseRef.current = activeVerifiedCourse;
    if (!activeRestoreFinished) return;
    if (activeVerifiedCourse) void activeVerifiedCourseStorage.write(activeVerifiedCourse);
    else void activeVerifiedCourseStorage.clear();
  }, [activeRestoreFinished, activeVerifiedCourse]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void ownedCourseLifecycle.resumePending();
      if (state === 'active') void liveLearningEvidence.retry().catch(() => undefined);
      if (state === 'active') void retryPendingLiveCourseCleanup().catch(() => undefined);
      if (state === 'active') void reconcileAndRefreshPendingNavigation('foreground');
    });
    return () => subscription.remove();
  }, [reconcileAndRefreshPendingNavigation]);
  useEffect(() => { void ownedCourseLifecycle.resumePending(); }, [accountSession?.user.id]);
  useEffect(() => nativePendingNavigationPort.subscribe(() => {
    void reconcileAndRefreshPendingNavigation('pending_signal');
  }), [reconcileAndRefreshPendingNavigation]);
  const refreshSavedCourses = useCallback(async () => {
    const subject = accountSession?.user.id ?? null;
    if (!accountSession) {
      setSavedCourses([]);
      setCoursesError('');
      return;
    }
    setIsCoursesLoading(true);
    setCoursesError('');
    try {
      const next = await listSavedCoursesFromRepository();
      if (accountSubjectRef.current !== subject) return;
      setSavedCourses(next); setSavedCoursesScope(subject);
    } catch (error) {
      if (accountSubjectRef.current === subject) setCoursesError('저장한 코스를 불러오지 못했습니다.');
    } finally {
      if (accountSubjectRef.current === subject) setIsCoursesLoading(false);
    }
  }, [accountSession]);

  const saveCourse = useCallback(async (params: ExecutionParams) => {
    requireAccountSession(accountSession, false);
    const saved = await saveCourseToRepository(params);
    if (accountSubjectRef.current !== accountSession?.user.id) throw Error('계정이 변경되어 다시 확인해야 합니다.');
    setSavedCoursesScope(accountSubjectRef.current);
    setSavedCourses((prev) => [saved, ...prev]);
    return saved;
  }, [accountSession]);
  const replaceCourse = useCallback(async (courseId: string, params: ExecutionParams) => {
    requireAccountSession(accountSession, false);
    const updated = await replaceCoursePlanInRepository(courseId, params);
    if (accountSubjectRef.current !== accountSession?.user.id) throw Error('계정이 변경되어 다시 확인해야 합니다.');
    await refreshSavedCourses();
    return updated;
  }, [accountSession, refreshSavedCourses]);
  const removeSavedCourse = useCallback(async (id: string) => {
    requireAccountSession(accountSession, false);
    await removeCourseFromRepository(id);
    if (accountSubjectRef.current !== accountSession?.user.id) return;
    setSavedCourses((prev) => prev.filter((course) => course.id !== id));
  }, [accountSession]);

  const value = useMemo<AppFlowContextValue>(() => ({
    latestResults,
    activeCourse,
    activeVerifiedCourse,
    pendingNavigationAction,
    isActiveVerifiedCourseRun: (courseRunId: string) => activeVerifiedCourseRef.current?.courseRunId === courseRunId,
    savedCourses: savedCoursesScope === accountSubject ? savedCourses : [],
    isCoursesLoading,
    coursesError,
    setLatestResults,
    setActiveCourse,
    startActiveVerifiedCourse,
    reconfirmActiveLocations,
    updateActiveVerifiedCourse,
    clearActiveVerifiedCourse,
    refreshPendingNavigationAction,
    refreshSavedCourses,
    saveCourse,
    replaceCourse,
    removeSavedCourse,
  }), [latestResults, activeCourse, activeVerifiedCourse, pendingNavigationAction, savedCourses, savedCoursesScope, accountSubject, isCoursesLoading, coursesError, setLatestResults, setActiveCourse, startActiveVerifiedCourse, updateActiveVerifiedCourse, clearActiveVerifiedCourse, refreshPendingNavigationAction, refreshSavedCourses, saveCourse, replaceCourse, removeSavedCourse]);

  return <AppFlowContext.Provider value={value}>{children}{accountSession ? <GuestImportPanel key={accountSession.user.id} subject={accountSession.user.id} surface="login" /> : null}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useAppFlow must be used inside AppFlowProvider');
  return ctx;
}

/** V1 진행 화면이 legacy 저장·repository action을 소비하지 않게 좁힌 runtime 전용 경계다. */
export function useActiveVerifiedCourseFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useActiveVerifiedCourseFlow must be used inside AppFlowProvider');
  return {
    activeVerifiedCourse: ctx.activeVerifiedCourse,
    pendingNavigationAction: ctx.pendingNavigationAction,
    isActiveVerifiedCourseRun: ctx.isActiveVerifiedCourseRun,
    startActiveVerifiedCourse: ctx.startActiveVerifiedCourse,
    reconfirmActiveLocations: ctx.reconfirmActiveLocations,
    updateActiveVerifiedCourse: ctx.updateActiveVerifiedCourse,
    clearActiveVerifiedCourse: ctx.clearActiveVerifiedCourse,
    refreshPendingNavigationAction: ctx.refreshPendingNavigationAction,
  };
}
