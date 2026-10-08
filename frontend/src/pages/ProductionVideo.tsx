import {useRef} from 'react';
import {useSelection,ProjectTree} from '../components/ProductionWorkspace';
import {VideoStudio} from './VideoStudio/VideoStudio';
export function ProductionVideo(){const w=useSelection();const guard=useRef<()=>Promise<boolean>>(async()=>true);return <div className="local-video-layout"><div className="klipanje-shell local-video-projects"><ProjectTree beforeSelect={()=>guard.current()}/></div>{w.script?<VideoStudio key={w.script.id} localScript={w.script} registerSave={save=>{guard.current=save;}}/>:<div className="local-video-empty"><h1>Tvoj sljedeći video.</h1><p>Odaberi projekat i dodaj skriptu da započneš.</p><button onClick={()=>w.createScript(w.project?.id)}>+ Dodaj skriptu</button></div>}</div>;}
