import {setMediaGain} from './media-gain';
export function syncVoicePlayback(video:HTMLVideoElement,audio:HTMLAudioElement,enabled:boolean,start:number,originalVolume:number) {
      const offset=video.currentTime-start;
      const active=enabled&&offset>=0&&(!Number.isFinite(audio.duration)||offset<audio.duration);
      setMediaGain(video,originalVolume);
      audio.playbackRate=video.playbackRate;
      if(active&&audio.readyState>0&&Math.abs(audio.currentTime-offset)>.15)audio.currentTime=offset;
      if(!active||video.paused||video.ended||video.seeking)audio.pause();
      else if(audio.paused&&audio.readyState>=2)void audio.play().catch(()=>{});
}
