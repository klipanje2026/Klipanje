import {useRef,useState} from 'react';
import {textFonts} from '../lib/text-presets';
export function TextFontPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [query,setQuery]=useState('');const details=useRef<HTMLDetailsElement>(null);
 const family=value.split(',')[0].replace(/["']/g,'').trim();
 const fontName=textFonts.find(f=>f.value.split(',')[0].replace(/["']/g,'').trim()===family)?.name||family.replace(/ Variable$/,'')||'Manrope';
 const fonts=textFonts.filter(f=>f.name.toLowerCase().includes(query.trim().toLowerCase()));
 return <details ref={details} className="text-font-picker"><summary><span>Font</span><strong style={{fontFamily:value}}>{fontName}</strong><svg className="text-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div className="text-font-menu"><input type="search" aria-label="Pretraži fontove" placeholder="Pretraži fontove…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="text-font-results">{fonts.map(f=><button key={f.value} type="button" aria-pressed={value===f.value} onClick={()=>{onChange(f.value);if(details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}><span>{f.name}</span><strong style={{fontFamily:f.value}}>Primjer</strong></button>)}{!fonts.length&&<p>Nema fontova za ovu pretragu.</p>}</div><small>Uključeni fontovi · besplatni za korištenje</small></div></details>;
}
