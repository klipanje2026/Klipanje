import type {Interval} from './production';
/** Word alignment retains interval identities and all timing/metadata. Every proposal is reviewed. */
export function syncIntervalText(items:Interval[],text:string,previousText?:string):{segments:Interval[];error?:string}{
 const words=(s:string)=>s.match(/\S+/g)||[];
 const old=items.flatMap(s=>words(s.text)),next=words(text);
 if(!items.length)return {segments:items,error:'Prvo napravi podjelu intervala.'};
 if(!next.length)return {segments:items,error:'Tekst skripte je prazan. Intervali nisu promijenjeni.'};
 if((old.length+1)*(next.length+1)>8000000)return {segments:items,error:'Prevelika izmjena za pouzdano automatsko povezivanje. Uredi tekst pojedinačnih intervala.'};
 const cols=next.length+1,table=new Uint32Array((old.length+1)*cols);
 for(let i=old.length-1;i>=0;i--)for(let j=next.length-1;j>=0;j--)table[i*cols+j]=old[i]===next[j]?1+table[(i+1)*cols+j+1]:Math.max(table[(i+1)*cols+j],table[i*cols+j+1]);
 const anchors:[number,number][]=[[-1,-1]];let i=0,j=0;
 while(i<old.length&&j<next.length){if(old[i]===next[j]){anchors.push([i++,j++]);}else if(table[(i+1)*cols+j]>=table[i*cols+j+1])i++;else j++;}
 anchors.push([old.length,next.length]);
 if(old.length>8&&anchors.length-2<Math.min(old.length,next.length)*.2)return {segments:items,error:'Tekst se previše razlikuje. Zadrži intervale ili ih ručno prilagodi; automatska zamjena nije izvršena.'};
 const boundaries=[0];let total=0;
 for(const item of items.slice(0,-1)){
  total+=words(item.text).length;
  const right=anchors.findIndex(([a])=>a>=total),[a,b]=anchors[Math.max(0,right-1)],[c,d]=anchors[right];
  const mapped=c===total?d:Math.round(b+1+(total-a-1)*(d-b-1)/Math.max(1,c-a-1));
  boundaries.push(Math.max(boundaries.at(-1)!,Math.min(next.length,mapped)));
 }
 boundaries.push(next.length);
 const segments=items.map((s,n)=>({...s,text:next.slice(boundaries[n],boundaries[n+1]).join(' ')}));
 if(segments.some(s=>!s.text.trim()))return {segments:items,error:'Izmjena bi ostavila prazan kadar. Prilagodi taj interval ručno; postojeća podjela je sačuvana.'};
 if(previousText!==undefined){
  const previous=syncIntervalText(items,previousText);
  if(!previous.error)return {segments:segments.map((s,i)=>previous.segments[i].text===s.text?items[i]:s)};
 }
 return {segments};
}

/** Replace only the located interval, preserving paragraphs and stage directions around it. */
export function updateScriptInterval(content:string,items:Interval[],id:string,text:string):string|undefined{
 let offset=0;
 for(const item of items){
  const tokens=item.text.match(/\S+/g)||[];if(!tokens.length)return undefined;
  const escaped=tokens.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const match=new RegExp(escaped,'u').exec(content.slice(offset));if(!match)return undefined;
  const at=offset+match.index;
  if(item.id===id)return content.slice(0,at)+text+content.slice(at+match[0].length);
  offset=at+match[0].length;
 }
 return undefined;
}
