export const PrismPalettes={amber:{label:'Amber',hue:170},rose:{label:'Rose',hue:95},emerald:{label:'Emerald',hue:-85},sapphire:{label:'Sapphire',hue:15},violet:{label:'Violet',hue:55},original:{label:'Original',hue:0}};
/** Rotate colored glass stops while retaining their lightness, saturation and alpha. */
export function prismColors(id){
 const shift=(PrismPalettes[id]||PrismPalettes.amber).hue/360;
 const rotate=hex=>{
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  if(!d)return hex;
  let h=max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4;
  h=((h/6+shift)%1+1)%1;
  const sat=d/(1-Math.abs(2*l-1)),a=sat*Math.min(l,1-l);
  return '#'+[0,8,4].map(n=>{const k=(n+h*12)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');}).join('');
 };
 return Object.fromEntries(SOURCE_COLORS.map(color=>[color,rotate(color)]));
}
const SOURCE_COLORS=['#476989', '#537ab7', '#577f94', '#71b9c5', '#7379a3', '#798fc1', '#80dbe9', '#83ced6', '#8971b2', '#89d8de', '#95a8bf', '#95cbc2', '#9893cf', '#99e4de', '#9bded4', '#9fdbdc', '#a0bace', '#aaa0cb', '#ace0e4', '#aeacdc', '#b1e7e2', '#b6c8ea', '#b9c9e0', '#bbadce', '#bec5ec', '#c4a9d9', '#c8dae4', '#cbb7e4', '#ccb1e0', '#d3b4e3', '#d5c7ed', '#d7faf9', '#ddadf1', '#def9f2', '#e2c8ec', '#edf2f5', '#effcff', '#f6f7ff', '#f9e1ff', '#faffff', '#ffe6da', '#ffffff'];
