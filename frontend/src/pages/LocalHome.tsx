import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

const tools = [
  {id:'script', number:'01', title:'Kreiranje skripte', description:'Zapiši ideju, oblikuj priču i sačuvaj tekst za sljedeći video.', path:'/skripte', label:'Počni pisati'},
  {id:'photo', number:'02', title:'Generisanje fotografija', description:'Prostor za vizuale koji će tvoju priču pretvoriti u sliku.', path:'/fotografije', label:'Otvori fotografije'},
  {id:'video', number:'03', title:'Generisanje videa', description:'Od skripte do kadra. Složi video, dodaj tekst i uredi titlove.', path:'/videa', label:'Otvori videa'},
];

export function LocalHome() {
  const {session} = useAuth();
  return <>
    <section className="klipanje-welcome"><p className="klipanje-eyebrow">KLIPANJE / TVOJ KREATIVNI STUDIO</p><h1>Dobro došao, <em>{session.user?.name}.</em></h1><p>Šta danas stvaramo?</p><Link className="klipanje-secondary" to="/projekti">Moji projekti ↗</Link></section>
    <section className="klipanje-tools" aria-label="Alati za stvaranje">{tools.map(tool=><Link to={tool.path} className={`klipanje-tool klipanje-tool-${tool.id}`} key={tool.id}>
      <div className="klipanje-tool-art" aria-hidden="true"><span className="klipanje-tool-number">/{tool.number}</span>{tool.id==='script'?<div className="klipanje-art-paper"><span>JEDNA IDEJA.</span><b>Velika priča.</b><i/><i/><i/><div>✎</div></div>:tool.id==='photo'?<div className="klipanje-art-photo"><i className="art-sun"/><i className="art-hill"/><i className="art-hill back"/><span>✦</span></div>:<div className="klipanje-art-video"><div><span>▶</span></div><i/><i/><i/><b/></div>}</div>
      <div className="klipanje-tool-content"><span className="klipanje-tool-category">{tool.id==='script'?'RIJEČI':tool.id==='photo'?'VIZUALI':'POKRET'}</span><h2>{tool.title}</h2><p>{tool.description}</p><span className="klipanje-tool-link">{tool.label}<span aria-hidden="true">↗</span></span></div>
    </Link>)}</section>

  </>;
}
