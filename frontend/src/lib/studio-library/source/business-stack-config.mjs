const bsPalette=(label,bg,text,muted,accent,mark,markText)=>({label,bg,text,muted,accent,mark,markText});
export const BusinessStyles=Object.freeze({
 boardroom:{name:'BOARDROOM',subtitle:'Strategija · jasna hijerarhija',align:'left',scales:[.78,1.03,1.18,.91,1.05,.84],widths:[.76,.97,1,.85,.97,.93],indents:[0,0,.02,.035,0,.01],gap:.32,weight:500,roles:['regular','bold','accent','regular','underline','regular','mark','regular'],palettes:{
  navy:bsPalette('Navy & Mint','#111e2c','#f2f0e9','#b3c0c5','#87c9bb','#9bbcaf','#142a29'),
  ivory:bsPalette('Ivory & Ink','#eeeae0','#202e3e','#5d6c75','#235774','#cedbd5','#183c39'),
  oxford:bsPalette('Oxford & Gold','#1e2638','#f3ebde','#b7b8c3','#d1b77f','#d3bb8c','#283142'),
  graphite:bsPalette('Graphite & Ice','#22252b','#eeeeeb','#b4bac0','#a7c3dc','#5a7287','#f2f6f8')
 }},
 editorial:{name:'EDITORIAL',subtitle:'Poslovni esej · serif i naglasci',align:'left',scales:[.90,1.14,1.03,1.19,.91,1.0],widths:[.90,.97,.83,1,.94,.90],indents:[0,.035,.08,0,.04,.025],gap:.38,weight:400,roles:['regular','regular','accent','bold','regular','underline','regular','mark'],palettes:{
  linen:bsPalette("Ivory / electric blue","#182438","#fff8ed","#bccbdd","#529bff","#315aa0","#ffffff"),
  midnight:bsPalette('Midnight & Brass','#172828','#eee7d9','#b6c3ba','#cdb88c','#3b5548','#f4e8ca'),
  plum:bsPalette('Plum & Rose','#2a202a','#efe6df','#c6b7c2','#d8b0a8','#654958','#fff0e8'),
  slate:bsPalette('Slate & Teal','#dfe5e2','#233c45','#586d72','#21635e','#c7d7c8','#173e36')
 }},
 memo:{name:'HIGHLIGHT MEMO',subtitle:'Sažetak · diskretno markiranje',align:'left',scales:[.87,1.08,1.03,.96,1.13,.89],widths:[.93,.97,1,.86,.97,.94],indents:[0,.01,.035,0,.01,.04],gap:.39,weight:500,roles:['regular','regular','mark','mark','regular','bold','regular','underline','accent'],palettes:{
  paper:bsPalette("White / sunflower","#19232c","#ffffff","#bac8d0","#ffd147","#ffd147","#242b36"),
  cobalt:bsPalette('Cobalt & Cream','#202f52','#edf0ee','#b4c0d2','#d9cfa4','#d9cfa4','#253451'),
  sage:bsPalette('Sage & Forest','#e2e8df','#293c34','#627166','#336453','#b4c4a6','#263e2b'),
  charcoal:bsPalette('Charcoal & Sand','#202b2f','#edf1ec','#b4bfb9','#d7c092','#d7c092','#22302f')
 }},
 ledger:{name:'LEDGER',subtitle:'Analitički ritam · poravnati redovi',align:'ledger',scales:[.95,1.08,.91,1.04,.98,1.06],widths:[1,1,1,1,1,1],indents:[0,0,0,0,0,0],gap:.44,weight:400,roles:['bold','regular','regular','accent','regular','underline','regular','mark','regular'],palettes:{
  forest:bsPalette("Ice / emerald","#112a2a","#f3fffb","#adc9c4","#42dbab","#246954","#f1fff8"),
  blueprint:bsPalette('Blueprint & Ice','#172739','#f0f2ee','#b2c2cf','#a4c6dc','#456785','#f4f6f8'),
  stone:bsPalette('Stone & Navy','#e8e7e0','#233442','#68757b','#315e74','#cad7da','#223e4b'),
  graphite:bsPalette('Graphite & Copper','#24272b','#f1eeea','#c0bab4','#c9a585','#d4b49b','#342b28')
 }},
 pivot:{name:'PIVOT',subtitle:'Prezentacija · odmjereni pomaci',align:'center',scales:[.83,1.14,.98,1.18,.89,1.04],widths:[.83,1,.91,.95,1,.87],indents:[0,-.035,.025,.015,-.02,.01],gap:.34,weight:500,roles:['regular','accent','regular','bold','regular','mark','underline','regular'],palettes:{
  ink:bsPalette("Pearl / cobalt","#16233c","#f8fbff","#b4c5e0","#5b9fff","#2e62b4","#ffffff"),
  ice:bsPalette('Slate & Ice','#273442','#eff3f1','#b7c3c8','#b5d6de','#587a8b','#eff8f8'),
  sand:bsPalette('Sand & Olive','#e8e2d6','#29372f','#6d7465','#57724b','#c6ceb2','#31462a'),
  wine:bsPalette('Wine & Rose','#342330','#f0e8e1','#c6b7c1','#d2aea6','#d2aea6','#402a36')
 }}
});
