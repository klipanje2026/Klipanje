import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Link} from 'react-router-dom';
import type {SelectHTMLAttributes} from 'react';
import {StudioIcon} from '../components/StudioIcon/StudioIcon';
import {aspectCrop,clamp,cropPixels,cropThumbnails,exportCroppedVideo,fullCrop,type CropRect} from '../lib/video-cropper';
import './VideoTools.scss';

const tr=(text:string,values:Record<string,string|number>={})=>text.replace(/\{([^}]+)\}/g,(match,key)=>String(values[key]??match));
const t=tr;
function AdminSelect({label,children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string}){return <label className="video-tool-select"><span>{label}</span><select aria-label={label} {...props}>{children}</select></label>;}
const formatRatio=(value:string)=>Number(({tiktok:'0.5625','youtube-shorts':'0.5625',youtube:'1.7777777777777777'} as Record<string,string>)[value]||value);
const time=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
type Meta={duration:number;width:number;height:number};
type Gesture={mode:string;px:number;py:number;box:DOMRect;crop:CropRect};
export function VideoTools(){
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(''),[meta,setMeta]=useState<Meta|null>(null);
 const [crop,setCrop]=useState<CropRect>(fullCrop),[ratio,setRatio]=useState('original'),[start,setStart]=useState(0),[end,setEnd]=useState(0),[position,setPosition]=useState(0);
 const [speed,setSpeed]=useState('1'),[quality,setQuality]=useState('0.65'),[edge,setEdge]=useState('1920'),[format,setFormat]=useState<'mp4'|'webm'>('mp4'),[mute,setMute]=useState(false);
 const [playing,setPlaying]=useState(false),[dragging,setDragging]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const [frames,setFrames]=useState<string[]>([]),[result,setResult]=useState<{url:string;extension:string;width:number;height:number;size:number}|null>(null);
 const video=useRef<HTMLVideoElement>(null),input=useRef<HTMLInputElement>(null),stage=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null);
 const gesture=useRef<Gesture|null>(null),trimGesture=useRef<'start'|'end'|'seek'|null>(null),controller=useRef<AbortController|null>(null),version=useRef(0);
 useEffect(()=>{if(!file)return;const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
 useEffect(()=>{setFrames([]);if(!url)return;const abort=new AbortController();void cropThumbnails(url,abort.signal).then(value=>{if(!abort.signal.aborted)setFrames(value);}).catch(()=>{});return()=>abort.abort();},[url]);
 useEffect(()=>()=>{if(result)URL.revokeObjectURL(result.url);},[result]);
 useEffect(()=>()=>{version.current++;controller.current?.abort();},[]);
 // An edited setting invalidates the old download, so its label never describes stale output.
 useEffect(()=>setResult(null),[crop,start,end,speed,quality,edge,format,mute]);
 useEffect(()=>{if(video.current){video.current.playbackRate=Number(speed);video.current.preservesPitch=true;}},[speed,url]);
 useEffect(()=>{if(!playing)return;let frame=0;const update=()=>{const v=video.current;if(!v)return;if(v.currentTime>=end){v.pause();v.currentTime=end;setPosition(end);return;}frame=requestAnimationFrame(update);};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);},[playing,end]);
 const output=meta?cropPixels(crop,meta.width,meta.height,Number(edge)):null;
 const pause=()=>{video.current?.pause();setPlaying(false);};
 function selectFile(next?:File){
  if(!next||busy)return;
  if(!next.type.startsWith('video/')&&!/\.(mp4|mov|webm|m4v)$/i.test(next.name)){setError(tr("Odaberi video datoteku."));return;}
  if(next.size>500e6){setError(tr("Odaberi video do 500 MB."));return;}
  pause();setMeta(null);setResult(null);setError('');setFrames([]);setPosition(0);setStart(0);setEnd(0);setCrop(fullCrop);setRatio('original');setFile(next);
 }
 function loaded(){const v=video.current;if(!v)return;if(!Number.isFinite(v.duration)||v.duration<.1||v.duration>1800||v.videoWidth<2||v.videoHeight<2){setMeta(null);setError(tr("Odaberi video do 30 minuta s ispravnim trajanjem."));return;}setMeta({duration:v.duration,width:v.videoWidth,height:v.videoHeight});setEnd(v.duration);v.playbackRate=Number(speed);v.preservesPitch=true;}
 function seekTo(value:number){if(!meta||busy)return;const next=clamp(value,start,end);if(video.current)video.current.currentTime=next;setPosition(next);}
 function updateRange(side:'start'|'end',value:number){if(!meta||!Number.isFinite(value)||busy)return;pause();if(side==='start'){const next=clamp(value,0,end-.1);setStart(next);if(video.current)video.current.currentTime=next;setPosition(next);}else{const next=clamp(value,start+.1,meta.duration);setEnd(next);if(position>next){if(video.current)video.current.currentTime=next;setPosition(next);}}}
 async function play(){const v=video.current;if(!v||!meta||busy)return;if(!v.paused){pause();return;}if(v.currentTime<start||v.currentTime>=end-.02)v.currentTime=start;try{await v.play();}catch{setError(tr("Video se ne može pokrenuti. Pokušaj drugi fajl."));}}
 function preset(value:string){if(!meta)return;setRatio(value);if(value==='free')return;setCrop(aspectCrop(value==='original'?meta.width/meta.height:formatRatio(value),meta.width/meta.height));}
 function beginCrop(event:ReactPointerEvent,mode:string){if(!meta||busy||!stage.current)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);gesture.current={mode,px:event.clientX,py:event.clientY,box:stage.current.getBoundingClientRect(),crop:{...crop}};pause();}
 function moveCrop(event:ReactPointerEvent){const g=gesture.current;if(!g||!meta||busy)return;const dx=(event.clientX-g.px)/g.box.width,dy=(event.clientY-g.py)/g.box.height;
  if(g.mode==='move'){setCrop({...g.crop,x:clamp(g.crop.x+dx,0,1-g.crop.width),y:clamp(g.crop.y+dy,0,1-g.crop.height)});return;}
  const left=g.mode.includes('w'),top=g.mode.includes('n'),ax=left?g.crop.x+g.crop.width:g.crop.x,ay=top?g.crop.y+g.crop.height:g.crop.y;
  const maxW=left?ax:1-ax,maxH=top?ay:1-ay;
  let w=clamp(g.crop.width+(left?-dx:dx),Math.min(.025,maxW),maxW),h=clamp(g.crop.height+(top?-dy:dy),Math.min(.025,maxH),maxH);
  if(ratio!=='free'){const normalized=(ratio==='original'?meta.width/meta.height:formatRatio(ratio))*meta.height/meta.width;if(Math.abs(dy)>Math.abs(dx))w=h*normalized;w=clamp(w,Math.min(.025,maxW,maxH*normalized),Math.min(maxW,maxH*normalized));h=w/normalized;}
  setCrop({x:left?ax-w:ax,y:top?ay-h:ay,width:w,height:h});
 }
 function timelinePointer(event:ReactPointerEvent,mode:'start'|'end'|'seek'){if(busy||!meta)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);trimGesture.current=mode;pause();moveTimeline(event,mode);}
 function moveTimeline(event:ReactPointerEvent,mode=trimGesture.current){if(!mode||!meta||!track.current||busy)return;const box=track.current.getBoundingClientRect(),value=clamp((event.clientX-box.left)/box.width,0,1)*meta.duration;if(mode==='seek')seekTo(value);else updateRange(mode,value);}
 function cropField(key:keyof CropRect,value:number){if(!meta||!Number.isFinite(value)||busy)return;const normalized=value/(['x','width'].includes(key)?meta.width:meta.height);setRatio('free');setCrop(old=>{const next={...old};if(key==='x')next.x=clamp(normalized,0,1-old.width);if(key==='y')next.y=clamp(normalized,0,1-old.height);if(key==='width')next.width=clamp(normalized,2/meta.width,1-old.x);if(key==='height')next.height=clamp(normalized,2/meta.height,1-old.y);return next;});}
 async function run(){if(!file||!meta||busy)return;pause();const current=++version.current;controller.current=new AbortController();setBusy(true);setProgress(0);setError('');setResult(null);
  try{const exported=await exportCroppedVideo(file,{crop,start,end,speed:Number(speed),quality:Number(quality),maxEdge:Number(edge),format,mute},controller.current.signal,value=>{if(version.current===current)setProgress(value);});if(version.current===current)setResult({...exported,url:URL.createObjectURL(exported.blob),size:exported.blob.size});}
  catch(cause){if(version.current===current)setError(cause instanceof Error?cause.message:tr("Izvoz nije uspio."));}finally{if(version.current===current)setBusy(false);}
 }
 return <div className="cropper-page"><main className="tools-content"><Link className="tool-back" to="/"><StudioIcon name="back"/>{t('Početna')}</Link>
  <header className="cropper-heading"><div><span className="tools-eyebrow">{t('BESPLATNO · NA TVOM UREĐAJU')}</span><h1>{tr("Prilagodi video")}</h1><p>{tr("Izreži kadar i trajanje, prilagodi brzinu te smanji video pri izvozu.")}</p></div>{file&&<button className="cropper-secondary" disabled={busy} onClick={()=>input.current?.click()}>{t('Promijeni video')}</button>}</header>
  <input ref={input} className="cropper-file-input" type="file" accept="video/*,.mp4,.mov,.webm,.m4v" onChange={e=>{selectFile(e.target.files?.[0]);e.target.value='';}}/>
  <section className={`cropper-shell${dragging?' is-dragging':''}`} onDragOver={e=>{if(!busy&&e.dataTransfer.types.includes('Files')){e.preventDefault();setDragging(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);selectFile(e.dataTransfer.files[0]);}}>
   {!file?<button className="cropper-drop" onClick={()=>input.current?.click()}><span className="cropper-drop-icon"><StudioIcon name="frame"/></span><strong>{t('Prevuci video ovdje')}</strong><span>{t('Odaberi video')}  {tr("· MP4, MOV, WebM")}</span><small>{t('Do 500 MB · do 30 minuta')}</small></button>:<>
    <div className="cropper-workspace"><div className="cropper-preview-area"><div className="cropper-stage" ref={stage} style={meta?{aspectRatio:`${meta.width}/${meta.height}`,width:`min(100%, calc(clamp(180px, 100dvh - 520px, 420px) * ${meta.width/meta.height}))`}:undefined}>
     <video ref={video} key={url} src={url||undefined} playsInline muted={mute} preload="auto" onLoadedMetadata={loaded} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>{const v=e.currentTarget;setPosition(v.currentTime);if(v.currentTime>=end&&end>0){v.pause();if(v.currentTime>end+.025)v.currentTime=end;}}} onEnded={()=>setPlaying(false)} onError={()=>{setMeta(null);setError(tr("Video se ne može otvoriti. Pokušaj MP4 (H.264) ili WebM."));}}/>
     {meta&&<div className="cropper-selection" role="group" aria-label={tr("Odabrani kadar; strelice pomjeraju okvir")} tabIndex={busy?-1:0} style={{left:`${crop.x*100}%`,top:`${crop.y*100}%`,width:`${crop.width*100}%`,height:`${crop.height*100}%`}} onPointerDown={e=>beginCrop(e,'move')} onPointerMove={moveCrop} onPointerUp={()=>{gesture.current=null;}} onPointerCancel={()=>{gesture.current=null;}} onLostPointerCapture={()=>{gesture.current=null;}} onKeyDown={e=>{if(busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=e.shiftKey ? .025 : .005;setCrop(old=>({...old,x:clamp(old.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),0,1-old.width),y:clamp(old.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0),0,1-old.height)}));}}>
      <i className="cropper-grid"/>{['nw','ne','sw','se'].map(corner=><span key={corner} className={`cropper-handle ${corner}`} onPointerDown={e=>beginCrop(e,corner)}/>)}
     </div>}
    </div><p className="cropper-preview-hint">{tr("Povuci okvir ili njegove uglove. Zatamnjeni dio se uklanja.")}</p></div>
    <fieldset className="cropper-settings" disabled={busy||!meta}><legend>{tr("Postavke videa")}</legend>
     <AdminSelect label={tr("Omjer kadra")} value={ratio} disabled={busy||!meta} onChange={e=>preset(e.target.value)}><option value="original">{tr("Original")}</option><option value="free">{tr("Slobodan kadar")}</option><option value="youtube">YouTube · 16:9</option><option value="tiktok">TikTok · 9:16</option><option value="youtube-shorts">YouTube Shorts · 9:16</option><option value="1">{tr("1:1 · Kvadrat")}</option><option value="0.8">{tr("4:5 · Objava")}</option><option value="1.3333333333333333">4:3</option></AdminSelect>
     <AdminSelect label={tr("Dimenzije izvoza")} value={edge} disabled={busy||!meta} onChange={e=>setEdge(e.target.value)}><option value="3840">{tr("Do 4K · 3840 px")}</option><option value="2560">2560 px</option><option value="1920">{tr("Full HD · 1920 px")}</option><option value="1280">{tr("HD · 1280 px")}</option><option value="854">{tr("Manji fajl · 854 px")}</option><option value="640">640 px · najmanji fajl</option></AdminSelect>
     <AdminSelect label={t('Kompresija')} value={quality} disabled={busy||!meta} onChange={e=>setQuality(e.target.value)}><option value="1">{tr("Visoka kvaliteta")}</option><option value="0.65">{t('Uravnotežena')}</option><option value="0.4">{tr("Manja veličina")}</option></AdminSelect>
     <AdminSelect label={tr("Brzina videa")} value={speed} disabled={busy||!meta} onChange={e=>{pause();setSpeed(e.target.value);}}>{Array.from({length:20},(_,i)=>(i+1)/10).map(value=><option key={value} value={value}>{value.toFixed(1)}{tr("×")}</option>)}</AdminSelect>
     <AdminSelect label={t('Format videa')} value={format} disabled={busy||!meta} onChange={e=>setFormat(e.target.value as 'mp4'|'webm')}><option value="mp4">{tr("MP4")}</option><option value="webm">{tr("WebM")}</option></AdminSelect>
     <label className="cropper-mute"><input type="checkbox" checked={mute} onChange={e=>setMute(e.target.checked)}/>{tr("Bez zvuka")}</label>
     <details className="cropper-precise"><summary>{tr("Precizan kadar")}</summary><div>{(['x','y','width','height'] as const).map(key=><label key={key}>{tr(({x:'X',y:'Y',width:'Širina',height:'Visina'})[key])}<input type="number" min={key==='x'||key==='y'?0:2} step={1} max={meta?(['x','width'].includes(key)?meta.width:meta.height):0} value={meta?Math.round(crop[key]*(['x','width'].includes(key)?meta.width:meta.height)):0} onChange={e=>cropField(key,e.target.valueAsNumber)}/></label>)}</div></details>
     <button className="cropper-secondary" onClick={()=>{setCrop(fullCrop);setRatio('original');setStart(0);setEnd(meta?.duration??0);setSpeed('1');pause();if(video.current)video.current.currentTime=0;setPosition(0);}}>{tr("Vrati kadar i trajanje")}</button>
    </fieldset></div>
    {meta&&<div className="cropper-timeline"><div className="cropper-transport"><button disabled={busy} className="cropper-play" onClick={()=>void play()} aria-label={playing?tr("Pauza"):tr("Pokreni video")}><StudioIcon name={playing?'pause':'play'}/></button><span>{time(position)} <small>/ {time(meta.duration)}</small></span><strong>{file.name}</strong><span>{output?.width}  {tr("×")} {output?.height}</span></div>
     <div className="cropper-ruler" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i}>{time(meta.duration*i/6)}</span>)}</div>
     <div ref={track} className="cropper-track" onPointerDown={e=>timelinePointer(e,'seek')} onPointerMove={e=>moveTimeline(e)} onPointerUp={()=>{trimGesture.current=null;}} onPointerCancel={()=>{trimGesture.current=null;}} onLostPointerCapture={()=>{trimGesture.current=null;}}>
      <div className="cropper-filmstrip" aria-hidden="true">{frames.map((frame,i)=><img key={i} src={frame} alt="" draggable={false}/>)}</div><div className="cropper-trim-shade" style={{left:0,width:`${start/meta.duration*100}%`}}/><div className="cropper-trim-shade" style={{right:0,width:`${(1-end/meta.duration)*100}%`}}/>
      <div className="cropper-trim-range" style={{left:`${start/meta.duration*100}%`,width:`${(end-start)/meta.duration*100}%`}}>
       {(['start','end'] as const).map(side=><button key={side} disabled={busy} className={`cropper-trim-handle ${side}`} role="slider" aria-label={side==='start'?tr("Početak videa"):tr("Kraj videa")} aria-valuemin={side==='start'?0:start+.1} aria-valuemax={side==='start'?end-.1:meta.duration} aria-valuenow={side==='start'?start:end} aria-valuetext={time(side==='start'?start:end)} onPointerDown={e=>timelinePointer(e,side)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();updateRange(side,e.key==='Home'?0:e.key==='End'?meta.duration:(side==='start'?start:end)+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1));}}><span/></button>)}
      </div><div className="cropper-playhead" style={{left:`${position/meta.duration*100}%`}} aria-hidden="true"/>
     </div>
     <input className="cropper-scrub" type="range" aria-label={tr("Pozicija u videu")} min={start} max={end} step={.01} value={clamp(position,start,end)} disabled={busy} onChange={e=>{pause();seekTo(Number(e.target.value));}}/>
     <div className="cropper-time-fields"><label>{tr("Od")} <input aria-label={tr("Početak u sekundama")} type="number" min={0} max={end-.1} step={.1} value={Number(start.toFixed(2))} disabled={busy} onChange={e=>updateRange('start',e.target.valueAsNumber)}/>  {tr("s")}</label><label>{tr("Do")} <input aria-label={tr("Kraj u sekundama")} type="number" min={start+.1} max={meta.duration} step={.1} value={Number(end.toFixed(2))} disabled={busy} onChange={e=>updateRange('end',e.target.valueAsNumber)}/>  {tr("s")}</label><span>{tr("Trajanje izvoza")} <strong>{time((end-start)/Number(speed))}</strong></span></div>
    </div>}
   </>}
  </section>
  {error&&<p className="cropper-error" role="alert">{t(error)}</p>}
  {file&&<footer className="cropper-export"><div><strong>{output?tr("{v0} × {v1} · {v2} · {v3}×", {v0: output.width,v1: output.height,v2: format.toUpperCase(),v3: speed}):tr("Priprema videa…")}</strong><p>{tr("Bez povećavanja izvorne rezolucije. Video ostaje na tvom uređaju.")}</p></div><button className="tool-primary" disabled={!meta||busy} onClick={()=>void run()}>{busy?t('Obrađujem…'):tr("Obradi video")}<StudioIcon name="download"/></button></footer>}
  {busy&&<div className="cropper-progress" role="status"><progress max={100} value={progress}/><span>{Math.round(progress)}{tr("% · Ostavi ovu karticu vidljivom do završetka izvoza.")}</span><button onClick={()=>controller.current?.abort()}>{t('Otkaži')}</button></div>}
  {result&&<section className="cropper-result"><div><span className="tools-eyebrow">{tr("SPREMNO ZA DIJELJENJE")}</span><h2>{tr("Video je spreman.")}</h2><p>Original: {((file?.size||0)/1e6).toFixed(2)} MB · Rezultat: {(result.size/1e6).toFixed(2)} MB</p><p>{result.size<(file?.size||0)?`${Math.round((1-result.size/file!.size)*100)}% manji fajl`:"Rezultat nije manji od originala. Za manji fajl smanji dimenzije ili odaberi jaču kompresiju."}</p><p>{result.width}  {tr("×")} {result.height} · {(result.size/1e6).toFixed(2)}  {tr("MB")}</p><a className="tool-primary" href={result.url} download={`klipanje-video-${file?.name.replace(/\.[^.]+$/,'')}.${result.extension}`}>{t('Preuzmi {format}',{format:result.extension.toUpperCase()})}<StudioIcon name="download"/></a></div><video src={result.url} controls playsInline/></section>}
  <p className="cropper-privacy">{tr("Obrada ostaje na tvom uređaju. Preuzmi rezultat prije zatvaranja stranice.")}</p>
 </main></div>;
}
