import {useState} from 'react';

export type GridFrame = {id:string; label:string; layer:number; start:number; end:number; eligible:boolean};

export function FrameGridPicker({frames, selectedId, disabled, onCreate}:{
  frames:GridFrame[]; selectedId?:string; disabled:boolean; onCreate:(ids:string[], followVoice:boolean)=>void;
}){
  const [first,setFirst]=useState('');
  const [count,setCount]=useState(4);
  const [followVoice,setFollowVoice]=useState(false);
  const runs=frames.flatMap((frame,index)=>{
    if(!frame.eligible)return [];
    const run=frames.slice(index).filter(next=>next.layer===frame.layer).slice(0,count);
    return run.length===count && run.every(next=>next.eligible)?[run]:[];
  });
  const run=runs.find(items=>items[0].id===first)||runs.find(items=>items[0].id===selectedId)||runs[0];
  const duration=run?Math.max(...run.map(item=>item.end))-run[0].start:0;
  return <fieldset disabled={disabled}><h3>Mreža od postojećih kadrova</h3>
    <label>Broj slika<select value={count} onChange={e=>setCount(Number(e.target.value))}>
      <option value={4}>4 slike · 2 + 2</option><option value={5}>5 slika · 3 + 2</option>
    </select></label>
    {run?<><label>Od prvog kadra<select value={run[0].id} onChange={e=>setFirst(e.target.value)}>
      {runs.map(items=><option key={items[0].id} value={items[0].id}>{items[0].label}</option>)}
    </select></label>
    <label>Pojavljivanje slika<select value={followVoice?'voice':'all'} onChange={e=>setFollowVoice(e.target.value==='voice')}>
      <option value="all">Sve slike odmah</option><option value="voice">Redom uz naraciju kadra</option>
    </select></label>
    <ol>{run.map(item=><li key={item.id}>{item.label}</li>)}</ol>
    <button type="button" onClick={()=>onCreate(run.map(item=>item.id),followVoice)}>Spoji u mrežu · {duration.toFixed(1)} s</button>
    </>:<p>Za ovu mrežu treba {count} uzastopnih slika na istoj traci timelinea.</p>}
  </fieldset>;
}
