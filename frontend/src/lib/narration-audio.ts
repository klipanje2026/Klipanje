import {audioBufferSegmentToWav} from './voice-wav';
export function speechBounds(channels:Float32Array[],rate:number){
 const length=channels[0]?.length||0;let first=length,last=-1;
 for(let i=0;i<length;i++)if(channels.some(data=>Math.abs(data[i])>.003)){first=Math.min(first,i);last=i;}
 if(last<first)return {start:0,end:length/rate};
 return {start:Math.max(0,first/rate-.06),end:Math.min(length/rate,(last+1)/rate+.08)};
}
export async function prepareNarration(blob:Blob,trim:boolean){
 const context=new AudioContext();try{
  const buffer=await context.decodeAudioData(await blob.arrayBuffer());
  const bounds=trim?speechBounds(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate):{start:0,end:buffer.duration};
  return {blob:audioBufferSegmentToWav(buffer,bounds.start,bounds.end,buffer.sampleRate),duration:bounds.end-bounds.start};
 }finally{await context.close();}
}
