// Offline transport, packet-copy and status tests. Never sends files or spends API credits.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as m from 'mediabunny';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const directory = resolve('work/transcription-check');
await mkdir(directory, { recursive: true });
for (const [input, name] of [['frontend/src/lib/caption-numbers.ts', 'caption-numbers'], ['frontend/src/lib/transcript-language.ts', 'transcript-language'], ['frontend/src/lib/transcription-client.ts', 'client'], ['frontend/src/lib/prepare-transcription-audio.ts', 'prepare'], ['frontend/src/components/TranscriptionStatus/TranscriptionStatus.tsx', 'status']]) {
  const source = await readFile(input, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  await writeFile(resolve(directory, `${name}.mjs`), result.outputText.replace("'./transcript-language'", "'./transcript-language.mjs'"));
}
const client = await import(pathToFileURL(resolve(directory, 'client.mjs')));
const { prepareTranscriptionAudio } = await import(pathToFileURL(resolve(directory, 'prepare.mjs')));
const { TranscriptionStatus } = await import(pathToFileURL(resolve(directory, 'status.mjs')));
const signal = () => new AbortController().signal;
const encoded = new Uint8Array([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]);
const config = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, description: new Uint8Array([0x11, 0x90]) };

async function fixture({ offset = 0, gap = false, tracks = 1 } = {}) {
  const target = new m.BufferTarget();
  const output = new m.Output({ format: new m.Mp4OutputFormat({ fastStart: false }), target });
  const sources = Array.from({ length: tracks }, () => new m.EncodedAudioPacketSource('aac'));
  sources.forEach((source) => output.addAudioTrack(source));
  await output.start();
  for (let index = 0; index < 150; index++) {
    for (const source of sources) await source.add(new m.EncodedPacket(encoded, 'key', offset + index * 1024 / 48000 + (gap && index > 60 ? 1 : 0), 1024 / 48000), index === 0 ? { decoderConfig: config } : undefined);
  }
  sources.forEach((source) => source.close());
  await output.finalize();
  // A legal unreferenced MP4 free box simulates video bytes; these packet fixtures test muxing, not decoding.
  const padding = new Uint8Array(1024 * 1024);
  new DataView(padding.buffer).setUint32(0, padding.length);
  padding.set(new TextEncoder().encode('free'), 4);
  return new File([target.buffer, padding], 'fixture.mp4', { type: 'video/mp4' });
}

const results = [];
for (const offset of [0, 2.5]) {
  const file = await fixture({ offset });
  const started = performance.now();
  const prepared = await prepareTranscriptionAudio(file, signal(), () => {});
  assert.equal(prepared.audioOnly, true);
  assert.ok(Math.abs(prepared.offset - offset) < .001);
  assert.ok(prepared.blob.size < file.size / 10);
  const input = new m.Input({ source: new m.BlobSource(prepared.blob), formats: m.ALL_FORMATS });
  const tracks = await input.getTracks();
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].type, 'audio');
  let count = 0;
  for await (const packet of new m.EncodedPacketSink(tracks[0]).packets()) {
    assert.deepEqual(packet.data, encoded, 'Speech bytes are copied exactly');
    assert.ok(Math.abs(packet.timestamp - count * 1024 / 48000) < .001);
    count++;
  }
  assert.equal(count, 150);
  input.dispose();
  results.push({ offset, packets: count, originalBytes: file.size, sentBytes: prepared.blob.size, preparationMs: Math.round(performance.now() - started) });
}

// Turn the delayed-track edit list into AAC priming / a substantial source trim.
async function editedFixture(mediaTime) {
  const bytes = new Uint8Array(await (await fixture({ offset: 2.5 })).arrayBuffer());
  const view = new DataView(bytes.buffer);
  let found = false;
  const walk = (start, end) => {
    for (let pos = start; pos + 8 <= end;) {
      const length = view.getUint32(pos);
      const name = new TextDecoder().decode(bytes.subarray(pos + 4, pos + 8));
      if (!length || pos + length > end) break;
      if (['moov', 'trak', 'edts'].includes(name)) walk(pos + 8, pos + length);
      if (name === 'elst') {
        assert.equal(bytes[pos + 8], 0, 'Fixture uses 32-bit edit-list entries');
        assert.equal(view.getUint32(pos + 12), 2);
        view.setUint32(pos + 16, 0); // Remove the initial empty edit.
        view.setInt32(pos + 32, mediaTime); // Second entry media_time, in 48 kHz ticks.
        found = true;
      }
      pos += length;
    }
  };
  walk(0, bytes.length);
  assert.ok(found);
  return new File([bytes], 'edited.mp4', { type: 'video/mp4' });
}
const primed = await prepareTranscriptionAudio(await editedFixture(1024), signal(), () => {});
assert.equal(primed.audioOnly, true);
assert.ok(Math.abs(primed.offset + 1024 / 48000) < .00001, 'Signed AAC priming maps back to video time');
assert.equal((await prepareTranscriptionAudio(await editedFixture(48000), signal(), () => {})).audioOnly, false, 'Substantial source trims retain original container');

for (const options of [{ gap: true }, { tracks: 2 }]) {
  const file = await fixture(options);
  const prepared = await prepareTranscriptionAudio(file, signal(), () => {});
  assert.equal(prepared.audioOnly, false);
  assert.equal(prepared.blob, file, 'Compatibility fallback reuses original Blob');
}
const corrupt = new File(['not a media file'], 'bad.mp4', { type: 'video/mp4' });
assert.equal((await prepareTranscriptionAudio(corrupt, signal(), () => {})).blob, corrupt);
const aborted = new AbortController(); aborted.abort();
await assert.rejects(prepareTranscriptionAudio(await fixture(), aborted.signal, () => {}), { name: 'AbortError' });
const words = [{ text: 'Zdravo', start: .5, end: 1 }];
assert.equal(client.alignTranscriptWords(words, 2.5)[0].start, 3);
assert.equal(client.alignTranscriptWords(words, -.02)[0].start, .48);
assert.equal(client.alignTranscriptWords([{ start: 0, end: .02 }], -.021).length, 0);
assert.deepEqual(client.alignTranscriptWords([{ text: 'removed', start: 1, end: 2 }, { text: 'visible', start: 6, end: 7 }], -5), [{ text: 'visible', start: 1, end: 2 }]);
assert.equal(words[0].start, .5, 'Alignment never mutates provider data');
const payload = client.transcriptionBody({ blob: new Blob(['audio']), name: 'govor.m4a' }, 'bos');
assert.equal(payload.get('diarize'), 'false');
assert.equal(payload.get('tag_audio_events'), 'false');
assert.equal(payload.get('timestamps_granularity'), 'word');
assert.equal(payload.get('model_id'), 'scribe_v2');
assert.equal(payload.get('file_format'), 'other');
assert.equal(payload.get('language_code'), 'bos');
assert.equal(client.transcriptionBody({ blob: new Blob(['audio']), name: 'govor.m4a' }, 'auto').has('language_code'), false);

class FakeXHR {
  static instances = [];
  upload = {}; status = 200; response = { words }; timeout = 0;
  constructor() { FakeXHR.instances.push(this); }
  open(method, url) { this.method = method; this.url = url; }
  send(body) { this.body = body; }
  abort() { this.wasAborted = true; this.onabort?.(); }
}
globalThis.XMLHttpRequest = FakeXHR;
let percentages = []; let recognizing = 0;
const transfer = client.uploadForTranscript('test-only', payload, signal(), (value) => percentages.push(value), () => recognizing++);
let xhr = FakeXHR.instances.at(-1);
xhr.upload.onprogress({ loaded: 12, total: 100, lengthComputable: true });
xhr.upload.onprogress({ loaded: 15, total: 0, lengthComputable: false });
xhr.upload.onload();
xhr.onload();
assert.deepEqual(await transfer, { words });
assert.deepEqual(percentages, [12, undefined]);
assert.equal(recognizing, 1);
assert.equal(xhr.upload.onprogress, null, 'Listeners are cleaned after success');
assert.equal(xhr.timeout, 30 * 60 * 1000);
for (const event of ['abort', 'error', 'timeout', 'quota', 'busy', 'invalid']) {
  const controller = new AbortController();
  const promise = client.uploadForTranscript('test-only', payload, controller.signal, () => {}, () => {});
  xhr = FakeXHR.instances.at(-1);
  if (event === 'abort') controller.abort();
  if (event === 'error') xhr.onerror();
  if (event === 'timeout') xhr.ontimeout();
  if (event === 'quota') { xhr.status = 401; xhr.response = { detail: { status: 'quota_exceeded' } }; xhr.onload(); }
  if (event === 'busy') { xhr.status = 429; xhr.onload(); }
  if (event === 'invalid') { xhr.response = {}; xhr.onload(); }
  await assert.rejects(promise, event === 'abort' ? { name: 'AbortError' } : /./);
  assert.equal(xhr.onload, null);
}
for (const stage of ['preparing', 'connecting', 'uploading', 'recognizing', 'done', 'error', 'cancelled']) {
  const html = renderToStaticMarkup(createElement(TranscriptionStatus, { status: { stage, startedAt: Date.now(), percent: 37 }, onCancel() {}, onRetry() {}, onCaptions() {} }));
  assert.equal(html.includes('37%'), ['preparing', 'uploading'].includes(stage), 'Only measurable phases expose percentages');
  if (stage === 'recognizing') assert.ok(!html.includes('37%'));
  if (stage === 'done') {
    assert.ok(html.includes('Titlovi su spremni'));
    assert.ok(!html.includes('<button') && !html.includes('<time') && !html.includes('<p'), 'Completion stays a single compact status');
  }
  if (stage === 'error' || stage === 'cancelled') assert.ok(html.includes('Pokušaj ponovo'));
}
const studio = await readFile('frontend/src/lib/transcript-segments.ts', 'utf8');
const ast = ts.createSourceFile('studio.tsx', studio, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ['wordsToSegments', 'splitTranscript'].includes(node.name?.text));
const segmentCode = ts.transpileModule(functions.map((node) => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
await writeFile(resolve(directory, 'segments.mjs'), "import {formatTranscriptNumbers,formatNumberText} from './caption-numbers.mjs';\n" + segmentCode);
const { wordsToSegments } = await import(pathToFileURL(resolve(directory, 'segments.mjs')));
assert.deepEqual(wordsToSegments([], '', 10), [], 'Silent recognition must never manufacture an exportable subtitle');
assert.equal(wordsToSegments([{ type: 'word', text: 'Zdravo', start: 1, end: 2 }], 'Zdravo', 10)[0].text, 'Zdravo');
console.log(JSON.stringify({ passed: true, syntheticPacketFixtures: results, transportStates: 7, statusStates: 7 }));

const {checkTranscriptLanguage}=await import(pathToFileURL(resolve(directory,'transcript-language.mjs')));
const speech={text:'Lepo vreme, avion.',words:[{text:'Lepo',start:0,end:.4,type:'word'},{text:'vreme',start:.4,end:1,type:'word'},{text:'avion',start:1,end:2,type:'word'}]};
assert.equal(checkTranscriptLanguage(speech,'bos').text,'Lijepo vrijeme, avion.');
assert.equal(checkTranscriptLanguage(speech,'hrv').text,'Lijepo vrijeme, zrakoplov.');
assert.deepEqual(checkTranscriptLanguage(speech,'hrv').words.map(w=>[w.start,w.end]),speech.words.map(w=>[w.start,w.end]));
assert.equal(checkTranscriptLanguage(speech,'srp'),speech);
assert.equal(checkTranscriptLanguage(speech,'auto'),speech);
assert.equal(checkTranscriptLanguage({text:'AVION Sarajevo nevreme'},'hr').text,'AVION Sarajevo nevreme');
console.log('Language normalization preserves timing, acronyms and unsupported languages.');
