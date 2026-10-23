import type {Overlay} from '../lib/video-overlays';
import {flagCountries} from '../lib/flag-animation';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
export function FlagControls({item,onChange}:{item:Overlay;onChange:(patch:Partial<Overlay>)=>void}){
 return <div className="flag-controls">
  <LanguageDropdown label="Zastava" value={item.flagCountry||'ba'} options={flagCountries.map(([value,label])=>({value,label}))} onChange={v=>onChange({flagCountry:v as Overlay['flagCountry'],text:`Zastava · ${flagCountries.find(([code])=>code===v)?.[1]||'BiH'}`})}/>
  <LanguageDropdown label="Oblik" value={item.flagShape||'rectangle'} options={[{value:'rectangle',label:'Pravougaona zastava'},{value:'pennant',label:'Trouglasta zastavica'}]} onChange={v=>onChange({flagShape:v as Overlay['flagShape']})}/>
  <LanguageDropdown label="Dolazak" value={item.flagArrival||'none'} options={[{value:'none',label:'Samo vijorenje'},{value:'left',label:'Doleti slijeva'},{value:'right',label:'Doleti zdesna'},{value:'top',label:'Sleti odozgo'}]} onChange={v=>onChange({flagArrival:v as Overlay['flagArrival']})}/>
  {item.flagArrival!=='none'&&<label>Trajanje dolaska · {(item.animationDuration??1.2).toFixed(1)} s<input type="range" min=".1" max="5" step=".1" value={item.animationDuration??1.2} onChange={e=>onChange({animationDuration:Number(e.target.value)})}/></label>}
  <label>Brzina vijorenja · {(item.flagSpeed??1).toFixed(1)}×<input type="range" min="0" max="3" step=".1" value={item.flagSpeed??1} onChange={e=>onChange({flagSpeed:Number(e.target.value)})}/></label>
  <label>Jačina vijorenja · {item.flagStrength??45}%<input type="range" min="0" max="100" step="1" value={item.flagStrength??45} onChange={e=>onChange({flagStrength:Number(e.target.value)})}/></label>
  <label className="flag-pole-toggle"><input type="checkbox" checked={item.flagPole!==false} onChange={e=>onChange({flagPole:e.target.checked})}/>Štap zastave</label>
  <small>Povuci zastavu na završni položaj u pregledu. Rubovima mijenjaš veličinu, a na timelineu početak i trajanje.</small>
 </div>;
}
