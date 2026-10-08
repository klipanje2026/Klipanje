"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, PointerEventHandler } from "react";
import { fitVideoToArea } from "../../lib/editor-layout";

export function VideoPreviewStage({ aspect, onPointerDown, children, tools }: {
  tools?: ReactNode; aspect: number; onPointerDown: PointerEventHandler<HTMLDivElement>; children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen,setFullscreen]=useState(false);
  const [fullscreenError,setFullscreenError]=useState('');
  useEffect(()=>{const update=()=>setFullscreen(document.fullscreenElement===stageRef.current);document.addEventListener('fullscreenchange',update);return ()=>document.removeEventListener('fullscreenchange',update);},[]);
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stageRef.current?.requestFullscreen();setFullscreenError('');}catch{setFullscreenError('Preglednik ne dopušta prikaz preko cijelog ekrana.');}};
  const [area, setArea] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = (width: number, height: number) => setArea((current) =>
      current.width === width && current.height === height ? current : { width, height });
    update(stage.clientWidth, stage.clientHeight);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const size = fitVideoToArea(area.width, area.height, aspect);
  return <div className="subtitle-preview-stage" ref={stageRef}>
    <div className={`subtitle-preview-frame${aspect < 1 ? " is-portrait" : ""}`}
      style={{ width: size.width, height: size.height, aspectRatio: aspect }} onPointerDown={onPointerDown}>
      {children}
    </div>
    <button type="button" className="subtitle-fullscreen-button" aria-label={fullscreen?"Izađi iz cijelog ekrana":"Video preko cijelog ekrana"} title={fullscreen?"Izađi iz cijelog ekrana":"Cijeli ekran"} onPointerDown={event=>event.stopPropagation()} onClick={()=>void toggleFullscreen()}>⛶</button>
    {tools&&<div className="subtitle-preview-repair">{tools}</div>}
    {fullscreenError&&<span className="subtitle-fullscreen-error" role="status">{fullscreenError}</span>}
  </div>;
}
