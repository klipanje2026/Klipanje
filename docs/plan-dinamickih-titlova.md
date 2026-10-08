# Edita: naredne faze razvoja

Prijedlog od 15. 9. 2026. Rad nastavljamo lokalno; ovaj dokument ne aktivira nove servise niti objavu na produkciju.

## 1. Dinamični titlovi — prvi isporučivi korak

Primjer: „Danas pravimo odličan video.“ Svaka riječ ima početak i kraj izgovora. U režimu postepenog prikaza riječ je skrivena do svog početka, kratko animira ulazak i ostaje vidljiva do kraja fraze. Raspored se računa za cijelu frazu unaprijed, tako da dodavanje riječi ne pomjera prethodne riječi.

Postojeća osnova:
- `backend/studio/transcription.py` traži vremena pojedinačnih riječi od Scribea.
- `frontend/src/config/captions/types.ts` čuva vremena, položaj scene i stil/položaj pojedinih riječi.
- `frontend/src/lib/caption-renderer.ts` crta kartice, pregled i izvoz.
- Hover u `CaptionSample.tsx` trenutno posebno zadaje `wordPreview` i smjenjuje pop/fade/pulse. Pregled stvarnog videa taj parametar ne koristi. To treba sjediniti u trajnu postavku animacije; ne pretpostaviti da svaka animirana kartica već predstavlja izvezeni rezultat.

Razdvojiti tri postavke koje korisnik može kombinovati:
1. **Izgled:** font, veličina, boja, rub, sjena i pozadina.
2. **Prikaz:** cijela fraza, riječi se dodaju i ostaju, samo trenutna riječ, fraza s naglašenom aktivnom riječi.
3. **Animacija:** bez animacije, pop, fade, kratki pomak; trajanje i jačina. Animacija riječi i ulazak cijele fraze su odvojene stvari.

Prvi paket: postepeni pop, postepeni fade i naglašavanje aktivne riječi. Svaki stil dobiva stvaran, stabilan primjer svoje animacije na hover. Animaciju računati iz vremena videa, ne iz broja proteklih intervala, tako da pause, seek i izvoz daju isti kadar.

Uslovi prihvatanja:
- Pregled kartice, titl na videu i izvezeni video pokazuju istu izabranu dinamiku.
- Riječi prate stvarni govor, ostaju na mjestu i pravilno se ponašaju u pauzama.
- Skok na sredinu snimka odmah daje ispravnu sliku; skriveni editor ne vrti nepotrebne animacije.
- Stilovi i pojedinačni položaji ostaju sačuvani nakon ponovnog otvaranja projekta.
- Stari projekti zadržavaju postojeće ponašanje kroz podrazumijevane vrijednosti/verziju podataka.
- Ispravka teksta zadržava pouzdano vezane riječi; dodavanje/brisanje riječi ne smije tiho dodijeliti tuđe vrijeme ili stil. Nepouzdana vremena označiti za podešavanje ili ponovno poravnanje sa zvukom.
- Provjeriti brz i spor bosanski/hrvatski/srpski govor, interpunkciju, duže riječi, č/ć/š/ž/đ, različite formate i duži izvoz.

## 2. Poznat raspored editora i preciznije uređivanje

Zadržati Editine boje i komponente. Lijeva traka: Mediji, Titlovi, Tekst, Zvuk, AI video. Pored nje se otvara odabrani alat; video je u sredini, vremenska linija ispod. Unutar Titlova: Tekst, Stilovi, Animacija, Pozicija. Ne dodavati stalno otvoren treći veliki panel koji smanjuje video.

Postepeno dodati: grupisanje u kratke fraze prema pauzama/interpunkciji i širini videa, prelom reda, podešavanje vremena riječi, odabir svih/scena/riječ, undo/redo i spremljene vlastite stilove. Već postojeće drag-and-drop kontrole doraditi umjesto pravljenja paralelnih kontrola. Za napredne pokrete kasnije dodati ključne kadrove položaja, veličine i rotacije.

Za svaku korisnikovu referencu prvo definirati ponašanje: koje riječi se vide, kada ulaze, šta ostaje, kako nestaju. Screenshot određuje izgled; kratki snimak bolje određuje kretanje. CapCut je referenca za poznat tok rada, Edita zadržava vlastite komponente i vizuelni identitet.

## 3. Google prijava

Dugme „Nastavi s Googleom“ na prijavi i registraciji. Django provjerava Google ID token i uspostavlja postojeću Edita sesiju. Identitet vezati za Google `sub`, ne samo za email. Postojeći račun povezati uz dokaz vlasništva; ne praviti duple korisnike, projekte ili početne tokene. Admin status nikada ne proizlazi iz samog Google profila. Zadržati prijavu emailom i lozinkom.

Potrebna je Google Cloud OAuth konfiguracija za lokalnu i produkcijsku adresu. Kasnije po potrebi Apple/Facebook kroz isti model povezanih identiteta.

Izvor: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## 4. AI video — Kling, zatim Seedance

Koristiti službene API-je; modeli se ne preuzimaju u React aplikaciju. Napraviti jedan Edita interfejs koji prikazuje samo mogućnosti odabranog modela i zasebne serverske integracije za dobavljače.

Prvi ekran: model, opis videa, referentni materijali, format, trajanje, kvalitet, zvuk, procjena potrošnje i dugme Generiši. Prvi radni tok je slika + opis → video; zatim kontrola pokreta iz videa i složenije reference.

Kling Motion Control dokumentacija potvrđuje sliku izgleda + video pokreta, izbor orijentacije i zvuka, asinhroni posao s ID-em, provjeru statusa i callback. Seedance dokumentacija potvrđuje tekst/slike/video/audio reference i zasebne mogućnosti po modelu. Limite i dostupnost provjeriti za konkretan račun/model prije implementacije, ne obećavati iste opcije za sve.

Posao čuvati u Django bazi s vlasnikom, modelom, ulazima, vanjskim ID-em, stanjem i evidencijom potrošnje. Obradu voditi iz trajnog pozadinskog radnika, ne iz otvorenog taba. Provjeriti podršku hostinga ili radnika smjestiti odvojeno. Osvježavanje stranice ne smije ponovo kreirati generaciju. Duple callbacke obraditi bez duplog terećenja. Nakon nejasnog prekida prvo uskladiti status s dobavljačem prije novog zahtjeva ili povrata.

Korisniku prikazati stvarno stanje posla, ne izmišljeni procenat. Rezultat preuzeti u privatni R2 prostor vlasnika, ponuditi „Dodaj u video“ i „Dodaj titlove“. Referencama dati vremenski ograničene linkove dovoljne za preuzimanje kod dobavljača; ne otvarati cijeli bucket.

AI generacije trebaju poseban obračun prema stvarnoj cijeni modela/trajanju/kvalitetu; postojeće pravilo 1 minuta = 1 token ne primjenjivati automatski. Prije slanja rezervisati potreban iznos i spriječiti dvostruko terećenje; završni obračun vezati za potvrđeni rezultat i pravila dobavljača.

Izvori pročitani 15. 9. 2026:
- https://kling.ai/document-api/api/video/motion-control
- https://kling.ai/document-api/guides/get-started/overview
- https://docs.byteplus.com/en/docs/Byteplus_LAS/video_gen_enhanced
- https://www.capcut.com/help/batch-edit-to-recognize-subtitle

## Sljedeća sesija

Početi od tri stvarna dinamična režima i njihovog izvoza na postojećem videu. Zatim prema referencama doraditi panel Animacija i raspored. Google prijava ide prije javnog širenja; AI generacija poslije pouzdanih titlova i evidencije troškova.
