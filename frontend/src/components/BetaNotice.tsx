import {useSyncExternalStore} from 'react';
import {dismissBetaNotice, isBetaNoticeDismissed, subscribeBetaNotice} from '../lib/beta-notice';

export function BetaNotice({section}:{section:string}) {
 const dismissed=useSyncExternalStore(subscribeBetaNotice,isBetaNoticeDismissed,()=>false);
 if(dismissed||!['settings','text','elements','filters','transitions'].includes(section))return null;
 return <div className="editor-beta-notice"><span className="beta-badge">Beta</span><p>Opcije editora su u beta verziji. Nastavit ćemo dodavati nove mogućnosti i dorađivati postojeće.</p><button type="button" onClick={dismissBetaNotice}>Razumijem</button></div>;
}
