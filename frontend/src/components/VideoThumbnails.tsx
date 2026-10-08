import { useEffect, useRef, useState } from 'react';

export function VideoThumbnails({url, start, end}: {url:string;start:number;end:number}) {
  const container=useRef<HTMLSpanElement>(null);
  const [count,setCount]=useState(6);
  const [result,setResult]=useState<{key:string;frames:string[]}>({key:'',frames:[]});
  const key=`${url}:${start}:${end}:${count}`;
  useEffect(()=>{
    const el=container.current;if(!el)return;
    const observer=new ResizeObserver(()=>setCount(Math.max(1,Math.min(32,Math.ceil(el.clientWidth/Math.max(48,el.clientHeight*16/9))))));
    observer.observe(el);return()=>observer.disconnect();
  },[]);
  useEffect(() => {
    let cancelled=false;
    const video=document.createElement('video'); video.muted=true; video.preload='auto';
    const canvas=document.createElement('canvas');canvas.width=288;canvas.height=162;
    const ctx=canvas.getContext('2d');
    let timer:ReturnType<typeof setTimeout>;
    let releaseSeek:(()=>void)|undefined;
    const seek=(time:number)=>new Promise<void>(resolve=>{
      const finish=()=>{clearTimeout(timer);video.onseeked=null;releaseSeek=undefined;resolve();};
      releaseSeek=finish;
      if(Math.abs(video.currentTime-time)<.002 && video.readyState>=2){finish();return;}
      video.onseeked=finish;timer=setTimeout(finish,2500);video.currentTime=time;
    });
    video.onloadeddata=async()=>{
      video.onloadeddata=null;
      if(!ctx||!video.videoWidth||!Number.isFinite(video.duration))return;
      const from=Math.max(0,Math.min(start,video.duration-.01));
      const to=Math.max(from,Math.min(end,video.duration-.01));
      const pictures:string[]=[];
      for(let i=0;i<count&&!cancelled;i++){
        await seek(from+(to-from)*(i+.5)/count);
        if(cancelled)return;
        try{
          const scale=Math.max(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
          const width=video.videoWidth*scale,height=video.videoHeight*scale;
          ctx.drawImage(video,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
          pictures.push(canvas.toDataURL('image/jpeg',.7));
          setResult({key,frames:[...pictures]});
        }catch{return;}
      }
    };
    video.src=url;
    return()=>{cancelled=true;releaseSeek?.();clearTimeout(timer);video.onloadeddata=null;video.onseeked=null;video.removeAttribute('src');video.load();};
  },[url,start,end,count,key]);
  const frames=result.key===key?result.frames:[];
  return <span ref={container} className="video-filmstrip" aria-hidden="true">{frames.length>0&&Array.from({length:count},(_,i)=><img key={i} src={frames[Math.min(i,frames.length-1)]} alt=""/>)}</span>;
}
