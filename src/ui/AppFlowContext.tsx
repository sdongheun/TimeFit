import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { RootStackParamList } from './nav';
import { listSavedCoursesFromRepository, removeCourseFromRepository, saveCourseToRepository } from '../services/courseRepository';
import { useAuth } from './AuthContext';

type ResultsParams = RootStackParamList['Results'];
type ExecutionParams = RootStackParamList['Execution'];

export type SavedCourse = ExecutionParams & { id: string; title: string; createdAt: number };

type AppFlowContextValue = {
  latestResults: ResultsParams | null;
  activeCourse: ExecutionParams | null;
  savedCourses: SavedCourse[];
  isCoursesLoading: boolean;
  coursesError: string;
  setLatestResults: (params: ResultsParams) => void;
  setActiveCourse: (params: ExecutionParams | null) => void;
  refreshSavedCourses: () => Promise<void>;
  saveCourse: (params: ExecutionParams) => Promise<SavedCourse>;
  removeSavedCourse: (id: string) => Promise<void>;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [latestResults, setLatestResultsState] = useState<ResultsParams | null>(null);
  const [activeCourse, setActiveCourseState] = useState<ExecutionParams | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const setLatestResults = useCallback((params: ResultsParams) => setLatestResultsState(params), []);
  const setActiveCourse = useCallback((params: ExecutionParams | null) => setActiveCourseState(params), []);
  const refreshSavedCourses = useCallback(async () => {
    if (!session) {
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
  }, [session]);

  useEffect(() => {
    void refreshSavedCourses();
  }, [refreshSavedCourses]);

  const saveCourse = useCallback(async (params: ExecutionParams) => {
    const saved = await saveCourseToRepository(params);
    setSavedCourses((prev) => [saved, ...prev]);
    return saved;
  }, []);
  const removeSavedCourse = useCallback(async (id: string) => {
    await removeCourseFromRepository(id);
    setSavedCourses((prev) => prev.filter((course) => course.id !== id));
  }, []);

  const value = useMemo<AppFlowContextValue>(() => ({
    latestResults,
    activeCourse,
    savedCourses,
    isCoursesLoading,
    coursesError,
    setLatestResults,
    setActiveCourse,
    refreshSavedCourses,
    saveCourse,
    removeSavedCourse,
  }), [latestResults, activeCourse, savedCourses, isCoursesLoading, coursesError, setLatestResults, setActiveCourse, refreshSavedCourses, saveCourse, removeSavedCourse]);

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useAppFlow must be used inside AppFlowProvider');
  return ctx;
}
