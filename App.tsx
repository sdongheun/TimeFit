import {
  DefaultTheme,
  NavigationContainer,
  Theme,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootStackParamList } from "./src/ui/nav";
import { HomeScreen } from "./src/ui/HomeScreen";
import { TimeSetupScreen } from "./src/ui/TimeSetupScreen";
import { ResultsScreen } from "./src/ui/ResultsScreen";
import { CourseConfirmScreen } from "./src/ui/CourseConfirmScreen";
import { PlaceDetailScreen } from "./src/ui/PlaceDetailScreen";
import { ProfileScreen } from "./src/ui/ProfileScreen";
import { ProfileManagementScreen } from "./src/ui/ProfileManagementScreen";
import { LoginScreen } from "./src/ui/LoginScreen";
import { ActivityRecordScreen } from "./src/ui/ActivityRecordScreen";
import { AppFlowProvider } from "./src/ui/AppFlowContext";
import { AuthProvider } from "./src/ui/AuthContext";
import { NearbyBrowseScreen } from "./src/ui/NearbyBrowseScreen";
import { C } from "./src/ui/theme";
import { PendingNavigationRouteBridge } from "./src/ui/liveActivity/PendingNavigationRouteBridge";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: C.bg,
    text: C.txt,
    border: C.line,
    primary: C.accent,
  },
};

function AppNavigation() {
  const navigation = useNavigationContainerRef<RootStackParamList>();
  const [ready, setReady] = useState(false);
  return <>
    <PendingNavigationRouteBridge navigation={navigation} ready={ready} />
    <NavigationContainer ref={navigation} theme={navTheme} onReady={() => setReady(true)}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.txt,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="TimeSetup" component={TimeSetupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CourseConfirm" component={CourseConfirmScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NearbyBrowse" component={NearbyBrowseScreen} options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="ProfileManagement" component={ProfileManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ActivityRecord" component={ActivityRecordScreen} options={{ headerShown: false, animation: 'none' }} />
      </Stack.Navigator>
    </NavigationContainer>
  </>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppFlowProvider>
          <AppNavigation />
        </AppFlowProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
