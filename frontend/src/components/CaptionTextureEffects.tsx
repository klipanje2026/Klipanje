import {CaptionRange} from './CaptionRange';
import {useEffect,useRef,useState} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {captionTextureGroups,textureNaturalScale,animatedTextureModes,captionTextureFill,prepareTextureFill,captionTextureColors} from '../lib/caption-texture-fill';
import {drawTextSurface,drawGoldTexture,prepareGoldTextures} from '../lib/text-surface';
import {uploadMedia} from '../lib/media-upload';
import {CaptionEffectSection} from './CaptionEffectSection';
import './CaptionTextureEffects.scss';
import {ColorPicker} from './ColorPicker/ColorPicker';
type Mode=NonNullable<CaptionSettings['fillTexture']>;
function Preview({mode,playing}:{mode:Mode;playing:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;let frame=0;
  const paint=(time=0)=>{const c=canvas.getContext('2d')!;c.clearRect(0,0,240,130);c.font='800 52px Arial';c.textAlign='center';c.textBaseline='middle';const color=getComputedStyle(canvas).color;c.fillStyle=captionTextureFill(c,'Tekst',120,60,52,{...DEFAULT_CAPTION_SETTINGS,fillTexture:mode,textColor:color},time/1000)||color;c.fillText(mode==='image'?'▧':mode==='video'?'▶':'Tekst',120,60);if(mode==='goldReference')drawGoldTexture(c,'Tekst',120,60,52,{...DEFAULT_CAPTION_SETTINGS,textColor:'#ffbc38',highlightColor:'#ffdd54'});if(['matte','metal','brushed','stone','satin'].includes(mode))drawTextSurface(c,'Tekst',120,60,52,{...DEFAULT_CAPTION_SETTINGS,textMaterial:mode as CaptionSettings['textMaterial'],surfaceStrength:60,surfaceBevel:35});if(playing&&animatedTextureModes.includes(mode))frame=requestAnimationFrame(paint);};
  paint();if(mode==='goldReference')void prepareGoldTextures().then(()=>paint()).catch(()=>{});const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);paint();});observer.observe(document.documentElement,{attributes:true});return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[mode,playing]);return <canvas ref={ref} width={240} height={130} aria-hidden="true"/>;
}
export function CaptionTextureEffects({settings:s,patch}:{settings:CaptionSettings;patch:(s:Partial<CaptionSettings>)=>void}){
 const [category,setCategory]=useState(()=>Math.max(0,captionTextureGroups.findIndex(group=>group.items.some(([id])=>id===s.fillTexture))));
 const [hover,setHover]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const last=useRef<Mode>(s.fillTexture&&!['none','image','video'].includes(s.fillTexture)?s.fillTexture:'pattern'),lastMedia=useRef<Mode>(s.fillTexture==='video'?'video':'image'),fileInput=useRef<HTMLInputElement>(null);
 const natural=textureNaturalScale(s.fillTexture||'pattern');
 const sizes=[.25,.5,.75,1,1.5,2].map(n=>Math.round(n*natural));
 const sizeIndex=sizes.reduce((best,value,index)=>Math.abs(value-(s.fillTextureScale??natural))<Math.abs(sizes[best]-(s.fillTextureScale??natural))?index:best,0);
 const mode=s.fillTexture||'none',isMedia=mode==='image'||mode==='video';
 const colors=captionTextureColors(mode,s.textColor);
 const choose=(next:Mode,replaceColors=false)=>patch({fillTexture:next,...(next==='prism'?{behindPerson:true}:{}),...(replaceColors?{fillTextureColor:undefined,fillTextureColor2:undefined,fillTextureScale:undefined,textureDetail:undefined}: {})});
 async function upload(file:File){
  const projectId=new URLSearchParams(window.location.search).get('project');if(!projectId){setMessage('Prvo sačuvaj projekat pa dodaj datoteku za ispunu.');return;}
  if(!file.type.startsWith(mode==='video'?'video/':'image/')){setMessage('Odaberi odgovarajuću sliku ili video.');return;}
  if(mode==='image'&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>32*1024*1024)){setMessage('Odaberi PNG, JPG ili WebP sliku do 32 MB.');return;}
  setBusy(true);setMessage('Spremanje ispune…');
  try{const asset=await uploadMedia<{url:string;name:string}>(projectId,file,setMessage);const next={fillTexture:mode,fillTextureUrl:asset.url,fillTextureName:asset.name};await prepareTextureFill({...s,...next},0);patch(next);setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'Ispuna nije učitana.');}finally{setBusy(false);}
 }
 return <div className="caption-light-effects caption-line-editor caption-texture-effects">
 <CaptionEffectSection id="texture" title="Teksture" enabled={mode!=='none'&&!isMedia} onChange={on=>{if(mode!=='none'&&!isMedia)last.current=mode;choose(on?last.current:'none');}}>
  <div className="caption-texture-categories" role="group" aria-label="Kategorije materijala">{captionTextureGroups.map((group,index)=><button type="button" key={group.label} aria-pressed={category===index} onClick={()=>setCategory(index)}>{group.label}</button>)}</div>
  <div className="caption-effect-choices" role="group" aria-label="Vrsta teksture">{captionTextureGroups[category].items.map(([id,label])=><button type="button" key={id} disabled={busy} aria-pressed={mode===id} onMouseEnter={()=>setHover(id)} onMouseLeave={()=>setHover('')} onFocus={()=>setHover(id)} onBlur={()=>setHover('')} onClick={()=>{choose(mode===id?'none':id,id!==last.current);last.current=id;}}><Preview mode={id} playing={hover===id||mode===id}/><span>{label}</span><i aria-hidden="true">{mode===id?'✓':''}</i></button>)}</div>
  {mode==='prism'?<><label>Boja preko osobe<ColorPicker value={s.fillTextureColor??s.highlightColor} onChange={e=>patch({fillTextureColor:e.target.value})}/></label><label className="caption-popover-range"><span>Jačina Prism efekta <b>{s.prismStrength??100}%</b></span><CaptionRange settingKey="prismStrength" resetValue={100} min={0} max={100} value={s.prismStrength??100} onChange={e=>patch({prismStrength:Number(e.target.value)})}/></label></>:<>
  <div className="caption-light-fields caption-texture-colors">{([['fillTextureColor','Boja uzorka 1'],['fillTextureColor2','Boja uzorka 2']] as const).map(([key,label])=><label key={key}><span>{label}</span><ColorPicker onReset={()=>patch({[key]:undefined})} value={s[key]||colors[key==='fillTextureColor'?0:1]} onChange={e=>patch({[key]:e.target.value})}/></label>)}
  <label className="subtitle-size-control"><span>Veličina uzorka <b>{sizes[sizeIndex]}%</b></span><CaptionRange resetValue={3} type="range" min={0} max={5} step={1} value={sizeIndex} onChange={e=>patch({fillTextureScale:sizes[Number(e.target.value)]})}/></label></div>
  <label className="caption-popover-range"><span>Jačina teksture <b>{s.textureAmount??100}%</b></span><CaptionRange settingKey="textureAmount" resetValue={100} min={0} max={100} value={s.textureAmount??100} onChange={e=>patch({textureAmount:Number(e.target.value)})}/></label>
  </>}
  {mode==='lava'&&<label className="caption-popover-range"><span>Širina pukotina lave <b>{s.textureDetail??50}%</b></span><CaptionRange settingKey="textureDetail" resetValue={50} min={0} max={100} value={s.textureDetail??50} onChange={e=>patch({textureDetail:Number(e.target.value)})}/></label>}
  {animatedTextureModes.includes(mode)&&<label className="caption-popover-range"><span>Brzina teksture <b>{s.textureSpeed??1}×</b></span><CaptionRange settingKey="textureSpeed" resetValue={1} min={.1} max={3} step={.1} value={s.textureSpeed??1} onChange={e=>patch({textureSpeed:Number(e.target.value)})}/></label>}

 </CaptionEffectSection>
 <CaptionEffectSection id="media-fill" title="Ispune" enabled={isMedia} onChange={on=>{if(isMedia)lastMedia.current=mode;patch({fillTexture:on?lastMedia.current:'none'});}}>
  <div className="caption-media-kinds">{(['image','video'] as const).map(id=><button type="button" disabled={busy} key={id} aria-pressed={mode===id} onClick={()=>{lastMedia.current=id;patch({fillTexture:id,...(mode!==id?{fillTextureUrl:undefined,fillTextureName:undefined}:{})});}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{id==='image'?<><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/></>:<><rect x="3" y="3" width="18" height="18" rx="5"/><path d="m10 8 6 4-6 4Z"/></>}</svg>{id==='image'?'Slika':'Video'}</button>)}</div>
  {isMedia&&<><input ref={fileInput} hidden type="file" accept={mode==='video'?'video/*':'image/png,image/jpeg,image/webp'} disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/>
   <button type="button" className="caption-fill-upload" disabled={busy} onClick={()=>fileInput.current?.click()}><span aria-hidden="true">＋</span><span>{busy?'Spremanje…':s.fillTextureName|| (mode==='video'?'Odaberi video za ispunu':'Odaberi sliku za ispunu')}</span><small>{mode==='video'?'Video unutar slova · bez zvuka':'PNG, JPG ili WebP · do 32 MB'}</small></button>
  </>}
  {message&&<small role="status">{message}</small>}
 </CaptionEffectSection></div>;
}
