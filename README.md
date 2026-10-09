# Klipanje

Lokalna Django + React aplikacija za skripte, fotografije, naraciju, titlove i montažu videa. Video editor koristi originalni Editin player, timeline i zajednički renderer, uz pojednostavljene alate.

## Instalacija i pokretanje

Potreban je Python 3.12+ i Node.js 22.13+. Nakon preuzimanja repozitorija pokreni **1-INSTALIRAJ.cmd**, a zatim **3-POKRENI.cmd**. Instalacija priprema zavisnosti, lokalnu bazu i račune. Za administratora koristi **4-ADMIN.cmd**.

- Aplikacija: http://127.0.0.1:5175/
- Projekti: http://127.0.0.1:5175/projekti
- Skripte: http://127.0.0.1:5175/skripte
- Fotografije: http://127.0.0.1:5175/fotografije
- Video editor: http://127.0.0.1:5175/videa
- Titlovi: panel unutar video editora
- Administracija: http://127.0.0.1:5175/administracija

Računi **Abdullah** i **Rijad** dobijaju jedinstvene privremene lozinke u lokalnom `.local/pocetne-prijave.txt` i moraju ih promijeniti pri prvom ulasku. Ponovna instalacija ne resetuje postojeće račune. Administrator **Naghun** postavlja se lokalno; lozinka nije dio repozitorija. Svaki računar ima vlastitu bazu i datoteke. GitHub prenosi kod, a ne korisničke projekte.

## Radni tok

1. U **Projektima** kreiraj projekat. Folder otvara knjigu s opisom, bilješkama, pravilima pripovijedanja, stilom, likovima i referencama. Pri zatvaranju promijenjenog projekta odaberi spremanje ili odbacivanje izmjena.
2. U **Skriptama** odaberi chapter i napiši tekst ili klikom zatraži AI prijedlog prema pravilima projekta. Podijeli tekst u intervale i prilagodi vremena. Dodavanje, podjela, dupliciranje, spajanje i spremanje ostaju lokalni.
3. U **Fotografijama** odaberi kadrove i broj slika po kadru, promptove, model, stil i format. Reference biraš u popupu i vežeš za kadrove. Imenovani projektni likovi automatski dobijaju svoje kanonske reference. Generisane rezultate pregledaj, prihvati u galeriju, preuzmi, regeneriši ili obriši. Dostupni su Flare i Sunburst te osam početnih stilova.
4. U **Video editoru** sačuvani su Editin player, timeline i MP4 izvoz. Paneli Početak, Mediji, Naracija, Zvukovi, Titlovi, Pokreti i Efekti uređuju odvojene staze. Trajanje možeš zadati ručno; novi duži sadržaj produžava timeline. Titlovi imaju deset jednostavnih stilova, boje i pozadinu, osnovne animacije te pomjeranje direktno u playeru. Fit, zoom i prikaz/sakrivanje timelinea su uz reprodukciju. Montaža se automatski sprema i ima dugme **Spremi**.

Opcija **ChatGPT** u fotografijama priprema prompt za ručno korištenje u razgovoru i omogućava uvoz rezultata. Ne upravlja automatski ChatGPT računom niti prenosi API naplatu na ChatGPT pretplatu.

U korisničkom meniju dostupno je dvanaest tema: šest svijetlih i šest tamnih. Početna paleta je **Koralj** u svijetloj i tamnoj varijanti; dostupne su i **Led** i **Grafit**, a **Neon** i **Koralj** prate dostavljene palete. Slike paleta nisu projektne reference niti dio galerija.

## Podaci i API ključevi

Baza je `backend/db.sqlite3`, a datoteke su u `backend/media/`. Aktivna aplikacija koristi lokalnu pohranu; nema Cloudflare/R2, Backblaze ni udaljene baze. Projekti i datoteke dostupni su prijavljenom vlasniku.

Ključeve postavi u glavni `.env` prema `.env.example`. Čitaju ih isključivo serverski OpenAI/ElevenLabs pozivi. `.env`, baze, lozinke, mediji i izvorne ZIP arhive isključeni su iz Gita. Na novom računaru potrebno je zasebno unijeti ključeve. Ne kopirati konfiguraciju iz izvorne Edita arhive.

Generisanje AI skripti, fotografija i naracije koristi internet i kredite izabranog servisa, tek kada se pokrene odgovarajućim dugmetom. Bez ključeva i dalje možeš pisati skripte, uvoziti vlastite medije, uređivati i izvoziti video.

## Reference i glasovi

Upute za dosljednost likova dostupne su u aplikaciji kroz **Upute**. Kanonski opis i odobrene referentne slike koriste se ponovo pri svakom pozivu; potpuna vizuelna identičnost nije zagarantovana. Do 16 referenci podržano je po API zahtjevu. Procjena cijene fotografije odnosi se na izlaz slike prema zvaničnom kalkulatoru; tekst i reference se dodatno naplaćuju.

ElevenLabs primjeri glasova se preslušavaju bez generisanja novog zvuka. Balkanika, Ivan i Milena su provjereni regionalni primjeri; njihova dostupnost preko API-ja zavisi od pretplate. Voice Library preko API-ja nije dostupan na Free planu, a Top Up sam ne mijenja plan. Nakon promjene pretplate ponovo učitaj glasove.

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
