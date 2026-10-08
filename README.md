# Klipanje

Lokalna Django + React aplikacija za skripte, fotografije, naraciju, titlove i montažu videa. Video editor koristi originalni Editin player, timeline i zajednički renderer, uz pojednostavljene alate.

## Instalacija i pokretanje

Potreban je Python 3.12+ i Node.js 22.13+. Nakon preuzimanja repozitorija pokreni **1-INSTALIRAJ.cmd**, a zatim **3-POKRENI.cmd**. Instalacija priprema zavisnosti, lokalnu bazu i račune. Za administratora koristi **4-ADMIN.cmd**.

- Aplikacija: http://127.0.0.1:5175/
- Projekti: http://127.0.0.1:5175/projekti
- Skripte: http://127.0.0.1:5175/skripte
- Fotografije: http://127.0.0.1:5175/fotografije
- Video editor: http://127.0.0.1:5175/videa
- Editor titlova: http://127.0.0.1:5175/titlovi
- Administracija: http://127.0.0.1:8002/admin/

Računi **Abdullah** i **Rijad** dobijaju jedinstvene privremene lozinke u lokalnom `.local/pocetne-prijave.txt` i moraju ih promijeniti pri prvom ulasku. Ponovna instalacija ne resetuje postojeće račune. Administrator **Naghun** postavlja se lokalno; lozinka nije dio repozitorija. Svaki računar ima vlastitu bazu i datoteke. GitHub prenosi kod, a ne korisničke projekte.

## Radni tok

1. U **Projektima** napravi projekat i upiši opis, serijal, likove i željeni izgled. Reference možeš dodati naknadno.
2. U **Skriptama** napiši tekst i podijeli ga na vremenske intervale. Intervali se ručno uređuju; automatska podjela daje procijenjena vremena. Skripte se spremaju lokalno i mogu se preuzeti kao TXT.
3. U **Fotografijama** odaberi cijelu skriptu ili interval, dopuni zajednički i pojedinačni prompt, stil, model i reference. Možeš uvesti vlastite slike ili klikom pokrenuti API generisanje. GPT Image 2.5 Flare služi za brže pokušaje, a Sunburst za zahtjevnije generisanje i rad s referencama. Dostupno je osam početnih stilova.
4. U **Video editoru** vanjski sidebar bira projekat i skriptu, a unutrašnji nudi medije, skriptu, naraciju, titlove, kadar i pokrete. Slike dodaješ na originalni Editin timeline, podešavaš trajanje, pomjeraš, režeš i dupliciraš. Dostupni su zoom in/out, pomak, blagi shake i prijelazi rez, pretapanje, fade i klizanje. Titlovi imaju Standard/Clean, prikaz riječ po riječ, slovo po slovo, fade i podešavanje veličine. Naracija se uvozi s diska ili generiše kroz ElevenLabs. Montaža se automatski sprema, ima i dugme **Spremi**, te lokalni MP4 izvoz.

Opcija **ChatGPT** u fotografijama priprema prompt za ručno korištenje u razgovoru i omogućava uvoz rezultata. Ne upravlja automatski ChatGPT računom niti prenosi API naplatu na ChatGPT pretplatu.

U korisničkom meniju dostupno je dvanaest tema: šest svijetlih i šest tamnih. Početne su **Led** i **Grafit**, a **Neon** i **Koralj** prate dostavljene palete. Slike paleta nisu projektne reference niti dio galerija.

## Podaci i API ključevi

Baza je `backend/db.sqlite3`, a datoteke su u `backend/media/`. Aktivna aplikacija koristi lokalnu pohranu; nema Cloudflare/R2, Backblaze ni udaljene baze. Projekti i datoteke dostupni su prijavljenom vlasniku.

Ključeve postavi u glavni `.env` prema `.env.example`. Čitaju ih isključivo serverski OpenAI/ElevenLabs pozivi. `.env`, baze, lozinke, mediji i izvorne ZIP arhive isključeni su iz Gita. Na novom računaru potrebno je zasebno unijeti ključeve. Ne kopirati konfiguraciju iz izvorne Edita arhive.

Generisanje fotografija i naracije koristi internet i kredite izabranog servisa, tek kada se pokrene odgovarajućim dugmetom. Bez ključeva i dalje možeš pisati skripte, uvoziti vlastite medije, uređivati i izvoziti video.

## Komande za razvoj

```powershell
npm run dev:all
npm run build
npm run test:backend
node scripts/test-video-studio.mjs
node scripts/test-editor-history.mjs
node scripts/test-export-safety.mjs
```

Izvorni zajednički renderer i dodatni Editini moduli sačuvani su radi daljnjih prerada. Marketinške stranice, CRM, naplata, affiliate i vanjske društvene prijave nisu dio aktivnih ruta lokalne aplikacije.
