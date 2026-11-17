# Editor: pregled i dorade, 12.11.2026.

## Šta je stvarno pregledano

Klipanje editor pregledan je bez osvježavanja korisnikove montaže. Imao je nespremljene izmjene, zato je implementacija pripremljena u zasebnoj kopiji. U CapCut desktopu otvoren je novi prazan testni projekt; pregledani su raspored medija, playera, desnog inspectora i timeline komandi. Postojeći CapCut projekti nisu mijenjani. To je poređenje rasporeda i dostupnosti kontrola, ne mjerenje CapCut brzine ili kompletna funkcionalna evaluacija.

Automatsko upravljanje Edgeom zaustavljeno je jer alat nije mogao pouzdano utvrditi trenutni URL. Interaktivna provjera nove verzije, uključujući fullscreen, ostala je otvorena; nije zaobiđena blokada.

## Obrasci u pripremljenom kodu

- Zadržan Editin player i postojeći raspored; ujednačene kompaktne ikonice, nazivi pri hoveru i pristupačni nazivi dugmadi.
- Na timelineu su vidljivi efekti i posebne animacije; obični ulasci/izlasci ostaju postavke kadra bez dodatnog reda za svaki kadar.
- Jedne makaze režu medije, titlove i samostalne efekte na pokazivaču. Svaki audio zadržava svoje izvorno vrijeme; rez efekta zadržava njegovu fazu.
- Povezivanje i grupisanje su različite komande. Povezivanje čuva zadate položaje. Grupa drži odabrane slike/videe, naracije i titlove zajedno; jedna slika ili jedan titl mogu pokriti zajednički raspon. Audio se grupisanjem ne rasteže.
- Shift + klik bira više elemenata. Ctrl+G grupiše, Ctrl+Shift+G raspušta grupu. „Uredi unutar grupe” omogućava pojedinačno pomjeranje; Esc vraća zajedničko pomjeranje. Raspuštanje čuva trenutna vremena.
- Magnet poravnava rubove; jedan magnet za pomjeranje narednih djeluje na traku, više magneta označava sve trake. Ručno formirana grupa ostaje cjelina.
- „Osvježi pregled videa i zvuka” priprema dekodere i vraća pokazivač na isto vrijeme. Ne osvježava stranicu, ne učitava drugi projekt i ne mijenja spremljenu montažu.

## Početak naracije i fullscreen

U kodu je nađen prozor u kojem je `paused=false`, ali obećanje prvog `play()` još nije završeno. Brojač pregleda mogao je napredovati prije stvarnog početka audija. Novi uslov čeka završetak pokretanja, zatim ograničava brojač prema vremenu audija. Audio kontekst za pojačanje budi se iz komande reprodukcije. Ovaj uzrok je pokriven simuliranim testom; nije potvrđeno da objašnjava svako zastajkivanje na korisnikovim datotekama.

Fullscreen je imao ugniježđeni player s flex pravilima namijenjenim direktnom potomku. Pripremljena je korekcija visine omotača/playera, vraćanje zooma i pomaka te vidljivo dugme za izlaz. Konačna vizuelna potvrda u Edgeu još je potrebna.

Izvoz ne koristi novi sat pregleda. Za rezane slojeve provjerena je jednakost renderovanih piksela prije i poslije reza; izvorni mediji se ne prepisuju.

## Preporuke za naredni krug — nisu implementirane

1. Zaključavanje i sakrivanje pojedinačne trake: olakšava duge montaže bez slučajnog odabira.
2. Jedan objedinjeni inspector s karticama za grupu i njen sadržaj, ako postojeći plutajući prozori postanu prebrojni.
3. Raspon petlje označen direktno na ruleru i prikaz A/B tačaka; korisno pri preciznom usklađivanju govora.
4. Prikaz stanja pripreme pregleda po datoteci, s mogućnošću ponovne pripreme samo problematičnog videa.
5. Desni klik s istim komandama kao toolbar, bez novih skrivenih ponašanja.
6. Optimizacija dekodiranja na stvarnoj velikoj montaži uz mjerenje ispuštenih frejmova. Poređenje brzine s praznim CapCut projektom ne bi bilo valjano.

Ove preporuke zahtijevaju zaseban dogovor; ne zamjenjuju tražene dorade.
