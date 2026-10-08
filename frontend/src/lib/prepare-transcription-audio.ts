import type { PreparedAudio } from "./transcription-client";

class MissingAudioError extends Error {}

/** Copies compressed audio packets, never decodes video or re-encodes speech. */
export async function prepareTranscriptionAudio(file: File, signal: AbortSignal,
  onProgress: (percent: number | undefined) => void): Promise<PreparedAudio> {
  signal.throwIfAborted();
  const original = { blob: file, name: file.name, audioOnly: false, offset: 0 };
  const m = await import("mediabunny");
  signal.throwIfAborted();
  const input = new m.Input({ source: new m.BlobSource(file), formats: m.ALL_FORMATS });
  let output: InstanceType<typeof m.Output> | undefined;
  const abort = () => { input.dispose(); void output?.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const tracks = await input.getAudioTracks();
    if (!tracks.length) throw new MissingAudioError("Ovaj video nema zvučni zapis. Ubaci snimak na kojem se čuje govor.");
    // Keep the provider's handling for multiple audio tracks and uncommon codecs.
    if (tracks.length !== 1) return original;
    const track = tracks[0];
    const codec = await track.getCodec();
    // WebM codec-delay handling needs a separate alignment path; retain original upload for now.
    if (codec !== "aac") return original;
    const config = await track.getDecoderConfig();
    if (!config) return original;
    const sink = new m.EncodedPacketSink(track);
    const first = await sink.getFirstPacket();
    if (!first) throw new MissingAudioError("Zvučni zapis je prazan. Ubaci drugi video.");
    // Keep substantial edit-list trims with the original container; only small codec priming is remapped.
    if (first.timestamp < -.1) return original;
    const end = await track.getDurationFromMetadata();
    // Include signed AAC priming/edit-list offset when mapping returned words back to video time.
    const offset = first.timestamp;
    const format = new m.Mp4OutputFormat({ fastStart: false });
    const target = new m.BufferTarget();
    output = new m.Output({ format, target });
    const source = new m.EncodedAudioPacketSource(codec);
    output.addAudioTrack(source);
    await output.start();
    let bytes = 0;
    let lastYield = performance.now();
    let previousEnd = first.timestamp;
    let initial = true;
    for await (const packet of sink.packets(first)) {
      signal.throwIfAborted();
      bytes += packet.byteLength;
      // Bounded optimization memory, NOT a video upload limit. Fall back to the original Blob.
      if (bytes > 128 * 1024 * 1024 || bytes >= file.size || packet.duration > .1 || Math.abs(packet.timestamp - previousEnd) > .1) return original;
      await source.add(packet.clone({ timestamp: packet.timestamp - offset }), initial ? { decoderConfig: config } : undefined);
      initial = false;
      previousEnd = packet.timestamp + packet.duration;
      if (performance.now() - lastYield > 50) {
        onProgress(end && end > offset ? Math.min(99, Math.round((previousEnd - offset) / (end - offset) * 100)) : undefined);
        // Yield to paint/input so editing remains responsive even with an in-memory source.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
    }
    source.close();
    await output.finalize();
    signal.throwIfAborted();
    if (!target.buffer || target.buffer.byteLength >= file.size) return original;
    onProgress(100);
    return { blob: new Blob([target.buffer], { type: "audio/mp4" }),
      name: "govor.m4a", audioOnly: true, offset };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof MissingAudioError) throw error;
    // Unsupported/corrupt local demuxing must not remove the existing provider upload path.
    return original;
  } finally {
    signal.removeEventListener("abort", abort);
    if (output && output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => undefined);
    input.dispose();
  }
}
