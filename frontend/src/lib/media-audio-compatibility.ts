/** Inspect the audio track independently: a decoded video frame does not prove audio support. */
export async function needsAudioPreparation(file:File,signal:AbortSignal):Promise<boolean>{
 signal.throwIfAborted();
 const m=await import('mediabunny');signal.throwIfAborted();
 const input=new m.Input({source:new m.BlobSource(file),formats:m.ALL_FORMATS});
 const abort=()=>input.dispose();signal.addEventListener('abort',abort,{once:true});
 try{
  const track=await input.getPrimaryAudioTrack();if(!track)return false;
  const codec=await track.getCodec();
  // MOV PCM/ALAC and spatial audio may decode video successfully but remain silent in HTML video.
  if(!codec||!['aac','mp3','opus','vorbis','flac'].includes(codec))return true;
  return !await track.canDecode();
 }catch{signal.throwIfAborted();return false;}finally{signal.removeEventListener('abort',abort);input.dispose();}
}
