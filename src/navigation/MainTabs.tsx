import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Explore: 'Explore',
  Library: 'Library',
  Community: 'Community',
  Profile: 'Profile',
};

const TAB_BAR_HEIGHT = 56;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{label.slice(0, 1)}</Text>
  );
}

export function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandOrange,
        tabBarInactiveTintColor: theme.colors.dimmedText,
        tabBarStyle: {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 8),
          height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={TAB_LABELS[route.name]} focused={focused} />
        ),
        sceneContainerStyle: styles.scene,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: theme.colors.surface,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  icon: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dimmedText,
  },
  iconFocused: {
    color: theme.colors.brandOrange,
  },
});
