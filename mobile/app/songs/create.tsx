import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';
import { normalizeKey } from '@/music/chordParser';
import { apiErrorMessage } from '@/services/api';
import { createSong } from '@/services/songs';
import { parseBracketContentToStructure } from '@/utils/song-structure';

const QUICK_CHORDS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Em', 'Dm'] as const;

const INITIAL_CONTENT = `[Verse]
[C] Is this the real life?
[Am] Is this just fantasy?
`;

export default function CreateSongScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState(INITIAL_CONTENT);
  const [saving, setSaving] = useState(false);

  const handleInsertChord = (chord: string) => {
    setContent((previous) => `${previous}${previous.endsWith('\n') || previous.length === 0 ? '' : ' '}[${chord}] `);
  };

  const handleSave = async () => {
    if (!title.trim() || !originalKey.trim() || !content.trim()) {
      Alert.alert('Erro', 'Titulo, tonalidade e letra sao obrigatorios.');
      return;
    }

    const key = normalizeKey(originalKey);
    if (!key) {
      Alert.alert('Tom invalido', 'Use um tom como C, F#, Bb, Am ou Do, Re menor.');
      return;
    }

    let structureJson: ReturnType<typeof parseBracketContentToStructure>;
    try {
      structureJson = parseBracketContentToStructure(content);
    } catch (error) {
      console.error('Error parsing content:', error);
      Alert.alert('Erro', 'Nao foi possivel interpretar a letra/cifras.');
      return;
    }

    try {
      setSaving(true);
      await createSong({
        title: title.trim(),
        originalKey: key,
        author: author.trim() || undefined,
        structureJson,
      });
      router.back();
    } catch (error) {
      console.error('Error creating song:', error);
      Alert.alert('Erro', apiErrorMessage(error, 'Nao foi possivel criar a musica.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFormatHelp = () => {
    Alert.alert(
      'Como formatar',
      'Use [Verse], [Chorus] e acordes entre colchetes, ex: [C] Eu te louvo.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerIconButton}>
          <MaterialIcons name="close" size={34} color={AppColors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Adicionar/Editar Musica</Text>

        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.importShortcut} onPress={() => router.push('/songs/import')}>
          <MaterialIcons name="photo-camera" size={24} color={AppColors.primary} />
          <View style={styles.importShortcutTextBlock}>
            <Text style={styles.importShortcutTitle}>Importar por OCR</Text>
            <Text style={styles.importShortcutSubtitle}>Escaneie uma folha e revise antes de salvar.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={AppColors.primary} />
        </Pressable>

        <Text style={styles.label}>TITULO DA MUSICA</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="ex. Bohemian Rhapsody"
          placeholderTextColor={AppColors.textMuted}
        />

        <Text style={styles.label}>ARTISTA / COMPOSITOR</Text>
        <TextInput
          style={styles.input}
          value={author}
          onChangeText={setAuthor}
          placeholder="e.g. Queen"
          placeholderTextColor={AppColors.textMuted}
        />

        <Text style={styles.label}>TONALIDADE ORIGINAL</Text>
        <TextInput
          style={styles.input}
          value={originalKey}
          onChangeText={setOriginalKey}
          placeholder="ex. C, Dm, F#"
          placeholderTextColor={AppColors.textMuted}
        />

        <View style={styles.contentHeader}>
          <Text style={styles.label}>LETRA & CIFRAS</Text>
          <Pressable onPress={handleFormatHelp} style={styles.helpButton}>
            <MaterialIcons name="help-outline" size={16} color={AppColors.primary} />
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
            onChangeText={setContent}
            placeholder="[C] Is this the real life?"
            placeholderTextColor={AppColors.textMuted}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomTools}>
        <Pressable style={styles.toolPill}>
          <MaterialIcons name="music-note" size={21} color={AppColors.primary} />
          <Text style={styles.toolText}>Acordes Automaticos</Text>
        </Pressable>
        <Pressable style={styles.toolPill}>
          <MaterialIcons name="swap-vert" size={21} color={AppColors.primary} />
          <Text style={styles.toolText}>Transpor</Text>
        </Pressable>
        <Pressable style={styles.toolPill}>
          <MaterialIcons name="history" size={21} color={AppColors.primary} />
          <Text style={styles.toolText}>Historico</Text>
        </Pressable>
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
    height: 82,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surface,
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
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '700',
  },
  saveText: {
    color: AppColors.primary,
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
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
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
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  importShortcutSubtitle: {
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  label: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 17,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  input: {
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 18,
    color: AppColors.text,
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
    color: AppColors.primary,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  contentBox: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: AppColors.surface,
  },
  quickChordsRow: {
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
  },
  quickChordButton: {
    minWidth: 70,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
  },
  quickChordButtonText: {
    color: AppColors.surface,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 410,
    padding: 18,
    color: AppColors.text,
    fontFamily: Fonts.mono,
    fontSize: 17,
    lineHeight: 30,
    textAlignVertical: 'top',
  },
  bottomTools: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: AppColors.background,
  },
  toolPill: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: AppColors.surfaceMuted,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  toolText: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
