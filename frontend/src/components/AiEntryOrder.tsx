import type {SetStateAction} from 'react';
import type {CaptionSettings,StyleKey} from '../config/captions/types';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';

export function AiEntryOrder({style,settings,onChange}:{style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
 if(style!=='prismFold')return null;
 const key='foldEntryOrder';
 return <LanguageDropdown label="Redoslijed ulaska" value={settings[key]??'phrase'} options={[
  {value:'phrase',label:'Cijela fraza · postojeći ulazak'},
  {value:'spoken',label:'Riječ po riječ · prema govoru'},
 ]} onChange={value=>onChange(previous=>({...previous,[key]:value as 'phrase'|'spoken'}))}/>;
}
