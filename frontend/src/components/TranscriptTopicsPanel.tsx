import type {Segment} from '../config/captions/presets';
import {useMemo,useState} from 'react';
export type TranscriptTopics={header:string;keywords:string[]};
const stop=new Set('a ako ali bez biti bio bila bilo bi bih bismo biste da do dok ga gdje i ili im ima imate imam iz ja je jer jeste kao kad kako ko koja koje koji koju li me mi moj moja na ne nego neki nije nisu o od on ona oni ono pa po pod prije trebaju treba trebamo sa sam se si smo su sve svoj ta taj tako te ti to tu u uz vam vas već vi za zato što šta ovo ove ovih samo još jedan jedna jedno the and of to is in it for with this that you we are be'.split(' '));
export function suggestTopics(text:string):TranscriptTopics {
 const counts=new Map<string,number>();
 const words=(text.toLocaleLowerCase().match(/\p{L}{3,}/gu)||[]).filter(w=>!stop.has(w));
 for(const word of words)counts.set(word,(counts.get(word)||0)+1);
 const keywords=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([word])=>word);
 return {header:keywords[0]||'',keywords};
}
export function TranscriptTopicsPanel({text,value,onChange,segments=[],onSelect,onClearSuggestions}:{text:string;value?:TranscriptTopics;onChange:(v:TranscriptTopics)=>void;segments?:Segment[];onSelect?:(index:number)=>void;onClearSuggestions?:()=>void}){
 const [tab,setTab]=useState('words');const suggested=useMemo(()=>suggestTopics(text),[text]),data=value||suggested;
 const words=segments.flatMap((s,i)=>Object.values(s.wordStyles||{}).map(w=>({text:w.text,index:i}))),titles=segments.flatMap((s,i)=>s.role==='title'?[{text:s.text,index:i}]:[]);
 return <details className="transcript-topics"><summary>Naslovi i bitne riječi</summary><nav className="transcript-topic-tabs">{[['words','Bitne riječi'],['titles','Naslovi'],['suggested','Prijedlozi']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>{tab==='suggested'?<><button type="button" onClick={()=>{onChange({header:'',keywords:[]});onClearSuggestions?.();}}>Izbriši predložene</button><small>Predloženi naslovi i bitne riječi iz cijelog teksta.</small><label>Naslov<input value={data.header} maxLength={160} onChange={e=>onChange({...data,header:e.target.value})}/></label><label>Bitne riječi<textarea rows={2} value={data.keywords.join(', ')} onChange={e=>onChange({...data,keywords:e.target.value.split(',').map(v=>v.trim()).slice(0,12)})}/></label></>:<div className="transcript-marked-list">{(tab==='words'?words:titles).map((item,i)=><button type="button" key={i} onClick={()=>onSelect?.(item.index)}>{item.text}</button>)}{!(tab==='words'?words:titles).length&&<small>Još nema odabranih {tab==='words'?'bitnih riječi':'naslova'}.</small>}</div>}</details>;
}
