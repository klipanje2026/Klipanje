import {useRef,useState} from 'react';

/** Local editing history; saving does not discard undo and changing scripts remounts it. */
export function useScriptHistory<T extends Record<string,unknown>>(initial:T){
 const [value,render]=useState(initial);
 const current=useRef(initial),past=useRef<T[]>([]);
 const group=useRef({key:'',at:0});
 function field<K extends keyof T>(key:K){
  return (update:T[K]|((previous:T[K])=>T[K]))=>{
   const old=current.current;
   const next=typeof update==='function'?(update as (previous:T[K])=>T[K])(old[key]):update;
   if(JSON.stringify(next)===JSON.stringify(old[key]))return;
   const now=Date.now();
   // Coalesce continuous typing, while structural interval edits remain individual steps.
   const typing=key==='content'||key==='title';
   if(!typing||group.current.key!==String(key)||now-group.current.at>700){
    past.current=[...past.current.slice(-99),old];
   }
   group.current={key:typing?String(key):'',at:now};
   current.current={...old,[key]:next};render(current.current);
  };
 }
 function undo(){
  const previous=past.current.pop();if(!previous)return;
  group.current={key:'',at:0};current.current=previous;render(previous);
 }
 function update(change:(old:T)=>T){
  const next=change(current.current);if(JSON.stringify(next)===JSON.stringify(current.current))return;
  past.current=[...past.current.slice(-99),current.current];group.current={key:'',at:0};current.current=next;render(next);
 }
 return {value,field,update,undo,canUndo:past.current.length>0};
}
