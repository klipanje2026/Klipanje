import {LanguageDropdown} from '../../components/LanguageDropdown/LanguageDropdown';
import {useAuth} from '../../context/auth-context';
import {saveSubtitleHandoff,saveVideoOnlyHandoff} from '../../lib/video-studio-handoff';
import { PublicFooter } from "../../components/PublicLayout/PublicLayout";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuroraVeil } from './AuroraVeil';
import { SiteHeader } from '../../components/SiteHeader/SiteHeader';
import { CaptionShowcase } from '../../components/CaptionShowcase/CaptionShowcase';
import { StudioIcon } from '../../components/StudioIcon/StudioIcon';

export function HomePage() {
  const {session}=useAuth();
  const [language,setLanguage]=useState('bos');
  const [dragging,setDragging]=useState(false);
  const [uploadMessage,setUploadMessage]=useState('');
  const [uploading,setUploading]=useState(false);
  const [mode, setMode] = useState<'captions' | 'video'>('captions');
  async function dropVideo(file?:File) {
    setDragging(false);
    if(!file||uploading)return;
    if(!file.type.startsWith('video/')){setUploadMessage('Odaberi video datoteku.');return;}
    setUploading(true);setUploadMessage('Otvaranje videa…');
    try {await (mode==='captions'?saveSubtitleHandoff:saveVideoOnlyHandoff)(session.user?.id??0,file);window.location.assign(mode==='captions'?`/titlovi?handoff=1&language=${encodeURIComponent(language)}`:'/video-editor?handoff=1');}
    catch {setUploading(false);setUploadMessage('Video nije moguće prenijeti. Pokušaj ponovo.');}
  }
  return <div className="home-page">
    <AuroraVeil />
    <SiteHeader />
    <main>
      <section className="home-hero" id="alati" aria-labelledby="home-title">
        <h1 id="home-title">Ti kreiraš.<br className="home-title-break" /> <span>Edita uređuje.</span></h1>
        <p className="home-intro">Od prvog kadra do posljednje riječi.<br className="home-desktop-break" /> Titlovi, zvuk i video — u tvom ritmu, s tvojim potpisom.</p>
        <div className="home-tool-switch" role="group" aria-label="Odaberi alat">
          <button aria-pressed={mode === 'captions'} onClick={() => setMode('captions')}><StudioIcon name="captions" />AI titlovi<span className="home-caption-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span></button>
          <button aria-pressed={mode === 'video'} onClick={() => setMode('video')}><StudioIcon name="video" />Video editor</button>
        </div>
        <div className={`home-start-panel${dragging?" drop-active":""}`} onDragOver={event=>{if(event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDrop={event=>{event.preventDefault();void dropVideo(event.dataTransfer.files[0]);}}>
          <div className="home-start-icon"><StudioIcon name="download" /></div>
          <div className="home-start-copy" aria-live="polite"><strong>Prevuci i pusti video ovdje</strong><p>{mode === 'captions' ? 'Odmah otvaramo video i prepoznajemo titlove.' : 'Odmah otvaramo video za montažu.'}</p></div>
          {mode==='captions'&&<div className="home-drop-language"><LanguageDropdown label="Odaberi jezik" value={language} onChange={setLanguage} options={[{value:'bos',label:'Bosanski'},{value:'srp',label:'Srpski'},{value:'hrv',label:'Hrvatski'},{value:'eng',label:'Engleski'},{value:'deu',label:'Njemački'},{value:'auto',label:'Automatski'}]}/></div>}
          <Link className="home-button home-button--accent" to={mode === 'captions' ? `/titlovi?language=${encodeURIComponent(language)}` : '/video-editor'}>Otvori editor<StudioIcon name="arrow" /></Link>
        </div>{uploadMessage&&<p className="home-drop-hint" role="status">{uploadMessage}</p>}
      </section>
      <CaptionShowcase />
      <section className="home-how" id="kako-radi" aria-labelledby="how-title">
        <div className="home-how-heading"><p>OD IDEJE DO OBJAVE</p><h2 id="how-title">Tri koraka.<br />Tvoj sljedeći video.</h2><Link to="/titlovi">Krenimo stvarati<StudioIcon name="arrow" /></Link></div>
        <ol><li><span>01</span><h3>Dodaj snimak</h3><p>Otvori editor i odaberi video ili audio s uređaja.</p></li><li><span>02</span><h3>Učini ga svojim</h3><p>Generiši titlove, dotjeraj tekst i odaberi boje, font i animaciju.</p></li><li><span>03</span><h3>Spremno za dijeljenje</h3><p>Pregledaj rezultat i izvezi video s titlovima.</p></li></ol>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
