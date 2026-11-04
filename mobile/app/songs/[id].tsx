import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import SongViewer from '@/components/SongViewer';
import { AppColors, Fonts } from '@/constants/theme';
import { useTranspose } from '@/hooks/use-transpose';
import { getSong, type Song } from '@/services/songs';

export default function SongDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; key?: string | string[] }>();
  const songId = Array.isArray(params.id) ? params.id[0] : params.id;
  // Opened from a setlist: start in the key chosen for it.
  const startKey = Array.isArray(params.key) ? params.key[0] : params.key;

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
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
          <ActivityIndicator size="large" color={AppColors.primary} />
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerAction}>
          <MaterialIcons name="arrow-back" size={31} color={AppColors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/songs/create', params: { id: song.id } })}
          style={styles.headerAction}>
          <MaterialIcons name="edit" size={27} color={AppColors.primary} />
        </Pressable>
      </View>

      <View style={styles.heroBlock}>
        <View style={styles.songIconBox}>
          <MaterialIcons name="music-note" size={56} color={AppColors.primary} />
        </View>

        <View style={styles.heroTextContent}>
          <Text style={styles.heroTitle}>{song.title}</Text>
          <Text style={styles.heroSubtitle}>{song.author || 'Autor desconhecido'}</Text>
        </View>
      </View>

      <View style={styles.toolsRow}>
        <View style={styles.toolsLeftGroup}>
          <Pressable style={styles.toolItem} onPress={transposeDown}>
            <View style={styles.toolIconCircle}>
              <MaterialIcons name="swap-vert" size={27} color={AppColors.primary} />
            </View>
            <Text style={styles.toolLabel}>Transpor</Text>
          </Pressable>

          <Pressable style={styles.toolItem} onPress={resetTranspose}>
            <View style={styles.toolIconCircle}>
              <MaterialIcons name="text-fields" size={27} color={AppColors.primary} />
            </View>
            <Text style={styles.toolLabel}>Reset</Text>
          </Pressable>

          <Pressable style={styles.toolItem} onPress={() => setFavorite((value) => !value)}>
            <View style={styles.toolIconCircle}>
              <MaterialIcons
                name={favorite ? 'star' : 'star-border'}
                size={27}
                color={favorite ? AppColors.primaryStrong : AppColors.primary}
              />
            </View>
            <Text style={styles.toolLabel}>Favorito</Text>
          </Pressable>
        </View>

        <View style={styles.keyPill}>
          <Text style={styles.keyPillText}>Tom: {currentKey}</Text>
        </View>
      </View>

      <View style={styles.transposeActions}>
        <Pressable style={styles.transposeButton} onPress={transposeDown}>
          <Text style={styles.transposeButtonText}>-1</Text>
        </Pressable>

        <Pressable style={styles.transposeButton} onPress={resetTranspose}>
          <Text style={styles.transposeButtonText}>Reset</Text>
        </Pressable>

        <Pressable style={styles.transposeButton} onPress={transposeUp}>
          <Text style={styles.transposeButtonText}>+1</Text>
        </Pressable>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    height: 78,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    paddingHorizontal: 16,
    backgroundColor: AppColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 21,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  heroBlock: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  songIconBox: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  heroTextContent: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 18,
  },
  toolsRow: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolsLeftGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  toolItem: {
    alignItems: 'center',
    gap: 8,
  },
  toolIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  toolLabel: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontWeight: '700',
  },
  keyPill: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 999,
    minHeight: 58,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
  },
  keyPillText: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  transposeActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  transposeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transposeButtonText: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  songContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: AppColors.textMuted,
    fontFamily: Fonts.serif,
    fontSize: 17,
  },
  errorText: {
    color: '#b42318',
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
});
