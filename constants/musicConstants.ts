/**
 * Musical constants for auto-tune processing
 * Based on standard Western music theory
 */

export const MUSICAL_KEYS = [
  'C',
  'C#/Db',
  'D',
  'D#/Eb',
  'E',
  'F',
  'F#/Gb',
  'G',
  'G#/Ab',
  'A',
  'A#/Bb',
  'B',
] as const;

export const MUSICAL_SCALES = [
  'Major',
  'Minor',
  'Chromatic',
] as const;

export type MusicalKey = typeof MUSICAL_KEYS[number];
export type MusicalScale = typeof MUSICAL_SCALES[number];

/**
 * Display names for keys (user-friendly)
 */
export const KEY_DISPLAY_NAMES: Record<string, string> = {
  'C': 'C',
  'C#/Db': 'C♯ / D♭',
  'D': 'D',
  'D#/Eb': 'D♯ / E♭',
  'E': 'E',
  'F': 'F',
  'F#/Gb': 'F♯ / G♭',
  'G': 'G',
  'G#/Ab': 'G♯ / A♭',
  'A': 'A',
  'A#/Bb': 'A♯ / B♭',
  'B': 'B',
};

/**
 * Descriptions for scale types
 */
export const SCALE_DESCRIPTIONS: Record<string, string> = {
  'Major': 'Bright, happy sound',
  'Minor': 'Dark, melancholic sound',
  'Chromatic': 'All 12 notes (no correction)',
};
