import {useState} from 'react';
import {numberDisplay,saveNumberDisplay,type NumberDisplay} from '../lib/caption-numbers';
import './CaptionNumberToggle.scss';
export function CaptionNumberToggle({onApply,disabled=false}:{onApply?:(mode:NumberDisplay)=>void;disabled?:boolean}){
 const [applied,setApplied]=useState(false);
 const [mode,setMode]=useState(numberDisplay);
 return <div className="caption-number-toggle"><span>Brojevi</span><button type="button" role="switch" aria-checked={mode==='digits'} aria-label="Brojeve piši ciframa pri novom prepoznavanju i uvozu" title="Primjenjuje se pri novom prepoznavanju i uvozu titlova" onClick={()=>{const next=mode==='digits'?'words':'digits';setMode(next);saveNumberDisplay(next);setApplied(false);}}><span className={mode==='digits'?'active':''}>123</span><span className={mode==='words'?'active':''}>Riječi</span></button>{onApply?<><button type="button" className="caption-number-apply" disabled={disabled} title="Primijeni odabrani prikaz brojeva na sve učitane titlove" onClick={()=>{onApply(mode);setApplied(true);}}>↻ Primijeni</button>{applied&&<small role="status">Primijenjeno</small>}</>:<small>Pri učitavanju</small>}</div>;
}
