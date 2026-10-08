export function drawPortraitVideo(ctx,video,width=1080,height=1920){
 if(video.readyState<2||!video.videoWidth)return;
 const factor=Math.max(width/video.videoWidth,height/video.videoHeight),w=video.videoWidth*factor,h=video.videoHeight*factor;
 ctx.drawImage(video,(width-w)/2,(height-h)/2,w,h);
}
export function drawPortraitBackdrop(ctx,width=1080,height=1920,time=0){
 const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,'#263332');g.addColorStop(.48,'#141b20');g.addColorStop(1,'#222124');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.filter=`blur(${58*ctx.canvas.width/width}px)`;ctx.globalAlpha=.38;
 const light=ctx.createLinearGradient(0,0,width,0);light.addColorStop(0,'#dda673');light.addColorStop(1,'#778b99');ctx.fillStyle=light;
 ctx.translate(Math.sin(time*.12)*8,0);ctx.fillRect(118,-110,150,725);ctx.fillRect(708,-130,115,480);ctx.globalAlpha=.17;ctx.fillStyle='#bfdacb';ctx.fillRect(250,1530,690,350);ctx.restore();
 ctx.save();ctx.strokeStyle='#ffffff09';ctx.lineWidth=2;for(const x of [113,307,724,864]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,490);ctx.stroke();}ctx.restore();
}
