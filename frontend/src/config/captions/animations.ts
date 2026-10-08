import type { CaptionSettings } from './types';
// Seconds and scale factors, shared by preview, sample cards and video export.
export const captionMotion = {
  fps: 30, fadeDuration: .18, popDuration: .2, bounceDuration: .16,
  bounceFrameDuration: .2, typewriterFraction: .75,
  popBaseScale: .75, popScaleRange: .25, popOvershoot: 1.70158,
  pulseAmplitude: .035, pulseFrequency: 1,
};
export const captionAnimations: { value: CaptionSettings['animation']; label: string }[] = [
  { value: 'none', label: 'Bez dodatne animacije' },
  { value: 'pop', label: 'Pop ulazak' },
  { value: 'fade', label: 'Fade ulazak' },
  { value: 'pulse', label: 'Lagani puls' },
];
