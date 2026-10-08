import {useCallback,useLayoutEffect,useState,type SetStateAction} from 'react';
import {clampTimelineHeight,timelineMaximum} from './timeline-size';

export function useTimelineHeight(initial:number,minimum:number,selector:string,enabled=true) {
 const [requested,setRequested]=useState(initial);
 const [maximum,setMaximum]=useState(()=>timelineMaximum(window.innerHeight-64));
 useLayoutEffect(()=>{
  if(!enabled)return;
  const area=document.querySelector(selector);if(!area)return;
  const measure=()=>setMaximum(timelineMaximum(area.getBoundingClientRect().height));
  measure();const observer=new ResizeObserver(measure);observer.observe(area);
  return()=>observer.disconnect();
 },[selector,enabled]);
 const height=clampTimelineHeight(requested,minimum,maximum);
 const setHeight=useCallback((value:SetStateAction<number>)=>setRequested(previous=>clampTimelineHeight(typeof value==='function'?value(clampTimelineHeight(previous,minimum,maximum)):value,minimum,maximum)),[minimum,maximum]);
 return [height,setHeight,maximum] as const;
}
