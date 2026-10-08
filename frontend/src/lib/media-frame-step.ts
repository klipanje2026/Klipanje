import {useEffect,useState} from 'react';
/** Matches the source cadence; 30 fps until metadata is available. */
export function useMediaFrameRate(file?:File|null){
 const [fps,setFps]=useState(30);
 useEffect(()=>{let cancelled=false;let dispose:(()=>void)|undefined;setFps(30);if(file)void import('mediabunny').then(async m=>{if(cancelled)return;const input=new m.Input({source:new m.BlobSource(file),formats:m.ALL_FORMATS});dispose=()=>input.dispose();try{const track=await input.getPrimaryVideoTrack();const stats=await track?.computePacketStats(120);if(!cancelled&&stats&&stats.averagePacketRate>0)setFps(stats.averagePacketRate);}finally{dispose();dispose=undefined;}}).catch(()=>{});return()=>{cancelled=true;dispose?.();};},[file]);
 return fps;
}
export function adjacentFrameTime(time:number,direction:number,fps:number,duration:number){const rate=Number.isFinite(fps)&&fps>0?fps:30;return Math.max(0,Math.min(Math.max(0,duration-1/rate),(Math.round(time*rate)+direction)/rate));}
