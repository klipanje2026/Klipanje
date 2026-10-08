/** Soft gate after speech isolation; RMS detector and release preserve quiet syllables. */
export async function gateCleanAudio(blob:Blob,thresholdDb:number):Promise<Blob>{
 if(thresholdDb<=-60)return blob;
 const context=new AudioContext();
 try{
 const audio=await context.decodeAudioData(await blob.arrayBuffer()),rate=audio.sampleRate,channels=audio.numberOfChannels,length=audio.length;
 const output=new ArrayBuffer(44+length*channels*2),view=new DataView(output),text=(at:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,output.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*channels*2,true);
 const tracks=Array.from({length:channels},(_,i)=>audio.getChannelData(i)),threshold=10**(thresholdDb/20),block=Math.max(1,Math.round(rate*.01));let gain=1;
 for(let start=0;start<length;start+=block){let energy=0;const end=Math.min(length,start+block);for(let i=start;i<end;i++)for(const track of tracks)energy+=track[i]*track[i];const rms=Math.sqrt(energy/((end-start)*channels));const target=Math.max(.08,Math.min(1,(rms/(threshold||1))**2));
 for(let i=start;i<end;i++){gain+=(target-gain)*(1-Math.exp(-1/(rate*(target>gain?.003:.12))));for(let ch=0;ch<channels;ch++)view.setInt16(44+(i*channels+ch)*2,Math.max(-32768,Math.min(32767,Math.round(tracks[ch][i]*gain*32767))),true);}}
 return new Blob([output],{type:'audio/wav'});
 }finally{await context.close();}
}
