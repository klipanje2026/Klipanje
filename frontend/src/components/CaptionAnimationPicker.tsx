import {useEffect,useRef,useState} from 'react';
import {drawCaption} from '../lib/caption-renderer';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import type {CaptionSettings} from '../config/captions/types';

const options:{label:string;reveal:NonNullable<CaptionSettings['reveal']>;animation:CaptionSettings['animation']}[]=[
 {label:'Bez animacije',reveal:'none',animation:'none'},
 {label:'Postepeno',reveal:'fade',animation:'none'},
 {label:'Slovo po slovo',reveal:'letters',animation:'none'},
 {label:'Iskakanje',reveal:'pop',animation:'none'},
 {label:'Slijeva',reveal:'slideLeft',animation:'none'},
 {label:'Odozdo',reveal:'rise',animation:'none'},
 {label:'Približavanje',reveal:'zoom',animation:'none'},
 {label:'Iz magle',reveal:'softBlur',animation:'none'},
 {label:'Klizanje i pad',reveal:'slideFall',animation:'none'},
 {label:'Blagi puls',reveal:'none',animation:'pulse'},
];
function MotionSample({option,playing}:{option:typeof options[number];playing:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const ctx=ref.current?.getContext('2d');if(!ctx)return;let frame=0;const start=performance.now();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{const time=playing&&!reduced?((now-start)/1000)%2.5:.5;ctx.clearRect(0,0,240,130);
   const color=getComputedStyle(ref.current!).color;
   drawCaption(ctx,{id:'animation-example',text:'Tvoja priča',start:0,end:3,keywordWord:null,headingWord:null,suppressSuggestions:true,words:[{text:'Tvoja',start:0,end:.8},{text:'priča',start:.8,end:3}]},time,'clean',{...DEFAULT_CAPTION_SETTINGS,x:50,y:50,fontScale:135,fontSizePx:undefined,textColor:color,highlightColor:color,outlineWidth:0,wordMode:'spoken',revealGroupSize:1,revealDuration:.45,...option});
   if(playing&&!reduced)frame=requestAnimationFrame(draw);
  };draw(performance.now());return()=>cancelAnimationFrame(frame);
 },[option,playing]);
 return <canvas ref={ref} width={240} height={130} aria-hidden="true"/>;
}
export function CaptionAnimationPicker({settings,onChange}:{settings:CaptionSettings;onChange:(patch:Partial<CaptionSettings>)=>void}){
 const [hover,setHover]=useState<number|null>(null);
 return <div className="caption-animation-grid">{options.map((option,index)=>{
  const selected=(settings.reveal??'none')===option.reveal&&settings.animation===option.animation;
  return <button type="button" key={option.label} aria-pressed={selected} onMouseEnter={()=>setHover(index)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(index)} onBlur={()=>setHover(null)} onClick={()=>onChange({reveal:option.reveal,animation:option.animation})}><MotionSample option={option} playing={hover===index}/><span>{option.label}</span></button>;
 })}</div>;
}
