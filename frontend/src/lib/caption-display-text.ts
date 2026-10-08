import type {Segment} from '../config/captions/types';
const cache=new WeakMap<Segment,Segment>();
const originalIndices=new WeakMap<Segment,number[]>();
export const originalDisplayWordIndex=(segment:Segment,index:number)=>originalIndices.get(segment)?.[index]??index;
/** Display-only cleanup: never change the saved transcript or remove semantic words. */
export function compactDisplayCaption(segment:Segment):Segment{
 const cached=cache.get(segment);if(cached)return cached;
 const tokens=segment.text.trim().split(/\s+/);if(tokens.length<=12)return segment;
 const kept=tokens.map((text,index)=>({text,index})).filter(({text})=>! /^(?:h+m+|u+m+|uh|e{3,})[,.!?…]*$/iu.test(text));
 if(kept.length===tokens.length||!kept.length)return segment;
 const positions=new Map(kept.map((v,i)=>[v.index,i]));
 const index=(i:number|null|undefined)=>i==null?i:positions.get(i)??null;
 const map=<T,>(items:Record<number,T>|undefined)=>items?Object.fromEntries(Object.entries(items).filter(([key])=>positions.has(Number(key))).map(([key,v])=>[positions.get(Number(key))!,v])):undefined;
 const words=segment.words?.length===tokens.length?kept.map(v=>segment.words![v.index]):kept.map(v=>({text:v.text,start:segment.start+(segment.end-segment.start)*v.index/tokens.length,end:segment.start+(segment.end-segment.start)*(v.index+1)/tokens.length}));
 const result={...segment,text:kept.map(v=>v.text).join(' '),words,wordStyles:map(segment.wordStyles),wordOffsets:map(segment.wordOffsets),keywordWord:index(segment.keywordWord),headingWord:index(segment.headingWord),hiddenTitleWords:segment.hiddenTitleWords?.flatMap(i=>positions.has(i)?[positions.get(i)!]:[])};
 cache.set(segment,result);cache.set(result,result);originalIndices.set(result,kept.map(v=>v.index));return result;
}
