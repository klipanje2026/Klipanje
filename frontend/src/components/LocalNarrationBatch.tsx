import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
import {useRef,useState} from 'react';
import {apiFetch} from '../lib/api';
import {uploadAsset,type Script} from '../lib/production';
import {rememberRemoteFile} from './LocalVideoStorage';
import {prepareNarration} from '../lib/narration-audio';
import {alignmentWords,narrationText,rememberMediaTiming,type NarrationTiming} from '../lib/narration-sync';
export function LocalNarrationBatch({script,text,segment,voice,start,disabled,onAdd}:{script:Script;text:string;segment:string;voice:string;start:number;disabled:boolean;onAdd:(files:File[],start:number,role:'narration')=>Promise<boolean>}){
 const [split,setSplit]=useState(false),[parts,setParts]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(0);
 const generated=useRef(new Map<number,Blob>());
 const alignments=useRef(new Map<number,ReturnType<typeof alignmentWords>>());
 const [speed,setSpeed]=useState(1),[sync,setSync]=useState(true),[placement,setPlacement]=useState<NarrationTiming['placement']>('scene');
 const [cursor,setCursor]=useState<number|null>(null);
 const change=(items:string[])=>{setParts(items);setDone(0);setCursor(null);generated.current.clear();alignments.current.clear();};
 async function generate(){setBusy(true);setMessage('');let at=cursor??start;const plan=split?parts:[text];try{
  for(let i=done;i<plan.length;i++){
   setMessage(`Generisanje ${i+1} / ${plan.length}…`);
   let blob=generated.current.get(i);
   if(!blob){const response=await apiFetch('/api/narration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voiceId:voice,text:narrationText(plan[i],script.photo_settings.keepQuotes!==false),speed,timestamps:true})});
    if(!response.ok){const error=await response.json();throw new Error(error.error||'Generisanje nije uspjelo.');}
    const result=await response.json();const bytes=Uint8Array.from(atob(result.audio_base64),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:'audio/mpeg'});alignments.current.set(i,alignmentWords(result.alignment));generated.current.set(i,blob);
   }
   const ready=await prepareNarration(blob,false);
   const file=new File([ready.blob],`${script.title}-naracija-${String(i+1).padStart(2,'0')}-${Date.now()}.wav`,{type:'audio/wav'});
   const segmentIds=segment?[segment]:split&&parts.length===script.segments.length?[script.segments[i].id]:!split?script.segments.map(s=>s.id):[];
   const timing:NarrationTiming={segmentIds,text:narrationText(plan[i],script.photo_settings.keepQuotes!==false),words:alignments.current.get(i)||[],duration:ready.duration,sync:sync&&!(split&&segment&&parts.length>1),placement:split&&segment&&i>0?'append':placement};
   const asset=await uploadAsset(script.project,file,{purpose:'narration',audioRole:'narration',scriptId:script.id,segmentId:segmentIds[0],segmentIds,narration:timing});
   rememberRemoteFile(file,asset.id);
   rememberMediaTiming(file,{narration:timing,segmentIds});
   const added=await onAdd([file],at,'narration');
   at+=ready.duration;setCursor(at);setDone(i+1);
   if(!added)throw new Error('Zvuk je sačuvan u medijima, ali nije dodat na timeline. Uvezi ga iz medija; nastavak neće ponovo generisati ovaj dio.');
  }
  setMessage('Naracija je sačuvana i postavljena na timeline.'+(sync?' Titlovi i povezane slike usklađeni su s trajanjem govora.':''));
 }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <section className="local-narration-generate"><h3>Generisanje naracije</h3><fieldset disabled={busy||disabled}>
 <label>Brzina govora · {speed.toFixed(2)}×<input type="range" min=".7" max="1.2" step=".05" value={speed} onChange={e=>{setSpeed(Number(e.target.value));change(parts);}}/></label>
 <StyleDropdown label="Postavljanje" value={placement} onChange={e=>setPlacement(e.target.value as NarrationTiming['placement'])}><option value="scene">Na trenutni početak kadra</option><option value="append">Iza posljednje naracije</option><option value="manual">Na upisano vrijeme</option></StyleDropdown>
 <label className="local-check"><input type="checkbox" checked={sync} onChange={e=>setSync(e.target.checked)}/>Uskladi titlove i povezane slike s govorom</label>
 <label className="local-check"><input type="checkbox" checked={split} onChange={e=>{setSplit(e.target.checked);change(!segment&&script.segments.length?script.segments.map(s=>s.text):[text]);}}/>Rastavi na kadrove</label>
 {split&&<><small>Svaki dio generiše se zasebno. Kod dodatnog ručnog sjeckanja kadra poravnaj titlove ručno; automatsko tempiranje koristi originalne kadrove. Uredi tekst ili postavi kursor pa podijeli dio. Pauze unutar govora ostaju.</small>{parts.map((part,i)=><div className="narration-batch-part" key={i}><label>Dio {i+1}<textarea rows={2} value={part} maxLength={10000} onChange={e=>change(parts.map((v,n)=>n===i?e.target.value:v))} id={`narration-part-${i}`}/></label><button type="button" onClick={()=>{const field=document.getElementById(`narration-part-${i}`) as HTMLTextAreaElement;const at=field.selectionStart;if(at>0&&at<part.length)change([...parts.slice(0,i),part.slice(0,at).trim(),part.slice(at).trim(),...parts.slice(i+1)]);}}>Podijeli na kursoru</button><button type="button" disabled={parts.length===1} onClick={()=>change(parts.filter((_,n)=>n!==i))}>Ukloni dio</button></div>)}</>}
 <button type="button" disabled={!voice||(split?parts.some(p=>!p.trim()):!text.trim())||done>=(split?parts.length:1)} onClick={()=>void generate()}>{done?'Nastavi generisanje':'Generiši naraciju'}</button>
 {done>0&&<button type="button" onClick={()=>{setDone(0);setCursor(null);generated.current.clear();alignments.current.clear();setMessage('Spremno za novu generaciju. Prethodni zvukovi ostaju sačuvani.');}}>Nova generacija</button>}
 </fieldset>{message&&<p role="status">{message}</p>}</section>;
}
