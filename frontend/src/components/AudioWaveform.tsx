import {useEffect,useMemo,useRef,useState} from 'react';
const cache=new WeakMap<Blob,Promise<Float32Array>>();
function peaks(file:Blob){let task=cache.get(file);if(!task){task=(async()=>{
 const m=await import('mediabunny');const input=new m.Input({source:new m.BlobSource(file),formats:m.ALL_FORMATS});
 try{const track=await input.getPrimaryAudioTrack();if(!track)throw new Error('No audio');
  let bins=new Float32Array(6000),length=1,lastYield=performance.now();
  for await(const sample of new m.AudioSampleSink(track).samples()){
   try{const buffer=sample.toAudioBuffer(),end=Math.ceil((sample.timestamp+buffer.duration)*100);if(end>8640000)throw new Error('Audio exceeds 24 hours');
    if(end>bins.length){const next=new Float32Array(Math.max(end,bins.length*2));next.set(bins);bins=next;}length=Math.max(length,end);
    for(let c=0;c<buffer.numberOfChannels;c++){const values=buffer.getChannelData(c);for(let i=0;i<values.length;i++){const bin=Math.floor((sample.timestamp+i/buffer.sampleRate)*100);if(bin>=0)bins[bin]=Math.max(bins[bin],Math.abs(values[i]));}}
   }finally{sample.close();}
   if(performance.now()-lastYield>40){await new Promise(resolve=>setTimeout(resolve,0));lastYield=performance.now();}
  }return bins.slice(0,length);
 }catch(error){if(file.size>32*1024*1024)throw error;const ctx=new AudioContext();try{const audio=await ctx.decodeAudioData(await file.arrayBuffer());const bins=new Float32Array(Math.max(1,Math.ceil(audio.duration*100)));for(let c=0;c<audio.numberOfChannels;c++){const samples=audio.getChannelData(c);for(let i=0;i<samples.length;i++){const b=Math.floor(i/audio.sampleRate*100);bins[b]=Math.max(bins[b],Math.abs(samples[i]));}}return bins;}finally{await ctx.close();}}
 finally{input.dispose();}
})();cache.set(file,task);}return task;}
export function AudioWaveform({file,start=0,end=1,volume=100,muted=false,normalize=false}:{file:Blob|null;start?:number;end?:number;volume?:number;muted?:boolean;normalize?:boolean}){
 const element=useRef<SVGSVGElement>(null);
 const [width,setWidth]=useState(240);
 const [data,setData]=useState<Float32Array|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setData(null);setFailed(false);if(file)void peaks(file).then(v=>{if(active)setData(v);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[file]);
 useEffect(()=>{const svg=element.current;if(!svg)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(1,Math.ceil(entries[0].contentRect.width))));observer.observe(svg);return()=>observer.disconnect();},[data]);
 const peak=useMemo(()=>normalize&&data?Math.max(.001,data.reduce((max,value)=>Math.max(max,value),0)):1,[normalize,data]);
 if(!file)return null;
 if(!data)return <span className="waveform-note">{failed?'Prikaz jačine zvuka nije dostupan':'Učitavanje zvučnog talasa…'}</span>;
 const count=Math.max(1,Math.min(12000,Math.ceil(width/2),Math.ceil(data.length*(end-start))));
 const bars=Array.from({length:count},(_,i)=>{const from=Math.max(0,Math.floor((start+(end-start)*i/count)*data.length));const to=Math.min(data.length,Math.ceil((start+(end-start)*(i+1)/count)*data.length));let value=0;for(let j=from;j<to;j++)value=Math.max(value,data[j]);return value;});
 return <svg ref={element} className="audio-waveform" viewBox={`0 0 ${count} 40`} preserveAspectRatio="none" role="img" aria-label="Jačina zvuka kroz vrijeme — detalji do 10 milisekundi pri zumiranju"><path d={`M0 40 ${bars.map((v,i)=>`L${i} ${40-Math.max(.005,muted?0:v/peak*Math.max(0,volume)/100)*(normalize?40:38)} L${i+.88} ${40-Math.max(.005,muted?0:v/peak*Math.max(0,volume)/100)*(normalize?40:38)}`).join(' ')} L${count} 40 Z`} fill="currentColor"/></svg>;
}
