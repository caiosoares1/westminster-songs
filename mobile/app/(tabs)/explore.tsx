import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, Fonts } from '@/constants/theme';

const SETTINGS_ROWS = [
  {
    id: 'ocr',
    title: 'OCR local (Tesseract)',
    value: 'Ativo no backend',
    icon: 'document-scanner',
  },
  {
    id: 'api',
    title: 'API base URL',
    value: 'Configurada via EXPO_PUBLIC_API_URL',
    icon: 'cloud-done',
  },
  {
    id: 'theme',
    title: 'Tema visual',
    value: 'Paleta custom MVP',
    icon: 'palette',
  },
] as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Configuracoes</Text>
        <Text style={styles.pageSubtitle}>Area de suporte operacional do MVP.</Text>

        <View style={styles.block}>
          {SETTINGS_ROWS.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialIcons name={row.icon} size={21} color={AppColors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <MaterialIcons name="info-outline" size={20} color={AppColors.primaryStrong} />
          <Text style={styles.noticeText}>
            Esta aba substitui o template do Expo e marca o escopo real do MVP.
          </Text>
        </View>
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
    gap: 14,
  },
  pageTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: '700',
  },
  pageSubtitle: {
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  block: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: AppColors.text,
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  rowValue: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    flex: 1,
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
