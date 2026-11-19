import type {StillMotion} from '../lib/still-scenes';

export function MotionDurationField({clip,onChange}:{clip:StillMotion & {inPoint:number;outPoint:number};onChange:(patch:StillMotion)=>void}){
 const length=clip.outPoint-clip.inPoint;
 const value=clip.motionDuration;
 return <label>Animacija završava nakon (s)
   <input type="number" min=".1" max={length} step="any"
     key={String(value)+':'+length} defaultValue={value??''}
     placeholder={clip.motion==='surprise'?String(clip.surpriseDuration??.6):'Kraj kadra'}
     onBlur={event=>{
       const input=event.currentTarget;
       if(!input.validity.valid){input.value=value===undefined?'':String(value);return;}
       const seconds=input.value===''?undefined:input.valueAsNumber;
       if(seconds!==value)onChange({motionDuration:seconds});
     }} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/>
 </label>;
}
