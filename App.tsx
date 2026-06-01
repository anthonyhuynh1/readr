import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { theme } from './src/constants/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PlaybackProvider } from './src/context/PlaybackContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { ProgressProvider } from './src/store/ProgressProvider';

function AppShell() {
  const { isSignedIn, isHydrated } = useAuth();

  if (!isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.brandOrange} />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.surface}
          translucent={false}
        />
        <AuthScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.surface}
        translucent={false}
      />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <ProgressProvider>
          <PlaybackProvider>
            <AppShell />
          </PlaybackProvider>
        </ProgressProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
});
