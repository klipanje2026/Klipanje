import {createPortal} from 'react-dom';
import {CaptionIndividualToggle} from '../CaptionIndividualToggle';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {groupCaptions,addCaptionsToGroup,nextCaptionGroup} from '../../lib/caption-selection';
import {DEFAULT_CAPTION_SETTINGS} from '../../config/captions/presets';
import type { Segment, CaptionSettings, StyleKey } from '../../config/captions/presets';
import { trimCaption, moveCaption, dragCaption, splitCaptionAt, mergeCaptionWithNext, nextCaptionToMerge } from '../../lib/caption-timing';
import './CaptionTimeline.scss';

export function CaptionTimeline({ segments, duration, zoom, selected, onSelect, onChange, onGroupSelect, time=0, onSeek, waveform, narration, onZoom, onEdit, onBegin, onEnd, compact=false,allowGroups=true,onSplit,onMerge,canMergePair,groupToolsTarget,groupStyle='clean',groupSettings=DEFAULT_CAPTION_SETTINGS }: {
  allowGroups?:boolean;onMerge?:(id:string)=>void;canMergePair?:(first:string,next:string)=>boolean;onSplit?:(id:string,time:number)=>void;onGroupSelect?:(id:string)=>void;groupToolsTarget?:string;groupStyle?:StyleKey;groupSettings?:CaptionSettings;compact?:boolean; onBegin?:()=>void; onEnd?:()=>void; onEdit?:(index:number)=>void; onZoom?:(zoom:number)=>void; waveform?:ReactNode; narration?:ReactNode; time?:number; onSeek?:(time:number)=>void; segments: Segment[]; duration: number; zoom: number; selected: number;
  onSelect: (index: number, container?:boolean) => void; onChange: (segments: Segment[]) => void;
}) {
  const [dragOrigin,setDragOrigin]=useState<{start:number;end:number;top:number}|null>(null);
  const [individualHint,setIndividualHint]=useState<string|null>(null);
  const previousSelection=useRef(segments[selected]?.id);
  useEffect(()=>{const id=segments[selected]?.id;if(previousSelection.current!==id){const prior=segments.find(s=>s.id===previousSelection.current);if(prior?.detachedStyle&&prior.separateStyle===false)setIndividualHint(prior.id);previousSelection.current=id;}},[segments,selected]);
  const [marked,setMarked]=useState<string[]>([]);const anchor=useRef(0);const [dropTarget,setDropTarget]=useState<string|null>(null);const dropTargetRef=useRef<string|null>(null);
  const addGroup=()=>{onChange(selectedIds.length>1?groupCaptions(segments,selectedIds,'',groupStyle,groupSettings):nextCaptionGroup(segments,segments[selected]?.id,groupStyle,groupSettings));setMarked([]);};
  const groupActions=useRef(addGroup);groupActions.current=addGroup;
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(allowGroups&&e.ctrlKey&&e.altKey&&e.code==='KeyG'&&!e.repeat&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable=true]'))){e.preventDefault();groupActions.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[allowGroups]);
  const selectedIds=marked.filter(id=>segments.some(s=>s.id===id));
  const groupRows=[...new Set(segments.flatMap(s=>s.group?[s.group.id]:[]))].map(id=>{const members=segments.filter(s=>s.group?.id===id);return {id,group:members[0].group!,lane:members[0].lane||0,start:Math.min(...members.map(s=>s.start)),end:Math.max(...members.map(s=>s.end)),members};});
  const [toolsTarget,setToolsTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{setToolsTarget(groupToolsTarget?document.getElementById(groupToolsTarget):null);},[groupToolsTarget]);
  const dropGroup=useRef<string|null>(null);
  const pan=useRef<{x:number;left:number}|null>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number; segments: Segment[]; end: number } | null>(null);
  const move = useRef<{ x: number;y:number; width: number; segments: Segment[]; start: number } | null>(null);
  const length = Math.max(duration, .1);
  useEffect(()=>{if(zoom===100&&track.current?.parentElement)track.current.parentElement.scrollLeft=0;},[zoom]);
  const base=compact?18:32;
  const titleHeight=segments.some(s=>s.role==='title')?26:0;
  const speechTop=base+titleHeight;
  const contentBottom=speechTop+58+groupRows.length*72;
  const segmentTop=(s:Segment)=>s.role==='title'?base:s.group?speechTop+58+groupRows.findIndex(g=>g.id===s.group!.id)*72+16:speechTop;
  const rowAt=(y:number)=>y<speechTop?null:y<speechTop+58?'all':groupRows[Math.floor((y-speechTop-58)/72)]?.id||null;
  const moveToRow=(items:Segment[],id:string,row:string)=>row==='all'?items.map(s=>s.id===id?{...s,group:undefined,laneStyle:s.inheritedStyle,inheritedStyle:undefined}:s):addCaptionsToGroup(items,[id],row);
  const seekRuler=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=track.current!.getBoundingClientRect();onSeek?.(Math.max(0,Math.min(length,(event.clientX-rect.left)/rect.width*length)));};
  useEffect(()=>{
    const el=track.current?.parentElement;if(!el||!onZoom)return;
    const wheel=(event:WheelEvent)=>{
      if(!event.ctrlKey)return;
      event.preventDefault();event.stopPropagation();
      const next=Math.max(100,Math.min(400,zoom*(event.deltaY<0?1.15:1/1.15)));
      const x=event.clientX-el.getBoundingClientRect().left;
      const scroll=(el.scrollLeft+x)*next/zoom-x;
      onZoom(next);requestAnimationFrame(()=>{el.scrollLeft=scroll;});
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[zoom,onZoom]);
  const selectedCaption=segments[selected];
  const splitWords=selectedCaption?.text.trim().split(/\s+/)||[];
  const splitStarts=selectedCaption?.words?.length===splitWords.length?selectedCaption.words.map(w=>w.start):splitWords.map((_,i)=>selectedCaption!.start+(selectedCaption!.end-selectedCaption!.start)*i/splitWords.length);
  const splitCount=splitStarts.filter(start=>start<time).length;
  const canSplit=!!selectedCaption&&time>selectedCaption.start+.01&&time<selectedCaption.end-.01&&splitCount>0&&splitCount<splitWords.length;
  const split=()=>{if(!selectedCaption||!canSplit)return;onBegin?.();if(onSplit)onSplit(selectedCaption.id,time);else onChange(splitCaptionAt(segments,selectedCaption.id,time));onEnd?.();};
  const mergeNext=selectedCaption&&nextCaptionToMerge(segments,selectedCaption.id);
  const canMerge=!!mergeNext&&(!canMergePair||canMergePair(selectedCaption.id,mergeNext.id));
  const merge=()=>{if(!canMerge)return;onBegin?.();if(onMerge)onMerge(selectedCaption.id);else {const next=mergeCaptionWithNext(segments,selectedCaption.id);onChange(next);onSelect(next.findIndex(s=>s.id===selectedCaption.id));}setMarked([]);onEnd?.();};
  const groupTools=<div className="timeline-group-tools">{allowGroups&&<button type="button" title="Dodaj grupu (Ctrl+Alt+G) · Shift + klik bira titlove · Ctrl / ⌘ + klik bira grupu ili sve titlove" onClick={addGroup}>＋ Dodaj grupu</button>}<button type="button" disabled={!canSplit} title="Podijeli odabrani titl na položaju pokazivača, između riječi" onClick={split}>✂ Podijeli titl</button><button type="button" disabled={!canMerge} className="caption-merge-action" title="Spoji odabrani i sljedeći titl na istoj traci; zadrži stil prvog titla" onClick={merge}>Spoji titl</button>{allowGroups&&selectedIds.length>0&&<><strong>{selectedIds.length} odabrano</strong><select aria-label="Dodaj odabrane titlove u grupu" value="" onChange={e=>{onChange(addCaptionsToGroup(segments,selectedIds,e.target.value));setMarked([]);}}><option value="">Dodaj u grupu…</option>{groupRows.filter(g=>selectedIds.every(id=>(segments.find(s=>s.id===id)?.lane||0)===g.lane)).map(g=><option key={g.id} value={g.id}>{g.group.name}</option>)}</select><button type="button" onClick={()=>setMarked([])}>Poništi odabir</button></>}</div>;
  return <>{toolsTarget?createPortal(groupTools,toolsTarget):groupTools}<div className={`caption-timing-scroll${compact?' is-compact':''}`} tabIndex={0} onPointerDownCapture={e=>{if(!(e.target instanceof Element&&e.target.closest('input,textarea,select')))e.currentTarget.focus({preventScroll:true});}} onPointerDown={e=>{if(e.button!==0||(e.target instanceof Element&&e.target.closest('button,input,select,.caption-time-ruler,.caption-playhead,.caption-waveform')))return;e.currentTarget.focus({preventScroll:true});e.preventDefault();pan.current={x:e.clientX,left:e.currentTarget.scrollLeft};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(pan.current)e.currentTarget.scrollLeft=pan.current.left+pan.current.x-e.clientX;}} onPointerUp={e=>{if(pan.current&&Math.abs(e.clientX-pan.current.x)<4){seekRuler(e);onSelect(-1);setMarked([]);}pan.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{pan.current=null;}} onKeyDown={e=>{if(['Delete','Backspace'].includes(e.key)&&!e.repeat&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable=true]'))&&segments[selected]){e.preventDefault();e.stopPropagation();onChange(segments.filter((_,i)=>i!==selected));onSelect(Math.max(0,selected-1));}}}><div ref={track} className="caption-timing-track" style={{ width: `${zoom}%`,height:contentBottom+(narration?48:0)+(waveform?62:0) }}><div className="caption-time-ruler" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);seekRuler(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))seekRuler(e);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}>{Array.from({length:21},(_,i)=><span key={i} style={{left:`${i*5}%`}}>{(length*i/20).toFixed(1)}s</span>)}</div>
    {narration&&<div className="caption-waveform caption-narration-lane" style={{top:contentBottom,height:42}}>{narration}</div>}
    {waveform&&<div className="caption-waveform caption-audio-lane" style={{top:contentBottom+(narration?48:0),height:56}}>{waveform}</div>}
    <div className="caption-playhead" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);seekRuler(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))seekRuler(e);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} style={{left:`${time/length*100}%`}}/>
    <div className="caption-row-background" style={{top:speechTop,height:58}}></div>
    {groupRows.map((g,i)=><div key={g.id} className="caption-row-background caption-group-row" style={{top:speechTop+58+i*72,height:72,'--group-color':g.group.color} as React.CSSProperties}><button type="button" className="caption-row-label" onClick={()=>{setMarked(g.members.map(s=>s.id));onSelect(segments.findIndex(s=>s.id===g.members[0].id),true);}}>{g.group.name}</button></div>)}
    {dragOrigin&&<div className="caption-drag-origin" aria-hidden="true" style={{left:`${dragOrigin.start/length*100}%`,width:`${(dragOrigin.end-dragOrigin.start)/length*100}%`,top:dragOrigin.top,bottom:0}}/>}
    {segments.map((segment,index) => <div onBlurCapture={e=>{if(segment.detachedStyle&&segment.separateStyle===false&&!e.currentTarget.contains(e.relatedTarget as Node|null))setIndividualHint(segment.id);}} data-timeline-caption={segment.id} key={segment.id} className={`caption-timing-clip${dropTarget===segment.id?' group-drop-target':''}${segment.role==='title'?' caption-title':''}${segment.suggestedTitle?' suggested-title':''}${segment.detachedStyle?' detached-caption':''}${segment.group?' grouped-caption':''}${index === selected ? ' active' : ''}${selectedIds.includes(segment.id)?' multi-selected':''}${time>=segment.start && time<segment.end?' at-playhead':''}`} style={{ ...(segment.group?{'--caption-group-color':segment.group.color} as React.CSSProperties:{}),top:segmentTop(segment),left: `${segment.start/length*100}%`, width: `${(segment.end-segment.start)/length*100}%` }}>
      {individualHint===segment.id&&segment.detachedStyle&&segment.separateStyle===false&&<div className="caption-individual-hint" role="status" onPointerDown={e=>e.stopPropagation()}><button type="button" aria-label="Zatvori obavijest" onClick={()=>setIndividualHint(null)}>×</button><p>Aktivirajte zasebne stilove ukoliko želite da se titl ponaša pojedinačno.</p><CaptionIndividualToggle segment={segment} style={groupStyle} settings={groupSettings} onChange={next=>{onChange(segments.map(s=>s.id===next.id?next:s));setIndividualHint(null);}}/></div>}{dropTarget===segment.id&&<span className="caption-drop-hint">{segment.group?`Dodaj u ${segment.group.name}`:'Grupiraj s ovim titlom'}</span>}{index === selected && <div className="caption-inline-times">
        <input type="number" step="0.1" onBlur={e=>{e.currentTarget.scrollLeft=0;}} aria-label={`Početak titla ${index+1}`} value={Number(segment.start.toFixed(1))} onChange={event=>onChange(trimCaption(segments,segment.id,'start',Number(event.target.value),duration))} />
        <input type="number" step="0.1" onBlur={e=>{e.currentTarget.scrollLeft=0;}} aria-label={`Kraj titla ${index+1}`} value={Number(segment.end.toFixed(1))} onChange={event=>onChange(trimCaption(segments,segment.id,'end',Number(event.target.value),duration))} />
      </div>}
      <button className="caption-timing-select" onDoubleClick={()=>onEdit?.(index)} onClick={event => {if(!event.shiftKey)onSelect(index,event.ctrlKey||event.metaKey);}} title={`${segment.suggestedTitle?'Predloženi naslov · Uredi ili zamijeni svojim naslovom · ':''}${segment.start.toFixed(1)}–${segment.end.toFixed(1)} s · ${segment.text}`} aria-label={`Titl ${index+1}: ${segment.text}`}
        onPointerDown={event=>{if(event.ctrlKey||event.metaKey||event.shiftKey){event.preventDefault();if(event.ctrlKey||event.metaKey){onSelect(index,true);setMarked(segments.filter(s=>s.role!=='title'&&(segment.group?s.group?.id===segment.group.id:!s.group)).map(s=>s.id));}else{anchor.current=index;const current=marked.length?marked:segments[selected]?[segments[selected].id]:[];const ids=current.includes(segment.id)?current.filter(id=>id!==segment.id):[...current,segment.id];setMarked(ids);if(onGroupSelect&&ids.length>1&&ids.every(id=>segments.find(s=>s.id===id)?.role!=='title')){const next=groupCaptions(segments,ids,'',groupStyle,groupSettings),group=next.find(s=>s.id===segment.id)?.group;onBegin?.();onChange(next);onSelect(index);if(group)onGroupSelect(group.id);onEnd?.();}}return;}anchor.current=index;setMarked([]);onBegin?.();event.preventDefault();event.currentTarget.focus({preventScroll:true});onSelect(index);onSeek?.(segment.start);move.current={x:event.clientX,y:event.clientY,width:track.current!.getBoundingClientRect().width,segments,start:segment.start};event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerMove={event=>{const origin=move.current;if(!origin||!event.currentTarget.hasPointerCapture(event.pointerId))return;
          const moved=Math.abs(event.clientX-origin.x)>=4||Math.abs(event.clientY-origin.y)>=4;if(!moved)return;
          setDragOrigin(current=>current||{start:origin.start,end:origin.segments.find(s=>s.id===segment.id)!.end,top:segmentTop(origin.segments.find(s=>s.id===segment.id)!)});
          const box=track.current!.getBoundingClientRect(),row=segment.role==='title'?null:rowAt(event.clientY-box.top);
          dropGroup.current=row;

          const next=dragCaption(origin.segments,segment.id,origin.start+(event.clientX-origin.x)/origin.width*length,duration);onChange(row?moveToRow(next,segment.id,row):next);onSeek?.(next.find(s=>s.id===segment.id)!.start);
        }}
        onPointerUp={event=>{dropGroup.current=null;dropTargetRef.current=null;setDropTarget(null);setDragOrigin(null);onEnd?.();move.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{dropTargetRef.current=null;setDropTarget(null);setDragOrigin(null);onEnd?.();move.current=null;}}
        onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();onChange(moveCaption(segments,segment.id,segment.start+(event.key==='ArrowRight'?.1:-.1),duration));}}}>
        {segment.group&&<small className="caption-group-label">{segment.group.name}</small>}<span>{segment.suggestedTitle?"✧ ":""}{segment.text}</span>
      </button>
      <button className="caption-timing-resize caption-timing-resize-start" aria-label={`Promijeni početak titla ${index+1}`} title="Povuci početak titla"
        onPointerDown={event => { onBegin?.();event.preventDefault();event.currentTarget.focus({preventScroll:true}); onSelect(index); drag.current={x:event.clientX,width:track.current!.getBoundingClientRect().width,segments,end:segment.start}; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const start=drag.current; if(start && event.currentTarget.hasPointerCapture(event.pointerId)) onChange(trimCaption(start.segments,segment.id,'start',Math.round((start.end+(event.clientX-start.x)/start.width*length)*10)/10,duration)); }}
        onPointerUp={event => { onEnd?.();drag.current=null; if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => {onEnd?.();drag.current=null;}}
        onKeyDown={event => { if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();onChange(trimCaption(segments,segment.id,'start',segment.start+(event.key==='ArrowRight'?.1:-.1),duration));} }} />
      <button className="caption-timing-resize" aria-label={`Promijeni trajanje titla ${index+1}`} title="Povuci kraj titla"
        onPointerDown={event => { onBegin?.();event.preventDefault();event.currentTarget.focus({preventScroll:true}); onSelect(index); drag.current={x:event.clientX,width:track.current!.getBoundingClientRect().width,segments,end:segment.end}; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const start=drag.current; if(start && event.currentTarget.hasPointerCapture(event.pointerId)) onChange(trimCaption(start.segments,segment.id,'end',Math.round((start.end+(event.clientX-start.x)/start.width*length)*10)/10,duration)); }}
        onPointerUp={event => { onEnd?.();drag.current=null; if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => {onEnd?.();drag.current=null;}}
        onKeyDown={event => { if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();onChange(trimCaption(segments,segment.id,'end',segment.end+(event.key==='ArrowRight'?.1:-.1),duration));} }} />
    </div>)}
  </div></div></>;
}
