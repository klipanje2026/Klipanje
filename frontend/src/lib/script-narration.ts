import type {Interval} from './production';
import {narrationText} from './narration-sync';
export type SceneVoice={speaker?:string;model?:string;tone?:string;speed?:number;assetId?:string};
export type NarrationPlan={mode?:'narration'|'dialogue';voices:Record<string,string>;scenes:Record<string,SceneVoice>;backgrounds:string[]};
export const emptyNarrationPlan=():NarrationPlan=>({voices:{},scenes:{},backgrounds:[]});
export function spokenScene(text:string,speaker:string,keepQuotes:boolean){
 const escaped=speaker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return narrationText(text,keepQuotes).replace(new RegExp(`^\\s*(?:\\*\\*|__)?(?:Narator|Narrator|${escaped})(?:\\*\\*|__)?\\s*:(?:\\*\\*|__)?\\s*`,'iu'),'').trim();
}
export function fitSceneDuration(items:Interval[],id:string,duration:number){
 if(!Number.isFinite(duration)||duration<=0)return items;
 const index=items.findIndex(s=>s.id===id);if(index<0)return items;
 const precise=(n:number)=>Math.round(n*1000000)/1000000;
 const end=precise(items[index].start+Math.max(.1,duration)),delta=end-items[index].end;
 return items.map((s,i)=>i<index?s:i===index?{...s,end}:{...s,start:precise(s.start+delta),end:precise(s.end+delta)});
}
export function bookPages(content:string,limit=1100,maxLines=14){
 const tokens=content.match(/\n|[^\S\n]+|[^\s]+/g)||[];const pages:string[]=[];let page='',line=0,column=0;
 for(const token of tokens){
  for(let offset=0;offset<token.length;offset+=limit){
   const part=token.slice(offset,offset+limit),newline=part==='\n';
   let nextLine=newline?line+1:line+Math.floor((column+part.length)/70),nextColumn=newline?0:(column+part.length)%70;
   if(page&&(nextLine>=maxLines||page.length+part.length>limit)){pages.push(page.trim());page='';line=0;column=0;nextLine=newline?0:Math.floor(part.length/70);nextColumn=newline?0:part.length%70;}
   if(!page&&!part.trim())continue;
   page+=part;line=nextLine;column=nextColumn;
  }
 }
 if(page.trim())pages.push(page.trim());return pages.length?pages:[''];
}
