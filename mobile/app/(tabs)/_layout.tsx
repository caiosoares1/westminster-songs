import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/providers/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.serif,
          fontSize: 12,
          letterSpacing: 1,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="songs"
        options={{
          title: 'MUSICAS',
          tabBarIcon: ({ color }) => <IconSymbol size={27} name="music.note.list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'PLAYLISTS',
          tabBarIcon: ({ color }) => <IconSymbol size={27} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'CONTA',
          tabBarIcon: ({ color }) => <IconSymbol size={27} name="person.crop.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
