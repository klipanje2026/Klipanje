# Prism Fold — novi stil i pregled funkcija

Implementirano lokalno 1. oktobra 2026. Testovi, build, browser provjera i objava nisu pokrenuti, prema `LOCAL_CHANGES.md`.

## Gdje se nalazi

U oba editora: **Titlovi → Stilovi → Dynamic → Prism Fold**. Stil je zaseban; ne pripada Neon Riot kolekciji i ne mijenja postojeće stilove.

Prism Fold prikazuje biserni tekst na poluprozirnim staklastim pločicama sa zakošenim uglovima. Svaka pločica otvara se u vertikalnim trakama, uz blagi odraz i svjetlosni prelaz. Riječi dolaze prema vremenu govora, a duga fraza prelazi u sljedeći red. U pitanju je Canvas simulacija dubine, a ne 3D model.

U postavkama tog stila nalaze se broj riječi, broj traka, jačina i razmak otvaranja, brzina svjetlosnog prelaza, dvije boje i boja stakla, osvijetljeni rubovi i odraz. Postojeće kontrole za materijal, refleksiju, odsjaj, trajanje i krivulju pokreta također učestvuju u crtanju. Promjena vremena na timelineu određuje isti položaj animacije u pregledu i izvozu.

## Šta je novo, a šta je preuzeto iz Edite

Neon Riot je prvobitno imao vlastiti model kretanja, a ne Editine presete Pop/Fade/Pulse. Koristio je postojeći sistem titlova, fontova, položaja, odabira, kartica, spremanja i video izvoza. Njegova grafika i putanje slova napisane su posebno i podijeljene između Node demo skripte i aplikacije.

Prism Fold direktno ponovo koristi tri postojeće funkcije:

| Funkcija | Uloga |
| --- | --- |
| `captionEase` | Usporavanje i krivulja otvaranja traka |
| `drawTextSurface` | Materijal, osvjetljenje, bevel i refleksija na slovima |
| `drawTextShine` | Animirani odsjaj, ograničen na samu površinu slova |

Samo crtanje pločice i njeno otvaranje u trakama su novi. Nema CSS animacije teksta i nema AI poziva pri crtanju.

## Koliko funkcija

Brojevi ispod računaju **imenovane funkcije u navedenim renderer datotekama**, uključujući imenovane pomoćne funkcije i metode. Ne računaju anonimne callbackove, React komponente, standardne Canvas API pozive ili sve funkcije u ostatku Edite.

Neon Riot jezgra ima **18 funkcija** nakon ovog proširenja:

| Funkcije | Broj | Uloga |
| --- | ---: | --- |
| `clamp`, `easeOut`, `smooth`, `spring`, `random` | 5 | Ograničenja, krivulje kretanja i ponovljive čestice |
| `rgba`, `mix` | 2 | Prozirnost i miješanje boja |
| `roundRect`, `star`, `makeGlyph`, `drawWord`, `drawBurst` | 5 | Kutije, zvjezdice, slojevita slova, riječi i čestice |
| `fontFor`, `measureWord`, `prepareWord`, `clearCache` | 4 | Font, mjerenje i ponovno korištenje nacrtanih slova |
| `createNeonRiotPainter`, `riotGlyphPose` | 2 | Sastavljanje renderera i dijeljeni izračun šest pokreta |

Prism Fold renderer ima **10 imenovanih funkcija**: `limit`, `number`, `ink`, `surface`, `context`, `prismFoldRevision`, `glassPath`, `paintPrismTile`, `foldTile`, `drawPrismFold`. Tri gore navedene postojeće funkcije se uvoze i nisu uključene u tih deset.

## Kako isprobati posebno napisane efekte

**Na bilo kojem stilu:** otvori kontrole stila i **Dodatni pokret**. Šest dostupnih pokreta su elastični odskok, klizanje, val, okret, zumiranje i neonski trzaj. Dodaju se na **cijeli titl**; njegovo postojeće crtanje i animacija ostaju osnova. Obojeni tragovi i čestice imaju zasebne prekidače, boje i postavke. Dugme „Isključi dodatne efekte” isključuje sva tri dodatka. Ove opcije su po zadanim postavkama isključene, tako da stari stilovi zadržavaju izgled.

**Na Neon Riotu:** isti izračun pokreta i dalje radi **slovo po slovo**. Uz ranije dostupnu paletu, kutije i podvlačenje, sada su dostupne grupe:

- **Odskok i tragovi:** brzina smirivanja, oscilacije, nagib, plutanje, trajanje izlaska, vidljivost i dvije boje tragova.
- **Čestice i izgled:** broj, rasipanje i trajanje čestica, zaobljenje kutije, debljina, trajanje i boja linije, preljev slova i sjaj ruba.

Mjerenje, cache i matematičke pomoćne funkcije nemaju posebne UI prekidače jer služe radu renderera. Podešavaju se vizualni parametri koje te funkcije koriste.

## Kako je povezano

1. `config/captions/types.ts` i `presets.ts` registruju `prismFold` i njegove postavke. Neon Riot zadržava svojih 20 ključeva.
2. `lib/prism-fold.ts` crta novi stil kroz postojeći `drawCaption` poziv. Kartice, oba editora i video izvoz koriste taj isti ulaz.
3. `lib/neon-riot-core.mjs` izlaže `riotGlyphPose`; Neon Riot i novi `lib/caption-accent-motion.ts` dijele taj izračun. Dodatni pokret koristi prozirni sloj titla, bez promjene originalnog videa.
4. `PrismFoldControls`, `NeonRiotControls` i `CaptionAccentControls` upisuju stvarne postavke renderera. Postavke nisu samo prikaz u sidebaru.
5. Backend `studio/caption_presets.py` prihvata novi stil i nova polja u postojećem JSON formatu predložaka. Nije potrebna nova tabela ni migracija.
6. Animirani cache koristi 60 vremenskih koraka u sekundi za ove efekte. Broj frameova izvezenog videa i dalje određuju njegove opcije izvoza/izvor.

Provjera objave odobrena je 1. oktobra 2026. Prošli su frontend regresijski testovi (116 stilova), lint, produkcijski build, 106 backend testova i četiri testa objave. Regresije uključuju prozirnost, animaciju, premotavanje, promjenu palete, isključene dodatne efekte i spremanje/učitavanje. Performanse na pojedinačnim korisničkim uređajima nisu posebno mjerene.
