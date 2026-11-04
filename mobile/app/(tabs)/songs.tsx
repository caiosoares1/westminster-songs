import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';
import { getSetlists, type SetlistListItem } from '@/services/setlists';
import { getSongs, type Song } from '@/services/songs';

const CATEGORIES = ['Todas', 'Hinos', 'Contemporaneas', 'Corais'] as const;

type Category = (typeof CATEGORIES)[number];

function filterByCategory(song: Song, category: Category): boolean {
  if (category === 'Todas') {
    return true;
  }

  const haystack = `${song.title} ${song.author ?? ''}`.toLowerCase();

  if (category === 'Hinos') {
    return haystack.includes('hino') || haystack.includes('tradicional');
  }

  if (category === 'Contemporaneas') {
    return !haystack.includes('hino');
  }

  if (category === 'Corais') {
    return haystack.includes('coro') || haystack.includes('coral');
  }

  return true;
}

export default function SongsScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setlists, setSetlists] = useState<SetlistListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');

  const loadSongs = useCallback(async () => {
    try {
      setError(null);
      const [data, setlistData] = await Promise.all([
        getSongs(),
        // Playlists are a nice-to-have here: don't fail the song list over them.
        getSetlists().catch(() => [] as SetlistListItem[]),
      ]);
      setSongs(data);
      setSetlists(setlistData);
    } catch (loadError) {
      console.error('Error fetching songs:', loadError);
      setError('Nao foi possivel carregar as musicas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSongs();
    }, [loadSongs])
  );

  const filteredSongs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return songs.filter((song) => {
      const haystack = `${song.title} ${song.author ?? ''} ${song.originalKey}`.toLowerCase();
      const matchesQuery = query.length === 0 || haystack.includes(query);
      return matchesQuery && filterByCategory(song, activeCategory);
    });
  }, [songs, searchQuery, activeCategory]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSongs();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={AppColors.primary} />
          }
          ListHeaderComponent={(
            <View style={styles.topSection}>
              <View style={styles.topBar}>
                <Pressable style={styles.circleButton}>
                  <MaterialIcons name="menu" size={26} color={AppColors.primary} />
                </Pressable>

                <Text style={styles.brandTitle}>Cifras Presbiterianas</Text>

                <Pressable style={styles.circleButton}>
                  <MaterialIcons name="person" size={24} color={AppColors.primary} />
                </Pressable>
              </View>

              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={24} color={AppColors.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar musicas, artistas ou letras"
                  placeholderTextColor={AppColors.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {CATEGORIES.map((category) => {
                  const selected = category === activeCategory;
                  return (
                    <Pressable
                      key={category}
                      onPress={() => setActiveCategory(category)}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Musicas Recentes</Text>
                <Text style={styles.sectionAction}>Ver tudo</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nenhuma musica encontrada</Text>
              <Text style={styles.emptySubtitle}>Ajuste a busca ou crie uma nova musica.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/songs/[id]', params: { id: item.id } }} asChild>
              <Pressable style={styles.card}>
                <View style={styles.cardIconBox}>
                  <MaterialIcons name="music-note" size={36} color={AppColors.primary} />
                </View>

                <View style={styles.cardTextContainer}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {item.author || 'Autor desconhecido'} - Tom: {item.originalKey}
                  </Text>
                </View>

                <MaterialIcons name="chevron-right" size={30} color={AppColors.border} />
              </Pressable>
            </Link>
          )}
          ListFooterComponent={
            setlists.length > 0 ? (
              <View style={styles.playlistsBlock}>
                <Text style={styles.sectionTitle}>Playlists</Text>
                <View style={styles.playlistsRow}>
                  {setlists.slice(0, 2).map((setlist) => (
                    <Link
                      key={setlist.id}
                      href={{ pathname: '/setlists/[id]', params: { id: setlist.id } }}
                      asChild>
                      <Pressable style={styles.playlistCard}>
                        <View style={styles.playlistOverlay} />
                        <Text style={styles.playlistTitle}>{setlist.name}</Text>
                        <Text style={styles.playlistCount}>
                          {setlist.songCount === 1 ? '1 musica' : `${setlist.songCount} musicas`}
                        </Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>
            ) : undefined
          }
        />

        <Link href="/songs/create" asChild>
          <Pressable style={styles.fab}>
            <MaterialIcons name="add" size={34} color={AppColors.surface} />
          </Pressable>
        </Link>

        <Link href="/songs/import" asChild>
          <Pressable style={styles.ocrFab}>
            <MaterialIcons name="photo-camera" size={25} color={AppColors.primaryStrong} />
          </Pressable>
        </Link>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSection: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primarySoft,
  },
  brandTitle: {
    flex: 1,
    textAlign: 'center',
    color: AppColors.primary,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  searchContainer: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
  },
  chipsRow: {
    gap: 12,
    paddingRight: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 24,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    color: AppColors.primaryStrong,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AppColors.surface,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: AppColors.text,
    fontWeight: '700',
  },
  sectionAction: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    color: AppColors.primary,
    fontWeight: '700',
  },
  errorText: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: '#b42318',
  },
  listContent: {
    gap: 14,
    paddingBottom: 160,
  },
  emptyState: {
    borderRadius: 22,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 18,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  card: {
    marginHorizontal: 20,
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    backgroundColor: AppColors.surface,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardIconBox: {
    width: 78,
    height: 78,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  cardTextContainer: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    fontFamily: Fonts.serif,
  },
  subtitle: {
    color: AppColors.primaryStrong,
    fontSize: 16,
    fontFamily: Fonts.serif,
  },
  playlistsBlock: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  playlistsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  playlistCard: {
    flex: 1,
    minHeight: 168,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'flex-end',
    backgroundColor: '#8CB5B6',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  playlistOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#214243',
    opacity: 0.4,
  },
  playlistTitle: {
    color: AppColors.surface,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    zIndex: 1,
  },
  playlistCount: {
    color: AppColors.surface,
    opacity: 0.85,
    fontFamily: Fonts.serif,
    fontSize: 16,
    zIndex: 1,
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 28,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ocrFab: {
    position: 'absolute',
    right: 22,
    bottom: 120,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
});
