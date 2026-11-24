import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '../src/bridgeHandlers';
import { SHELL_BACKGROUND } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: SHELL_BACKGROUND } }} />
    </SafeAreaProvider>
  );
}
