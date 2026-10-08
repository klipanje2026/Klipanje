import {formatNumberText} from './caption-numbers';
import type {Segment} from '../config/captions/presets';
import {splitTranscript} from './transcript-segments';
function parseSubtitleTime(value: string) {
  const parts = value.trim().replace(",", ".").split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0];
}

function parseRawSubtitleText(
  content: string,
  name: string,
  duration: number,
): Segment[] {
  const extension = name.split(".").pop()?.toLowerCase();
  const clean = content.replace(/^\uFEFF/, "").trim();
  if (extension === "txt") return splitTranscript(clean, duration);
  if (extension === "ass" || extension === "ssa")
    return clean
      .split(/\r?\n/)
      .filter((line) => line.startsWith("Dialogue:"))
      .flatMap((line) => {
        const parts = line.slice(9).split(",");
        if (parts.length < 10) return [];
        const start = parseSubtitleTime(parts[1]);
        const end = parseSubtitleTime(parts[2]);
        const text = parts
          .slice(9)
          .join(",")
          .replace(/\{[^}]*\}/g, "")
          .replace(/\\N/g, "\n")
          .trim();
        return text ? [{ id: crypto.randomUUID(), start, end, text }] : [];
      });
  return clean
    .replace(/^WEBVTT[^\n]*\n/i, "")
    .split(/\r?\n\s*\r?\n/)
    .flatMap((block) => {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return [];
      const [startText, endText] = lines[timingIndex]
        .split("-->")
        .map((part) => part.trim().split(/\s+/)[0]);
      const text = lines
        .slice(timingIndex + 1)
        .join("\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (!text) return [];
      return [
        {
          id: crypto.randomUUID(),
          start: parseSubtitleTime(startText),
          end: parseSubtitleTime(endText),
          text,
        },
      ];
    });
}


export function parseSubtitleText(content:string,name:string,duration:number):Segment[]{return parseRawSubtitleText(content,name,duration).map(s=>({...s,text:formatNumberText(s.text)}));}
