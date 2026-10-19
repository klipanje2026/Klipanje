import {LocalDialog} from './LocalDialog';
import {useLayoutEffect,useRef,useState} from 'react';
import {fitBookPages} from '../lib/book-pagination';
const parts=(text:string)=>text.split(/(\n[ \t]*\n(?:[ \t]*\n)*|\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
const isGap=(part:string)=>/^\n[ \t]*\n/.test(part);
function BookText({text}:{text:string}){return <>{parts(text).map((part,i)=>isGap(part)?<span key={i} className="script-book-paragraph-gap" aria-hidden="true"/>:part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:part)}</>;}
export function ScriptBook({title,content,onClose}:{title:string;content:string;onClose:()=>void}){
 const [index,setIndex]=useState(0),[pages,setPages]=useState([content]);
 const paper=useRef<HTMLElement>(null),body=useRef<HTMLDivElement>(null),footer=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const page=paper.current,text=body.current,foot=footer.current;if(!page||!text||!foot)return;
  let frame=0,disposed=false;
  const measure=()=>{
   if(disposed)return;
   const style=getComputedStyle(page),height=page.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-foot.getBoundingClientRect().height;
   const probe=text.cloneNode(false) as HTMLDivElement;
   probe.setAttribute('aria-hidden','true');
   Object.assign(probe.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',width:`${text.getBoundingClientRect().width}px`,height:'auto',minHeight:'0',flex:'none',top:'0',left:'0'});
   page.appendChild(probe);
   const fits=(value:string)=>{
    probe.replaceChildren();
    for(const part of parts(value)){
     if(isGap(part)){const gap=document.createElement('span');gap.className='script-book-paragraph-gap';probe.appendChild(gap);}
     else if(part.startsWith('**')||part.startsWith('*')){const bold=part.startsWith('**'),node=document.createElement(bold?'strong':'em');node.textContent=part.slice(bold?2:1,bold?-2:-1);probe.appendChild(node);}
     else probe.appendChild(document.createTextNode(part));
    }
    return probe.getBoundingClientRect().height<=height;
   };
   try{const next=fitBookPages(content,fits);setPages(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);}finally{probe.remove();}
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);observer.observe(page);schedule();
  void document.fonts.ready.then(schedule);document.fonts.addEventListener('loadingdone',schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.fonts.removeEventListener('loadingdone',schedule);};
 },[content]);
 const at=Math.min(index,pages.length-1);
 return <LocalDialog title={title} onClose={onClose} className="script-book-dialog"><div className="script-book"><nav aria-label="Stranice skripte"><button disabled={!at} onClick={()=>setIndex(at-1)}>← Prethodna</button><span>Stranica {at+1} / {pages.length}</span><button disabled={at===pages.length-1} onClick={()=>setIndex(at+1)}>Sljedeća →</button></nav><article ref={paper} className="script-book-page"><header>{title}</header><div ref={body}><BookText text={pages[at]||'Napiši svoju priču u tabu Skripte.'}/></div><footer ref={footer}>{at+1}</footer></article><small>Pregled prati izvorni tekst. Tekst za govor i vremena uređuješ u prilagodbi naracije.</small></div></LocalDialog>;
}
