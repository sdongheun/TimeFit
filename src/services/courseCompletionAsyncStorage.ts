import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCourseCompletionRepository, type CourseCompletionStorage } from './courseCompletionRepository';

const asyncStorageAdapter: CourseCompletionStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const courseCompletionRepository = createCourseCompletionRepository(asyncStorageAdapter);
