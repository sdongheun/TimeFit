import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import { RootStackParamList } from './nav';

type ResultsParams = RootStackParamList['Results'];
type ExecutionParams = RootStackParamList['Execution'];

type AppFlowContextValue = {
  latestResults: ResultsParams | null;
  activeCourse: ExecutionParams | null;
  setLatestResults: (params: ResultsParams) => void;
  setActiveCourse: (params: ExecutionParams | null) => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: PropsWithChildren) {
  const [latestResults, setLatestResultsState] = useState<ResultsParams | null>(null);
  const [activeCourse, setActiveCourseState] = useState<ExecutionParams | null>(null);
  const setLatestResults = useCallback((params: ResultsParams) => setLatestResultsState(params), []);
  const setActiveCourse = useCallback((params: ExecutionParams | null) => setActiveCourseState(params), []);

  const value = useMemo<AppFlowContextValue>(() => ({
    latestResults,
    activeCourse,
    setLatestResults,
    setActiveCourse,
  }), [latestResults, activeCourse, setLatestResults, setActiveCourse]);

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useAppFlow must be used inside AppFlowProvider');
  return ctx;
}
