import 'react-native-reanimated';
import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { theme } from './src/constants/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AiProvider } from './src/context/AiContext';
import { BookmarkProvider } from './src/context/BookmarkContext';
import { CatalogProvider } from './src/context/CatalogContext';
import { PlaybackProvider } from './src/context/PlaybackContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { ProgressProvider } from './src/store/ProgressProvider';

/**
 * AppShell — auth gate that decides whether to show the app or the sign-in screen.
 * Must be a child of AuthProvider so it can read auth state.
 */
function AppShell() {
  const { isSignedIn, isHydrated } = useAuth();

  if (!isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.brandOrange} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.surface}
        translucent={false}
      />
      <NavigationContainer key={isSignedIn ? 'app' : 'auth'}>
        {isSignedIn ? <RootNavigator /> : <AuthScreen />}
      </NavigationContainer>
    </>
  );
}

/**
 * Provider tree (outermost → innermost):
 *   SafeAreaProvider
 *   → AuthProvider          (session, OTP, dev guest)
 *     → ProgressProvider    (Reanimated SharedValue for 60fps karaoke clock)
 *       → CatalogProvider   (book catalog, discovery list)
 *         → BookmarkProvider (bookmark CRUD, offline-first sync)
 *           → PlaybackProvider (chapter, audio, session orchestration)
 *             → AiProvider   (Ask AI sheet state)
 *               → AppShell
 */
export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <ProgressProvider>
          <CatalogProvider>
            <BookmarkProvider>
              <PlaybackProvider>
                <AiProvider>
                  <AppShell />
                </AiProvider>
              </PlaybackProvider>
            </BookmarkProvider>
          </CatalogProvider>
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
