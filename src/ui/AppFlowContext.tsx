import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import { RootStackParamList } from './nav';

type ResultsParams = RootStackParamList['Results'];
type ExecutionParams = RootStackParamList['Execution'];

export type SavedCourse = ExecutionParams & {
  id: string;
  title: string;
  createdAt: number;
};

type AppFlowContextValue = {
  latestResults: ResultsParams | null;
  activeCourse: ExecutionParams | null;
  savedCourses: SavedCourse[];
  setLatestResults: (params: ResultsParams) => void;
  setActiveCourse: (params: ExecutionParams | null) => void;
  saveCourse: (params: ExecutionParams) => SavedCourse;
  removeSavedCourse: (id: string) => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const [latestResults, setLatestResultsState] = useState<ResultsParams | null>(null);
  const [activeCourse, setActiveCourseState] = useState<ExecutionParams | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const setLatestResults = useCallback((params: ResultsParams) => setLatestResultsState(params), []);
  const setActiveCourse = useCallback((params: ExecutionParams | null) => setActiveCourseState(params), []);
  const saveCourse = useCallback((params: ExecutionParams) => {
    const title = params.course.spots.map((sp) => sp.title).join(' + ');
    const saved: SavedCourse = {
      ...params,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: Date.now(),
    };
    setSavedCourses((prev) => [saved, ...prev]);
    return saved;
  }, []);
  const removeSavedCourse = useCallback((id: string) => {
    setSavedCourses((prev) => prev.filter((course) => course.id !== id));
  }, []);

  const value = useMemo<AppFlowContextValue>(() => ({
    latestResults,
    activeCourse,
    savedCourses,
    setLatestResults,
    setActiveCourse,
    saveCourse,
    removeSavedCourse,
  }), [latestResults, activeCourse, savedCourses, setLatestResults, setActiveCourse, saveCourse, removeSavedCourse]);

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useAppFlow must be used inside AppFlowProvider');
  return ctx;
}
