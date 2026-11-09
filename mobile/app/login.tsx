import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { apiErrorMessage } from '@/services/api';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password || (isRegister && (!name.trim() || !inviteCode.trim()))) {
      setError('Preencha todos os campos.');
      return;
    }
    if (isRegister && password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      if (isRegister) {
        await signUp({ name, email, password, inviteCode });
      } else {
        await signIn(email, password);
      }
      // The navigator switches to the app as soon as the user is set.
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'Nao foi possivel entrar. Tente de novo.'));
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <MaterialIcons name="library-music" size={40} color={colors.onPrimary} />
          </View>
          <Text style={styles.title}>Westminster Songs</Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? 'Crie sua conta com o codigo que o administrador do grupo te passou.'
              : 'Entre para ver as cifras e playlists do grupo.'}
          </Text>

          <View style={styles.form}>
            {isRegister ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.textMuted}
                autoComplete="name"
                textContentType="name"
              />
            ) : null}
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={isRegister ? 'Senha (minimo 8 caracteres)' : 'Senha'}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              textContentType={isRegister ? 'newPassword' : 'password'}
            />
            {isRegister ? (
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Codigo do grupo"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}>
              <Text style={styles.buttonText}>
                {submitting ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
              </Text>
            </Pressable>

            <Pressable onPress={switchMode} style={styles.switch}>
              <Text style={styles.switchText}>
                {isRegister ? 'Ja tenho conta. Entrar' : 'Primeira vez? Criar conta'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 10,
  },
  logo: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    textAlign: 'center',
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  form: { marginTop: 14, gap: 12 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  switch: { alignItems: 'center', paddingVertical: 8 },
  switchText: { color: colors.primaryStrong, fontSize: 15, fontWeight: '600' },
});
