import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';
import { getTransposedKey } from '@/music/transpose';
import { apiErrorMessage } from '@/services/api';
import {
  deleteSetlist,
  getSetlist,
  replaceSetlistSongs,
  updateSetlist,
  type SetlistDetail,
  type SetlistSongSummary,
} from '@/services/setlists';
import { getSongs } from '@/services/songs';
import { confirmAction, showMessage } from '@/utils/dialog';
import { formatServiceDate, parseServiceDateInput } from '@/utils/service-date';

interface Entry {
  /** Local id, stable across reorders (server ids change on every save). */
  localId: string;
  song: SetlistSongSummary;
  key: string;
}

let localIdCounter = 0;
const nextLocalId = () => `entry-${(localIdCounter += 1)}`;

function toEntries(setlist: SetlistDetail): Entry[] {
  return setlist.songs.map((item) => ({ localId: nextLocalId(), song: item.song, key: item.key }));
}

export default function SetlistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const setlistId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [setlist, setSetlist] = useState<SetlistDetail | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingInfo, setEditingInfo] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [dateInput, setDateInput] = useState('');

  const [picking, setPicking] = useState(false);
  const [allSongs, setAllSongs] = useState<SetlistSongSummary[]>([]);
  const [search, setSearch] = useState('');

  // Saves run one after the other, so a slow request can't overwrite a newer list.
  const saveQueue = useRef(Promise.resolve());

  const load = useCallback(async () => {
    if (!setlistId) return;
    try {
      setError(null);
      const data = await getSetlist(setlistId);
      setSetlist(data);
      setEntries(toEntries(data));
    } catch (loadError) {
      console.error('Error fetching setlist:', loadError);
      setError(apiErrorMessage(loadError, 'Nao foi possivel carregar a playlist.'));
    } finally {
      setLoading(false);
    }
  }, [setlistId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const persist = (next: Entry[]) => {
    setEntries(next);
    if (!setlistId) return;

    saveQueue.current = saveQueue.current.then(async () => {
      try {
        setSaving(true);
        await replaceSetlistSongs(
          setlistId,
          next.map((entry) => ({ songId: entry.song.id, key: entry.key })),
        );
      } catch (saveError) {
        console.error('Error saving setlist songs:', saveError);
        showMessage('Erro ao salvar', apiErrorMessage(saveError, 'A playlist foi recarregada.'));
        await load();
      } finally {
        setSaving(false);
      }
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const changeKey = (index: number, steps: number) => {
    persist(
      entries.map((entry, i) =>
        i === index ? { ...entry, key: getTransposedKey(entry.key, steps) } : entry,
      ),
    );
  };

  const remove = (index: number) => {
    persist(entries.filter((_, i) => i !== index));
  };

  const addSong = (song: SetlistSongSummary) => {
    persist([...entries, { localId: nextLocalId(), song, key: song.originalKey }]);
  };

  const openPicker = async () => {
    setPicking(true);
    try {
      const songs = await getSongs();
      setAllSongs(
        songs.map(({ id, title, author, originalKey }) => ({
          id,
          title,
          author: author ?? null,
          originalKey,
        })),
      );
    } catch (pickError) {
      showMessage('Erro', apiErrorMessage(pickError, 'Nao foi possivel carregar as musicas.'));
    }
  };

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allSongs.filter((song) =>
      `${song.title} ${song.author ?? ''}`.toLowerCase().includes(query),
    );
  }, [allSongs, search]);

  const songIdsInList = useMemo(() => new Set(entries.map((entry) => entry.song.id)), [entries]);

  const startEditingInfo = () => {
    if (!setlist) return;
    setNameInput(setlist.name);
    setDateInput(setlist.date ? formatServiceDate(setlist.date) : '');
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!setlistId || !nameInput.trim()) {
      showMessage('Nome obrigatorio', 'A playlist precisa de um nome.');
      return;
    }
    const isoDate = dateInput.trim() ? parseServiceDateInput(dateInput) : null;
    if (dateInput.trim() && !isoDate) {
      showMessage('Data invalida', 'Use o formato dd/mm/aaaa, ex. 08/11/2026.');
      return;
    }

    try {
      const updated = await updateSetlist(setlistId, { name: nameInput.trim(), date: isoDate });
      setSetlist(updated);
      setEditingInfo(false);
    } catch (saveError) {
      showMessage('Erro', apiErrorMessage(saveError, 'Nao foi possivel salvar a playlist.'));
    }
  };

  const handleDelete = async () => {
    if (!setlistId || !setlist) return;
    const confirmed = await confirmAction(
      'Excluir playlist',
      `"${setlist.name}" sera apagada. As musicas continuam no app.`,
      'Excluir',
      true,
    );
    if (!confirmed) return;

    try {
      await deleteSetlist(setlistId);
      router.back();
    } catch (deleteError) {
      showMessage('Erro', apiErrorMessage(deleteError, 'Nao foi possivel excluir a playlist.'));
    }
  };

  if (loading || error || !setlist) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator size="large" color={AppColors.primary} />
          ) : (
            <Text style={styles.errorText}>{error ?? 'Playlist nao encontrada.'}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerAction}>
          <MaterialIcons name="arrow-back" size={28} color={AppColors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {setlist.name}
        </Text>
        <Pressable onPress={() => void handleDelete()} style={styles.headerAction}>
          <MaterialIcons name="delete-outline" size={26} color={AppColors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {editingInfo ? (
          <View style={styles.infoEdit}>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Nome da playlist"
              placeholderTextColor={AppColors.textMuted}
            />
            <TextInput
              style={styles.input}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="Data (opcional), dd/mm/aaaa"
              placeholderTextColor={AppColors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditingInfo(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void saveInfo()}>
                <Text style={styles.primaryButtonText}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.info} onPress={startEditingInfo}>
            <View style={styles.infoText}>
              <Text style={styles.title}>{setlist.name}</Text>
              <Text style={styles.meta}>
                {setlist.date ? formatServiceDate(setlist.date) : 'Sem data'} ·{' '}
                {entries.length === 1 ? '1 musica' : `${entries.length} musicas`}
                {saving ? ' · salvando...' : ''}
              </Text>
            </View>
            <MaterialIcons name="edit" size={22} color={AppColors.primary} />
          </Pressable>
        )}

        {entries.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma musica ainda. Adicione abaixo.</Text>
        ) : null}

        {entries.map((entry, index) => (
          <View key={entry.localId} style={styles.entry}>
            <Text style={styles.position}>{index + 1}</Text>

            <Pressable
              style={styles.entryText}
              onPress={() =>
                router.push({
                  pathname: '/songs/[id]',
                  params: { id: entry.song.id, key: entry.key },
                })
              }>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {entry.song.title}
              </Text>
              <Text style={styles.entryMeta} numberOfLines={1}>
                {entry.song.author || 'Autor desconhecido'}
                {entry.key !== entry.song.originalKey ? ` · original ${entry.song.originalKey}` : ''}
              </Text>
            </Pressable>

            <View style={styles.keyControl}>
              <Pressable onPress={() => changeKey(index, -1)} hitSlop={6}>
                <MaterialIcons name="remove" size={18} color={AppColors.primary} />
              </Pressable>
              <Text style={styles.keyText}>{entry.key}</Text>
              <Pressable onPress={() => changeKey(index, 1)} hitSlop={6}>
                <MaterialIcons name="add" size={18} color={AppColors.primary} />
              </Pressable>
            </View>

            <View style={styles.entryActions}>
              <Pressable onPress={() => move(index, -1)} disabled={index === 0} hitSlop={4}>
                <MaterialIcons
                  name="keyboard-arrow-up"
                  size={24}
                  color={index === 0 ? AppColors.border : AppColors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                disabled={index === entries.length - 1}
                hitSlop={4}>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={24}
                  color={index === entries.length - 1 ? AppColors.border : AppColors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable onPress={() => remove(index)} hitSlop={6}>
              <MaterialIcons name="close" size={22} color={AppColors.textMuted} />
            </Pressable>
          </View>
        ))}

        {picking ? (
          <View style={styles.picker}>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar musica"
                placeholderTextColor={AppColors.textMuted}
              />
              <Pressable style={styles.secondaryButton} onPress={() => setPicking(false)}>
                <Text style={styles.secondaryButtonText}>Fechar</Text>
              </Pressable>
            </View>
            {filteredSongs.map((song) => (
              <Pressable key={song.id} style={styles.pickItem} onPress={() => addSong(song)}>
                <MaterialIcons name="add-circle-outline" size={22} color={AppColors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.entryMeta}>
                    Tom {song.originalKey}
                    {songIdsInList.has(song.id) ? ' · ja esta na playlist' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            {allSongs.length > 0 && filteredSongs.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma musica encontrada.</Text>
            ) : null}
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => void openPicker()}>
            <MaterialIcons name="playlist-add" size={22} color={AppColors.surface} />
            <Text style={styles.primaryButtonText}>Adicionar musicas</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AppColors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: AppColors.danger, fontSize: 16, textAlign: 'center' },
  header: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    marginHorizontal: 6,
  },
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  infoText: { flex: 1, gap: 4 },
  infoEdit: { gap: 10 },
  title: { color: AppColors.text, fontFamily: Fonts.serif, fontSize: 22, fontWeight: '700' },
  meta: { color: AppColors.primaryStrong, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  flex: { flex: 1 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 12,
    color: AppColors.text,
    fontSize: 16,
  },
  emptyText: { color: AppColors.textMuted, fontSize: 15, paddingVertical: 8 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  position: { width: 20, color: AppColors.textMuted, fontWeight: '700', textAlign: 'center' },
  entryText: { flex: 1, gap: 2 },
  entryTitle: { color: AppColors.text, fontFamily: Fonts.serif, fontSize: 16, fontWeight: '700' },
  entryMeta: { color: AppColors.textMuted, fontSize: 13 },
  keyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AppColors.surfaceMuted,
  },
  keyText: {
    minWidth: 30,
    textAlign: 'center',
    color: AppColors.primaryStrong,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    fontSize: 15,
  },
  entryActions: { alignItems: 'center' },
  picker: {
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: AppColors.surfaceMuted,
  },
  pickItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  addButton: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: AppColors.surface, fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: AppColors.primaryStrong, fontWeight: '700', fontSize: 15 },
});
