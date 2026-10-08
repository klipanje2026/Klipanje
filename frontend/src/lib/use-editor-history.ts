import { useRef, useState, useCallback, type SetStateAction } from 'react';
export function useEditorHistory<T>(initial:T) {
  const [value,render]=useState(initial);
  const current=useRef(initial), past=useRef<T[]>([]), future=useRef<T[]>([]), transaction=useRef<T|null>(null);
  const [,refresh]=useState(0);
  const apply=useCallback((next:T)=>{current.current=next;render(next);refresh(v=>v+1);},[]);
  const set=useCallback((action:SetStateAction<T>)=>{
    const next=typeof action==='function'?(action as (v:T)=>T)(current.current):action;
    if(JSON.stringify(next)===JSON.stringify(current.current))return;
    if(transaction.current===null){past.current=[...past.current.slice(-49),current.current];future.current=[];}
    apply(next);
  },[apply]);
  const begin=()=>{if(transaction.current===null)transaction.current=current.current;};
  const end=()=>{const before=transaction.current;transaction.current=null;if(before!==null&&JSON.stringify(before)!==JSON.stringify(current.current)){past.current=[...past.current.slice(-49),before];future.current=[];refresh(v=>v+1);}};
  const undo=()=>{end();const previous=past.current.pop();if(previous!==undefined){future.current.push(current.current);apply(previous);}};
  const undoScoped=(pick:(value:T)=>unknown,merge:(value:T,source:T)=>T)=>{
    end();
    let index=past.current.length-1;
    while(index>=0&&JSON.stringify(pick(past.current[index]))===JSON.stringify(pick(past.current[index+1]??current.current)))index--;
    if(index<0)return;
    const before=past.current[index],after=past.current[index+1]??current.current,old=current.current;
    // Rebase later unrelated snapshots so undoing them cannot resurrect this edit.
    const onlyScoped=JSON.stringify(merge(before,after))===JSON.stringify(after);
    if(onlyScoped)past.current.splice(index,1);
    for(let i=onlyScoped?index:index+1;i<past.current.length;i++)past.current[i]=merge(past.current[i],before);
    future.current.push(old);apply(merge(old,before));
  };
  const redo=()=>{const next=future.current.pop();if(next!==undefined){past.current.push(current.current);apply(next);}};
  const reset=useCallback((next:T)=>{past.current=[];future.current=[];transaction.current=null;apply(next);},[apply]);
  return {value,set,begin,end,undo,undoScoped,redo,reset,canUndo:past.current.length>0,canRedo:future.current.length>0};
}
