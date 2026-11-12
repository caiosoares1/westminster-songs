import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/CategoryPicker';
import { guessCategory, type SongCategory } from '@/constants/categories';
import { Fonts, type AppPalette } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/providers/theme';
import {
  extractLikelyOriginalKey,
  findDoubtfulChords,
  parseOcrTextToStructure,
  parseOcrTokensToStructure,
  tokensToTextLines,
} from '@/music/ocrParser';
import { combineStructures } from '@/music/combine';
import { extractHymnHeader } from '@/music/hymnHeader';
import { fillChordsFromPattern } from '@/music/pattern';
import { describeTokens, isDeviceOcrAvailable, recognizeImage } from '@/services/ocr';
import { normalizeKey } from '@/music/chordParser';
import { apiErrorMessage } from '@/services/api';
import { showMessage } from '@/utils/dialog';
import { createSong } from '@/services/songs';
import { parseBracketContentToStructure, structureToBracketContent } from '@/utils/song-structure';

const SAMPLE_OCR_TEXT = `Verso
C               G
Castelo forte e o nosso Deus,
Am              F
Amparo e fortaleza;

Refrao
C                G
Na luta e na tristeza.
`;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return String(error);
}

export default function ImportSongScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<SongCategory | null>(null);
  const [originalKey, setOriginalKey] = useState('');
  const [ocrText, setOcrText] = useState(SAMPLE_OCR_TEXT);
  const [reviewContent, setReviewContent] = useState('');
  // Photos of the same chord sheet, in reading order (a long sheet may need several).
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  /** Notes about the reading shown above the review (filled chords, doubtful chords...). */
  const [notices, setNotices] = useState<string[]>([]);
  /** Positions read from the photos, shared when a reading comes out wrong. */
  const [readingData, setReadingData] = useState<string | null>(null);
  const [processingText, setProcessingText] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const canProcessText = useMemo(() => ocrText.trim().length > 0, [ocrText]);
  const canProcessImage = selectedImageUris.length > 0;
  const canSave = useMemo(
    () => title.trim().length > 0 && originalKey.trim().length > 0 && reviewContent.trim().length > 0,
    [title, originalKey, reviewContent]
  );

  const applyParsedStructure = (
    parsed: ReturnType<typeof parseOcrTextToStructure>,
    doubtfulChords: string[] = [],
  ) => {
    // Hymnal heading ("120 DEPENDÊNCIA. G 3/4"): title, key and time
    // signature, taken out of the lyrics.
    const { structure: withoutHeader, header } = extractHymnHeader(parsed);

    // Stanzas with only lyrics get the chords of the first chorded stanza,
    // syllable by syllable (same melody in every stanza).
    const structureJson = fillChordsFromPattern(withoutHeader);
    const filledCount = structureJson.sections.filter(
      (section, index) => section !== withoutHeader.sections[index],
    ).length;

    const nextNotices: string[] = [];
    if (header) {
      nextNotices.push(
        `Cabecalho do hinario: ${header.number} ${header.title}` +
          (header.key ? `, tom ${header.key}` : '') +
          (header.timeSignature ? `, compasso ${header.timeSignature}` : '') +
          '.',
      );
    }
    if (filledCount > 0) {
      nextNotices.push(
        `Acordes completados em ${filledCount} ${filledCount === 1 ? 'estrofe' : 'estrofes'} seguindo o padrao da estrofe cifrada. Confira antes de salvar.`,
      );
    }
    if (doubtfulChords.length > 0) {
      nextNotices.push(
        `Confira ${doubtfulChords.length === 1 ? 'este trecho' : 'estes trechos'}, a leitura pode ter errado o acorde: ${doubtfulChords.slice(0, 5).join('; ')}.`,
      );
    }
    setNotices(nextNotices);
    setReviewContent(structureToBracketContent(structureJson));

    if (header && !title.trim()) {
      setTitle(`${header.number} ${header.title}`);
    }
    if (!category) {
      setCategory(guessCategory(header ? header.title : title, header?.number));
    }
    if (!originalKey.trim()) {
      const guessedKey = (header?.key && normalizeKey(header.key)) || extractLikelyOriginalKey(structureJson);
      if (guessedKey) {
        setOriginalKey(guessedKey);
      }
    }
  };

  const pickImage = async (source: 'gallery' | 'camera') => {
    try {
      const imagePickerCompat = ImagePicker as unknown as { MediaTypeOptions?: { Images?: unknown } };
      const imageMediaType = (imagePickerCompat.MediaTypeOptions?.Images ??
        ['images']) as ImagePicker.ImagePickerOptions['mediaTypes'];

      if (source === 'gallery') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showMessage('Permissao negada', 'Permita acesso a galeria para continuar.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showMessage('Permissao negada', 'Permita acesso a camera para continuar.');
          return;
        }
      }

      const result =
        source === 'gallery'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: imageMediaType,
              quality: 1,
              allowsMultipleSelection: true,
              orderedSelection: true,
              selectionLimit: 8,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: imageMediaType,
              quality: 1,
            });

      if (result.canceled) {
        return;
      }

      // Added after the photos already chosen, in the order they were picked.
      setSelectedImageUris((previous) =>
        [...previous, ...result.assets.map((asset) => asset.uri)].slice(0, 8),
      );
    } catch (error) {
      console.error(`Error selecting image from ${source}:`, error);
      showMessage('Erro', 'Nao foi possivel selecionar a imagem.');
    }
  };

  const handleProcessOcrText = () => {
    if (!canProcessText) {
      showMessage('OCR vazio', 'Cole o texto do OCR antes de processar.');
      return;
    }

    try {
      setProcessingText(true);
      const structureJson = parseOcrTextToStructure(ocrText);
      applyParsedStructure(structureJson, findDoubtfulChords(ocrText.split('\n')));
    } catch (error) {
      console.error('Error processing OCR text:', error);
      showMessage('Erro', 'Nao foi possivel interpretar o texto OCR.');
    } finally {
      setProcessingText(false);
    }
  };

  const handleProcessOcrImage = async () => {
    if (selectedImageUris.length === 0) {
      showMessage('Imagem ausente', 'Selecione uma imagem antes de processar.');
      return;
    }

    setProcessingImage(true);
    try {
      const parts: ReturnType<typeof parseOcrTextToStructure>[] = [];
      const startsWithoutTitle: boolean[] = [];
      const texts: string[] = [];
      const readings: string[] = [];
      const doubtful: string[] = [];

      for (const [position, uri] of selectedImageUris.entries()) {
        const photoLabel = selectedImageUris.length > 1 ? ` ${position + 1}` : '';

        // 1. Text recognition on the phone (ML Kit): no upload, works offline.
        let ocrResult: Awaited<ReturnType<typeof recognizeImage>>;
        try {
          ocrResult = await recognizeImage(uri);
        } catch (error) {
          console.error('OCR recognition failed:', error);
          showMessage(
            `Erro ao ler a foto${photoLabel}`,
            `O reconhecimento de texto falhou. Tente outra foto ou cole o texto abaixo.\n\nDetalhe: ${describeError(error)}`,
          );
          return;
        }
        if (!ocrResult.fullText.trim()) {
          continue;
        }
        texts.push(ocrResult.fullText);
        readings.push(`# foto ${position + 1}\n${describeTokens(ocrResult.tokens)}`);
        doubtful.push(...findDoubtfulChords(tokensToTextLines(ocrResult.tokens)));

        // 2. Chords and lyrics: by word positions, then by plain text, then
        // as lyrics only, so nothing that was read gets lost.
        const attempts = [
          () => parseOcrTokensToStructure(ocrResult.tokens),
          () => parseOcrTextToStructure(ocrResult.fullText),
          () => parseBracketContentToStructure(ocrResult.fullText),
        ];
        for (const parse of attempts) {
          try {
            const part = parse();
            parts.push(part);
            // No title or stanza number at the top: continues the previous photo.
            startsWithoutTitle.push(part.sections[0]?.type === 'verse');
            break;
          } catch (error) {
            console.warn('OCR parse attempt failed:', error);
          }
        }
      }

      if (texts.length === 0) {
        showMessage('Nenhum texto encontrado', 'Tente fotos mais nitidas, de frente e bem iluminadas.');
        return;
      }
      setOcrText(texts.join('\n\n'));
      setReadingData(`westminster-ocr v1\n${readings.join('\n')}`);

      if (parts.length === 0) {
        setNotices([]);
        setReviewContent(texts.join('\n\n'));
        showMessage('Texto lido, cifra nao organizada', 'O texto das fotos foi colocado na revisao para voce ajustar.');
        return;
      }

      applyParsedStructure(combineStructures(parts, startsWithoutTitle), [...new Set(doubtful)]);
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      showMessage('Dados incompletos', 'Preencha titulo, tonalidade e revise o conteudo antes de salvar.');
      return;
    }

    const key = normalizeKey(originalKey);
    if (!key) {
      showMessage('Tom invalido', 'Use um tom como C, F#, Bb, Am ou Do, Re menor.');
      return;
    }

    let structureJson: ReturnType<typeof parseBracketContentToStructure>;
    try {
      structureJson = parseBracketContentToStructure(reviewContent);
    } catch (error) {
      console.error('Error parsing reviewed content:', error);
      showMessage('Erro', 'A revisao contem linhas invalidas.');
      return;
    }

    try {
      setSaving(true);
      const createdSong = await createSong({
        title: title.trim(),
        author: author.trim() || undefined,
        category: category ?? guessCategory(title),
        originalKey: key,
        structureJson,
      });

      router.replace({
        pathname: '/songs/[id]',
        params: { id: createdSong.id },
      });
    } catch (error) {
      console.error('Error creating imported song:', error);
      showMessage('Erro', apiErrorMessage(error, 'Nao foi possivel salvar a musica importada.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerIconButton}>
          <MaterialIcons name="close" size={34} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Scanner de Cifras</Text>

        <Pressable onPress={handleSave} disabled={saving || !canSave}>
          <Text style={[styles.saveText, (saving || !canSave) && styles.saveTextDisabled]}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.captureBlock}>
          <Text style={styles.blockTitle}>CAPTURA</Text>

          {!isDeviceOcrAvailable ? (
            <Text style={styles.unavailableText}>
              A leitura de fotos funciona no app instalado (APK). Aqui, cole o texto da cifra
              mais abaixo.
            </Text>
          ) : null}

          <View style={[styles.captureButtonsRow, !isDeviceOcrAvailable && styles.hidden]}>
            <Pressable onPress={() => void pickImage('gallery')} style={styles.captureButton}>
              <MaterialIcons name="photo-library" size={22} color={colors.primaryStrong} />
              <Text style={styles.captureButtonText}>Galeria</Text>
            </Pressable>

            <Pressable onPress={() => void pickImage('camera')} style={styles.captureButton}>
              <MaterialIcons name="photo-camera" size={22} color={colors.primaryStrong} />
              <Text style={styles.captureButtonText}>Camera</Text>
            </Pressable>
          </View>

          {!isDeviceOcrAvailable ? null : selectedImageUris.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
              {selectedImageUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.thumb}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>{index + 1}</Text>
                  </View>
                  <Pressable
                    style={styles.thumbRemove}
                    hitSlop={6}
                    onPress={() => setSelectedImageUris((previous) => previous.filter((_, i) => i !== index))}>
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPreview}>
              <MaterialIcons name="image" size={28} color={colors.textMuted} />
              <Text style={styles.emptyPreviewText}>
                Selecione uma ou mais fotos da cifra, na ordem
              </Text>
            </View>
          )}

          <Pressable
            style={[
              styles.processButton,
              (!canProcessImage || processingImage) && styles.processButtonDisabled,
              !isDeviceOcrAvailable && styles.hidden,
            ]}
            onPress={() => void handleProcessOcrImage()}
            disabled={!canProcessImage || processingImage}>
            <MaterialIcons name="document-scanner" size={20} color={colors.onPrimary} />
            <Text style={styles.processButtonText}>
              {processingImage
                ? 'Lendo...'
                : selectedImageUris.length > 1
                  ? `Processar ${selectedImageUris.length} fotos`
                  : 'Processar imagem'}
            </Text>
          </Pressable>
        </View>

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

        <Text style={styles.label}>TIPO</Text>
        <CategoryPicker value={category} onChange={setCategory} />

        <Text style={styles.label}>TONALIDADE ORIGINAL</Text>
        <TextInput
          style={styles.input}
          value={originalKey}
          onChangeText={setOriginalKey}
          placeholder="ex. C, Dm, F#"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.ocrHeader}>
          <Text style={styles.label}>TEXTO OCR</Text>
          <Pressable onPress={() => setOcrText(SAMPLE_OCR_TEXT)}>
            <Text style={styles.smallAction}>Usar exemplo</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.ocrInput}
          multiline
          textAlignVertical="top"
          value={ocrText}
          onChangeText={setOcrText}
          placeholder="Cole aqui o texto extraido do OCR..."
          placeholderTextColor={colors.textMuted}
        />

        <Pressable
          style={[styles.processButton, (!canProcessText || processingText) && styles.processButtonDisabled]}
          onPress={handleProcessOcrText}
          disabled={!canProcessText || processingText}>
          <MaterialIcons name="tune" size={20} color={colors.onPrimary} />
          <Text style={styles.processButtonText}>{processingText ? 'Processando...' : 'Processar texto OCR'}</Text>
        </Pressable>

        <View style={styles.reviewHeader}>
          <Text style={styles.label}>REVISAO FINAL</Text>
          <Text style={styles.reviewHelp}>Edite antes de salvar</Text>
        </View>

        {notices.map((notice) => (
          <View key={notice} style={styles.notice}>
            <MaterialIcons name="auto-fix-high" size={18} color={colors.primaryStrong} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ))}

        <TextInput
          style={styles.reviewInput}
          multiline
          textAlignVertical="top"
          value={reviewContent}
          onChangeText={setReviewContent}
          placeholder="[Verse]\n[C] Castelo forte e o nosso Deus..."
          placeholderTextColor={colors.textMuted}
        />

        {readingData ? (
          <Pressable
            style={styles.reportLink}
            hitSlop={8}
            onPress={() => void Share.share({ message: readingData })}>
            <MaterialIcons name="bug-report" size={16} color={colors.textMuted} />
            <Text style={styles.reportText}>Leitura saiu errada? Enviar dados da leitura</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  unavailableText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  hidden: {
    display: 'none',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.primary,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  saveText: {
    color: colors.primary,
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  saveTextDisabled: {
    opacity: 0.45,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
    gap: 14,
  },
  captureBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  blockTitle: {
    color: colors.text,
    fontFamily: Fonts.serif,
    fontSize: 16,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  captureButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureButtonText: {
    color: colors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  thumbRow: {
    gap: 10,
  },
  thumb: {
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadgeText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  thumbRemove: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  reportText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyPreview: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyPreviewText: {
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
  ocrHeader: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAction: {
    color: colors.primary,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  ocrInput: {
    minHeight: 190,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 24,
  },
  processButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonText: {
    color: colors.onPrimary,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  reviewHeader: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewHelp: {
    color: colors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  reviewInput: {
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 27,
  },
});
