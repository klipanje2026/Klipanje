# Edita — handoff za 13 animiranih titl stilova

Ovaj paket sadrži **13 odobrenih stilova** kao izvorni Node.js/JavaScript kod, tekstove s tajmingom i animirane 9:16 GIF preglede. Nema MP4, MOV, HTML, CSS ni font datoteka. Rendereri crtaju direktno na native Canvas; pozadina u GIF-u služi samo za pregled. U aplikaciji titlovi ostaju prozirni dok ih ne nacrtate preko video frejma.

## Brzi početak

1. Instalirajte Node.js 20+ i pokrenite `npm install` u ovom direktoriju.
2. Pokrenite `npm run verify`. Ovo nacrta po jedan prozirni frejm svih 13 stilova i provjeri GIF datoteke.
3. Otvorite `previews/` i odaberite stil. Svaki GIF je 432 × 768 na 25 fps; `impact` do `pressure` traju 9 s, `orbit` do `duet` 18 s, a pet korporativnih stilova 8 s.
4. Za integraciju otvorite `GPT_HANDOFF.md` zajedno s projektom Edita.

`npm run frame -- --style=axis --time=1.25` napravi prozirni PNG frejm. Za ponovni izvoz GIF-a instalirajte FFmpeg i pokrenite `npm run preview -- --style=axis`. Ako FFmpeg nije u `PATH`, postavite `FFMPEG_PATH`.

## Stilovi

| ID | Trajanje | Vizualni karakter | Konfiguracija |
| --- | ---: | --- | --- |
| `impact` | 9 s | Neon, odskok, snažan udar riječi | `data/captions.impact.json` |
| `impact-refined` | 9 s | Isti pokret, bijela, čelik i šampanjac | `data/captions.impact.json` |
| `cutout` | 9 s | Papirne kartice, pečati i rotacije | `data/captions.cutout.json` |
| `prism` | 9 s | Hromirano staklo, odsjaj i presjek riječi | `data/captions.prism.json` |
| `pressure` | 9 s | Reljefna slova, sudar i rastezanje | `data/captions.pressure.json` |
| `orbit` | 18 s | Kružni pokreti, sateliti i ekscentrična paleta | `data/captions.orbit.json` |
| `fault` | 18 s | Industrijski tip, snažni ulazi i segmentirani izlazi | `data/captions.fault.json` |
| `duet` | 18 s | Više fontova u istom titlu, odvojeni redovi | `data/captions.duet.json` |
| `axis` | 8 s | Editorial mreža i precizan bočni ulaz | `data/captions.corporate.json` → `axis` |
| `signature` | 8 s | Serif, zlatni potez i mekši dolazak | `data/captions.corporate.json` → `signature` |
| `momentum` | 8 s | Brz bočni ulaz, odjeci, energičan izlaz | `data/captions.corporate.json` → `momentum` |
| `ledger` | 8 s | Svijetla poslovna kartica i otkrivanje teksta | `data/captions.corporate.json` → `ledger` |
| `signal` | 8 s | Tehnički panel i horizontalni segmenti riječi | `data/captions.corporate.json` → `signal` |

## Integracijski API

```js
import * as native from '@napi-rs/canvas';
import { createCaptionPreset, presetIds, getPresetData } from './src/index.mjs';

const preset = createCaptionPreset({ id: 'momentum', native }); // napraviti jednom
const ctx = native.createCanvas(1080, 1920).getContext('2d');

// Aplikacija prvo nacrta svoj video frejm na ctx.
// draw() dodaje samo animirani titl za dati trenutak u sekundama.
preset.draw(ctx, 1.25, { width: 1080, height: 1920 });

// Opcionalno: oslobodi keširane oblike, npr. nakon promjene dimenzija.
preset.clearCache();
console.log(presetIds, getPresetData('momentum'));
```

`draw(ctx, timeSeconds, viewport?)` prima **vrijeme u sekundama od početka titl-timelinea**. Rezultat je metapodatak aktivnog titla ili `null` kada nema titla. Funkcija ne briše postojeći video frejm. Za transparentan export nacrtajte titl na zaseban prazan RGBA Canvas, pa ga spojite s videom pri izvozu.

Za vlastiti tekst proslijedite `cues` pri kreiranju preseta. Kada se tekst ili tajming promijeni, **kreirajte novu instancu renderera**; samo `clearCache()` ne mijenja prethodno učitane titlove. Zadržite polja za efekat, boju, raspored i tajming iz primjera u `data/` jer se struktura razlikuje po stilu. Posebno: `duet` koristi `rows` i `runs` za različite fontove unutar istog titla; pet korporativnih stilova koristi `headline` kao niz fontskih segmenata. `impact-refined` koristi iste rečenice kao `impact`, uz drugu paletu.

## Fontovi i prenosivost

Mac primjeri koriste sistemske fontove navedene u `src/index.mjs`. Font fajlovi nisu uključeni. Na drugom sistemu proslijedite `fontPaths`, npr. `{ impact: '/putanja/Impact.ttf' }`, ili `fontFamilies` ako je aplikacija već registrovala font. Za `duet` i korporativne stilove moguće je proslijediti `theme.fonts`; za ostale `theme.fontFamily`.

Ključevi za fontove su `impact`, `black`, `rounded`, `sans`, `serif`, `hand`, `condensed` i `mono`. Ako font nije dostupan, paket javlja jasno ime nedostajućeg fonta. Tekst na B/H/S jeziku treba provjeriti nakon zamjene fontova jer neki fontovi nemaju sva slova.

## Struktura

- `src/index.mjs` — jedan ulaz za svih 13 stilova.
- `src/*-engine.mjs` — originalni kod animacije; nema HTML-a ni CSS-a.
- `data/*.json` — primjeri teksta, efekata i tajminga.
- `previews/*.gif` — potpuni 9:16 animirani pregledi.
- `examples/render-frame.mjs` — izvoz jednog prozirnog frejma.
- `tools/render-gif.mjs` — ponovni izvoz pregleda pomoću FFmpeg-a.
- `tools/verify.mjs` — osnovna provjera svih preseta.

Paket je samostalan za rad s rendererima. Integraciju u stvarni Edita projekat treba uraditi u njegovom repozitoriju, prema `GPT_HANDOFF.md`.
