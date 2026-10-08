import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
import type {CaptionBounds} from './caption-renderer';
import {drawTextUnderline,drawPresetFace,drawTextSurface,drawTextShine} from './text-surface';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function drawProgressiveCaption(ctx:CanvasRenderingContext2D,segment:Segment,time:number,style:StyleKey,settings:CaptionSettings):CaptionBounds|null{
 if(segment.effectOnly||time<segment.start||time>=segment.end)return null;
 const text=segment.text.trim().split(/\s+/);if(!text[0])return null;
 const w=ctx.canvas.width,h=ctx.canvas.height,x=(segment.position?.x??settings.x)/100*w,y=(segment.position?.y??settings.y)/100*h;
 const size=Math.min(w*.075,h*.065)*settings.fontScale/100,lineHeight=size*1.3,maxWidth=w*.84;
 ctx.save();ctx.font=`${settings.fontWeight??600} ${size}px ${settings.fontFamily}`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.letterSpacing=`${size*(settings.letterSpacing??0)/100}px`;
 const words=text.map((t,i)=>({text:settings.uppercase?t.toLocaleUpperCase():t,index:i,start:segment.words?.[i]?.start??segment.start+i/text.length*(segment.end-segment.start),end:segment.words?.[i]?.end??segment.start+(i+1)/text.length*(segment.end-segment.start)}));
 if(style==='waveWords'){const group=Math.max(1,Math.min(6,Math.round(settings.revealGroupSize??1)));const starts=words.map(word=>word.start);words.forEach((word,i)=>{word.start=starts[Math.floor(i/group)*group];});}
 const space=Math.max(0,ctx.measureText(' ').width+size*(settings.wordSpacing??0)/100),lines:{items:typeof words;width:number}[]=[{items:[],width:0}];
 for(const word of words){const width=ctx.measureText(word.text).width;let line=lines[lines.length-1];if(line.items.length&&line.width+space+width>maxWidth){line={items:[],width:0};lines.push(line);}line.width+=(line.items.length?space:0)+width;line.items.push(word);}
 const widest=Math.max(...lines.map(l=>l.width)),height=lines.length*lineHeight;
 ctx.translate(x,y);ctx.rotate(settings.rotation*Math.PI/180);
 if(settings.backgroundOpacity>0){ctx.save();ctx.globalAlpha=settings.backgroundOpacity/100;ctx.fillStyle=settings.backgroundColor;ctx.beginPath();ctx.roundRect(-widest/2-size*.25,-height/2-size*.12,widest+size*.5,height+size*.24,size*.12);ctx.fill();ctx.restore();}
 const bounds:CaptionBounds['words']=[];let cursorX=-lines[0].width/2,cursorY=-(lines.length-1)*lineHeight/2,hasTyped=false;
 lines.forEach((line,row)=>{let left=settings.alignment==='left'?-widest/2:settings.alignment==='right'?widest/2-line.width:-line.width/2;const baseline=(row-(lines.length-1)/2)*lineHeight;
  for(const word of line.items){const width=ctx.measureText(word.text).width,age=time-word.start;
   if(age>=0){
    const letters=Array.from(word.text),count=style==='terminalType'&&settings.typingUnit!=='words'?Math.min(letters.length,Math.floor(clamp(age/Math.max(.04,(word.end-word.start)*.85))*letters.length)):letters.length;
    let offset=0;
    for(let j=0;j<count;j++){
     const char=letters[j],advance=ctx.measureText(char).width;
     ctx.save();
     if(style==='waveWords'){const p=clamp((age-j*.025)/.42);const bounce=Math.sin(p*Math.PI*2.5)*Math.pow(1-p,2),idle=Math.sin((time-segment.start)*3+j*.55+word.index)*.025;
      ctx.globalAlpha=p;ctx.translate(left+offset+advance/2,baseline+size*(bounce*.38+idle)*(settings.waveStrength??100)/100);const scale=.2+.8*(1-Math.pow(1-p,3));ctx.scale(scale,scale);ctx.translate(-advance/2,0);
     }else ctx.translate(left+offset,baseline);
     if(settings.outlineWidth>0){ctx.strokeStyle=settings.outlineColor;ctx.lineWidth=settings.outlineWidth*size/17;ctx.strokeText(char,0,0);}
     drawPresetFace(ctx,char,0,0,size,settings,settings.textColor);drawTextSurface(ctx,char,0,0,size,settings);drawTextShine(ctx,char,0,0,size,settings,time-segment.start);ctx.restore();offset+=advance;
    }
    if(count>0){cursorX=left+ctx.measureText(letters.slice(0,count).join('')).width;cursorY=baseline;hasTyped=true;}
    const a=settings.rotation*Math.PI/180,cx=left+width/2;
    bounds.push({index:word.index,text:word.text,x:(x+cx*Math.cos(a)-baseline*Math.sin(a))/w*100,y:(y+cx*Math.sin(a)+baseline*Math.cos(a))/h*100,width:width/w*100,height:lineHeight/h*100,rotation:settings.rotation});
   }
   if(age>=0&&(settings.underline||settings.textUnderline))drawTextUnderline(ctx,word.text,left,baseline,size,{...settings,textUnderline:true,textUnderlineColor:settings.textUnderlineColor??settings.underlineColor??settings.textColor},age);
   left+=width+space;
  }
 });
 if(style==='terminalType'&&Math.floor((time-segment.start)*2)%2===0){ctx.fillStyle='#fff';ctx.fillRect(cursorX+(hasTyped?size*.08:0),cursorY-size*.45,size*.56,size*.9);}
 ctx.restore();return {x:x/w*100,y:y/h*100,width:widest/w*100,height:height/h*100,rotation:settings.rotation,segmentId:segment.id,words:bounds};
}
