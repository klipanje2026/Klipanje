import type {StyleKey} from './captions/types';
export type HomeExample={id:string;label:string;title:string;description:string;style:StyleKey;portrait:number;text:string;phrases:string[];palette?:string;wordInterval?:number};
// Actual editor presets and existing palette variants; demo timestamps control speech pacing.
export const homeExamples:HomeExample[]=[
 {id:'ricochet',label:'Ricochet',title:'Daj priči novi ritam.',description:'Riječi pune pokreta i energije',style:'collectionStudioRicochet',wordInterval:.2,portrait:7,text:'Tvoja priča pokreće svijet',phrases:['Svaki kadar dobije energiju','Ostavi svoj snažan potpis']},
 {id:'prism',label:'Prism Fold',title:'Svjetlost u pokretu.',description:'Slojevi, boje i odsjaji',style:'prismFold',portrait:8,text:'Svjetlost pokreće priču',phrases:['Svaka ideja zasija','Stvori nešto novo']},
 {id:'lustre',label:'Lustre Cut',title:'Ostavi svoj trag.',description:'Sjajni rezovi i ritam riječi',style:'collectionStudioLustreCut',wordInterval:.2,portrait:2,text:'Ostavi svoj trag',phrases:['Tvoj glas odjekuje','Pokreni svoju priču']},
 {id:'riot',label:'Neon Riot',title:'Riječi pune energije.',description:'Boje i ritam u svakom kadru',style:'neonRiot',portrait:1,text:'Tvoja priča pokreće svijet',phrases:['Ideje ne čekaju dozvolu','Daj riječima novu energiju']},
 {id:'armor',label:'Ion Armor',title:'Svaka riječ zasija.',description:'Titanium / ultraviolet u pokretu',style:'collectionStudioPowerArmor',palette:'2',wordInterval:.2,portrait:4,text:'Svaka priča vrijedi više',phrases:['Stvori nešto sasvim svoje','Riječi koje dugo ostaju']},
 {id:'gaming',label:'Hyper Pop',title:'Podigni energiju.',description:'Odvažne boje i snažna slova',style:'collectionHyperPop',portrait:5,text:'Tvoja igra tvoja pravila',phrases:['Svaka ideja mijenja igru','Daj priči novu energiju']},
 {id:'pearl',label:'Abyssal Pearl',title:'Otkrij dubinu priče.',description:'Biserna slova i živ odsjaj',style:'collectionAbyssalPearl',portrait:0,text:'Mala ideja pokreće priču',phrases:['Svaki trenutak nešto znači','Pusti riječi da govore']},
 {id:'folio',label:'Folio',title:'Daj riječima prostora.',description:'Tipografija i slojevi kartica',style:'collectionStudioFolio',portrait:6,text:'Najbolje priče tek dolaze',phrases:['Svaka riječ ima smisao','Mali trenutak mijenja sve']},
];
