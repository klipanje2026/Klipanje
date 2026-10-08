// Motion families settle to the same final typography and layout.
export const BusinessSignatures=Object.freeze({boardroom:'lift',editorial:'wipe',memo:'marker',ledger:'tracking',pivot:'depth'});
export const BusinessEffects=Object.freeze({
 lift:{label:'Lift & Settle',duration:.68,mask:'rise',x:0,y:.30,scale:.976,skew:0,tracking:.018,stagger:0,blur:.78,weight:0,marker:'grow'},
 wipe:{label:'Editorial Wipe',duration:.78,mask:'left',x:.13,y:.04,scale:1,skew:0,tracking:.025,stagger:.07,blur:.40,weight:0,marker:'grow'},
 marker:{label:'Marker Flow',duration:.72,mask:'left',x:.045,y:.13,scale:.986,skew:0,tracking:0,stagger:.10,blur:.42,weight:0,marker:'sweep'},
 tracking:{label:'Precision Track',duration:.78,mask:'none',x:.12,y:.065,scale:1,skew:0,tracking:.085,stagger:.15,blur:.30,weight:.48,marker:'grow'},
 depth:{label:'Soft Depth',duration:.84,mask:'none',x:0,y:.19,scale:.940,skew:.052,tracking:.035,stagger:.06,blur:1.06,weight:.22,marker:'center'},
 soft:{label:'Soft Fade',duration:.46,mask:'none',x:0,y:.12,scale:1,skew:0,tracking:0,stagger:0,blur:1,weight:0,marker:'grow'}
});
const beLimit=(n,a,b)=>Math.max(a,Math.min(b,n));
const beSmooth=(a,b,n)=>{const t=beLimit((n-a)/(b-a),0,1);return t*t*(3-2*t);};
export function businessMotion(age,word,effect,strength=1,reduced=false){
 const recipe=BusinessEffects[effect]||BusinessEffects.lift,gain=beLimit(strength,0,1.4),disabled=reduced||gain===0,duration=recipe.duration*(.84+.16*gain),progress=disabled?1:beSmooth(0,duration,age),rest=disabled?0:Math.pow(1-beLimit(age/duration,0,1),3);
 return {effect,age,duration,progress,settled:disabled||age>=duration,alpha:disabled?1:beSmooth(0,duration*.73,age),dx:word.size*recipe.x*rest*gain,dy:word.size*recipe.y*rest*gain,scale:1-(1-recipe.scale)*rest*gain,skew:recipe.skew*rest*gain,tracking:word.size*recipe.tracking*rest*gain,blur:disabled?0:(1-beSmooth(0,duration*.82,age))*word.size*.14*recipe.blur,
  mask:disabled?'none':recipe.mask,reveal:disabled?1:1-(1-beSmooth(.025,duration*.83,age))*Math.min(gain,1),stagger:disabled?0:recipe.stagger*Math.min(gain,1),weight:Math.round(word.weight-(word.weight-400)*recipe.weight*rest*gain),marker:recipe.marker,markProgress:disabled?1:beSmooth(recipe.marker==='sweep'?0:.02,recipe.marker==='sweep'?.38:.48,age),lineProgress:disabled?1:beSmooth(.07,duration*.85,age)};
}
