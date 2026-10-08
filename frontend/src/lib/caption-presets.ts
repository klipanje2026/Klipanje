import {templates,type CaptionSettings,type CaptionTemplate,type StyleKey} from '../config/captions/presets';
export type SavedCaptionPreset={id:string;name:string;style:StyleKey;settings:CaptionSettings;portrait:number;status:string;owner:number;username:string};
export function savedTemplate(p:SavedCaptionPreset):CaptionTemplate {
 const base=templates.find(t=>t.key===p.style)||templates[0];
 return {...base,name:p.name,preset:p.settings,portrait:p.portrait};
}
