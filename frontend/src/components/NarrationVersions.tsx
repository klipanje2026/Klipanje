import {useEffect,useRef,useState} from 'react';
import type {Asset} from '../lib/production';
import {StudioIcon} from './StudioIcon/StudioIcon';
export function NarrationVersions({takes,onUse,onDelete,selected}:{takes:Asset[];onUse:(take:Asset)=>void;onDelete?:(take:Asset)=>void;selected?:string}){
 const audio=useRef<HTMLAudioElement|null>(null),[playing,setPlaying]=useState(''),[expanded,setExpanded]=useState('');
 useEffect(()=>()=>{audio.current?.pause();},[]);
 const play=async(take:Asset)=>{audio.current?.pause();if(playing===take.id){setPlaying('');return;}const next=new Audio(take.url);audio.current=next;setPlaying(take.id);next.onended=()=>setPlaying('');try{await next.play();}catch{setPlaying('');}};
 return <div className="frame-narration-versions">{takes.filter(t=>!t.metadata.archived).map((take,i)=><div key={take.id}><div className="compact-media-row"><span title={take.metadata.narration?.text}>{take.metadata.voiceName||'Narator'} — verzija {i+1}</span><button title="Poslušaj" aria-label="Poslušaj verziju" onClick={()=>void play(take)}><StudioIcon name={playing===take.id?'pause':'play'}/></button><button title="Koristi ovu naraciju" aria-label="Koristi ovu naraciju" aria-pressed={selected===take.id} onClick={()=>onUse(take)}><StudioIcon name={selected===take.id?'check':'plus'}/></button><button title="Tekst naracije" aria-label="Tekst naracije" aria-expanded={expanded===take.id} onClick={()=>setExpanded(expanded===take.id?'':take.id)}><StudioIcon name="chevron"/></button>{onDelete&&<button title="Obriši naraciju" aria-label="Obriši naraciju" onClick={()=>onDelete(take)}><StudioIcon name="trash"/></button>}</div>{expanded===take.id&&<p>{take.metadata.narration?.text}</p>}</div>)}</div>;
}
