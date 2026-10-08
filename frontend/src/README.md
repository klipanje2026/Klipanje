# Organizacija frontenda

Frontend je **React + TypeScript + Vite + SCSS**. Početna je na `/`, editor titlova na `/titlovi`, a video editor na `/video-editor`.

```text
src/
  App.tsx                         # Rute aplikacije
  main.tsx                        # Ulaz i učitavanje stilova
  pages/
    HomePage/
      HomePage.tsx
      HomePage.scss
    SubtitleStudio/
      SubtitleStudio.tsx
      SubtitleStudio.scss
    VideoStudio/                  # Isti raspored za svaku stranicu
    AccountPage/
    ...
  components/
    SiteHeader/
      SiteHeader.tsx
      SiteHeader.scss
    CaptionShowcase/               # Slider: pomjeranje i kontrole
    CaptionShowcaseCard/           # Jedna kartica i prikaz titlova
    ProjectToolbar/
    ...
  config/
    home.ts                       # Sadržaj, redoslijed i stilovi slidera
    captions/
      types.ts                    # Tipovi postavki i ključevi stilova
      colors.ts                   # Zajednička paleta titlova
      presets.ts                  # Katalog stilova + početne postavke
      animations.ts               # Nazivi, trajanja, brzine i jačina animacija
      effects.ts                  # Grupe efekata: neon, kartica, itd.
      fonts.ts                    # Fontovi ponuđeni u editoru
  styles/
    _tokens.scss                  # Boje interfejsa i mobile mixin
    index.scss                    # Redoslijed učitavanja svih SCSS datoteka
    shared.scss                   # Reset i zajednički postojeći stilovi
    tailwind.css                  # Tailwind v4 se obrađuje odvojeno od Sassa
  context/                        # Kontekst prijave
  data/                           # Sadržaj ranijih marketinških stranica
  lib/                            # API, transkripcija, Canvas prikaz i pomoćne funkcije
```

## Gdje mijenjam izgled?

Aktuelni vizuelni smjer za **edita.ba** koristi lokalno uključen **Manrope Variable**, plavu `#3568bf` i neutralne bijele/sive površine. Ovo je privremena paleta do potvrde boja brenda. Font, akcentna boja i širina običnog sadržaja (`1400px`) podešavaju se u `styles/_tokens.scss`.

Slider je zaseban, širi blok do `1560px`, centriran s jednakim rubovima. Broj cijelih vidljivih kartica je 5 od `1400px`, 4 od `1100px`, 3 od `800px`, 2 od `520px` i 1 ispod toga. Te granice, razmak i širina uređuju se u `components/CaptionShowcase/CaptionShowcase.scss`. Strelice računaju stvarnu širinu kartice i razmak. Privremeno je prikazano deset kartica: dva seta po pet, s različitim identifikatorima. Slider, sekcija s koracima i footer koriste isti `wide-shell` mixin iz `_tokens.scss`, pa su njihovi vanjski rubovi poravnati na svim širinama.

- Početna, naslov, razmaci i dugmad: `pages/HomePage/HomePage.scss`.
- Logo i navigacija: `components/SiteHeader/`.
- Slider: `components/CaptionShowcase/`; izgled jedne kartice: `components/CaptionShowcaseCard/`.
- Glavne boje novog interfejsa: `styles/_tokens.scss`.
- Izgled editora titlova: `pages/SubtitleStudio/SubtitleStudio.scss`. Izdvojeni paneli imaju stilove u svojim komponentama.
- Slike početne: `frontend/public/images/home/`. Sadržaj kartica: `config/home.ts`.

Svaka stranica i izdvojena komponenta ima svoj folder i istoimene `.tsx` i `.scss` datoteke. Logičke komponente koje nemaju vlastiti vizuelni element imaju SCSS s komentarom; naslijeđeni zajednički stilovi ostaju u `shared.scss` ili vizuelnom roditelju.

Stilovi se učitavaju **jednom**, kroz `styles/index.scss`, pomoću `@use`. Kada dodaš novu komponentu, dodaj njen SCSS u taj spisak. Nemoj istovremeno uvoziti isti SCSS iz TSX-a. Tako redoslijed stilova ne zavisi od toga koju je stranicu korisnik prvu otvorio.

Za Sass varijable i mobile mixin u komponenti koristi:

```scss
@use '../../styles/tokens' as *;

.moja-komponenta {
  background: $white;
  color: $ink;
  @include mobile { padding: 16px; }
}
```

## Boje, stilovi i animacije titlova

`config/captions/presets.ts` je katalog svih 44 stila. Svaki ima stabilni `key`, naziv, primjer, kategoriju i početne postavke. Zajedničke boje su u `colors.ts`, a posebne kombinacije uz svoj preset. Izmjena palete ili preseta utiče na nove odabire; već spremljeni projekti zadržavaju svoje postavke.

`animations.ts` definiše izbor animacija, trajanja u sekundama, brzinu pulsa i jačinu pop efekta. `effects.ts` povezuje stilove s porodicama vizuelnih efekata.

**Titlovi u videu se crtaju na Canvasu.** SCSS uređuje interfejs; ne može mijenjati izgled titla u izvezenom videu. Za potpuno nov način iscrtavanja efekta mijenja se `lib/caption-renderer.ts`. Isti renderer koriste editor, primjeri i izvoz, pa ostaju usklađeni. Dodavanje nove vrste animacije zahtijeva i podršku u rendereru i tipovima; dodavanje stavke u meni samo po sebi nije dovoljno.

Link poput `/titlovi?style=duoElectric` otvara editor s tim stilom. Ako je potrebna prijava, odabir se prenosi kroz prijavu. Nepoznat ključ koristi zadani stil `focus`. Otvaranje spremljenog projekta učitava njegove postavke.

## Lokalni rad i provjere

Pokretanje ostaje isto: Django `python manage.py runserver` iz `backend/`, a React `npm run dev` iz `frontend/`. Portovi su **8002** i **5175**. Vite odmah prikazuje izmjene TSX-a i SCSS-a.

Iz korijena projekta: `npm run build`, `npm run lint`, `npm test`. Postojeće provjere pokrivaju transkripciju, raspored editora i prikaz svih 44 stila.

Slider automatski napreduje svake 3,5 sekunde dok je vidljiv. Pauzira na hover, fokus, kratko nakon dodira/pomjeranja, u skrivenom tabu i uz sistemsku opciju smanjenih animacija. Dugme pauze daje ručnu kontrolu. Kruženje koristi dva jednaka seta iz `config/home.ts`; pri zamjeni primjerima videa zadrži isti redoslijed u oba seta. Hover i fokus dodaju plavi obrub bez promjene širine kartice.
