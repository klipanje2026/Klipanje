import {formatTranscriptNumbers,formatNumberText} from './caption-numbers';
import type {TranscriptWord} from "./transcription-client";
import type {Segment} from "../config/captions/presets";
export function wordsToSegments(
  words: TranscriptWord[],
  fallbackText: string,
  duration: number,
): Segment[] {
  const timedWords = formatTranscriptNumbers(words.filter(w=>w.type!=='spacing'))
    .filter(
      (word) =>
        word.type !== "spacing" &&
        word.type !== "audio_event" &&
        word.text?.trim(),
    )
    .map((word) => ({
      text: word.text!.trim(),
      start: typeof word.start === "number" ? word.start : undefined,
      end: typeof word.end === "number" ? word.end : undefined,
      confidence:
        typeof word.logprob === "number"
          ? Math.exp(word.logprob) * 100
          : undefined,
    }));

  if (
    !timedWords.length ||
    timedWords.every((word) => word.start === undefined)
  ) {
    return splitTranscript(fallbackText, duration);
  }

  const segments: Segment[] = [];
  let current: typeof timedWords = [];

  const flush = () => {
    if (!current.length) return;
    const text = current
      .reduce((caption, word) => {
        const punctuation = /^[.,!?;:%)\]}]/.test(word.text);
        return caption
          ? `${caption}${punctuation ? "" : " "}${word.text}`
          : word.text;
      }, "")
      .trim();
    const start = current.find((word) => word.start !== undefined)?.start ?? 0;
    const end =
      [...current].reverse().find((word) => word.end !== undefined)?.end ??
      Math.min(start + 2.5, duration);
    const confidenceValues = current.flatMap((word) =>
      word.confidence === undefined ? [] : [word.confidence],
    );
    segments.push({
      id: crypto.randomUUID(),
      start,
      end: Math.max(start + 0.35, end),
      text,
      words: current
        .filter((word) => !/^[.,!?;:%)\]}]+$/.test(word.text))
        .map((word) => ({
          text: word.text,
          start: word.start ?? start,
          end: word.end ?? end,
        })),
      confidence: confidenceValues.length
        ? Math.round(
            confidenceValues.reduce((sum, value) => sum + value, 0) /
              confidenceValues.length,
          )
        : undefined,
    });
    current = [];
  };

  for (const word of timedWords) {
    const preview = [...current, word].reduce((caption, item) => {
      const punctuation = /^[.,!?;:%)\]}]/.test(item.text);
      return caption
        ? `${caption}${punctuation ? "" : " "}${item.text}`
        : item.text;
    }, "");
    const segmentStart =
      current.find((item) => item.start !== undefined)?.start ??
      word.start ??
      0;
    const segmentEnd = word.end ?? segmentStart;
    const shouldBreak =
      current.length >= 8 ||
      preview.length > 48 ||
      segmentEnd - segmentStart > 4.2;
    if (shouldBreak) flush();
    current.push(word);
    if (/[.!?]$/.test(word.text) && current.length >= 3) flush();
  }
  flush();

  return segments.length ? segments : splitTranscript(fallbackText, duration);
}

export function splitTranscript(text: string, duration: number): Segment[] {
  text=formatNumberText(text);
  const parts =
    text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [];
  const safeParts = parts;
  const totalChars = safeParts.reduce((sum, part) => sum + part.length, 0);
  let cursor = 0;
  return safeParts.map((part) => {
    const start = cursor;
    const span = Math.max(1.2, duration * (part.length / totalChars));
    cursor = Math.min(duration, cursor + span);
    return { id: crypto.randomUUID(), start, end: cursor, text: part };
  });
}
