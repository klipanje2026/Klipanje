import type {TranscriptResult} from './transcription-client';
// Conservative, whole-word normalization. Never use a blanket e -> ije replacement.
const ijekavian:Record<string,string>={vreme:'vrijeme',vremena:'vremena',vremenu:'vremenu',lepo:'lijepo',lepa:'lijepa',lepi:'lijepi',lep:'lijep',mleko:'mlijeko',mleka:'mlijeka',mleku:'mlijeku',dete:'dijete',deca:'djeca',dece:'djece',deci:'djeci',devojka:'djevojka',devojke:'djevojke',devojku:'djevojku',pesma:'pjesma',pesme:'pjesme',pesmu:'pjesmu',reč:'riječ',reči:'riječi',rečima:'riječima',rečnik:'rječnik',rečnika:'rječnika',mesec:'mjesec',meseca:'mjeseca',meseci:'mjeseci',mesecima:'mjesecima',mesto:'mjesto',mesta:'mjesta',mestu:'mjestu',sneg:'snijeg',snega:'snijega',snegu:'snijegu',svetlo:'svjetlo',svetlost:'svjetlost',ovde:'ovdje',telo:'tijelo',tela:'tijela',telom:'tijelom',uvek:'uvijek',uspeh:'uspjeh',uspeha:'uspjeha',uspešno:'uspješno',sledeći:'sljedeći',sledeća:'sljedeća',sledeće:'sljedeće',ponedeljak:'ponedjeljak',nedelja:'nedjelja',nedelje:'nedjelje',nedelju:'nedjelju',obaveštenje:'obavještenje',obaveštenja:'obavještenja'};
const croatian:Record<string,string>={avion:'zrakoplov',aviona:'zrakoplova',avionom:'zrakoplovom',avioni:'zrakoplovi',aerodrom:'zračna luka',voz:'vlak',voza:'vlaka',vozom:'vlakom',vozovi:'vlakovi',vazduh:'zrak',vazduha:'zraka',vazduhu:'zraku',opština:'općina',opštine:'općine',opštini:'općini',saopštenje:'priopćenje',saopštenja:'priopćenja',obavještenje:'obavijest',obavještenja:'obavijesti'};
export function checkTranscriptLanguage(result:TranscriptResult,language:string):TranscriptResult {
 const code=language.toLowerCase();if(!['bos','bs','hrv','hr'].includes(code))return result;
 const hr=code==='hr'||code==='hrv';
 const convert=(text:string)=>text.replace(/\p{L}+/gu,word=>{
  // Preserve acronyms; one-token replacements keep word timings intact.
  const lower=word.toLocaleLowerCase();if(word===word.toLocaleUpperCase()&&word.length>1)return word;
  const first=ijekavian[lower]||lower;const replacement=(hr?croatian[first]:undefined)||first;
  if(replacement===lower||replacement.includes(' '))return word;
  return word[0]===word[0].toLocaleUpperCase()?replacement[0].toLocaleUpperCase()+replacement.slice(1):replacement;
 });
 return {...result,...(typeof result.text==='string'?{text:convert(result.text)}:{}),...(result.words?{words:result.words.map(w=>w.type&&w.type!=='word'?w:{...w,text:typeof w.text==='string'?convert(w.text):w.text})}:{})};
}
