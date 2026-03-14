import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import ChordLine from '@/components/ChordLine';
import { AppColors, Fonts } from '@/constants/theme';
import { transposeStructure } from '@/music/transpose';
import type { SongStructure } from '@/services/songs';

interface SongViewerProps {
  structureJson: SongStructure;
  transposeSteps?: number;
}

const SECTION_LABELS: Record<string, string> = {
  verse: 'Verso',
  chorus: 'Refrao',
  bridge: 'Ponte',
  intro: 'Introducao',
  outro: 'Final',
  prechorus: 'Pre-refrao',
};

function formatSectionLabel(sectionType: string): string {
  const normalizedType = sectionType.trim().toLowerCase().replace(/[_\s-]+/g, '');
  const mappedLabel = SECTION_LABELS[normalizedType];

  if (mappedLabel) {
    return `[${mappedLabel}]`;
  }

  const fallback = sectionType
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return `[${fallback || 'Secao'}]`;
}

export default function SongViewer({ structureJson, transposeSteps = 0 }: SongViewerProps) {
  const structureToRender = useMemo(() => {
    if (transposeSteps === 0) {
      return structureJson;
    }

    return transposeStructure(structureJson, transposeSteps);
  }, [structureJson, transposeSteps]);

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
            section.type.toLowerCase().includes('chorus') && styles.highlightedSection,
          ]}>
          <Text style={styles.sectionTitle}>{formatSectionLabel(section.type)}</Text>

          {section.lines.map((line, lineIndex) => (
            <ChordLine
              key={`line-${sectionIndex}-${lineIndex}`}
              line={line}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 22,
    paddingBottom: 36,
    paddingTop: 8,
  },
  section: {
    gap: 10,
    paddingLeft: 4,
  },
  highlightedSection: {
    backgroundColor: AppColors.surfaceMuted,
    borderLeftWidth: 4,
    borderLeftColor: AppColors.primarySoft,
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    color: AppColors.primaryStrong,
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
