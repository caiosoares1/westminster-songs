import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppColors, Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: AppColors.surface,
          borderTopColor: AppColors.border,
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
