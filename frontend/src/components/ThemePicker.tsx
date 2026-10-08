import {useEffect,useState} from 'react';
import {applyVariant,currentTheme,currentVariant,lightPalettes,darkPalettes} from '../lib/theme';
export function ThemePicker(_props:{simple?:boolean}) {
 const [choice,setChoice]=useState(()=>`${currentTheme()}:${currentVariant()}`);
 useEffect(()=>{const sync=()=>setChoice(`${currentTheme()}:${currentVariant()}`);window.addEventListener('edita-theme-changed',sync);return()=>window.removeEventListener('edita-theme-changed',sync);},[]);
 return <div className="production-theme-picker">{(['light','dark'] as const).map(mode=><section key={mode}><strong>{mode==='light'?'Svijetle':'Tamne'}</strong><div>{(mode==='light'?lightPalettes:darkPalettes).map(p=><button key={p.id} type="button" aria-pressed={choice===`${mode}:${p.id}`} onClick={()=>applyVariant(mode,p.id)}><span>{p.colors.map((color,i)=><i key={i} style={{background:color}}/>)}</span>{p.name}</button>)}</div></section>)}</div>;
}
