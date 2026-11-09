import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles, type ThemeMode } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { apiErrorMessage } from '@/services/api';
import { getMembers, removeMember, setMemberRole, type Member } from '@/services/auth';
import { confirmAction, showMessage } from '@/utils/dialog';

const ROLE_LABEL = { admin: 'Administrador', member: 'Membro' } as const;

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { mode: 'system', label: 'Automático', icon: 'brightness-auto' },
  { mode: 'light', label: 'Claro', icon: 'light-mode' },
  { mode: 'dark', label: 'Escuro', icon: 'dark-mode' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, isAdmin, signOut } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setError(null);
      setMembers(await getMembers());
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Nao foi possivel carregar os membros.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const toggleRole = async (member: Member) => {
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const confirmed = await confirmAction(
      nextRole === 'admin' ? 'Tornar administrador' : 'Remover de administrador',
      nextRole === 'admin'
        ? `${member.name} podera excluir musicas e gerenciar membros.`
        : `${member.name} deixara de poder excluir musicas e gerenciar membros.`,
      'Confirmar',
    );
    if (!confirmed) return;

    try {
      await setMemberRole(member.id, nextRole);
      await loadMembers();
    } catch (roleError) {
      showMessage('Erro', apiErrorMessage(roleError, 'Nao foi possivel alterar o membro.'));
    }
  };

  const handleRemove = async (member: Member) => {
    const confirmed = await confirmAction(
      'Remover do grupo',
      `${member.name} perdera o acesso ao app. As musicas e playlists continuam.`,
      'Remover',
      true,
    );
    if (!confirmed) return;

    try {
      await removeMember(member.id);
      await loadMembers();
    } catch (removeError) {
      showMessage('Erro', apiErrorMessage(removeError, 'Nao foi possivel remover o membro.'));
    }
  };

  const handleSignOut = async () => {
    if (await confirmAction('Sair', 'Deseja sair da sua conta neste aparelho?', 'Sair')) {
      await signOut();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Conta</Text>

        <View style={styles.block}>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowIcon}>
              <MaterialIcons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{user?.name}</Text>
              <Text style={styles.rowValue}>
                {user?.email} · {user ? ROLE_LABEL[user.role] : ''}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tema</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const selected = option.mode === mode;
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.themeOption, selected && styles.themeOptionSelected]}
                onPress={() => setMode(option.mode)}>
                <MaterialIcons
                  name={option.icon}
                  size={20}
                  color={selected ? colors.onPrimary : colors.primary}
                />
                <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Membros do grupo</Text>
        {isAdmin ? (
          <Text style={styles.hint}>
            Para alguem entrar, passe o codigo do grupo. Somente administradores podem excluir
            musicas.
          </Text>
        ) : null}

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {members.length > 0 ? (
          <View style={styles.block}>
            {members.map((member, index) => {
              const isSelf = member.id === user?.id;
              return (
                <View
                  key={member.id}
                  style={[styles.row, index === members.length - 1 && styles.rowLast]}>
                  <View style={styles.rowIcon}>
                    <MaterialIcons
                      name={member.role === 'admin' ? 'verified-user' : 'person-outline'}
                      size={21}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>
                      {member.name}
                      {isSelf ? ' (voce)' : ''}
                    </Text>
                    <Text style={styles.rowValue}>{ROLE_LABEL[member.role]}</Text>
                  </View>
                  {isAdmin && !isSelf ? (
                    <View style={styles.memberActions}>
                      <Pressable onPress={() => void toggleRole(member)} hitSlop={6}>
                        <MaterialIcons
                          name={member.role === 'admin' ? 'remove-moderator' : 'add-moderator'}
                          size={22}
                          color={colors.primary}
                        />
                      </Pressable>
                      <Pressable onPress={() => void handleRemove(member)} hitSlop={6}>
                        <MaterialIcons name="person-remove" size={22} color={colors.danger} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <Pressable style={styles.signOut} onPress={() => void handleSignOut()}>
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  themeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  themeLabelSelected: {
    color: colors.onPrimary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 14,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  block: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  rowValue: {
    color: colors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  sectionTitle: {
    marginTop: 8,
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  signOut: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
