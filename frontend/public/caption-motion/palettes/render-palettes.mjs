import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../three-title-lab/package.json',import.meta.url));
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');GlobalFonts.registerFromPath('C:/Windows/Fonts/arial.ttf','Palette');GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf','Palette Bold');
const data=JSON.parse(await readFile(new URL('./PALETE.json',import.meta.url),'utf8')),canvas=createCanvas(1440,970),c=canvas.getContext('2d');
c.fillStyle='#10151e';c.fillRect(0,0,1440,970);c.font='bold 38px "Palette Bold"';c.fillStyle='#edf0f4';c.fillText('EDITA / PALETE STILOVA',44,64);c.font='18px Palette';c.fillStyle='#91a0b2';c.fillText('Osnovne boje · gradijenti · zasebna boja fonta, bordera i sjene za Three.js',44,101);
for(let i=0;i<data.styles.length;i++){
 const style=data.styles[i],x=32+(i%3)*466,y=133+Math.floor(i/3)*276,w=444,h=250;
 c.fillStyle='#1b2531';c.beginPath();c.roundRect(x,y,w,h,14);c.fill();c.font='bold 24px "Palette Bold"';c.fillStyle='#edf0f4';c.fillText(String(i+1).padStart(2,'0')+' '+style.name,x+20,y+37);
 c.font='12px Palette';c.fillStyle='#8294a6';c.fillText(style.engine==='three.js'?'Boje se mijenjaju u pregledu + JSON izvoz':'Paleta iz izvornog JS renderera',x+20,y+60);
 const entries=Object.entries(style.colors||style.palette).slice(0,6);
 for(let j=0;j<entries.length;j++){
  const [key,color]=entries[j],xx=x+20+(j%3)*139,yy=y+80+Math.floor(j/3)*78;
  if(Array.isArray(color)){const g=c.createLinearGradient(xx,0,xx+123,0);color.forEach((col,n)=>g.addColorStop(n/(color.length-1),col));c.fillStyle=g;}else c.fillStyle=color;
  c.beginPath();c.roundRect(xx,yy,123,30,5);c.fill();c.font='12px Palette';c.fillStyle='#ccd6e0';c.fillText(key,xx,yy+47);c.font='10px Palette';c.fillStyle='#879aac';c.fillText(Array.isArray(color)?color[0]+' → '+color.at(-1):color,xx,yy+61);
 }
}
c.font='15px Palette';c.fillStyle='#8395a8';c.fillText('Sve HEX vrijednosti: PALETE.json. Nijanse rendera ovise o svjetlu, dubini i materijalu.',44,951);
await writeFile(new URL('./PALETE.png',import.meta.url),canvas.toBuffer('image/png'));console.log('Palette sheet ready.');
