import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
import {useRef,useState} from 'react';
import {apiFetch} from '../lib/api';
import {uploadAsset,type Script} from '../lib/production';
import {rememberRemoteFile} from './LocalVideoStorage';
import {prepareNarration} from '../lib/narration-audio';
import {audioBufferSegmentToWav} from '../lib/voice-wav';
import {alignmentWords,narrationText,rememberMediaTiming,type NarrationTiming} from '../lib/narration-sync';
import {narrationFrameRanges} from '../lib/narration-frame-ranges';
export function LocalNarrationBatch({voiceName,beforeGenerate,tone,onBusy,model,script,text,segment,voice,start,disabled,onAdd}:{voiceName?:string;beforeGenerate?:()=>Promise<boolean>;tone:string;onBusy:(busy:boolean)=>void;model:string;script:Script;text:string;segment:string;voice:string;start:number;disabled:boolean;onAdd:(files:File[],start:number,role:'narration')=>Promise<boolean>}){
 const [split,setSplit]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState<string[]>([]);
 const [speed,setSpeed]=useState(()=>{try{return Math.max(.7,Math.min(1.2,Number(localStorage.getItem('klipanje-speed-'+script.id))||1));}catch{return 1;}}),[sync,setSync]=useState(true),[placement,setPlacement]=useState<NarrationTiming['placement']>('scene');
 const running=useRef(false),responses=useRef(new Map<string,{blob:Blob;words:ReturnType<typeof alignmentWords>}>()),uploaded=useRef(new Map<string,File>());
 const frames=segment?script.segments.filter(s=>s.id===segment):script.segments;
 const clear=()=>{responses.current.clear();uploaded.current.clear();setDone([]);setMessage('');};
 async function generate(only?:string){
  if(running.current)return;
  const rows=only?frames.filter(s=>s.id===only):split?frames:[];
  const source=rows.length?rows.map(s=>s.text).join('\n'):text;
  const key=JSON.stringify([rows.map(s=>s.id),source,voice,model,tone,speed,split]);
  running.current=true;setBusy(true);onBusy(true);setMessage('Generisanje naracije…');
  try{
   if(beforeGenerate&&!await beforeGenerate())throw new Error('Spremanje nije završeno. Naracija nije pokrenuta.');
   if(!source.trim())throw new Error('Nema teksta za naraciju.');
   if(model!=='eleven_v4_turbo'&&/\[[^\]\r\n]+\]/.test(source))throw new Error('Audio tagovi traže V4 Turbo.');
   let ready=responses.current.get(key);
   if(!ready){const response=await apiFetch('/api/narration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voiceId:voice,text:(model==='eleven_v4_turbo'&&tone?tone+' ':'')+narrationText(source,script.photo_settings.keepQuotes!==false),speed,model,timestamps:true})});if(!response.ok){const error=await response.json();throw new Error(error.error||'Generisanje nije uspjelo.');}const result=await response.json();ready={blob:new Blob([Uint8Array.from(atob(result.audio_base64),c=>c.charCodeAt(0))],{type:result.content_type||'audio/mpeg'}),words:alignmentWords(result.alignment)};responses.current.set(key,ready);}
   const prepared=await prepareNarration(ready.blob,false);
   const ranges=rows.length?narrationFrameRanges(rows.map(s=>s.text),ready.words,prepared.duration):[{start:0,end:prepared.duration}];
   const context=rows.length>1?new AudioContext():undefined;
   try{
    const buffer=context?await context.decodeAudioData(await prepared.blob.arrayBuffer()):undefined;
    for(let i=0;i<ranges.length;i++){
     const partKey=key+':'+i;if(done.includes(partKey))continue;
     const range=ranges[i],ids=rows.length?[rows[i].id]:frames.map(s=>s.id);
     const timing:NarrationTiming={segmentIds:ids,text:rows[i]?.text||text,words:ready.words.filter(w=>w.start<range.end&&w.end>range.start).map(w=>({...w,start:Math.max(0,w.start-range.start),end:Math.min(range.end-range.start,w.end-range.start)})),duration:range.end-range.start,sync,placement};
     let file=uploaded.current.get(partKey);
     if(!file){const blob=buffer?audioBufferSegmentToWav(buffer,range.start,range.end,buffer.sampleRate):prepared.blob;file=new File([blob],`${script.title}-${(voiceName||'naracija').replace(/[^\p{L}\p{N} -]/gu,'').slice(0,50)}-${rows[i]?script.segments.findIndex(s=>s.id===rows[i].id)+1:'cijela'}-${Date.now()}.wav`,{type:'audio/wav'});const asset=await uploadAsset(script.project,file,{voiceId:voice,voiceName:voiceName||voice,model,tone,speed,purpose:'narration',gallery:true,audioRole:'narration',scriptId:script.id,segmentId:ids[0],segmentIds:ids,narration:timing});rememberRemoteFile(file,asset.id);rememberMediaTiming(file,{narration:timing,segmentIds:ids});uploaded.current.set(partKey,file);}
     if(!await onAdd([file],start+range.start,'narration'))throw new Error('Snimak je sačuvan. Pokušaj ponovo dodati; neće se ponovo generisati.');
     setDone(old=>old.includes(partKey)?old:[...old,partKey]);
    }
   }finally{await context?.close();}
   setMessage('Naracija je dodana. Tvoja podjela kadrova i tekst titlova ostaju sačuvani.');
  }catch(error){setMessage((error as Error).message);}finally{running.current=false;setBusy(false);onBusy(false);}
 }
 return <section className="local-narration-generate"><fieldset disabled={busy||disabled}>
 <label className="narration-inline-control">Brzina govora · {speed.toFixed(2)}×<input type="range" min=".7" max="1.2" step=".05" value={speed} onChange={e=>{setSpeed(Number(e.target.value));try{localStorage.setItem('klipanje-speed-'+script.id,e.target.value);}catch{}clear();}}/></label>
 <StyleDropdown label="Postavljanje" value={placement} onChange={e=>{setPlacement(e.target.value as NarrationTiming['placement']);clear();}}><option value="scene">Na trenutni početak kadra</option><option value="append">Iza posljednje naracije</option><option value="manual">Na upisano vrijeme</option></StyleDropdown>
 <label className="local-check"><input type="checkbox" checked={sync} onChange={e=>{setSync(e.target.checked);clear();}}/>Uskladi trajanje titlova i povezanih slika s govorom</label>
 <label className="local-check"><input type="checkbox" checked={split} disabled={!frames.length} onChange={e=>{setSplit(e.target.checked);clear();}}/>Rastavi na postojeće kadrove</label>
 {split&&<><small>Jedna generacija odabranog teksta, zatim rezovi po tvojim postojećim kadrovima.</small>{frames.map(s=><div className="narration-batch-part" key={s.id}><span>Kadar {script.segments.indexOf(s)+1} · {s.text}</span><button type="button" disabled={!voice} onClick={()=>void generate(s.id)}>Generiši naraciju</button></div>)}</>}
 <button type="button" disabled={!voice||!(split?frames.length:text.trim())} onClick={()=>void generate()}>{busy?'Generišem…':done.length?'Nastavi / dodaj naraciju':'Generiši naraciju'}</button>
 {done.length>0&&<button type="button" onClick={clear}>Nova generacija</button>}
 </fieldset>{message&&<p role="status">{message}</p>}</section>;
}
