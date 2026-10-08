// Two original caption treatments; Canvas 2D, explicit time, no DOM/CSS.
// renderCaption(ctx, seconds, 'impact' | 'fold', width, height)
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),4);
const spring=x=>{x=clamp(x);return x===1?1:1-Math.exp(-7*x)*Math.cos(10*x);};
function rect(c,x,y,w,h,col,r=0){c.fillStyle=col;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function font(c,size,weight=700){c.font=`${weight} ${size}px "Bahnschrift", Arial`;c.textBaseline='alphabetic';}
function lineWidth(c,str,size,tracking){font(c,size);return [...str].reduce((a,l)=>a+c.measureText(l).width+tracking,0)-tracking;}
function spaced(c,str,x,y,size,tracking,color){font(c,size);c.fillStyle=color;for(const l of str){c.fillText(l,x,y);x+=c.measureText(l).width+tracking;}}
function glyphs(c,str,y,size,local,delay,color,depth){
 const tracking=size*.013,w=lineWidth(c,str,size,tracking);let x=(900-w)/2;
 for(let i=0;i<str.length;i++){
  font(c,size);const ch=str[i],cw=c.measureText(ch).width,age=local-delay-i*.029,p=spring(age/.55),alpha=ease(age/.19);
  if(age>0){c.save();c.globalAlpha*=alpha;c.translate(x+cw/2,y+(1-p)*40);c.rotate((1-p)*-.15);c.scale(1+(1-p)*.14,Math.max(.01,p));
   font(c,size);if(depth){c.fillStyle='#121c24';for(let d=5;d>0;d--)c.fillText(ch,-cw/2+d,d);c.fillStyle='#c0c9ce';c.globalAlpha*=.18;c.fillText(ch,-cw/2-1,-1);c.globalAlpha/= .18;}
   c.fillStyle=color;c.fillText(ch,-cw/2,0);c.restore();
  }x+=cw+tracking;
 }
}
function bg(c){const g=c.createRadialGradient(450,230,15,450,253,620);g.addColorStop(0,'#18222b');g.addColorStop(.65,'#10181f');g.addColorStop(1,'#0a1016');rect(c,0,0,900,506,g);}
export function renderCaption(c,t,style='impact',width=900,height=506,lines=['',''],backdrop=false){
 c.save();c.clearRect(0,0,width,height);c.scale(width/900,height/506);if(backdrop)bg(c);
 const local=t%3.2,exit=ease((local-2.76)/.4);
 c.save();c.globalAlpha=1-exit;c.translate(0,-exit*24);
 if(style==='impact'){
  const first=lines[0],second=lines[1];const heroSize=Math.min(79,740/Math.max(1,lineWidth(c,second,79,1.027))*79);
  const firstSize=Math.min(38,700/Math.max(1,lineWidth(c,first,38,5))*38),plaque=first?ease((local-.03)/.42):0,fw=lineWidth(c,first,firstSize,5);
  c.save();c.translate(450,193);c.rotate((1-plaque)*-.06);c.scale(plaque,1);rect(c,-fw/2-22,-39,fw+44,54,'#2d3b45',4);c.restore();
  const fp=ease((local-.13)/.45);c.save();c.globalAlpha*=fp;spaced(c,first,(900-fw)/2,193+(1-fp)*13,firstSize,5,'#d3dae0');c.restore();
  glyphs(c,second,293,heroSize,local,.27,'#e9d5aa',true);
  const sw=lineWidth(c,second,heroSize,heroSize*.013),underline=ease((local-.72)/.55);
  rect(c,(900-sw)/2,318,sw*underline,3,'#9e8c68',1.5);
  const glint=clamp((local-1.05)/1.3);if(glint>0&&glint<1){c.save();c.globalAlpha=.5*Math.sin(glint*Math.PI);const gx=(900-sw)/2+sw*glint;const g=c.createLinearGradient(gx-36,0,gx+36,0);g.addColorStop(0,'#e9d5aa00');g.addColorStop(.5,'#fff5db');g.addColorStop(1,'#e9d5aa00');rect(c,gx-36,317,72,5,g,2);c.restore();}
 }else{
  const top=lines[0],bottom=lines[1];
  const topSize=Math.min(43,740/Math.max(1,lineWidth(c,top,43,2.4))*43),tw=lineWidth(c,top,topSize,2.4);
  const p=ease((local-.04)/.7);c.save();c.globalAlpha*=p;c.translate(450,190+(1-p)*25);c.transform(1,0,(1-p)*.3,Math.max(.03,p),0,0);spaced(c,top,-tw/2,0,topSize,2.4,'#e5e9ee');c.restore();
  const size=Math.min(61,740/Math.max(1,lineWidth(c,bottom,61,.8))*61),track=.8,w=lineWidth(c,bottom,size,track),x=(900-w)/2,y=222,h=91;
  for(let slice=0;slice<8;slice++){
   const start=x-23+(w+46)*slice/8,sw=(w+46)/8,age=local-.24-slice*.049,q=ease(age/.55);
   if(age<=0)continue;c.save();c.globalAlpha*=ease(age/.14);c.translate(start,y+h*.5);c.transform(Math.max(.015,q),(1-q)*(slice%2?-.38:.38),0,1,0,(1-q)*(slice%2?22:-22));
   c.beginPath();c.rect(0,-h/2,sw+.6,h);c.clip();
   const gr=c.createLinearGradient(0,-h/2,0,h/2);gr.addColorStop(0,'#a9c6da');gr.addColorStop(.55,'#8dafc6');gr.addColorStop(1,'#7397b2');rect(c,0,-h/2,sw+1,h,gr);
   spaced(c,bottom,x-start,19,size,track,'#101e2d');
   if(q<.99)rect(c,0,-h/2,sw*(1-q),h,'#e6f0f544');c.restore();
  }
  const corner=ease((local-.75)/.5);c.save();c.globalAlpha*=corner;c.beginPath();c.moveTo(x+w+23,y+h-21);c.lineTo(x+w+23,y+h);c.lineTo(x+w+2,y+h);c.closePath();c.fillStyle='#4d6d85';c.fill();c.restore();
  const line=ease((local-.75)/.5);rect(c,450-23*line,337,46*line,2,'#89a7be',1);
 }
 c.restore();c.restore();
}
