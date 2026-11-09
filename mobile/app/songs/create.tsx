import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/providers/theme';
import { normalizeKey } from '@/music/chordParser';
import { chordsAboveLyricsToBracket, transposeEditorContent } from '@/music/editor';
import { useAuth } from '@/providers/auth';
import { apiErrorMessage } from '@/services/api';
import {
  createSong,
  deleteSong,
  getSong,
  updateSong,
  type SongStructure,
  type SongVersion,
} from '@/services/songs';
import { confirmAction, showMessage } from '@/utils/dialog';
import {
  isSongStructure,
  parseBracketContentToStructure,
  structureToBracketContent,
} from '@/utils/song-structure';

const QUICK_CHORDS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Em', 'Dm'] as const;

const INITIAL_CONTENT = `[Verso]
[C]Escreva a letra aqui e co[G]loque cada acorde
[Am]entre colchetes, antes da [F]sílaba em que ele entra.

[Refrão]
[F]Use [G]Refrão, Ponte, Intro... [C]como títulos.
`;

const FORMAT_HELP =
  'Coloque cada acorde entre colchetes, antes da sílaba: [C]Castelo [G]forte.\n\n' +
  'Títulos de seção ficam sozinhos na linha: [Verso], [Refrão], [Ponte].\n\n' +
  'Estrofes sem título: separe com uma linha em branco (viram Verso 2, Verso 3...).\n\n' +
  'Toque em "Acordes automáticos" para converter uma cifra colada de site (acordes na linha de cima) ' +
  'e para completar as estrofes sem acordes com o padrão da estrofe cifrada.';

function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function SongFormScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const songId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEditing = Boolean(songId);
  const { isAdmin } = useAuth();

  const [title, setTitle] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState(isEditing ? '' : INITIAL_CONTENT);
  /** Content before the last "Acordes automáticos", to undo it. */
  const [contentBeforeAuto, setContentBeforeAuto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [savedStructure, setSavedStructure] = useState<SongStructure | null>(null);
  const [panel, setPanel] = useState<'none' | 'transpose' | 'history'>('none');

  useEffect(() => {
    if (!songId) {
      return;
    }

    let isMounted = true;
    getSong(songId)
      .then((song) => {
        if (!isMounted) return;
        const latest = song.versions[0]?.structureJson;
        setTitle(song.title);
        setAuthor(song.author ?? '');
        setOriginalKey(song.originalKey);
        setVersions(song.versions);
        if (isSongStructure(latest)) {
          setSavedStructure(latest);
          setContent(structureToBracketContent(latest));
        }
      })
      .catch((error) => {
        console.error('Error loading song for edit:', error);
        if (isMounted) setLoadError(apiErrorMessage(error, 'Nao foi possivel carregar a musica.'));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [songId]);

  const validVersions = useMemo(
    () => versions.filter((version) => isSongStructure(version.structureJson)),
    [versions],
  );

  const handleInsertChord = (chord: string) => {
    setContent(
      (previous) =>
        `${previous}${previous.endsWith('\n') || previous.length === 0 ? '' : ' '}[${chord}] `,
    );
  };

  const handleAutoChords = () => {
    try {
      const converted = chordsAboveLyricsToBracket(content);
      if (converted.trim() === content.trim()) {
        showMessage('Nada para mudar', 'Nao encontrei acordes acima da letra nem estrofes para completar.');
        return;
      }
      setContentBeforeAuto(content);
      setContent(converted);
    } catch {
      showMessage('Nada para converter', 'Cole a cifra com os acordes na linha de cima da letra.');
    }
  };

  const handleTranspose = (steps: number) => {
    const key = normalizeKey(originalKey);
    if (!key) {
      showMessage('Tom invalido', 'Preencha o tom original antes de transpor.');
      return;
    }

    try {
      const result = transposeEditorContent(content, key, steps);
      setContent(result.content);
      setContentBeforeAuto(null);
      setOriginalKey(result.key);
    } catch {
      showMessage('Erro', 'Nao foi possivel interpretar a letra/cifras.');
    }
  };

  const handleRestoreVersion = async (version: SongVersion) => {
    const confirmed = await confirmAction(
      'Restaurar versão',
      `Substituir o conteúdo do editor pela versão de ${formatVersionDate(version.createdAt)}? Ela só é salva quando você tocar em Salvar.`,
      'Restaurar',
    );
    if (confirmed && isSongStructure(version.structureJson)) {
      setContent(structureToBracketContent(version.structureJson));
      setContentBeforeAuto(null);
      setPanel('none');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !originalKey.trim() || !content.trim()) {
      showMessage('Erro', 'Titulo, tonalidade e letra sao obrigatorios.');
      return;
    }

    const key = normalizeKey(originalKey);
    if (!key) {
      showMessage('Tom invalido', 'Use um tom como C, F#, Bb, Am ou Do, Re menor.');
      return;
    }

    let structureJson: SongStructure;
    try {
      structureJson = parseBracketContentToStructure(content);
    } catch (error) {
      console.error('Error parsing content:', error);
      showMessage('Erro', 'Nao foi possivel interpretar a letra/cifras.');
      return;
    }

    try {
      setSaving(true);
      if (songId) {
        // Only send the structure when it changed: each one becomes a new version.
        const structureChanged = JSON.stringify(structureJson) !== JSON.stringify(savedStructure);
        await updateSong(songId, {
          title: title.trim(),
          originalKey: key,
          author: author.trim(),
          ...(structureChanged ? { structureJson } : {}),
        });
      } else {
        await createSong({
          title: title.trim(),
          originalKey: key,
          author: author.trim() || undefined,
          structureJson,
        });
      }
      router.back();
    } catch (error) {
      console.error('Error saving song:', error);
      showMessage('Erro', apiErrorMessage(error, 'Nao foi possivel salvar a musica.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!songId) return;
    const confirmed = await confirmAction(
      'Excluir música',
      `"${title || 'Esta música'}" e todo o histórico de versões serão apagados. Isso não pode ser desfeito.`,
      'Excluir',
      true,
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteSong(songId);
      router.dismissTo('/songs');
    } catch (error) {
      console.error('Error deleting song:', error);
      showMessage('Erro', apiErrorMessage(error, 'Nao foi possivel excluir a musica.'));
      setDeleting(false);
    }
  };

  if (loading || loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          {loadError ? (
            <Text style={styles.errorText}>{loadError}</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const busy = saving || deleting;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerIconButton}>
          <MaterialIcons name="close" size={34} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>{isEditing ? 'Editar Musica' : 'Nova Musica'}</Text>

        <Pressable onPress={handleSave} disabled={busy}>
          <Text style={[styles.saveText, busy && styles.saveTextDisabled]}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!isEditing ? (
          <Pressable style={styles.importShortcut} onPress={() => router.push('/songs/import')}>
            <MaterialIcons name="photo-camera" size={24} color={colors.primary} />
            <View style={styles.importShortcutTextBlock}>
              <Text style={styles.importShortcutTitle}>Importar por OCR</Text>
              <Text style={styles.importShortcutSubtitle}>
                Escaneie uma folha e revise antes de salvar.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
          </Pressable>
        ) : null}

        <Text style={styles.label}>TITULO DA MUSICA</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="ex. Castelo Forte"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>ARTISTA / COMPOSITOR</Text>
        <TextInput
          style={styles.input}
          value={author}
          onChangeText={setAuthor}
          placeholder="ex. Martinho Lutero"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>TONALIDADE ORIGINAL</Text>
        <TextInput
          style={styles.input}
          value={originalKey}
          onChangeText={setOriginalKey}
          placeholder="ex. C, Dm, F# ou Dó, Ré menor"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.contentHeader}>
          <Text style={styles.label}>LETRA & CIFRAS</Text>
          <Pressable
            onPress={() => showMessage('Como formatar', FORMAT_HELP)}
            style={styles.helpButton}>
            <MaterialIcons name="help-outline" size={16} color={colors.primary} />
            <Text style={styles.helpButtonText}>Como formatar</Text>
          </Pressable>
        </View>

        <View style={styles.contentBox}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChordsRow}>
            {QUICK_CHORDS.map((chord) => (
              <Pressable
                key={chord}
                onPress={() => handleInsertChord(chord)}
                style={styles.quickChordButton}>
                <Text style={styles.quickChordButtonText}>{chord}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={styles.textArea}
            multiline
            value={content}
            onChangeText={(text) => {
              setContent(text);
              setContentBeforeAuto(null);
            }}
            placeholder="[C]Castelo forte é [G]nosso Deus"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {isEditing && isAdmin ? (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={busy}>
            <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Excluindo...' : 'Excluir musica'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {panel === 'transpose' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Transpor a cifra ({originalKey || 'sem tom'})</Text>
          <View style={styles.panelRow}>
            <Pressable style={styles.panelButton} onPress={() => handleTranspose(-1)}>
              <Text style={styles.panelButtonText}>-1</Text>
            </Pressable>
            <Pressable style={styles.panelButton} onPress={() => handleTranspose(1)}>
              <Text style={styles.panelButtonText}>+1</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {panel === 'history' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Versões salvas</Text>
          {validVersions.length === 0 ? (
            <Text style={styles.panelEmpty}>Nenhuma versão salva ainda.</Text>
          ) : (
            <ScrollView style={styles.historyList}>
              {validVersions.map((version, index) => (
                <Pressable
                  key={version.id}
                  style={styles.historyItem}
                  onPress={() => void handleRestoreVersion(version)}>
                  <MaterialIcons name="history" size={18} color={colors.primary} />
                  <Text style={styles.historyText}>
                    {formatVersionDate(version.createdAt)}
                    {index === 0 ? ' (atual)' : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {contentBeforeAuto !== null ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>Acordes aplicados. Confira a letra.</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setContent(contentBeforeAuto);
              setContentBeforeAuto(null);
            }}>
            <Text style={styles.undoAction}>Desfazer</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomTools}>
        <Pressable style={styles.toolPill} onPress={handleAutoChords}>
          <MaterialIcons name="auto-fix-high" size={20} color={colors.primary} />
          <Text style={styles.toolText} numberOfLines={1}>
            Acordes
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toolPill, panel === 'transpose' && styles.toolPillActive]}
          onPress={() => setPanel(panel === 'transpose' ? 'none' : 'transpose')}>
          <MaterialIcons name="swap-vert" size={21} color={colors.primary} />
          <Text style={styles.toolText} numberOfLines={1}>
            Transpor
          </Text>
        </Pressable>
        {isEditing ? (
          <Pressable
            style={[styles.toolPill, panel === 'history' && styles.toolPillActive]}
            onPress={() => setPanel(panel === 'history' ? 'none' : 'history')}>
            <MaterialIcons name="history" size={21} color={colors.primary} />
            <Text style={styles.toolText} numberOfLines={1}>
              Histórico
            </Text>
          </Pressable>
        ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
  },
  deleteButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    color: colors.danger,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  panel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  panelTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontWeight: '700',
  },
  panelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  panelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  panelButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  panelEmpty: {
    color: colors.textMuted,
    fontSize: 14,
  },
  historyList: {
    maxHeight: 180,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  historyText: {
    color: colors.text,
    fontSize: 15,
  },
  toolPillActive: {
    backgroundColor: colors.primarySoft,
  },
  header: {
    height: 82,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '700',
  },
  saveText: {
    color: colors.primary,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  saveTextDisabled: {
    opacity: 0.45,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 14,
  },
  importShortcut: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  importShortcutTextBlock: {
    flex: 1,
    gap: 3,
  },
  importShortcutTitle: {
    color: colors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  importShortcutSubtitle: {
    color: colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  label: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 17,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  input: {
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 18,
  },
  contentHeader: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpButtonText: {
    color: colors.primary,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  contentBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  quickChordsRow: {
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  quickChordButton: {
    minWidth: 70,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  quickChordButtonText: {
    color: colors.onPrimary,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 410,
    padding: 18,
    color: colors.text,
    fontFamily: Fonts.mono,
    fontSize: 17,
    lineHeight: 30,
    textAlignVertical: 'top',
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  undoText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
  },
  undoAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomTools: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.background,
  },
  toolPill: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  toolText: {
    color: colors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
