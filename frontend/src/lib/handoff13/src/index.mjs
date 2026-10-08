import impactData from '../data/captions.impact.json';
import cutoutData from '../data/captions.cutout.json';
import prismData from '../data/captions.prism.json';
import pressureData from '../data/captions.pressure.json';
import orbitData from '../data/captions.orbit.json';
import faultData from '../data/captions.fault.json';
import duetData from '../data/captions.duet.json';
import corporateData from '../data/captions.corporate.json';
import { createImpactRenderer } from './impact-engine.mjs';
import { createCutoutRenderer } from './cutout-engine.mjs';
import { createPrismRenderer } from './prism-engine.mjs';
import { createPressureRenderer } from './pressure-engine.mjs';
import { createOrbitRenderer } from './orbit-engine.mjs';
import { createFaultRenderer } from './fault-engine.mjs';
import { createDuetRenderer } from './duet-engine.mjs';
import { createCorporateRenderer, corporateStyles } from './corporate-engine.mjs';

const specs = {
  impact: { data: 'impact', factory: createImpactRenderer, font: 'impact', colorway: 'original' },
  'impact-refined': { data: 'impact', factory: createImpactRenderer, font: 'impact', colorway: 'refined' },
  cutout: { data: 'cutout', factory: createCutoutRenderer, font: 'impact' },
  prism: { data: 'prism', factory: createPrismRenderer, font: 'black' },
  pressure: { data: 'pressure', factory: createPressureRenderer, font: 'rounded' },
  orbit: { data: 'orbit', factory: createOrbitRenderer, font: 'black' },
  fault: { data: 'fault', factory: createFaultRenderer, font: 'impact' },
  duet: { data: 'duet', factory: createDuetRenderer, fonts: ['sans', 'serif', 'hand'] },
  ...Object.fromEntries(corporateStyles.map(id => [id,
    { data: 'corporate', section: id, factory: createCorporateRenderer,
      fonts: ['black', 'serif', 'condensed', 'mono'], corporate: true }])),
};
export const presetIds = Object.freeze(Object.keys(specs));

const datasets={impact:impactData,cutout:cutoutData,prism:prismData,pressure:pressureData,orbit:orbitData,fault:faultData,duet:duetData,corporate:corporateData};
function loadData(id){const spec=specs[id];if(!spec)throw new RangeError('Unknown caption preset');const data=datasets[spec.data];return spec.section?data[spec.section]:data;}
export function getPresetData(id) {
  return structuredClone(loadData(id));
}
export function createCaptionPreset({ id, native, cues, theme = {}, fontFamilies = {} }) {
  if (!native || typeof native.createCanvas !== 'function')
    throw new TypeError('Pass native Canvas with createCanvas, for example @napi-rs/canvas.');
  const spec = specs[id];
  if (!spec) throw new RangeError(`Unknown preset "${id}". Choose one of: ${presetIds.join(', ')}`);
  function font(key){if(!fontFamilies[key])throw new Error('Missing caption font: '+key);return fontFamilies[key];}
  const data = loadData(id);
  let defaults;
  if (spec.corporate) {
    defaults = { fonts: { bold: fontFamilies.black || theme.fonts?.bold || font('black'),
      serif: fontFamilies.serif || theme.fonts?.serif || font('serif'),
      condensed: fontFamilies.condensed || theme.fonts?.condensed || font('condensed'),
      mono: fontFamilies.mono || theme.fonts?.mono || font('mono') } };
  } else if (id === 'duet') {
    defaults = { fonts: { sans: theme.fonts?.sans || font('sans'),
      serif: theme.fonts?.serif || font('serif'), hand: theme.fonts?.hand || font('hand') } };
  } else {
    defaults = { fontFamily: theme.fontFamily || font(spec.font) };
    if (spec.colorway) defaults.colorway = spec.colorway;
  }
  const merged = { ...defaults, ...theme,
    ...(defaults.fonts ? { fonts: { ...defaults.fonts, ...theme.fonts } } : {}) };
  const selectedCues = cues || structuredClone(data.cues);
  const renderer = spec.factory({ createCanvas: native.createCanvas,
    ...(spec.corporate ? { style: id } : {}), cues: selectedCues, theme: merged });
  return { id, duration: cues ? Math.max(0, ...selectedCues.map(x => x.end)) : data.duration,
    cues: selectedCues,
    draw: renderer.draw, clearCache: renderer.clearCache };
}
