import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './src/ui/nav';
import { HomeScreen } from './src/ui/HomeScreen';
import { ResultsScreen } from './src/ui/ResultsScreen';
import { DetailScreen } from './src/ui/DetailScreen';
import { ExecutionScreen } from './src/ui/ExecutionScreen';
import { FeedbackScreen } from './src/ui/FeedbackScreen';
import { C } from './src/ui/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.txt, border: C.line, primary: C.accent },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.txt,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Results" component={ResultsScreen} options={{ title: '코스 만들기' }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: '코스 상세' }} />
          <Stack.Screen name="Execution" component={ExecutionScreen} options={{ title: '코스 진행 중', headerBackTitle: '상세' }} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: '코스 완료', headerBackVisible: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
