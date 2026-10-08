import {audioBufferSegmentToWav,audioBuffersToWav} from '../lib/voice-wav';
import {prepareTranscriptionAudio} from '../lib/prepare-transcription-audio';
import {AudioPlayer} from './AudioPlayer';
import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../lib/api';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
type Voice={id:string;name:string;language?:string;previewUrl:string};
export function VideoVoicePanel({disabled,time,onAdd,file,sourceTime=0,transcript='',sourceEnd}:{disabled:boolean;time:number;file?:File;sourceTime?:number;sourceEnd?:number;transcript?:string;onAdd:(file:File,start:number,replace?:boolean)=>Promise<void>}) {
  const [voices,setVoices]=useState<Voice[]>([]),[voice,setVoice]=useState('');
  const [mode,setMode]=useState('narrator'),[seconds,setSeconds]=useState(10),[mix,setMix]=useState(false),[progress,setProgress]=useState(0);
  const [text,setText]=useState(''),[stability,setStability]=useState(55),[similarity,setSimilarity]=useState(75),[speed,setSpeed]=useState(100);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{file:File;url:string;start:number;replace?:boolean}|null>(null);
  const controller=useRef<AbortController|null>(null),preview=useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{const abort=new AbortController();void apiFetch('/api/voices',{signal:abort.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Glasovi nisu dostupni.');setVoices(data.voices||[]);setVoice(data.voices?.[0]?.id||'');}).catch(error=>{if(!abort.signal.aborted)setError(error instanceof Error?error.message:'Glasovi nisu dostupni.');});return()=>{abort.abort();controller.current?.abort();};},[]);
  useEffect(()=>()=>{if(result)URL.revokeObjectURL(result.url);},[result]);
  useEffect(()=>{controller.current?.abort();setResult(null);return()=>controller.current?.abort();},[file]);
  const filtered=voices;
  const [previewUrl,setPreviewUrl]=useState('');
  async function generate() {
    if(disabled||busy||!voice||(mode==='narrator'?!text.trim():!file))return;
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');const start=time;
    let context:AudioContext|undefined;
    try {
      if(mode==='change'){
        setProgress(0);const prepared=await prepareTranscriptionAudio(file!,abort.signal,()=>{});
        context=new AudioContext();const audio=await context.decodeAudioData(await prepared.blob.arrayBuffer());abort.signal.throwIfAborted();
        const from=Math.max(0,sourceTime-prepared.offset),end=Math.min(audio.duration,(sourceEnd??audio.duration)-prepared.offset,seconds?from+seconds:audio.duration);
        if(end<=from)throw new Error('Nema zvuka na odabranom dijelu scene.');
        const buffers:AudioBuffer[]=[];const count=Math.ceil((end-from)/270);
        for(let i=0;i<count;i++){
          abort.signal.throwIfAborted();const body=new FormData();body.append('audio',audioBufferSegmentToWav(audio,from+i*270,Math.min(end,from+(i+1)*270),16000),'glas.wav');body.append('model_id','eleven_multilingual_sts_v2');body.append('voice_settings',JSON.stringify({stability:stability/100,similarity_boost:similarity/100,style:0,use_speaker_boost:true}));
          const response=await apiFetch(`/api/voice-change?voiceId=${encodeURIComponent(voice)}`,{method:'POST',body,signal:abort.signal});
          if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Promjena glasa nije uspjela.');}
          buffers.push(await context.decodeAudioData(await response.arrayBuffer()));setProgress(Math.round((i+1)/count*100));
        }
        abort.signal.throwIfAborted();const audioFile=new File([audioBuffersToWav(buffers)],'novi-glas.wav',{type:'audio/wav'});setResult({file:audioFile,url:URL.createObjectURL(audioFile),start:start+Math.max(0,prepared.offset-sourceTime),replace:true});return;
      }
      const response=await apiFetch('/api/narration',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({voiceId:voice,text:text.trim(),stability:stability/100,similarity:similarity/100,speed:speed/100})});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Naracija nije uspjela. Pokušaj ponovo.');}
      const blob=await response.blob();abort.signal.throwIfAborted();
      if(!blob.size)throw new Error('Servis nije vratio zvuk.');
      const narrationFile=new File([blob],'naracija.mp3',{type:'audio/mpeg'});setResult({file:narrationFile,url:URL.createObjectURL(narrationFile),start,replace:mix});
    } catch(error) {if(!abort.signal.aborted)setError(error instanceof Error?error.message:'Naracija nije uspjela.');}
    finally {if(context)await context.close();setBusy(false);controller.current=null;}
  }
  return <div className="video-voice-panel"><h3>Glas i naracija</h3><div className="caption-edit-actions"><button disabled={busy} aria-pressed={mode==='narrator'} onClick={()=>setMode('narrator')}>Narator</button><button disabled={busy||!file} aria-pressed={mode==='change'} onClick={()=>setMode('change')}>Promijeni glas</button></div><p>Napiši tekst, odaberi glas i dodaj naraciju od trenutnog položaja na timelineu.</p>
    <LanguageDropdown variant="voice" label="Glas" placeholder="Nema označenih glasova" value={voice} onChange={value=>{preview.current?.pause();setPreviewUrl('');setVoice(value);}} disabled={busy||disabled||!filtered.length} options={filtered.map(voice=>({value:voice.id,label:voice.name}))}/>
    <button type="button" disabled={busy||!voices.find(item=>item.id===voice)?.previewUrl} onClick={()=>{const url=voices.find(item=>item.id===voice)!.previewUrl;setPreviewUrl(url);if(preview.current?.src===url)void preview.current.play().catch(()=>setError('Primjer nije dostupan.'));}}>Poslušaj glas</button>
    {previewUrl&&<AudioPlayer ref={preview} autoPlay src={previewUrl}/>}
    {mode==='narrator'&&<><button disabled={busy||!transcript} onClick={()=>setText(transcript)}>Preuzmi tekst titlova</button><label>Tekst naracije<textarea rows={3} maxLength={10000} value={text} disabled={busy||disabled} onChange={event=>setText(event.target.value)} placeholder="Napiši šta narator treba izgovoriti…"/></label><label><input type="checkbox" checked={mix} onChange={e=>setMix(e.target.checked)}/> Zamijeni originalni govor tokom naracije</label></>}
    <label>Stabilnost · {stability}%<input type="range" min="0" max="100" value={stability} disabled={busy||disabled} onChange={e=>setStability(Number(e.target.value))}/></label>
    <label>Sličnost · {similarity}%<input type="range" min="0" max="100" value={similarity} disabled={busy||disabled} onChange={e=>setSimilarity(Number(e.target.value))}/></label>
    <label>Brzina · {speed}%<input type="range" min="70" max="120" value={speed} disabled={busy||disabled} onChange={e=>setSpeed(Number(e.target.value))}/></label>
    {mode==='change'&&<label>Trajanje obrade<select value={seconds} disabled={busy} onChange={e=>setSeconds(Number(e.target.value))}>{[5,10,20,60,0].map(n=><option key={n} value={n}>{n?`${n} sekundi`:'Do kraja scene'}</option>)}</select></label>}
    <button type="button" disabled={busy||disabled||!voice||(mode==='narrator'?!text.trim():!file)} onClick={()=>void generate()}>{busy?`Obrada… ${progress}%`:mode==='change'?'Promijeni glas':'Generiši naraciju'}</button>{busy&&<button onClick={()=>controller.current?.abort()}>Otkaži</button>}
    {result&&<><AudioPlayer src={result.url}/><button type="button" disabled={busy||disabled} onClick={async()=>{setBusy(true);try{await onAdd(result.file,result.start,result.replace);setResult(null);}catch{setError('Naraciju nije moguće dodati. Pokušaj ponovo.');}finally{setBusy(false);}}}>Primijeni zvuk na timeline · {result.start.toFixed(1)} s</button></>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
