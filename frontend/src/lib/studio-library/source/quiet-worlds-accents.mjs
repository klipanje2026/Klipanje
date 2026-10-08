const qaClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const qaEase=(v)=>{v=qaClamp(v,0,1);return v*v*(3-2*v);};
const qaRGB=color=>color.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16));
export const quietMix=(a,b,t)=>'#'+qaRGB(a).map((v,i)=>Math.round(v+(qaRGB(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
const qaLum=color=>qaRGB(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
const qaContrast=(a,b)=>(Math.max(qaLum(a),qaLum(b))+.05)/(Math.min(qaLum(a),qaLum(b))+.05);
const qaHSL=color=>{const [r,g,b]=qaRGB(color).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)/6;return [h,d?d/(1-Math.abs(2*l-1)):0,l];};
const qaHex=([h,s,l])=>{const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return '#'+[0,8,4].map(n=>Math.round(f(n)*255).toString(16).padStart(2,'0')).join('');};
export function quietAccentColors(palette,theme){
 const backdrop=['postmark','tape','chat'].includes(theme)?palette.panel:palette.bg,[h,s,l]=qaHSL(palette.accent),chromatic=qaHex([h,Math.max(.36,s),l]);
 const readable=color=>{for(let i=0;i<=20;i++){const result=quietMix(color,palette.text,i/20);if(qaContrast(result,backdrop)>=4.5)return result;}return palette.text;};
 const color=readable(chromatic),alternate=readable(qaHex([(h+.075)%1,Math.max(.32,s),l])),dark='#172026',light='#fff9ee',ink=qaContrast(dark,chromatic)>qaContrast(light,chromatic)?dark:light;let fill=chromatic;
 for(let i=1;qaContrast(ink,fill)<4.5&&i<=20;i++)fill=quietMix(chromatic,ink===dark?light:dark,i/20);
 return {color,alternate,fill,ink,backdrop};
}
const qaStop=new Set('a ali ako bez bi bilo da do dok ga gdje i ili ima iz je još kad kada kao ko koje koja koji koliko kroz li malo me mi na nakon ne neki nego nije od oko onaj ono pa po pod preko prema pri put sa se si smo so su sve ta taj te ti to tu u uz za zbog'.split(' '));
const qaKey=word=>word.toLocaleLowerCase('bs').replace(/[^\p{L}\p{N}]+/gu,'');
const qaKinds=['frame','underline','marker','color','bold','double'];
const qaCycles={subframe:['frame','underline','color','marker','bold','double'],postmark:['underline','frame','marker','color','bold','double'],orbit:['frame','color','underline','marker','double','bold'],tape:['marker','bold','frame','underline','color','double'],garden:['underline','color','frame','bold','marker','double'],chat:['marker','frame','color','underline','bold','double'],contour:['frame','marker','double','color','bold','underline'],focus:['frame','color','marker','underline','bold','double'],tideline:['underline','marker','color','frame','double','bold'],pulse:['marker','double','bold','frame','color','underline']};
export function quietAccentPlan(page,options){
 const result=new Map();if(options.emphasis==='none')return result;
 const named=new Set(String(options.accentWords||'').split(/[,;\s]+/).map(qaKey).filter(Boolean));
 let candidates=page.words.map((word,index)=>({word,index,key:qaKey(word.text)})).filter(v=>named.size?named.has(v.key):v.key.length>3&&!qaStop.has(v.key));
 if(!candidates.length&&!named.size)candidates=page.words.map((word,index)=>({word,index}));
 const ratio={sparse:.25,balanced:.42,rich:.62}[options.emphasis]??.62,count=named.size?candidates.length:Math.min(candidates.length,Math.max(1,Math.round(page.words.length*ratio))),selected=[];
 for(let i=0;i<count;i++)selected.push(candidates[Math.floor(i*candidates.length/count)]);
 selected.forEach((v,index)=>{const mixing=!qaKinds.includes(options.accentKind),kind=mixing?(qaCycles[options.theme]||qaCycles.subframe)[index%6]:options.accentKind;result.set(v.index,{kind,bold:kind==='bold'||kind==='frame'||kind==='marker'||(mixing&&index%3===0),colored:kind==='color'||kind==='frame'||(mixing&&['underline','double'].includes(kind)&&index%2===0),alternate:index%4===2,size:options.emphasis==='rich'&&['frame','marker'].includes(kind)?1.045:1});});return result;
}
export function quietFontWeight(cfg,bold=false){
 if(cfg.family==='QWCondensed')return bold?900:700;
 if(cfg.family==='QWSans')return bold?700:Number(cfg.weight);
 if(cfg.family==='QWSpace')return bold?600:400;
 if(cfg.family==='QWSerif')return 600;
 if(cfg.family==='QWTech')return 700;
 if(cfg.family==='QWBrush')return 400;
 return bold?700:Number(cfg.weight);
}
export function quietAccentProgress(age,animate){return animate?qaEase((age-.035)/.62):age>=0?1:0;}
// Background marks sit behind the glyphs; strokes remain sharp while text focuses.
export function drawQuietAccent(ctx,word,theme,colors,progress){
 const effect=word.accent;if(!effect||progress<=0)return;const s=word.size,x=word.x-s*.11,y=word.baseline-s*.88,w=word.width+s*.22,h=s*1.15,r=['orbit','chat','tideline'].includes(theme)?h*.48:theme==='postmark'?s*.02:s*.09;
 ctx.save();ctx.filter='none';ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=effect.alternate?colors.alternate:colors.color;ctx.fillStyle=colors.fill;ctx.lineWidth=Math.max(.85,s*.042);
 if(effect.kind==='marker'){
  ctx.beginPath();ctx.rect(x-s*.03,y-s*.1,(w+s*.06)*progress,h+s*.2);ctx.clip();
  if(['postmark','contour','tideline'].includes(theme)){ctx.beginPath();ctx.moveTo(x,y+s*.05);ctx.lineTo(x+w,y);ctx.lineTo(x+w-s*.035,y+h-s*.03);ctx.lineTo(x+s*.025,y+h);ctx.closePath();}else{ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  ctx.fill();
 }else if(effect.kind==='frame'){
  if(theme==='focus'){const leg=s*.24;ctx.globalAlpha*=progress;for(const px of [x,x+w])for(const py of [y,y+h]){const dx=px===x?1:-1,dy=py===y?1:-1;ctx.beginPath();ctx.moveTo(px+dx*leg,py);ctx.lineTo(px,py);ctx.lineTo(px,py+dy*leg);ctx.stroke();}}
  else{ctx.beginPath();if(theme==='postmark'){ctx.moveTo(x,y+s*.025);ctx.lineTo(x+w,y);ctx.lineTo(x+w-s*.022,y+h);ctx.lineTo(x+s*.01,y+h-s*.027);ctx.closePath();}else ctx.roundRect(x,y,w,h,r);const perimeter=2*(w+h)-8*r+2*Math.PI*r;if(progress<1)ctx.setLineDash([perimeter*progress,perimeter]);else if(theme==='tape')ctx.setLineDash([s*.10,s*.08]);ctx.stroke();}
  if(theme==='orbit'){ctx.setLineDash([]);ctx.beginPath();ctx.arc(x+w-s*.14,y+s*.035,s*.038,0,Math.PI*2);ctx.fill();}
 }else if(effect.kind==='underline'||effect.kind==='double'){
  const uy=word.baseline+s*.20;ctx.beginPath();ctx.rect(x-s*.03,uy-s*.11,(w+s*.06)*progress,s*.36);ctx.clip();
  const count=effect.kind==='double'?2:1;for(let line=0;line<count;line++){const yy=uy+line*s*.105;ctx.lineWidth=Math.max(.85,s*(theme==='postmark'?.065:line?.028:.043));ctx.beginPath();ctx.moveTo(word.x-s*.025,yy);if(['garden','postmark','tideline'].includes(theme))ctx.bezierCurveTo(word.x+w*.28,yy+s*.06,word.x+w*.62,yy-s*.055,word.x+word.width+s*.025,yy+s*.018);else ctx.lineTo(word.x+word.width+s*.025,yy);ctx.stroke();}
  if(['pulse','focus'].includes(theme)){for(const px of [word.x,word.x+word.width]){ctx.beginPath();ctx.moveTo(px,uy-s*.04);ctx.lineTo(px,uy+s*.075);ctx.stroke();}}
 }
 ctx.restore();return {x,y,w,h,progress};
}
