import type { StyleKey } from './types';
// Assign a template key to these families to share its rendering behavior.
export const captionEffects = {
  timedWords: ['karaoke', 'bounce', 'social'],
  neon: ['glow', 'neon', 'neonPink', 'ice'],
  soft: ['minimal', 'cinema', 'elegant', 'typewriter'],
  card: ['box', 'news', 'marker', 'bubble', 'cyber', 'gaming', 'urgent', 'pastel', 'captionCard'],
} satisfies Record<string, StyleKey[]>;
