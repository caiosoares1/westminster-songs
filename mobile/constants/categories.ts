/** Type of song, as stored by the API. */
export type SongCategory = 'hymn' | 'psalm' | 'canticle';

export const SONG_CATEGORIES: SongCategory[] = ['hymn', 'psalm', 'canticle'];

export const CATEGORY_LABEL: Record<SongCategory, string> = {
  hymn: 'Hinário',
  psalm: 'Salmo',
  canticle: 'Cântico',
};

/** Names for the list filter. */
export const CATEGORY_FILTER_LABEL: Record<SongCategory, string> = {
  hymn: 'Hinário',
  psalm: 'Salmos',
  canticle: 'Cânticos',
};

/**
 * Type suggested by the title or by the hymnal heading: "Salmo 16b" or a
 * psalter number with a letter ("16B") is a psalm; "HNC 120", "Hino ..." or
 * a plain number is a hymn. null when there is no clue.
 */
export function guessCategory(title: string, headerNumber?: string): SongCategory | null {
  const text = title.trim();
  if (/^(salmo|sl\.?)\s/i.test(text) || /\bsalmo\b/i.test(text)) return 'psalm';
  if (headerNumber && /^\d{1,3}[A-Za-z]$/.test(headerNumber)) return 'psalm';
  if (/^(hnc|hino)\b/i.test(text) || /^\d{1,3}\s/.test(text) || headerNumber) return 'hymn';
  return null;
}
