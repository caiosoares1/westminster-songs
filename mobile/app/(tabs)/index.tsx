import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';

const MOCK_PLAYLISTS = [
  { id: '1', name: 'Culto Domingo Manha', songs: 12, status: 'Pronta' },
  { id: '2', name: 'Ensaio do Coro', songs: 8, status: 'Pronta' },
  { id: '3', name: 'Especial Jovens', songs: 0, status: 'Em montagem' },
] as const;

export default function PlaylistsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Playlists</Text>
        <Text style={styles.pageSubtitle}>Fase 3 em andamento. Base pronta para setlists.</Text>

        <View style={styles.list}>
          {MOCK_PLAYLISTS.map((playlist) => (
            <View key={playlist.id} style={styles.card}>
              <View style={styles.cardIcon}>
                <MaterialIcons name="queue-music" size={24} color={AppColors.primary} />
              </View>

              <View style={styles.cardTextBlock}>
                <Text style={styles.cardTitle}>{playlist.name}</Text>
                <Text style={styles.cardMeta}>{playlist.songs} musicas</Text>
              </View>

              <Text style={styles.cardStatus}>{playlist.status}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.primaryButton} disabled>
          <MaterialIcons name="playlist-add" size={20} color={AppColors.surface} />
          <Text style={styles.primaryButtonText}>Criar playlist (em breve)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 12,
  },
  pageTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    fontSize: 28,
  },
  pageSubtitle: {
    color: AppColors.textMuted,
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
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
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
    backgroundColor: AppColors.surfaceMuted,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMeta: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  cardStatus: {
    color: AppColors.primary,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 14,
    minHeight: 52,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: 0.7,
  },
  primaryButtonText: {
    color: AppColors.surface,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    fontSize: 16,
  },
});
