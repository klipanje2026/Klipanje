import {LocalDialog} from './LocalDialog';
import {useEffect,useState} from 'react';
import {bookPages} from '../lib/script-narration';
export function ScriptBook({title,content}:{title:string;content:string}){
 const [index,setIndex]=useState(0),[open,setOpen]=useState(true),[height,setHeight]=useState(window.innerHeight);
 useEffect(()=>{const resize=()=>setHeight(window.innerHeight);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const pages=bookPages(content,2400,Math.max(16,Math.floor((height*.94-180)/25))),at=Math.min(index,pages.length-1);
 return <><button type="button" onClick={()=>setOpen(true)}>Otvori veliki pregled skripte ↗</button>{open&&<LocalDialog title={title} onClose={()=>setOpen(false)} className="script-book-dialog"><div className="script-book"><nav aria-label="Stranice skripte"><button disabled={!at} onClick={()=>setIndex(at-1)}>← Prethodna</button><span>Stranica {at+1} / {pages.length}</span><button disabled={at===pages.length-1} onClick={()=>setIndex(at+1)}>Sljedeća →</button></nav><article className="script-book-page"><header>{title}</header><div>{(pages[at]||'Napiši svoju priču u tabu Skripte.').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part,i)=>part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:part)}</div><footer>{at+1}</footer></article><small>Pregled prati izvorni tekst. Tekst za govor i vremena uređuješ u prilagodbi naracije.</small></div></LocalDialog>}</>;
}
