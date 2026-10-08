import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout/PublicLayout';
const groups = [
  {title:'Titlovi za naš govor',items:[
    ['Koje jezike Edita podržava?','U editoru možeš odabrati bosanski, hrvatski i srpski, uz druge dostupne jezike. Edita je usmjerena na kreatore s Balkana: snimi svoj govor, odaberi jezik i dotjeraj prepoznati tekst u editoru.'],
    ['Prepoznaje li dijalekte, žargon i č, ć, š, ž, đ?','Prepoznavanje govora može obraditi lokalne izraze i naša slova, ali rezultat zavisi od jasnoće snimka, naglaska, buke i preklapanja glasova. Imena, žargon i stručne izraze pregledaj prije objave. Tekst uvijek možeš ručno ispraviti.'],
    ['Jesu li automatski titlovi isto što i prijevod?','Ne. Dodavanje titlova pretvara govor u tekst na odabranom jeziku. Odabir jezika govora ne prevodi sadržaj na drugi jezik. Automatsko prevođenje između jezika trenutno nije zasebna funkcija Edite.'],
    ['Mogu li promijeniti izgled i položaj titlova?','Da. Odaberi stil, font, boju, animaciju i veličinu. Titl možeš povući na drugo mjesto u video pregledu. Enter u tekstu titla dodaje novi red; zaseban stil i položaj jedne riječi trenutno nisu dostupni.'],
  ]},
  {title:'Video, spremanje i izvoz',items:[
    ['Kako početi?','Prijavi se, otvori AI titlove i odaberi snimak i jezik govora. Nakon odabira datoteke obrada titlova se automatski pokreće. Zatim pregledaj tekst, odaberi izgled i izvezi rezultat. Za rezanje i slaganje klipova koristi Video editor.'],
    ['Zašto se moj MP4 nekad duže učitava?','MP4 je format datoteke, a video u njemu može koristiti različite kodeke. Ako preglednik ne može prikazati sliku, Edita priprema kompatibilnu verziju. Vrijeme zavisi od dužine, rezolucije snimka, računara i veze. Pripremu možeš prekinuti.'],
    ['Može li obrada titlova krenuti prije prikaza videa?','Da. Edita pokušava izdvojiti zvuk za prepoznavanje govora nezavisno od pripreme video pregleda. Zato titlovi mogu biti spremni dok se slika još priprema.'],
    ['Kako sačuvati projekat za kasnije?','Klikni Spremi projekat u gornjoj traci. Spremljeni projekat otvaraš iz odjeljka Saved. Spremi kopiju pravi zaseban projekat. Promjene koje nisi spremio mogu se izgubiti nakon zatvaranja stranice.'],
    ['Šta mogu preuzeti?','U editoru titlova možeš izvesti tekst kao TXT, VTT ili SRT te video s ugrađenim titlovima. Izvoz videa zavisi od podrške preglednika. Tokom izvoza ostavi stranicu otvorenu dok se datoteka ne preuzme.'],
    ['Mogu li provjeriti položaj titlova za društvene mreže?','Da. Prikaz platforme nudi pomoćne zone za Instagram Reels, TikTok i YouTube Shorts. Oznake su okvirne jer se izgled aplikacija i ekrana razlikuje. Ne ulaze u izvezeni video.'],
  ]},
  {title:'Račun, glas i privatnost',items:[
    ['Mogu li drugi korisnici vidjeti moje videe?','Tvoji projekti su vezani za tvoj račun i nisu javna galerija. Drugi korisnički računi ih ne mogu otvoriti kroz aplikaciju. Snimci i zvuk se obrađuju putem servisa navedenih u Politici privatnosti.'],
    ['Šta rade Promijeni glas i Narator?','Promijeni glas obrađuje postojeći govor iz snimka odabranim glasom. Narator stvara govor iz teksta koji uneseš. Za promjenu glasa prvo isprobaj kratki dio, pa tek onda cijeli snimak.'],
    ['Kako se naplaćuju krediti?','Korisnički paketi, kupovina kredita i pravila naplate još nisu uvedeni. Podaci o vanjskom AI paketu koje vidi administrator nisu korisnički cjenovnik Edite. Uslove ćemo objaviti prije uvođenja naplate.'],
    ['Kako obrisati projekat ili zatražiti brisanje podataka?','Projekat možeš obrisati iz odjeljka Saved. Za brisanje računa ili zahtjev vezan za lične podatke piši na info@gordondm.com. Detalji o pohrani i brisanju nalaze se u Politici privatnosti.'],
  ]},
];
export function FaqPage() {
  return <PublicLayout><main className="public-content faq-page"><header className="public-hero"><p className="public-kicker">Manje nedoumica. Više stvaranja.</p><h1>Tvoj govor.<br />Naši odgovori.</h1><p>Česta pitanja o Editi, balkanskim titlovima i putu od prvog snimka do videa spremnog za objavu.</p></header>
    <nav className="faq-jump" aria-label="Teme pitanja">{groups.map((group,index)=><a key={group.title} href={`#tema-${index}`}>{group.title}</a>)}</nav>
    {groups.map((group,index)=><section className="faq-group" id={`tema-${index}`} key={group.title}><h2>{group.title}</h2><div>{group.items.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>)}
    <aside className="public-contact"><h2>Nisi pronašao odgovor?</h2><p>Javi nam se na <a href="mailto:info@gordondm.com">info@gordondm.com</a>. Za podatke i pohranu pogledaj <Link to="/privatnost">Politiku privatnosti</Link>.</p><Link to="/titlovi">Otvori svoj studio →</Link></aside>
  </main></PublicLayout>;
}
