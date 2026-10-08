# Kolekcija 01 — svi-titlovi-kolekcija.zip

Uvoz prvog Semirovog ZIP-a, 2. oktobar 2026. Original je raspakovan u `work/imports/2026-10-02-caption-collection/studio-titlova`. Dokumenti u arhivi korišteni su kao opis API-ja i izvora, a ne kao nove projektne instrukcije.

## Šta se nalazi u Editi

U **Stilovi → Kolekcija 01 · 22** registrirana su sva 22 kataloška unosa. Imaju vlastite ključeve `collection…`, tako da npr. CINEMA, NEON i KARAOKE iz arhive ne zamjenjuju istoimene postojeće stilove Edite. Voltage Rush je uklonjen iz registracije, postavki i renderera.

| Stil | Preneseni izvor | Posebne postavke |
| --- | --- | --- |
| HYPER POP MARKS | Originalni Three.js renderer i geometrija naglasaka | 12 paleta, 3 fonta, 7 vrsta naglasaka, dubina, jačina |
| HYPER POP | Originalni Three.js renderer | 12 paleta, 3 fonta, dubina, jačina |
| JUICE JAM | Originalni Three.js renderer i zasebni materijali | 12 paleta, 3 fonta, dubina, jačina |
| PRISM BLOOM | Originalne Canvas funkcije | Refrakcija, kristali |
| INK RIOT | Originalne Canvas funkcije | Kapljice tinte |
| FORGED | Originalne Canvas funkcije | 8 metalnih paleta, dubina, iskre |
| ATELIER NOIR | Originalni Three.js renderer i materijali | Dubina |
| REALITY RIFT | Originalni Three.js renderer, efekti i materijali | Dubina, jačina |
| TITANIUM EDGE | Originalni Three.js renderer, vektorski font i materijali | Dubina, jačina |
| MAGMA CORE | Originalna geometrija, shaderi i pokret izdvojeni iz demonstracije | Toplina, dubina, iskre i komadići |
| ABYSSAL PEARL | Originalna geometrija, shaderi i pokret izdvojeni iz demonstracije | Odsjaji, dubina, mjehurići |
| PAPER SCULPT | Originalni Three.js renderer | Dubina |
| VELVET PULSE | Originalne Canvas funkcije | Elastičnost, vlakna |
| PORCELAIN FLOW | Originalne Canvas funkcije | Glazura, zlatne pukotine |
| LASER TRACE | Originalne Canvas funkcije | Sjaj, električni lukovi |
| FUSION CAPS | Originalni prozirni Canvas renderer | Jačina; vremena riječi |
| 3D DEPTH | Canvas teksture i WebGL perspektiva prema `captions.css` / `captions.js` | Naglasak, dubina |
| KARAOKE | Canvas adaptacija `captions.css` / `captions.js` | Boja naglaska |
| CINEMA | Canvas adaptacija `captions.css` / `captions.js` | Boja naglaska |
| NEON | Canvas adaptacija `captions.css` / `captions.js` | Boja naglaska |
| POP PUNCH | Canvas adaptacija `captions.css` / `captions.js` | Boja naglaska |
| GLASS | Canvas adaptacija `captions.css` / `captions.js` | Boja naglaska |

Za sve su dostupni brzina, veličina, vidljivost, položaj i rotacija. Autorski prikazi imaju prekidač pozadine reference, osim FUSION CAPS koji je izvorno proziran. Efekti koji imaju fiksnu autorsku paletu nisu prikazani kao lažne univerzalne kontrole za proizvoljne boje/fontove. Tekst dolazi iz korisnikovih titlova.

## Granica vjernosti

Semir je 2. oktobra 2026. izričito odobrio lokalno poređenje i provjere. Snimke u galeriji su označene kao **Referenca** jer dolaze iz ZIP-a; animirani **Pregled** koristi isti integrirani renderer kao oba editora i video izvoz.

Prvih 16 unosa zadržava izvorne funkcije crtanja, geometriju, palete, fontove i materijale. Prilagođeni su ulaz titlova, vremenski izvor, učitavanje fontova, transparentnost, izbor pozadine i životni ciklus resursa. Poređeni su sa stvarnim originalnim rendererima na početku, sredini i kraju animacije, pri jednakoj rezoluciji, frazi i trajanju. Canvas rezultati su identični; WebGL rezultati imaju samo sitne razlike zaokruživanja (najveća prosječna greška kanala 0,002 na skali 0–255). Kod 15 stilova provjerena je i druga fraza, uključujući automatsku promjenu naglasaka i kontinuirane dekorativne faze. To nije garancija identičnih piksela na svim GPU-ovima i browserima.

Posljednjih šest bili su DOM/CSS prikazi. Njihov port sada mjeri izvorni raspored i `text-wrap: balance` pomoću nevidljivog DOM-a, a vidljive piksele crta kroz Canvas. Originalne krivulje ulaska, pomjeranje, aktivna riječ, sjene, podloge, boje i zamućenje računaju se iz vremena videa, pa povlačenje vremenske linije ne zavisi od prethodnog framea. 3D DEPTH koristi WebGL projekciju s izvornim uglovima i perspektivom. GLASS uzima trenutni kadar videa i zamućuje ga unutar pločice. Upoređeni su sa stvarnim originalnim CSS prikazom, uključujući prijelaze i završni raspored. CSS i Canvas mogu imati male razlike u rasterizaciji rubova, sjena i blur efekta; za tih šest ne tvrdimo matematičku jednakost svakog piksela.

Pri poređenju se u oba prikaza učitavaju originalni fontovi i Latin Extended znakovi. Originalni demo je učitavao samo osnovni dio fonta i mogao zadržati zamjenski oblik slova Č/Ć u cacheu; u Editi se to sprečava prije prvog crtanja. Dodatni referentni export nije potreban za ovaj ZIP.

Dekorativna scenografija šest CSS demonstracija (orb, mreža, naziv demonstracije) nije dio titla na korisnikovom videu. Opcionalna pozadina njihove kartice je neutralna; 16 grafičkih renderera zadržava svoju izvornu scenografiju kada se uključi pozadina reference.

Uvezeni autorski stilovi trenutno se pozicioniraju kao cjelina. Ne prikazuju izmišljene pojedinačne granice slova/riječi za povlačenje; izvorni raspored unutar fraze ostaje vezan uz originalni renderer. Precizna segmentna vremena iz Edite određuju granice prikazanih fraza, dok se autorski ulazak i izlazak vremenski uklapaju u njih.

## Integracija

- `config/captions/collection.ts`: izdvojeni katalog, originalni fontovi i postavke.
- `lib/collection/`: lokalne kopije renderera, materijala i Three.js 0.169.0; `runtime.mjs` povezuje njihove API-je. `studio-canvas.mjs`, `studio-layout.mjs` i `studio-depth.mjs` sadrže port šest CSS stilova, mjerenje tipografije i projekciju.
- `lib/collection-captions.ts`: prozirni sloj kroz postojeći `drawCaption`, priprema fontova, vremensko mapiranje i ograničen cache živih renderera.
- `CollectionStyleControls` i `CollectionSample`: postavke i galerija. Samo aktivni pregled pokreće animaciju; originalne sličice ne zauzimaju WebGL kontekste.
- `offline-export.ts`: priprema kolekcijske resurse prije prvog framea, uključujući odvojene stilove u projektu. Greška crtanja pri izvozu prijavljuje se umjesto tihog izvoza bez tog sloja.
- `person-mask.ts` / `CaptionCanvas.tsx`: dijele kadar izvornog videa s Glass slojem. `VideoCaptionLayer.tsx` osvježava i pauziran prikaz nakon učitavanja novog stila.
- `backend/studio/caption_presets.py`: novi ključevi i polja u postojećem formatu spremanja. Nema migracije baze.

Fontovi i licence su u `frontend/public/caption-collection`. Ne traže Google Fonts/CDN tokom crtanja. Nema `window.openai`, widget poruka, demo lokalnog spremanja, tuđih uploadova ili samostalnih animacijskih satova u prenesenom putu crtanja.

`scripts/import-caption-collection.mjs` reproducira mehaničko izdvajanje iz originala, bez izvršavanja izvornih demonstracija. `provenance.json` čuva SHA-256 izvora. Izvorne reference su ostale u raspakovanom direktoriju. Postojeći Node/Skia regresijski harness učitava novu registraciju, a browser kolekciju eksplicitno navodi kao nepokrivenu; ne predstavlja njeno preskakanje kao uspješan WebGL test.

## Lokalne provjere

- Puna frontend regresijska provjera, uključujući 116 ranijih stilova: prošla.
- Frontend lint i produkcijski build: prošli. Ostaju upozorenja za veličinu odvojenog grafičkog paketa i postojeći person-mask import; nisu greške izgradnje.
- Backend: 12 testova caption preseta, uključujući spremanje svih 22 nova stila i provjeru tipova postavki, prošlo u privremenoj memorijskoj bazi.
- Browser: 22/22 stvarno renderuje, prozirni sloj i ponovno traženje istog vremena provjereni. Odvojeno su poređeni izvorni rendereri i šest CSS adaptacija prema gore opisanom postupku.
- Svih 12 paleta na tri Hyper porodice i 8 Forged materijala daju zaseban prikaz; Glass provjeren sa sintetičkim video kadrom.
- Stvarni `offlineExport` / `drawCaption` izvezao je svih 22 u MP4: 52,8 sekundi, 736 × 414, 24 fps. Cijeli video dekodiran je bez greške.
- Stvarni editor na izoliranom lokalnom fixtureu prikazuje Kolekciju 01, native postavke i promjenu palete. Voltage nije u galeriji. Nijedan korisnički projekat nije mijenjan.

Dokazi su lokalno u `outputs/collection-01-qa/`: `report.json`, `extra.json`, `editor-final.png`, `css-comparison.png`, `css-motion-08.png`, `css-motion-15.png`, pojedinačna original/Edita poređenja, `kolekcija-01.mp4` i `export-contact-sheet.png`. Kontrolirani referentni pregled i testni server su u `work/collection-qa*` i `work/collection-css-qa.html`.

## Status objave

Samo lokalno. Drugi ZIP nije dostavljen u ovom koraku. Nema GitHub pusha, live objave ni izmjene korisničkih projekata.
