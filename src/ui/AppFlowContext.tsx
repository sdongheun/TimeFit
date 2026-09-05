import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { uuid } from 'expo-modules-core';
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

type ResultsParams = RootStackParamList['Results'];
type ExecutionParams = RootStackParamList['Execution'];

export type SavedCourse = ExecutionParams & { id: string; title: string; createdAt: number };

type AppFlowContextValue = {
  latestResults: ResultsParams | null;
  activeCourse: ExecutionParams | null;
  activeVerifiedCourse: ActiveVerifiedCourse | null;
  savedCourses: SavedCourse[];
  isCoursesLoading: boolean;
  coursesError: string;
  setLatestResults: (params: ResultsParams) => void;
  setActiveCourse: (params: ExecutionParams | null) => void;
  startActiveVerifiedCourse: (params: RootStackParamList['CourseConfirm']) => ActiveVerifiedCourse;
  updateActiveVerifiedCourse: (identity: string, update: (progress: VerifiedCourseProgressState) => VerifiedCourseProgressState) => void;
  clearActiveVerifiedCourse: (identity: string) => void;
  refreshSavedCourses: () => Promise<void>;
  saveCourse: (params: ExecutionParams) => Promise<SavedCourse>;
  replaceCourse: (courseId: string, params: ExecutionParams) => Promise<ExecutionParams>;
  removeSavedCourse: (id: string) => Promise<void>;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const { accountSession } = useAuth();
  const [latestResults, setLatestResultsState] = useState<ResultsParams | null>(null);
  const [activeCourse, setActiveCourseState] = useState<ExecutionParams | null>(null);
  const [activeVerifiedCourse, setActiveVerifiedCourseState] = useState<ActiveVerifiedCourse | null>(null);
  const verifiedIdentityFactory = useRef(createActiveVerifiedCourseIdentityFactory()).current;
  const verifiedCourseRunIdFactory = useRef(createOpaqueCourseRunIdFactory(uuid.v4)).current;
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const setLatestResults = useCallback((params: ResultsParams) => setLatestResultsState(params), []);
  const setActiveCourse = useCallback((params: ExecutionParams | null) => setActiveCourseState(params), []);
  const startActiveVerifiedCourse = useCallback((params: RootStackParamList['CourseConfirm']) => {
    const active = createActiveVerifiedCourse(params.session, params.course, verifiedIdentityFactory, undefined, verifiedCourseRunIdFactory);
    setActiveVerifiedCourseState(active);
    return active;
  }, [verifiedCourseRunIdFactory, verifiedIdentityFactory]);
  const updateActiveVerifiedCourse = useCallback((identity: string, update: (progress: VerifiedCourseProgressState) => VerifiedCourseProgressState) => {
    setActiveVerifiedCourseState((active) => updateActiveVerifiedCourseState(active, identity, update));
  }, []);
  const clearActiveVerifiedCourse = useCallback((identity: string) => {
    setActiveVerifiedCourseState((active) => clearActiveVerifiedCourseState(active, identity));
  }, []);
  const refreshSavedCourses = useCallback(async () => {
    if (!accountSession) {
      setSavedCourses([]);
      setCoursesError('');
      return;
    }
    setIsCoursesLoading(true);
    setCoursesError('');
    try {
      setSavedCourses(await listSavedCoursesFromRepository());
    } catch (error) {
      setCoursesError(error instanceof Error ? error.message : '저장한 코스를 불러오지 못했습니다.');
    } finally {
      setIsCoursesLoading(false);
    }
  }, [accountSession]);

  useEffect(() => {
    void refreshSavedCourses();
  }, [refreshSavedCourses]);

  const saveCourse = useCallback(async (params: ExecutionParams) => {
    requireAccountSession(accountSession, false);
    const saved = await saveCourseToRepository(params);
    setSavedCourses((prev) => [saved, ...prev]);
    return saved;
  }, [accountSession]);
  const replaceCourse = useCallback(async (courseId: string, params: ExecutionParams) => {
    requireAccountSession(accountSession, false);
    const updated = await replaceCoursePlanInRepository(courseId, params);
    await refreshSavedCourses();
    return updated;
  }, [accountSession, refreshSavedCourses]);
  const removeSavedCourse = useCallback(async (id: string) => {
    requireAccountSession(accountSession, false);
    await removeCourseFromRepository(id);
    setSavedCourses((prev) => prev.filter((course) => course.id !== id));
  }, [accountSession]);

  const value = useMemo<AppFlowContextValue>(() => ({
    latestResults,
    activeCourse,
    activeVerifiedCourse,
    savedCourses,
    isCoursesLoading,
    coursesError,
    setLatestResults,
    setActiveCourse,
    startActiveVerifiedCourse,
    updateActiveVerifiedCourse,
    clearActiveVerifiedCourse,
    refreshSavedCourses,
    saveCourse,
    replaceCourse,
    removeSavedCourse,
  }), [latestResults, activeCourse, activeVerifiedCourse, savedCourses, isCoursesLoading, coursesError, setLatestResults, setActiveCourse, startActiveVerifiedCourse, updateActiveVerifiedCourse, clearActiveVerifiedCourse, refreshSavedCourses, saveCourse, replaceCourse, removeSavedCourse]);

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
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
    startActiveVerifiedCourse: ctx.startActiveVerifiedCourse,
    updateActiveVerifiedCourse: ctx.updateActiveVerifiedCourse,
    clearActiveVerifiedCourse: ctx.clearActiveVerifiedCourse,
  };
}
