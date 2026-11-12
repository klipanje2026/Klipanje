import {ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output} from './mediabunny.min.mjs';

export function sizeFor(width, height) {
  const scale = Math.min(1, 1200 / Math.max(width, height));
  return {width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2)};
}
export function validSpeed(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= .1 && value <= 3;
}
export async function convert(blob, speed, progress = () => {}) {
  if (!validSpeed(speed)) throw Error('Odaberi brzinu od 0,1 do 3×.');
  if (!blob?.size || blob.size > 500e6) throw Error('Odaberi video do 500 MB.');
  if (typeof VideoEncoder === 'undefined') throw Error('Ovaj preglednik nema brzu obradu videa. Otvori stranicu u novijem Chromeu ili Edgeu.');
  const input = new Input({source: new BlobSource(blob), formats: ALL_FORMATS});
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw Error('Datoteka nema video zapis.');
    const [sourceWidth, sourceHeight, duration] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight(), track.computeDuration()]);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1800) throw Error('Odaberi video do 30 minuta.');
    const {width, height} = sizeFor(sourceWidth, sourceHeight);
    const target = new BufferTarget();
    const output = new Output({target, format: new Mp4OutputFormat({fastStart: 'in-memory'})});
    const conversion = await Conversion.init({input, output, tracks: 'primary', audio: {discard: true}, tags: {}, showWarnings: false,
      video: {width, height, fit: 'contain', codec: 'avc', bitrate: Math.round(Math.max(400000, Math.min(2800000, width * height * 30 * .12 * .65))),
        forceTranscode: true, allowRotationMetadata: false, keyFrameInterval: 2,
        process(sample) {sample.setTimestamp(sample.timestamp / speed); sample.setDuration(sample.duration / speed); return sample;}}});
    if (!conversion.isValid || !conversion.utilizedTracks.some(t => t === track)) throw Error('Video se ne može obraditi u ovom pregledniku. Original je sačuvan.');
    conversion.onProgress = value => progress(Math.round(value * 100));
    await conversion.execute();
    if (!target.buffer?.byteLength) throw Error('Obrada nije napravila video. Original je sačuvan.');
    return {blob: new Blob([target.buffer], {type: 'video/mp4'}), width, height, duration: duration / speed, sourceDuration: duration, speed, maxEdge: 1200, muted: true};
  } finally {input.dispose();}
}
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = async ({data}) => {
    try {self.postMessage({type: 'ready', result: await convert(data.blob, data.speed, value => self.postMessage({type: 'progress', value}))});}
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      self.postMessage({type: 'error', error: /^(Odaberi|Ovaj preglednik|Datoteka nema|Video se ne može|Obrada nije)/.test(message) ? message : 'Video se ne može obraditi. Original je sačuvan; pokušaj drugi MP4.'});
    }
  };
}
