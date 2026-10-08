import {checkTranscriptLanguage} from './transcript-language';
export type TranscriptWord = { text?: string; start?: number; end?: number; type?: string; logprob?: number };
export type TranscriptResult = { words?: TranscriptWord[]; text?: string };
export type AnalysisStage = "preparing" | "connecting" | "uploading" | "recognizing" | "done" | "error" | "cancelled";
export type AnalysisStatus = {
  stage: AnalysisStage;
  startedAt: number;
  percent?: number;
  uploadBytes?: number;
  originalBytes?: number;
  audioOnly?: boolean;
  message?: string;
};
export type PreparedAudio = { blob: Blob; name: string; audioOnly: boolean; offset: number };

export function transcriptionBody(audio: PreparedAudio, language: string) {
  const body = new FormData();
  body.append("file", audio.blob, audio.name);
  body.append("model_id", "scribe_v2");
  body.append("timestamps_granularity", "word");
  body.append("file_format", "other");
  body.append("tag_audio_events", "false");
  body.append("diarize", "false");
  if (language !== "auto") body.append("language_code", language);
  return body;
}

export function transcriptError(status: number, detail?: unknown) {
  const code = typeof detail === "object" && detail ? String((detail as { status?: string }).status || "") : "";
  if (status === 429) return "Servis je trenutno zauzet ili je dostignut broj paralelnih obrada. Sačekaj malo prije ponovnog pokušaja.";
  if (status === 402 || code === "quota_exceeded") return "Nema dovoljno ElevenLabs kredita za ovaj snimak. Provjeri stanje računa.";
  if (status === 401 || status === 403) return "Servis nije odobrio obradu. Pokušaj ponovo za novi pristupni token; ako se ponovi, provjeri API dozvole.";
  if (status === 413) return "Datoteka prelazi ograničenje servisa za jednu obradu. Koristi kraći dio snimka.";
  if (status >= 500) return "Servis za prepoznavanje trenutno ne odgovara. Tvoj video i odabrani stil su ostali u editoru.";
  return "Zvuk se nije mogao analizirati. Provjeri ima li snimak ispravan zvučni zapis i pokušaj ponovo.";
}

// XHR exposes real transmitted-byte progress. There is deliberately no guessed AI percentage.
export function uploadForTranscript(token: string, body: FormData, signal: AbortSignal,
  onUpload: (percent: number | undefined) => void, onRecognizing: () => void, proxyCsrf?: string): Promise<TranscriptResult> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (error?: Error, result?: TranscriptResult) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      xhr.upload.onprogress = null;
      xhr.upload.onload = null;
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
      if (error) reject(error); else resolve(result || {});
    };
    const abort = () => { xhr.abort(); finish(new DOMException("Obrada je prekinuta.", "AbortError")); };
    xhr.upload.onprogress = (event) => onUpload(event.lengthComputable ? Math.min(100, Math.round(event.loaded / event.total * 100)) : undefined);
    xhr.upload.onload = onRecognizing;
    xhr.open("POST", proxyCsrf ? "/api/transcribe" : `https://api.elevenlabs.io/v1/speech-to-text?token=${encodeURIComponent(token)}`);
    if(proxyCsrf) xhr.setRequestHeader("X-CSRFToken",proxyCsrf);
    if(proxyCsrf)try{if(localStorage.getItem("edita-product-analytics")==="yes")xhr.setRequestHeader("X-Product-Analytics","1");}catch{/* optional */}
    xhr.responseType = "json";
    // Long recordings need longer than the SDK's default response window.
    xhr.timeout = 30 * 60 * 1000;
    xhr.onload = () => {
      const result = xhr.response;
      if (xhr.status < 200 || xhr.status >= 300) return finish(new Error(result?.error || transcriptError(xhr.status, result?.detail)));
      if (!result || (!Array.isArray(result.words) && typeof result.text !== "string")) return finish(new Error("Servis je vratio nepotpun odgovor. Pokušaj ponovo."));
      finish(undefined, checkTranscriptLanguage(result,String(body.get('language_code')||'auto')));
    };
    xhr.onerror = () => finish(new Error("Veza je prekinuta. Provjeri internet; video i stil su sačuvani u ovoj sesiji."));
    xhr.ontimeout = () => finish(new Error("Servis nije odgovorio u roku od 30 minuta. Prije ponavljanja provjeri stanje obrade i kredite."));
    xhr.onabort = () => finish(new DOMException("Obrada je prekinuta.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else xhr.send(body);
  });
}

export function alignTranscriptWords(words: TranscriptWord[], offset: number): TranscriptWord[] {
  return words.filter((word) => word.end === undefined || word.end + offset > 0).map((word) => ({ ...word,
    start: word.start === undefined ? undefined : Math.max(0, word.start + offset),
    end: word.end === undefined ? undefined : Math.max(0, word.end + offset),
  }));
}
