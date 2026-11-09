import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/providers/theme';
import { apiErrorMessage } from '@/services/api';
import { createSetlist, getSetlists, type SetlistListItem } from '@/services/setlists';
import { showMessage } from '@/utils/dialog';
import { formatServiceDate, parseServiceDateInput } from '@/utils/service-date';

function songCountLabel(count: number): string {
  return count === 1 ? '1 musica' : `${count} musicas`;
}

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSetlists(await getSetlists());
    } catch (loadError) {
      console.error('Error fetching setlists:', loadError);
      setError(apiErrorMessage(loadError, 'Nao foi possivel carregar as playlists.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      showMessage('Nome obrigatorio', 'De um nome para a playlist, ex. Culto de Domingo.');
      return;
    }

    const isoDate = date.trim() ? parseServiceDateInput(date) : null;
    if (date.trim() && !isoDate) {
      showMessage('Data invalida', 'Use o formato dd/mm/aaaa, ex. 08/11/2026.');
      return;
    }

    try {
      setCreating(true);
      const created = await createSetlist({ name: name.trim(), date: isoDate });
      setName('');
      setDate('');
      router.push({ pathname: '/setlists/[id]', params: { id: created.id } });
    } catch (createError) {
      console.error('Error creating setlist:', createError);
      showMessage('Erro', apiErrorMessage(createError, 'Nao foi possivel criar a playlist.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }>
        <Text style={styles.pageTitle}>Playlists</Text>
        <Text style={styles.pageSubtitle}>
          Monte o repertorio do culto ou do ensaio, com o tom de cada musica.
        </Text>

        <View style={styles.createBox}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome, ex. Culto de Domingo"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="Data (opcional), dd/mm/aaaa"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <Pressable
            style={[styles.primaryButton, creating && styles.buttonDisabled]}
            onPress={() => void handleCreate()}
            disabled={creating}>
            <MaterialIcons name="playlist-add" size={20} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>{creating ? 'Criando...' : 'Criar playlist'}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && setlists.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma playlist ainda. Crie a primeira acima.</Text>
        ) : null}

        <View style={styles.list}>
          {setlists.map((setlist) => (
            <Pressable
              key={setlist.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/setlists/[id]', params: { id: setlist.id } })}>
              <View style={styles.cardIcon}>
                <MaterialIcons name="queue-music" size={24} color={colors.primary} />
              </View>

              <View style={styles.cardTextBlock}>
                <Text style={styles.cardTitle}>{setlist.name}</Text>
                <Text style={styles.cardMeta}>
                  {songCountLabel(setlist.songCount)}
                  {setlist.date ? ` · ${formatServiceDate(setlist.date)}` : ''}
                </Text>
              </View>

              <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 12,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    fontSize: 28,
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    marginTop: 8,
    gap: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 14,
    minHeight: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createBox: {
    marginTop: 6,
    gap: 10,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    fontSize: 16,
  },
});
