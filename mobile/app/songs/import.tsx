import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';
import {
  extractLikelyOriginalKey,
  parseOcrTextToStructure,
  parseOcrTokensToStructure,
} from '@/music/ocrParser';
import { isDeviceOcrAvailable, recognizeImage } from '@/services/ocr';
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

export default function ImportSongScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [ocrText, setOcrText] = useState(SAMPLE_OCR_TEXT);
  const [reviewContent, setReviewContent] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [processingText, setProcessingText] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const canProcessText = useMemo(() => ocrText.trim().length > 0, [ocrText]);
  const canProcessImage = selectedImageUri !== null;
  const canSave = useMemo(
    () => title.trim().length > 0 && originalKey.trim().length > 0 && reviewContent.trim().length > 0,
    [title, originalKey, reviewContent]
  );

  const applyParsedStructure = (structureJson: ReturnType<typeof parseOcrTextToStructure>) => {
    setReviewContent(structureToBracketContent(structureJson));

    if (!originalKey.trim()) {
      const guessedKey = extractLikelyOriginalKey(structureJson);
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
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: imageMediaType,
              quality: 1,
            });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];
      setSelectedImageUri(selectedAsset.uri);
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
      applyParsedStructure(structureJson);
    } catch (error) {
      console.error('Error processing OCR text:', error);
      showMessage('Erro', 'Nao foi possivel interpretar o texto OCR.');
    } finally {
      setProcessingText(false);
    }
  };

  const handleProcessOcrImage = async () => {
    if (!selectedImageUri) {
      showMessage('Imagem ausente', 'Selecione uma imagem antes de processar.');
      return;
    }

    try {
      setProcessingImage(true);
      // Text recognition runs on the phone (ML Kit): no upload, works offline.
      const ocrResult = await recognizeImage(selectedImageUri);
      if (!ocrResult.fullText.trim()) {
        showMessage('Nenhum texto encontrado', 'Tente uma foto mais nitida, de frente e bem iluminada.');
        return;
      }
      setOcrText(ocrResult.fullText);

      const structureJson =
        ocrResult.tokens.length > 0
          ? parseOcrTokensToStructure(ocrResult.tokens)
          : parseOcrTextToStructure(ocrResult.fullText);

      applyParsedStructure(structureJson);
    } catch (error) {
      console.error('Error processing OCR image:', error);
      showMessage('Erro OCR', 'Nao foi possivel ler a imagem. Tente outra foto ou cole o texto abaixo.');
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
          <MaterialIcons name="close" size={34} color={AppColors.text} />
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
              <MaterialIcons name="photo-library" size={22} color={AppColors.primaryStrong} />
              <Text style={styles.captureButtonText}>Galeria</Text>
            </Pressable>

            <Pressable onPress={() => void pickImage('camera')} style={styles.captureButton}>
              <MaterialIcons name="photo-camera" size={22} color={AppColors.primaryStrong} />
              <Text style={styles.captureButtonText}>Camera</Text>
            </Pressable>
          </View>

          {!isDeviceOcrAvailable ? null : selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.emptyPreview}>
              <MaterialIcons name="image" size={28} color={AppColors.textMuted} />
              <Text style={styles.emptyPreviewText}>Selecione uma imagem para OCR</Text>
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
            <MaterialIcons name="document-scanner" size={20} color={AppColors.surface} />
            <Text style={styles.processButtonText}>
              {processingImage ? 'Lendo imagem...' : 'Processar imagem'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>TITULO DA MUSICA</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="ex. Castelo Forte"
          placeholderTextColor={AppColors.textMuted}
        />

        <Text style={styles.label}>ARTISTA / COMPOSITOR</Text>
        <TextInput
          style={styles.input}
          value={author}
          onChangeText={setAuthor}
          placeholder="ex. Martinho Lutero"
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
          placeholderTextColor={AppColors.textMuted}
        />

        <Pressable
          style={[styles.processButton, (!canProcessText || processingText) && styles.processButtonDisabled]}
          onPress={handleProcessOcrText}
          disabled={!canProcessText || processingText}>
          <MaterialIcons name="tune" size={20} color={AppColors.surface} />
          <Text style={styles.processButtonText}>{processingText ? 'Processando...' : 'Processar texto OCR'}</Text>
        </Pressable>

        <View style={styles.reviewHeader}>
          <Text style={styles.label}>REVISAO FINAL</Text>
          <Text style={styles.reviewHelp}>Edite antes de salvar</Text>
        </View>

        <TextInput
          style={styles.reviewInput}
          multiline
          textAlignVertical="top"
          value={reviewContent}
          onChangeText={setReviewContent}
          placeholder="[Verse]\n[C] Castelo forte e o nosso Deus..."
          placeholderTextColor={AppColors.textMuted}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  unavailableText: {
    color: AppColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  hidden: {
    display: 'none',
  },
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
    color: AppColors.primary,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  saveText: {
    color: AppColors.primary,
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
    borderColor: AppColors.border,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    padding: 16,
    gap: 12,
  },
  blockTitle: {
    color: AppColors.text,
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
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureButtonText: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 230,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  emptyPreview: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyPreviewText: {
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
  ocrHeader: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAction: {
    color: AppColors.primary,
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontWeight: '700',
  },
  ocrInput: {
    minHeight: 190,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: AppColors.text,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 24,
  },
  processButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonText: {
    color: AppColors.surface,
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
    color: AppColors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  reviewInput: {
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: AppColors.text,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 27,
  },
});
