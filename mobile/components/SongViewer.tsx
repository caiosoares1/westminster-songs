import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import ChordLine from '@/components/ChordLine';
import { Fonts, type AppPalette } from '@/constants/theme';
import { useThemedStyles } from '@/providers/theme';
import { transposeStructure } from '@/music/transpose';
import type { SongStructure } from '@/services/songs';
import { formatSectionHeading, isSongStructure } from '@/utils/song-structure';

interface SongViewerProps {
  structureJson: SongStructure;
  transposeSteps?: number;
  originalKey?: string;
}

export default function SongViewer({
  structureJson,
  transposeSteps = 0,
  originalKey,
}: SongViewerProps) {
  const styles = useThemedStyles(createStyles);
  const structureToRender = useMemo(() => {
    if (!isSongStructure(structureJson) || transposeSteps === 0) {
      return structureJson;
    }

    return transposeStructure(structureJson, transposeSteps, originalKey);
  }, [structureJson, transposeSteps, originalKey]);

  if (!isSongStructure(structureToRender)) {
    return (
      <View style={styles.invalid}>
        <Text style={styles.invalidText}>
          Esta cifra está num formato inválido e não pode ser exibida. Edite a música para
          corrigi-la.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {structureToRender.sections.map((section, sectionIndex) => (
        <View
          key={`section-${sectionIndex}`}
          style={[
            styles.section,
            section.type.toLowerCase().startsWith('chorus') && styles.highlightedSection,
          ]}>
          <Text style={styles.sectionTitle}>[{formatSectionHeading(section.type)}]</Text>
          {section.lines.map((line, lineIndex) => (
            <ChordLine key={`line-${sectionIndex}-${lineIndex}`} line={line} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingTop: 10,
  },
  section: {
    gap: 10,
    paddingLeft: 4,
  },
  highlightedSection: {
    backgroundColor: colors.surfaceMuted,
    borderLeftWidth: 4,
    borderLeftColor: colors.primarySoft,
    borderRadius: 12,
    padding: 10,
  },
  invalid: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  invalidText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
