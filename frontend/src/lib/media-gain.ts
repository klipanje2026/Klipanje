let context:AudioContext|undefined;
const nodes=new WeakMap<HTMLMediaElement,GainNode>();
export function setMediaGain(media:HTMLMediaElement,volume:number){
 const gain=Math.max(0,Math.min(1.5,Number.isFinite(volume)?volume:1));
 if(typeof AudioContext==='undefined'){media.volume=Math.min(1,gain);return;}
 let node=nodes.get(media);
 if(!node&&gain<=1){if(media.volume!==gain)media.volume=gain;return;}
 if(!node){context??=new AudioContext();node=context.createGain();context.createMediaElementSource(media).connect(node);node.connect(context.destination);nodes.set(media,node);}
 if(media.volume!==1)media.volume=1;
 if(node.gain.value!==gain)node.gain.value=gain;
 if(!media.paused&&context?.state==='suspended')void context.resume().catch(()=>{});
}
