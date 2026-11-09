import { ActivityIndicator, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/providers/auth';
import { AppThemeProvider, useTheme } from '@/providers/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const signedIn = Boolean(user);

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="songs/create" options={{ headerShown: false }} />
        <Stack.Screen name="songs/import" options={{ headerShown: false }} />
        <Stack.Screen name="songs/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="setlists/[id]" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function ThemedApp() {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        {Platform.OS === 'web' ? (
          // On a computer screen, keep the app at a readable width.
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
              <RootNavigator />
            </View>
          </View>
        ) : (
          <RootNavigator />
        )}
      </AuthProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedApp />
    </AppThemeProvider>
  );
}
