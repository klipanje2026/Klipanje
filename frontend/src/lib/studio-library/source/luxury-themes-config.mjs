const luxuryPalette=(label,text,surface,accent,background,shadow)=>({label,text,surface,accent,background,shadow});
export const LuxuryThemes=Object.freeze({
 stone:{name:'PORTICO',subtitle:'ARCHITECTURAL STONE',category:'3D · Kamen i arhitektura',detail:'Travertin · Podizanje ploča · Brončani spojevi',kind:0,palettes:{
  travertine:luxuryPalette('Travertin · Bronca','#e5dfd1','#746551','#b49b70',['#24251f','#3e3e31'],'#1e211b'),
  limestone:luxuryPalette('Vapnenac · Grafit','#e4e5dc','#787d73','#a6b2a5',['#202927','#3b4641'],'#17221e'),
  basalt:luxuryPalette('Bazalt · Srebro','#d4dde1','#55616a','#a2b4be',['#1c232d','#353f4d'],'#141b25'),
  rosso:luxuryPalette('Rosso · Pijesak','#e4d5c3','#76534a','#b99a80',['#2c211f','#4b3730'],'#231916')
 }},
 silk:{name:'SARTORIA',subtitle:'TAILORED SILK',category:'3D · Svila i krojenje',detail:'Tkani reljef · Drapiranje · Fini rubovi',kind:1,palettes:{
  wine:luxuryPalette('Bordo · Šampanjac','#e7dfcf','#865865','#c5aa81',['#291e28','#46303b'],'#1f1620'),
  midnight:luxuryPalette('Ponoćna plava · Biser','#dde2e1','#4c6b85','#a8babf',['#17252e','#304555'],'#121e27'),
  moss:luxuryPalette('Šumska svila · Lan','#e1ded0','#61755c','#b1b491',['#1f2822','#3c4c3a'],'#17211a'),
  cocoa:luxuryPalette('Kakao · Bakrena nit','#e4d8c8','#8a6953','#b69470',['#28201f','#4c3930'],'#201818')
 }},
 paper:{name:'SIGNET',subtitle:'PRIVATE STATIONERY',category:'3D · Papir i reljefni otisak',detail:'Pamučni papir · Utisak · Suhi pečat',kind:2,palettes:{
  cotton:luxuryPalette("Ivory / imperial blue","#183766","#fff0d2","#326ef0",["#182644","#314a6e"],"#0c1730"),
  graphite:luxuryPalette("Graphite / silver","#ffffff","#273340","#92d8ff",["#101822","#293848"],"#080f19"),
  sage:luxuryPalette("Emerald / gold","#fff8da","#19523e","#ffcc54",["#10291e","#27533b"],"#091b13"),
  blue:luxuryPalette("Royal blue / pearl","#f4faff","#2456a0","#92d9ff",["#101d37","#294776"],"#0b1329"),burgundy:luxuryPalette("Bordeaux / gold","#fff0db","#742a43","#ffd37a",["#291525","#4b273c"],"#1a0c17"),copper:luxuryPalette("Copper / cream","#fff7e7","#944926","#ffc386",["#321e17","#593e2b"],"#21120c")}},
 wood:{name:'MARQUET',subtitle:'MODERN MARQUETRY',category:'3D · Drvo i intarzija',detail:'Drvene žile · Otvaranje lamela · Intarzija',kind:3,palettes:{
  walnut:luxuryPalette('Orah · Mesing','#e8dfcf','#684832','#b69a6d',['#201f1b','#3e372b'],'#151610'),
  oak:luxuryPalette('Dimljeni hrast · Kamen','#e3e0d3','#716851','#b4b6a0',['#242722','#424638'],'#1b1e17'),
  ebony:luxuryPalette('Ebanovina · Nikl','#dedee0','#44454b','#9eacb4',['#1a1d25','#353841'],'#11151c'),
  cherry:luxuryPalette('Trešnja · Bronca','#e7d8cb','#7f4b3a','#b69578',['#2a211f','#47332b'],'#211715')
 }},
 glass:{name:'LUCENT',subtitle:'SMOKED GLASS',category:'3D · Dimljeno staklo',detail:'Slojevi stakla · Klizanje · Optički rubovi',kind:4,palettes:{
  smoke:luxuryPalette('Dimljeno staklo · Platina','#dee4e2','#667f86','#a5bdc0',['#17232b','#334750'],'#0f1921'),
  tea:luxuryPalette('Čajno staklo · Bronca','#e7dfd0','#9a8061','#baa78e',['#292623','#4c4338'],'#1e1c19'),
  jade:luxuryPalette('Jadeit · Srebro','#dce5da','#597e71','#a3b8a5',['#1b2927','#365047'],'#13211d'),
  violet:luxuryPalette('Grafitno staklo · Ljubičasti dim','#dfdce4','#716d8a','#ada9bf',['#24242f','#414150'],'#191923')
 }}
});
