import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import SongViewer from '@/components/SongViewer';
import { CATEGORY_LABEL } from '@/constants/categories';
import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/providers/theme';
import { useTranspose } from '@/hooks/use-transpose';
import { getSong, type Song } from '@/services/songs';

export default function SongDetailScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; key?: string | string[] }>();
  const songId = Array.isArray(params.id) ? params.id[0] : params.id;
  // Opened from a setlist: start in the key chosen for it.
  const startKey = Array.isArray(params.key) ? params.key[0] : params.key;

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    steps: transpose,
    currentKey,
    transposeUp,
    transposeDown,
    resetTranspose,
  } = useTranspose(song?.originalKey ?? 'C', song ? startKey : undefined);

  // Refetch whenever the screen regains focus, e.g. after editing the song.
  useFocusEffect(
    useCallback(() => {
      if (!songId) {
        return;
      }

      let isMounted = true;

      const fetchSong = async () => {
        try {
          setError(null);
          const data = await getSong(songId);

          if (!isMounted) {
            return;
          }

          setSong(data);
        } catch (fetchError) {
          console.error('Error fetching song:', fetchError);

          if (!isMounted) {
            return;
          }

          setSong(null);
          setError('Nao foi possivel carregar a musica.');
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      void fetchSong();

      return () => {
        isMounted = false;
      };
    }, [songId]),
  );

  if (!songId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>ID da musica invalido.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!song) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Musica nao encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const structureJson = song.versions[0]?.structureJson;
  const transposed = currentKey !== song.originalKey;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Compact header: the chord sheet is what matters on this screen. */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerAction} hitSlop={6}>
          <MaterialIcons name="arrow-back" size={26} color={colors.primary} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {song.title}
          </Text>
          {song.author || song.category ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {[song.category ? CATEGORY_LABEL[song.category] : null, song.author]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/songs/create', params: { id: song.id } })}
          style={styles.headerAction}
          hitSlop={6}>
          <MaterialIcons name="edit" size={23} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.keyBar}>
        <Pressable style={styles.keyButton} onPress={transposeDown} hitSlop={6}>
          <MaterialIcons name="remove" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.keyText}>Tom: {currentKey}</Text>
        <Pressable style={styles.keyButton} onPress={transposeUp} hitSlop={6}>
          <MaterialIcons name="add" size={20} color={colors.primary} />
        </Pressable>

        {transposed ? (
          <Pressable style={styles.resetButton} onPress={resetTranspose} hitSlop={6}>
            <MaterialIcons name="restart-alt" size={18} color={colors.textMuted} />
            <Text style={styles.resetText}>original {song.originalKey}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.songContent}>
        {structureJson ? (
          <SongViewer
            structureJson={structureJson}
            transposeSteps={transpose}
            originalKey={song.originalKey}
          />
        ) : (
          <Text style={styles.emptyText}>Sem versao de estrutura para esta musica.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#b42318',
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: Fonts.serif,
    fontSize: 17,
  },
  header: {
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  keyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  keyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  keyText: {
    minWidth: 70,
    textAlign: 'center',
    color: colors.primaryStrong,
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  resetButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  songContent: {
    flex: 1,
    paddingHorizontal: 14,
  },
});
