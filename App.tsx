import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './src/ui/nav';
import { HomeScreen } from './src/ui/HomeScreen';
import { ResultsScreen } from './src/ui/ResultsScreen';
import { DetailScreen } from './src/ui/DetailScreen';
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
          <Stack.Screen name="Results" component={ResultsScreen} options={{ title: '추천 코스' }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: '코스 상세' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
