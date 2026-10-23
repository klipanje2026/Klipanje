import {StudioIcon} from './StudioIcon/StudioIcon';
import {AudioEnvelopeControls} from './AudioEnvelopeControls';
import type {AudioEnvelope} from '../lib/audio-envelope';
type SoundClip={name:string;start:number;inPoint:number;outPoint:number;volume:number;muted:boolean;audioRole?:'sound'|'music'|'narration';audioEnvelope?:AudioEnvelope};
export function SoundInspector({clip,duration,playhead,disabled,onChange,onClose,onSplit,onRemove}:{clip:SoundClip;duration:number;playhead:number;disabled:boolean;onChange:(patch:Partial<SoundClip>)=>void;onClose:()=>void;onSplit:()=>void;onRemove:()=>void}){
 const round=(value:number)=>Math.round(value*10)/10;
 return <aside className="overlay-floating-inspector sound-floating-inspector" aria-label="Postavke odabranog zvuka"><div className="overlay-edit-header sound-inspector-header"><strong>{clip.audioRole==='music'?'Pozadinska muzika':'Zvučni efekat'}</strong><button type="button" className="sound-inspector-close" title="Zatvori" aria-label="Zatvori postavke zvuka" onClick={onClose}><StudioIcon name="close"/></button></div><div className="overlay-library local-editor-tools"><small>{clip.name}</small><fieldset disabled={disabled}>
 <label>Traka<select value={clip.audioRole||'sound'} onChange={e=>onChange({audioRole:e.target.value as 'sound'|'music'})}><option value="sound">Zvučni efekti</option><option value="music">Pozadinska muzika</option></select></label>
 <label className="narration-inline-control compact-audio-start">Početak (s)<input type="number" min="0" step=".1" value={round(clip.start)} onChange={e=>onChange({start:Math.max(0,round(Number(e.target.value)))})}/></label>
 <label className="narration-inline-control">Trajanje (s)<input type="number" min=".1" max={duration-clip.inPoint} step=".1" value={round(clip.outPoint-clip.inPoint)} onChange={e=>onChange({outPoint:Math.min(duration,clip.inPoint+Math.max(.1,Number(e.target.value)))})}/></label>
 <div className="overlay-property-grid"><label>Izvor · od (s)<input type="number" min="0" max={clip.outPoint-.01} step=".1" value={round(clip.inPoint)} onChange={e=>onChange({inPoint:Math.max(0,Math.min(clip.outPoint-.01,Number(e.target.value)))})}/></label><label>Izvor · do (s)<input type="number" min={clip.inPoint+.01} max={duration} step=".1" value={round(clip.outPoint)} onChange={e=>onChange({outPoint:Math.min(duration,Math.max(clip.inPoint+.01,Number(e.target.value)))})}/></label></div>
 <small>Koristi odabrani dio snimka. Original ostaje sačuvan.</small>
 <AudioEnvelopeControls clip={clip} onChange={onChange} playhead={playhead}/>
 <div className="overlay-actions"><button disabled={playhead<=clip.start||playhead>=clip.start+clip.outPoint-clip.inPoint} onClick={onSplit}>Presijeci ovdje</button><button onClick={()=>onChange({muted:!clip.muted})}>{clip.muted?'Uključi zvuk':'Utišaj'}</button><button onClick={onRemove}>Ukloni s timelinea</button></div>
 </fieldset></div></aside>;
}
