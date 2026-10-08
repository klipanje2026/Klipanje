export function audioBufferSegmentToWav(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number,
  targetRate: number,
) {
  const frameCount = Math.max(1, Math.ceil((endSeconds - startSeconds) * targetRate));
  const wav = new ArrayBuffer(44 + frameCount * 2);
  const view = new DataView(wav);
  writeWavHeader(view, frameCount, targetRate, 1);
  const sourceStart = startSeconds * buffer.sampleRate;
  const sourceStep = buffer.sampleRate / targetRate;
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sourcePosition = sourceStart + frame * sourceStep;
    const firstIndex = Math.min(buffer.length - 1, Math.floor(sourcePosition));
    const secondIndex = Math.min(buffer.length - 1, firstIndex + 1);
    const blend = sourcePosition - firstIndex;
    let sample = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      sample += data[firstIndex] * (1 - blend) + data[secondIndex] * blend;
    }
    sample = Math.max(-1, Math.min(1, sample / buffer.numberOfChannels));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([wav], { type: "audio/wav" });
}

export function audioBuffersToWav(buffers: AudioBuffer[]) {
  if (!buffers.length) return new Blob([], { type: "audio/wav" });
  const sampleRate = buffers[0].sampleRate;
  const channels = Math.min(2, Math.max(...buffers.map((buffer) => buffer.numberOfChannels)));
  const frameCount = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const wav = new ArrayBuffer(44 + frameCount * channels * 2);
  const view = new DataView(wav);
  writeWavHeader(view, frameCount, sampleRate, channels);
  let offset = 44;
  for (const buffer of buffers) {
    for (let frame = 0; frame < buffer.length; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(sourceChannel)[frame]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
  }
  return new Blob([wav], { type: "audio/wav" });
}

function writeWavHeader(
  view: DataView,
  frameCount: number,
  sampleRate: number,
  channels: number,
) {
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  const blockAlign = channels * 2;
  write(0, "RIFF");
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, frameCount * blockAlign, true);
}

