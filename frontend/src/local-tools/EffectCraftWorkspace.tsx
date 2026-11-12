import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useProduction} from '../components/ProductionWorkspace';
import {downloadBlob, uploadAsset} from '../lib/production';
import {darkPalettes, lightPalettes} from '../lib/theme';
import './EffectCraftWorkspace.scss';

type Output = {id:string; name:string; blob:Blob; created:number; assetId?:string; project?:string; script?:string; processedBlob?:Blob; processedAssetId?:string; processing?:{status:string;name:string;speed:number}};
type Library = {listOutputs:()=>Promise<Output[]>; putOutput:(output:Output)=>Promise<void>; removeOutput:(id:string)=>Promise<void>};
const libraryUrl = new URL('/effectcraft/0.9.2/klipanje-library.js', location.origin).href;
const library = () => import(/* @vite-ignore */ libraryUrl) as Promise<Library>;
const editorUrl = '/effectcraft/0.9.2/index.html?nosw=1&cpu&nogpuworkers&frameworkers=1&home';

export function MotionImages() {
  const {projects, scripts} = useProduction();
  const [params] = useSearchParams();
  const stage = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const [started, setStarted] = useState(false), [message, setMessage] = useState('');
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    try {const saved = localStorage.getItem('klipanje-effectcraft-theme'); return saved === 'light' || saved === 'dark' ? saved : document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';} catch {return 'light';}
  });
  const [project, setProject] = useState(params.get('project') || ''), [script, setScript] = useState(params.get('script') || '');
  const [auto, setAuto] = useState(true), [outputs, setOutputs] = useState<Output[]>([]);
  const [busy, setBusy] = useState<string[]>([]), [showLibrary, setShowLibrary] = useState(true);
  const inFlight = useRef(new Set<string>()), imported = useRef(new Set<string>());
  const [, paletteChanged] = useState(0);
  useEffect(() => {
    const sync = () => {setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); paletteChanged(value => value + 1);};
    window.addEventListener('edita-theme-changed', sync);
    return () => window.removeEventListener('edita-theme-changed', sync);
  }, []);
  const palettes = theme === 'light' ? lightPalettes : darkPalettes;
  const variant = document.documentElement.dataset[theme === 'light' ? 'lightPalette' : 'darkPalette'];
  const colors = (palettes.find(p => p.id === variant) || palettes.find(p => p.id === 'coral')!).colors;
  const paletteStyle = {'--motion-stage':colors[0], '--motion-panel':colors[1], '--motion-soft':colors[2], '--motion-accent':colors[3]} as CSSProperties;
  const destinationValid = projects.some(p => p.id === project) && scripts.some(s => s.id === script && s.project === project);
  const refresh = useCallback(async () => {
    try {const entries = await (await library()).listOutputs(); setOutputs(entries.sort((a,b) => b.created-a.created)); return entries;}
    catch {setMessage('Lokalna biblioteka nije dostupna. Datoteke ostaju u preuzimanjima preglednika.');return [];}
  }, []);
  useEffect(() => {void refresh();}, [refresh]);
  const sendTheme = useCallback(() => frame.current?.contentWindow?.postMessage({type:'klipanje-effectcraft-theme', theme}, location.origin), [theme]);
  useEffect(() => {
    try {localStorage.setItem('klipanje-effectcraft-theme', theme);} catch { /* Session selection. */ }
    sendTheme();
  }, [theme, sendTheme]);
  const importOutput = useCallback(async (output:Output) => {
    if (!destinationValid || output.assetId || imported.current.has(output.id) || inFlight.current.has(output.id)) return;
    const video = output.blob.type.startsWith('video/'), image = output.blob.type.startsWith('image/');
    if (video && (!output.processedBlob || output.processing?.status !== 'ready')) {setMessage('Za video otvori Prilagodi i spremi: 1200 px, bez zvuka i izbor brzine.');return;}
    if (!video && !image) return;
    inFlight.current.add(output.id); setBusy(ids => [...ids, output.id]);
    try {
      const asset = await uploadAsset(project, new File([video ? output.processedBlob! : output.blob], video ? output.processing!.name : output.name, {type:video?'video/mp4':output.blob.type}), {gallery:true, purpose:video?'video':'image', scriptId:script});
      imported.current.add(output.id);
      await (await library()).putOutput({...output, assetId:asset.id, project, script});
      setMessage(`${output.name} je spremljen u medije odabrane skripte.`);
      await refresh();
    } catch (error) {setMessage(`${output.name}: ${error instanceof Error ? error.message : 'Uvoz nije uspio.'} Datoteka ostaje u biblioteci.`);}
    finally {inFlight.current.delete(output.id); setBusy(ids => ids.filter(id => id !== output.id));}
  }, [destinationValid, project, script, refresh]);
  useEffect(() => {
    const receive = (event:MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'effectcraft-ready') sendTheme();
      if (event.data?.type === 'effectcraft-processing') void refresh();
      if (event.data?.type === 'effectcraft-output-error') setMessage('Izvoz je preuzet u pregledniku, ali lokalna biblioteka nije spremljena. Provjeri slobodan prostor.');
      if (event.data?.type === 'effectcraft-output' && typeof event.data.id === 'string') {
        const id = event.data.id;
        void refresh().then(entries => {
          const output = entries.find(entry => entry.id === id);
          setShowLibrary(true);
          if (output && auto && destinationValid && !output.blob.type.startsWith('video/')) void importOutput(output);
          else if (output) setMessage(output.blob.type.startsWith('video/') ? 'Video je u biblioteci. Otvori Prilagodi i spremi za 1200 px, brzinu i spremanje u folder.' : `${output.name} je u biblioteci. Odaberi projekat i skriptu za uvoz.`);
        });
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [refresh, sendTheme, auto, destinationValid, importOutput]);
  useEffect(() => {
    const channel = new BroadcastChannel('klipanje-effectcraft-processing');
    channel.onmessage = () => {void refresh();};
    return () => channel.close();
  }, [refresh]);
  const processingHref = '/effectcraft/0.9.2/processing/index.html?' + new URLSearchParams({project,script});
  async function saveVideo(output:Output) {
    setBusy(ids => [...ids, output.id]);
    try {
      const url = new URL('/effectcraft/0.9.2/processing/folder.js', location.origin).href;
      const folder = await import(/* @vite-ignore */ url) as {savePrepared:(id:string)=>Promise<{path:string}>};
      const result = await folder.savePrepared(output.id);
      setMessage('Spremljeno u ' + result.path);
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Spremanje nije uspjelo.');}
    finally {setBusy(ids => ids.filter(id => id !== output.id));}
  }
  async function fullscreen() {
    try {await stage.current?.requestFullscreen();} catch {setMessage('Za veći prikaz koristi Otvori zasebno.');}
  }
  async function remove(output:Output) {
    if (!window.confirm(`Ukloniti ${output.name} iz lokalne biblioteke? Mediji u Klipanju i preuzete kopije ostaju sačuvani.`)) return;
    try {await (await library()).removeOutput(output.id); await refresh();} catch {setMessage('Datoteka nije uklonjena. Pokušaj ponovo.');}
  }
  return <section className="motion-images-page" data-effectcraft-theme={theme} style={paletteStyle}>
    <header>
      <div><h1>Slike s pokretima</h1><p>EffectCraft · od fotografije do animiranog kadra</p></div>
      <div className="motion-images-actions"><a href={processingHref} target="_blank" rel="noopener">Prilagodi i spremi · 1200 px ↗</a>
        <a href="/effectcraft/0.9.2/rijeka-suma-job/index.html" target="_blank" rel="noopener">Rijeka · pripremljena animacija ↗</a>
        <div className="motion-theme" role="group" aria-label="Tema EffectCrafta">
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Svijetla</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Tamna</button>
        </div>
        {started && <button type="button" onClick={() => void fullscreen()}>Cijeli ekran</button>}
        <a href={`/slike-s-pokretima?${new URLSearchParams({project, script})}`} target="_blank" rel="noopener">Otvori zasebno ↗</a>
      </div>
    </header>
    <div className="motion-destination">
      <strong>Spremanje u Klipanje</strong>
      <label>Projekat<select value={project} onChange={event => {setProject(event.target.value); setScript('');}}><option value="">Odaberi projekat</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Skripta<select value={script} onChange={event => setScript(event.target.value)} disabled={!project}><option value="">Odaberi skriptu</option>{scripts.filter(s => s.project === project).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />Automatski uvezi nove slike</label>
      <button type="button" aria-expanded={showLibrary} onClick={() => setShowLibrary(!showLibrary)}>Preuzimanja ({outputs.length})</button>
      <small>{destinationValid && auto ? 'Nove slike idu u medije ove skripte. Za videe koristi Prilagodi i spremi.' : 'Izvoz ostaje u biblioteci. Za automatski uvoz odaberi projekat i skriptu.'}</small>
    </div>
    {message && <p className="motion-status" role="status">{message}</p>}
    <div className="motion-workspace">
      <div className="motion-images-stage" ref={stage}>
        {started ? <iframe ref={frame} src={editorUrl} title="Slike s pokretima — EffectCraft" onLoad={sendTheme} allow="fullscreen; clipboard-read; clipboard-write" allowFullScreen /> :
          <div className="motion-images-launch">
            <img src="/effectcraft/0.9.2/favicon.svg" alt="" width="56" height="56" />
            <h2>Oživi fotografiju</h2><p>Dodaj sliku, složi pokrete i izvezi gotov kadar.</p>
            <ol><li><b>Uvezi sliku</b><span>File → Import, zatim Add to Composition.</span></li><li><b>Dodaj pokret</b><span>Pomak, približavanje, maske i efekti po slojevima.</span></li><li><b>Izvezi video</b><span>Render Queue → H.264 / MP4 → Render.</span></li></ol>
            <button type="button" onClick={() => setStarted(true)}>Pokreni EffectCraft</button>
            <p>Za lakši rad koristi Half ili Quarter pregled. Izvoz zadržava punu rezoluciju.</p>
          </div>}
      </div>
      {showLibrary && <aside className="motion-library" aria-label="Preuzimanja EffectCrafta">
        <h2>Preuzimanja</h2><p>Završeni izvozi i spremljeni projekti ostaju ovdje, na ovom računaru i u ovom pregledniku.</p>
        {!outputs.length && <div className="motion-empty">Još nema izvoza.<br />Izvezi MP4 u Render Queue; pojavit će se ovdje automatski.</div>}
        {outputs.map(output => {
          const supported = /^(video|image)\//.test(output.blob.type);
          return <article key={output.id}><strong>{output.name}</strong><small>{new Date(output.created).toLocaleString('bs-BA')} · {(output.blob.size/1024/1024).toFixed(1)} MB</small>
            <span>{(output.assetId || output.processedAssetId) ? '✓ Spremljeno u Klipanje' : supported ? 'Spremno za uvoz' : 'Projekt / arhiva · preuzmi za nastavak rada'}</span>
            <div><button onClick={() => downloadBlob(output.blob, output.name)}>{output.blob.type.startsWith('video/') ? 'Preuzmi original' : 'Preuzmi'}</button>
              {output.blob.type.startsWith('video/') && <a href={processingHref+'&output='+output.id} target="_blank" rel="noopener">Prilagodi i spremi →</a>}
              {output.processedBlob && output.processing?.status === 'ready' && <button disabled={busy.includes(output.id)} onClick={() => void saveVideo(output)}>Spremi u folder · 1200 px · {output.processing.speed}×</button>}
              {supported && !output.blob.type.startsWith('video/') && !output.assetId && <button disabled={!destinationValid || busy.includes(output.id)} onClick={() => void importOutput(output)}>{busy.includes(output.id) ? 'Spremam…' : 'Uvezi u Klipanje'}</button>}
              <button aria-label={`Ukloni ${output.name} iz biblioteke`} disabled={busy.includes(output.id) || ['queued','processing'].includes(output.processing?.status || '')} onClick={() => void remove(output)}>Ukloni</button></div>
            {output.assetId && <Link to={`/videa?project=${output.project}&script=${output.script}`}>Otvori u video editoru →</Link>}
          </article>;
        })}
        <p>MP4 je za montažu. .ecproj čuva slojeve i pokrete za nastavak rada u EffectCraftu. Biblioteka se ne prenosi između preglednika.</p>
      </aside>}
    </div>
  </section>;
}
