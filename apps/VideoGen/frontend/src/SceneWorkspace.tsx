import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ChevronDown,Clapperboard,FolderOpen,ImagePlus,LoaderCircle,Plus,RefreshCw,X} from 'lucide-react';
import type {Bootstrap,Job,Model,Project} from './App';
import {cents,statuses} from './App';
import {DownloadButton} from './Downloads';
import {ProcessedVideo,requestProcessedDownload} from './ProcessedVideo';

export type Plan={
 id:string;title:string;description:string;prompt:string;signature:string;
 has_end_frame?:boolean;scene_url?:string|null;end_url?:string|null;image_role?:'start'|'reference';
};
export type Settings={
 title:string;direction:string;style:string;model:string;gpu:string;duration:number;aspect:string;
 steps:number;referenceMode:string;seed:number;fixedSeed:boolean;negative:string;renderProfile:string;
 useEndFrame:boolean;imageRole:'start'|'reference';
};
type Draft={id:string;form:Settings;plan:Plan|null;fileVersion:number;selectedId:string};
type Files={image:File|null;ending:File|null};
type Api=(path:string,options?:RequestInit)=>Promise<any>;
type WorkspaceProps={
 data:Bootstrap;project:Project;api:Api;refresh:()=>Promise<Bootstrap>;
 setError:(message:string)=>void;setNotice:(message:string)=>void;
 toggleGallery:(job:Job)=>Promise<void>;onGenerations:()=>void;reuseJob:Job|null;
};
const defaults:Settings={
 title:'',direction:'',style:'cartoon3d',model:'wan22-5b',gpu:'RTX-PRO-6000',duration:5,
 aspect:'16:9',steps:15,referenceMode:'combined',seed:42,fixedSeed:false,
 negative:'blurry, flickering, inconsistent character, distorted anatomy, text, watermark',
 renderProfile:'standard',useEndFrame:false,imageRole:'start',
};
const activeStates=['queued','batch_waiting','submitting','preparing','running','submission_unknown','cancelling'];
const nativeLtx=['ltx23-22b','ltx25-dev','ltx25-distilled'];
const endFrameModels=['ltx-2b',...nativeLtx];
const noFiles:Files={image:null,ending:null};

function initial(project:Project):Draft[]{
 const stored=project.draft.scenes as Draft[]|undefined;
 const rows=Array.isArray(stored)&&stored.length?stored:[
  {id:crypto.randomUUID(),form:project.draft.form,plan:project.draft.plan,fileVersion:project.draft.fileVersion,selectedId:''} as Draft,
 ];
 return rows.map(row=>{
  const plan=row.plan||null;
  const form={...defaults,...(row.form||{})};
  if(!row.form?.imageRole)form.imageRole=plan?.image_role||(['keyframe','reference'].includes(form.referenceMode)?'reference':'start');
  return {id:row.id||crypto.randomUUID(),form,plan,fileVersion:Number(row.fileVersion)||0,selectedId:row.selectedId||''};
 });
}
function signature(draft:Draft){
 const f=draft.form;
 return JSON.stringify([f.title,f.direction,f.style,f.aspect,f.duration,f.imageRole,draft.fileVersion,f.useEndFrame]);
}
function placementFor(form:Settings){
 if(nativeLtx.includes(form.model))return 'native';
 if(form.model==='lightx-wan22')return form.gpu==='RTX-PRO-6000'?'merged-resident':form.gpu==='A10'?'merged-blocks':'merged';
 if(form.model==='hunyuan15-step')return form.gpu==='A10'?'merged-blocks':form.gpu==='L40S'?'offload':'resident';
 if(form.model==='wan22-5b'&&['RTX-PRO-6000','L40S','A100-80GB'].includes(form.gpu))return 'resident';
 return form.model==='ltx-2b'&&form.gpu==='L40S'?'resident':'offload';
}
function generationSettings(draft:Draft,plan:Plan){
 const f=draft.form;
 return {
  plan:plan.id,title:f.title,model_id:f.model,gpu:f.gpu,placement:placementFor(f),steps:f.steps,
  seed:f.fixedSeed?f.seed:Math.floor(Math.random()*2147483647),negative_prompt:f.negative,render_profile:f.renderProfile,
 };
}
function ready(draft:Draft,model:Model|undefined,files:Files){
 return !!model?.enabled&&!!draft.form.title.trim()&&draft.form.direction.trim().length>=10&&
  draft.form.direction.trim().length<=4000&&(!model.image||!!files.image||!!draft.plan&&draft.plan.scene_url!==null)&&
  (!draft.form.useEndFrame||!!files.ending||!!draft.plan?.has_end_frame);
}
function fileName(title:string,model:string){
 let name=title.replace(/đ/g,'d').replace(/Đ/g,'D').trim().replace(/\.mp4$/i,'');
 name=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_.]+/g,'_').replace(/^[_.]+|[_.]+$/g,'').slice(0,150)||'scena';
 const tag:Record<string,string>={'ltx25-dev':'ltx2.5','ltx25-distilled':'ltx2.5','ltx23-22b':'ltx2.3','ltx-2b':'ltx'};
 if(!name.includes('_video_'))name+='_video_'+(tag[model]||model.replace(/-/g,'_'));
 return name+'.mp4';
}

export function SceneWorkspace(props:WorkspaceProps){
 const {data,project,api,refresh,setError,setNotice,reuseJob}=props;
 const [drafts,setDrafts]=useState<Draft[]>(()=>initial(project));
 const [busy,setBusy]=useState('');
 const lastSaved=useRef(drafts),files=useRef(new Map<string,Files>()),inFlight=useRef(false);
 const imported=useRef(''),request=useRef({body:'',key:'',payload:''});
 const active=data.jobs.some(job=>activeStates.includes(job.status));
 const batch=data.batches?.find(item=>item.project===project.id&&!['completed','cancelled','failed'].includes(item.status));

 useEffect(()=>{
  if(drafts===lastSaved.current)return;
  const timer=setTimeout(()=>{
   api('creative/projects/'+project.id+'/',{method:'PATCH',body:JSON.stringify({draft:{scenes:drafts}})})
    .then(()=>{lastSaved.current=drafts}).catch(error=>setError(error.message));
  },600);
  return()=>clearTimeout(timer);
 },[project.id,drafts]);
 useEffect(()=>{
  if(!reuseJob||imported.current===reuseJob.id)return;
  imported.current=reuseJob.id;
  void (async()=>{
   let form={...defaults,title:reuseJob.title,direction:reuseJob.prompt,model:reuseJob.model_id,gpu:reuseJob.gpu,steps:reuseJob.steps};
   let plan:Plan|null=null;
   if(reuseJob.scene_plan){
    const saved=await api('creative/plans/'+reuseJob.scene_plan+'/');
    form={...form,...saved.form,imageRole:saved.plan.image_role||'start'};
    plan=saved.plan;
   }
   const draft:Draft={id:crypto.randomUUID(),form,plan,fileVersion:0,selectedId:reuseJob.id};
   setDrafts(old=>old.some(item=>item.selectedId===reuseJob.id)?old:old.length===1&&!old[0].form.direction?[draft]:[...old,draft]);
  })().catch(error=>setError(error.message));
 },[reuseJob?.id]);

 function change(id:string,update:(draft:Draft)=>Draft){
  setDrafts(old=>old.map(draft=>draft.id===id?update(draft):draft));
 }
 function selectFile(id:string,key:keyof Files,file:File){
  files.current.set(id,{...(files.current.get(id)||noFiles),[key]:file});
  const current=drafts.find(draft=>draft.id===id);
  if(!current)return;
  const next={...current,fileVersion:current.fileVersion+1};
  change(id,()=>next);
  void saveScene(next,true).catch(error=>setError(error.message));
 }
 async function saveScene(draft:Draft,draftOnly=false){
  const f=draft.form,body=new FormData(),images=files.current.get(draft.id)||noFiles;
  const fields={
   project:project.id,title:f.title,direction:f.direction,style:f.style,aspect:f.aspect,duration:f.duration,
   model_id:f.model,image_role:f.imageRole,previous_plan:draft.plan?.id||'',end_enabled:f.useEndFrame?'1':'0',
   draft_only:draftOnly?'1':'0',
  };
  Object.entries(fields).forEach(([key,value])=>body.append(key,String(value)));
  if(images.image)body.append('image',images.image);
  if(f.useEndFrame&&images.ending)body.append('end_reference',images.ending);
  const saved:Plan=await api('creative/scenes/',{method:'POST',body});
  const plan={...saved,signature:signature(draft)};
  change(draft.id,current=>current.fileVersion===draft.fileVersion?{...current,plan}:current);
  return plan;
 }
 async function generateOne(draft:Draft){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(draft.id);setError('');
  try{
   const plan=await saveScene(draft);
   const job:Job=await api('creative/generate/',{method:'POST',body:JSON.stringify({
    account:data.selected_account,...generationSettings(draft,plan),
   })});
   change(draft.id,current=>({...current,selectedId:job.id}));
   await refresh();
   if(job.error)setError(job.error);
   else setNotice('Generacija je pokrenuta.');
  }catch(error){setError((error as Error).message)}
  finally{setBusy('');inFlight.current=false}
 }
 async function generateAll(){
  if(inFlight.current)return;
  inFlight.current=true;setBusy('all');setError('');
  try{
   const body=JSON.stringify({project:project.id,account:data.selected_account,
    scenes:drafts.map(draft=>({id:draft.id,form:draft.form,fileVersion:draft.fileVersion})),
   });
   if(request.current.body!==body||!request.current.key){
    const scenes=[];
    for(const draft of drafts){
     const plan=await saveScene(draft);
     scenes.push({...generationSettings(draft,plan),scene_key:draft.id});
    }
    const key=crypto.randomUUID();
    request.current={body,key,payload:JSON.stringify({project:project.id,account:data.selected_account,request_key:key,scenes})};
   }
   const result=await api('creative/batches/',{method:'POST',body:request.current.payload});
   setDrafts(old=>old.map(draft=>({...draft,selectedId:result.jobs.find((job:Job)=>job.scene_key===draft.id)?.id||draft.selectedId})));
   await refresh();request.current.key='';
   setNotice('Sve scene su dodane u red generisanja.');
  }catch(error){setError((error as Error).message)}
  finally{setBusy('');inFlight.current=false}
 }
 const canRun=!active&&!busy&&data.paid_enabled&&data.billing.synced&&Number(data.billing.remaining)>0;
 const allReady=drafts.every(draft=>ready(draft,data.models.find(model=>model.id===draft.form.model),files.current.get(draft.id)||noFiles));
 return <div className="scene-workspace">
  {batch&&<div className="panel batch-status" role="status">
   <div><strong>{batch.status==='attention'?'Red traži provjeru':'Generisanje scena u nizu'}</strong>
    <p>{batch.completed} / {batch.total} završeno</p>{batch.error&&<p>{batch.error}</p>}
   </div>
   <button className="button secondary" disabled={batch.cancel_requested} onClick={()=>void api('creative/batches/'+batch.id+'/cancel/',{method:'POST'}).then(refresh).catch(error=>setError(error.message))}>
    {batch.cancel_requested?'Zaustavljam…':'Zaustavi sve scene'}
   </button>
  </div>}
  {drafts.map((draft,index)=><section className="scene-row" key={draft.id} aria-label={'Scena '+(index+1)}>
   <div className="scene-row-heading"><h2>Scena {index+1}</h2>
    {drafts.length>1&&<button className="text-button" disabled={active||!!busy} onClick={()=>{files.current.delete(draft.id);setDrafts(old=>old.filter(item=>item.id!==draft.id))}}><X size={15}/>Ukloni iz radne sobe</button>}
   </div>
   <SceneRow {...props} draft={draft} files={files.current.get(draft.id)||noFiles}
    first={index===0} canRun={canRun} generating={busy===draft.id}
    change={update=>change(draft.id,update)} selectFile={(key,file)=>selectFile(draft.id,key,file)}
    generate={()=>void generateOne(draft)}/>
  </section>)}
  <button className="button secondary add-scene" disabled={!!busy} onClick={()=>setDrafts(old=>[...old,{
   id:crypto.randomUUID(),form:{...old[old.length-1].form,title:'',direction:''},plan:null,fileVersion:0,selectedId:'',
  }])}><Plus size={20}/>Dodaj još jednu scenu</button>
  {drafts.length>1&&<div className="panel batch-footer">
   <div><strong>{drafts.length} scena</strong><p>Svaka scena koristi svoju sliku, opis i postavke.</p></div>
   <button className="button primary" disabled={!canRun||!allReady} onClick={()=>void generateAll()}>
    {busy==='all'?<LoaderCircle size={18} className="spin"/>:<Clapperboard size={18}/>}Generiši sve scene
   </button>
  </div>}
 </div>;
}

type RowProps=WorkspaceProps&{
 draft:Draft;files:Files;first:boolean;canRun:boolean;generating:boolean;
 change:(update:(draft:Draft)=>Draft)=>void;selectFile:(key:keyof Files,file:File)=>void;generate:()=>void;
};
function SceneRow({draft,files,data,project,api,refresh,setError,toggleGallery,onGenerations,
 first,canRun,generating,change,selectFile,generate}:RowProps){
 const {form,plan}=draft;
 const [advanced,setAdvanced]=useState(false),[savedImages,setSavedImages]=useState<Plan|null>(plan);
 useEffect(()=>{
  let current=true;
  if(plan)void api('creative/plans/'+plan.id+'/').then(saved=>{if(current)setSavedImages(saved.plan)}).catch(error=>setError(error.message));
  return()=>{current=false};
 },[plan?.id]);
 const saved=savedImages?.id===plan?.id?savedImages:plan;
 const imageUrl=useImage(files.image,saved?.scene_url),endUrl=useImage(files.ending,saved?.end_url);
 const model=data.models.find(item=>item.id===form.model);
 const candidates=data.averages.filter(mean=>mean.model_id===form.model&&mean.gpu===form.gpu&&mean.duration===5);
 const mean=candidates.find(item=>item.steps===form.steps&&item.aspect===form.aspect&&item.render_profile===form.renderProfile)||candidates[0];
 const projectJobs=data.jobs.filter(job=>job.project===project.id);
 const selected=projectJobs.find(job=>job.id===draft.selectedId)||projectJobs.find(job=>job.scene_key===draft.id)||
  projectJobs.find(job=>plan&&job.scene_plan===plan.id)||(first&&!plan?projectJobs[0]:undefined);
 const active=projectJobs.find(job=>activeStates.includes(job.status)&&job.scene_plan===plan?.id);
 const canGenerate=canRun&&ready(draft,model,files);
 function update<K extends keyof Settings>(key:K,value:Settings[K]){
  change(current=>({...current,form:{...current.form,[key]:value}}));
 }
 function chooseModel(id:string){
  const selectedModel=data.models.find(item=>item.id===id);
  if(!selectedModel)return;
  change(current=>({...current,form:{...current.form,model:id,
   gpu:selectedModel.gpu_options.some(gpu=>gpu.id==='RTX-PRO-6000')?'RTX-PRO-6000':selectedModel.gpu,
   steps:id==='wan22-5b'?15:selectedModel.steps,
   duration:selectedModel.duration_options.includes(current.form.duration)?current.form.duration:5,
   renderProfile:'standard',useEndFrame:endFrameModels.includes(id)&&current.form.useEndFrame,
  }}));
 }
 return <div className="studio-grid">
  <section className="panel composer">
   <div className="panel-heading"><h2>Postavke generisanja</h2><span className="step-number">01</span></div>
   <div className="composer-inner">
    <label className="field-label">VIZUELNI STIL</label>
    <div className="vg-styles">{data.styles.map(([id,label])=><button key={id} aria-pressed={form.style===id} onClick={()=>update('style',id)}>
     <img src={'/style-previews/'+(id==='chibi'?'chibi-square.png':id+'-character.png')} alt=""/><span>{label}</span>{form.style===id&&<Check size={13}/>}
    </button>)}</div>
    <div className="room-settings">
     <label>Model<select value={form.model} onChange={event=>chooseModel(event.target.value)}>{data.models.map(item=>
      <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name} · {item.variant}</option>)}</select></label>
     <label>GPU<select value={form.gpu} onChange={event=>{const gpu=event.target.value;change(current=>({...current,form:{...current.form,gpu,steps:current.form.model==='hunyuan15-step'&&['A10','L40S'].includes(gpu)?8:current.form.steps,renderProfile:'standard'}}))}}>{model?.gpu_options.map(gpu=>
      <option key={gpu.id} value={gpu.id}>{gpu.id==='RTX-PRO-6000'?'RTX PRO 6000':gpu.id} · {gpu.vram} GB</option>)}</select></label>
    </div>
    <div className="model-description compact-price"><strong>{mean?'Prosjek '+cents(mean.mean_usd)+' / 5 s':'Prosjek za 5 s još nije dostupan'}</strong></div>
    <div className="room-settings three">
     <label>Trajanje<select value={form.duration} onChange={event=>update('duration',Number(event.target.value))}>
      {(model?.duration_options||[3,5]).map(seconds=><option key={seconds} value={seconds}>{seconds} {seconds===1?'sekunda':seconds<5?'sekunde':'sekundi'}</option>)}
     </select></label>
     <label>Format<select value={form.aspect} onChange={event=>update('aspect',event.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
     <label>Koraci{model?.step_options?<select value={form.steps} onChange={event=>update('steps',Number(event.target.value))}>
      {model.step_options.map(steps=><option key={steps}>{steps}</option>)}</select>:
      <input type="number" min={model?.min_steps||8} max={model?.max_steps||50} value={form.steps} onChange={event=>update('steps',Number(event.target.value))}/>}</label>
    </div>
    <button className="advanced-toggle" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}>Napredne postavke <ChevronDown size={15}/></button>
    {advanced&&<div className="room-advanced">
     <label><input type="checkbox" checked={form.fixedSeed} onChange={event=>update('fixedSeed',event.target.checked)}/>Koristi isti seed</label>
     <label>Seed<input type="number" value={form.seed} min={0} max={2147483647} onChange={event=>update('seed',Number(event.target.value))}/></label>
     <label>Izbjegni<textarea value={form.negative} onChange={event=>update('negative',event.target.value)}/></label>
     {form.model==='ltx23-22b'&&form.gpu==='RTX-PRO-6000'&&form.duration===5&&form.aspect==='9:16'&&
      <label>Rezolucijski profil<select value={form.renderProfile} onChange={event=>update('renderProfile',event.target.value)}>
       <option value="standard">Standardni</option><option value="detail">Detaljniji</option><option value="ultra">Ultra</option>
      </select></label>}
    </div>}
    <div className="room-divider"/>
    {model?.image&&<>
     <label className="field-label">SLIKA</label>
     <ImageInput label="Ubaci sliku" file={files.image} url={imageUrl} select={file=>selectFile('image',file)}/>
     <label className="room-field image-role">Uloga slike<select value={form.imageRole} onChange={event=>update('imageRole',event.target.value as Settings['imageRole'])}>
      <option value="start">Početni kadar</option><option value="reference">Referenca kadra</option>
     </select></label>
     {form.imageRole==='reference'&&<p className="field-hint">{nativeLtx.includes(form.model)?
      'Referenca vodi izgled kadra približno u sredini videa. U opisu napiši radnju.':
      'AI iz reference i tvog opisa priprema početni kadar. Ova priprema ima zaseban OpenAI trošak.'}</p>}
     {endFrameModels.includes(form.model)&&<section className="end-frame-section">
      <label className="end-frame-toggle"><input type="checkbox" checked={form.useEndFrame} onChange={event=>update('useEndFrame',event.target.checked)}/>Dodaj završni kadar</label>
      {form.useEndFrame&&<ImageInput label="Završni kadar" file={files.ending} url={endUrl} select={file=>selectFile('ending',file)}/>}
     </section>}
    </>}
    <label className="room-field">Naziv scene / videa<input value={form.title} onChange={event=>update('title',event.target.value)} maxLength={120} placeholder="leon_kusa_vodu_video_ltx2.5"/></label>
    <p className="field-hint video-filename">{fileName(form.title,form.model)}</p>
    <label className="room-field">Opis scene / prompt<textarea className="direction-input" value={form.direction} maxLength={4000}
     onChange={event=>update('direction',event.target.value)} placeholder="Opiši radnju, kameru i sve što želiš u videu…"/></label>
   </div>
   <div className="generate-footer"><button className="button primary generate" disabled={!canGenerate} onClick={generate}>
    {generating?<LoaderCircle className="spin" size={17}/>:<Clapperboard size={17}/>}Generiši scenu<ArrowRight size={16}/>
   </button></div>
  </section>
  <div className="right-column">
   <section className="panel preview-panel">
    <div className="panel-heading"><h2>Pregled scene</h2><span className="preview-badge">{selected?.missing_video?'Datoteka nedostaje':selected?statuses[selected.status]||selected.status:'TVOJ REZULTAT'}</span></div>
    <div className={'room-preview aspect-'+form.aspect.replace(':','-')}>
     {selected?.video_url?<video key={selected.id} src={selected.video_url} controls playsInline/>:
      imageUrl?<img src={imageUrl} alt="Slika scene"/>:selected?.reference_url?<img src={selected.reference_url} alt="Pripremljeni kadar"/>:
      <div className="preview-empty"><Clapperboard size={42} strokeWidth={1}/><strong>Ovdje počinje tvoja scena.</strong><span>Dodaj sliku i opiši radnju.</span></div>}
     {active&&<div className="render-overlay"><LoaderCircle className="spin" size={32}/><strong>{statuses[active.status]}</strong>
      <button onClick={()=>void api(active.batch?'creative/batches/'+active.batch+'/cancel/':'jobs/'+active.id+'/cancel/',{method:'POST'}).then(refresh).catch(error=>setError(error.message))}>Zaustavi generisanje</button>
     </div>}
    </div>
    <div className="preview-caption"><div><strong>{selected?.title||form.title||'Nova scena'}</strong><small>{selected?selected.duration+' s · '+selected.gpu:'Bez generisanog videa'}</small></div>
     {selected?.video_url&&<DownloadButton job={selected} iconOnly/>}
    </div>
    {selected?.error&&<p className="job-error">{selected.error}</p>}
    {selected&&<ProcessedVideo job={selected} process={(job,speed)=>void api('creative/videos/'+job.id+'/process/',{method:'POST',body:JSON.stringify({speed})})
     .then(()=>{requestProcessedDownload(job.id);return refresh()}).catch(error=>setError(error.message))}/>}
    <div className="preview-buttons">
     <button className="button secondary" disabled={!canGenerate} onClick={generate}><RefreshCw size={15}/>Generiši novi</button>
     <button className="button primary" disabled={!selected?.video_url||generating} onClick={()=>selected&&void toggleGallery(selected)}>
      {selected?.in_gallery?<Check size={15}/>:<Plus size={15}/>} {selected?.in_gallery?'U galeriji · ukloni':'Ubaci u galeriju'}
     </button>
    </div>
   </section>
   <div className="room-note"><FolderOpen size={20}/><p>Sve generacije se čuvaju u projektu <strong>{project.name}</strong>.</p>
    <button className="text-button" onClick={onGenerations}>Otvori generacije <ArrowRight size={14}/></button>
   </div>
   {!!project.context.name&&<div className="room-note"><strong>Klipanje kontekst</strong><p>{String(project.context.name)}</p></div>}
  </div>
 </div>;
}

function useImage(file:File|null,saved?:string|null){
 const [url,setUrl]=useState('');
 useEffect(()=>{
  if(!file){setUrl('');return}
  const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);
  return()=>URL.revokeObjectURL(objectUrl);
 },[file]);
 return file?url:saved||'';
}
function ImageInput({label,file,url,select}:{label:string;file:File|null;url:string;select:(file:File)=>void}){
 return <label className="room-upload">
  {url?<img src={url} alt={label}/>:<ImagePlus size={26} strokeWidth={1.3}/>}
  <strong>{label}</strong><small>{file?.name||(url?'Slika je učitana':'PNG, JPEG ili WebP · do 8 MB')}</small>
  <input type="file" aria-label={label} accept="image/png,image/jpeg,image/webp" onChange={event=>{
   const image=event.target.files?.[0];if(image)select(image);
  }}/>
  <span>{url?'Promijeni sliku':'Odaberi sliku'}</span>
 </label>;
}
