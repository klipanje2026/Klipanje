export type AudioRamp={start:number;duration:number};
export type AudioEnvelope={fadeIn?:AudioRamp;fadeOut?:AudioRamp;lower?:AudioRamp&{level:number}};
const progress=(time:number,ramp:AudioRamp)=>!Number.isFinite(ramp.start)||!Number.isFinite(ramp.duration)?0:Math.max(0,Math.min(1,(time-ramp.start)/Math.max(.001,ramp.duration)));
/** Source time keeps the envelope continuous across cuts, moves and exports. */
export function audioEnvelopeGain(envelope:AudioEnvelope|undefined,sourceTime:number):number{
 if(!envelope)return 1;
 let gain=1;
 if(envelope.fadeIn)gain*=progress(sourceTime,envelope.fadeIn);
 if(envelope.fadeOut)gain*=1-progress(sourceTime,envelope.fadeOut);
 if(envelope.lower){const level=Number.isFinite(envelope.lower.level)?Math.max(0,Math.min(1,envelope.lower.level)):1;gain*=1-(1-level)*progress(sourceTime,envelope.lower);}
 return gain;
}
