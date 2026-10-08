// Keep source timestamps intact; apply the lead once at playback/export boundaries.
export const CAPTION_LEAD_SECONDS = 0.1;
export function captionPlaybackTime(sourceTime:number) { return sourceTime + CAPTION_LEAD_SECONDS; }
export function captionOutputTime(sourceTime:number) { return Math.max(0,sourceTime - CAPTION_LEAD_SECONDS); }
