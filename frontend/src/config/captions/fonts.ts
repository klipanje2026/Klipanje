import '../../lib/text-fonts';
// Grouped by use, then alphabetically within each family.
const fontGroups = [
 {label:'Sans serif · jednostavni',names:['Arial','Inter','Montserrat','Nunito','Raleway','Roboto','Trebuchet','Verdana']},
 {label:'Serif · klasični',names:['Georgia','Playfair Display','Roboto Slab']},
 {label:'Rukopisni',names:['ArtBrush','Caveat','Pinyon Script']},
 {label:'Naslovni · izražajni',names:['Arial Black','CC-GothicPro','CCPowerPop POW Wide','Impact','Oswald','YWFT Black Slabbath']},
 {label:'Tehnološki',names:['Cyber Track','Hightech']},
 {label:'Monospace',names:['Courier']},
];
export const fontOptions = [
  {value:'"Pinyon Script", cursive',label:'Pinyon Script'},
  {value:'"CCPowerPop POW Wide", sans-serif',label:'CCPowerPop POW Wide'},
  {value:'"YWFT Black Slabbath", sans-serif',label:'YWFT Black Slabbath'},
  {value:'"CC-GothicPro", "Oswald Variable", sans-serif',label:'CC-GothicPro'},
  {value:'"ArtBrush", "Caveat Variable", cursive',label:'ArtBrush'},
  {value: '"Hightech", "Roboto Variable", sans-serif', label:"Hightech"},
  {value: '"Cyber Track", "Roboto Variable", sans-serif', label:"Cyber Track"},
  {value: '"Roboto Variable", sans-serif', label: "Roboto"},
  {value: '"Inter Variable", sans-serif', label: "Inter"},
  {value: '"Montserrat Variable", sans-serif', label: "Montserrat"},
  {value: '"Oswald Variable", sans-serif', label: "Oswald"},
  {value: '"Playfair Display Variable", serif', label: "Playfair Display"},
  {value: '"Roboto Slab Variable", serif', label: "Roboto Slab"},
  {value: '"Raleway Variable", sans-serif', label: "Raleway"},
  {value: '"Nunito Variable", sans-serif', label: "Nunito"},
  {value: '"Caveat Variable", cursive', label: "Caveat"},

  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Arial Black, Arial, sans-serif", label: "Arial Black" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "Courier New, monospace", label: "Courier" },
].map(font=>({...font,group:fontGroups.find(group=>group.names.includes(font.label))!.label}))
 .sort((a,b)=>fontGroups.findIndex(group=>group.label===a.group)-fontGroups.findIndex(group=>group.label===b.group)||a.label.localeCompare(b.label,'bs'));

// Warm the bundled faces for canvas previews and offline export, including Balkan glyphs.
if (typeof document !== 'undefined' && document.fonts) {
  for (const font of fontOptions.filter(font=>font.value.includes('Pinyon Script')||font.value.includes('Variable')||font.value.includes('ArtBrush')||font.value.includes('CC-GothicPro')||font.value.includes('CCPowerPop POW Wide')||font.value.includes('YWFT Black Slabbath'))) {
    void document.fonts.load(`${font.value.includes('Pinyon Script')?400:900} 32px ${font.value}`, 'ČćŽžŠšĐđ ABC').catch(()=>{});
  }
}

/** Keep the same weight controls across font families. */
export function captionWeightOptions(_family:string,current?:number){
 const weights=[300,400,500,600,700,800,900];
 const options=[{value:'0',label:'Prema stilu'},...weights.map(weight=>({value:String(weight),label:String(weight)}))];
 if(current&&!weights.includes(current))options.push({value:String(current),label:String(current)});
 return options;
}
