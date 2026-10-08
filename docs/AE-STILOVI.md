# After Effects predložak → Edita stil

Ove upute služe da od poslanog AEP projekta napravimo novi, ponovo upotrebljiv stil titlova u Editi. Preuzimamo izgled i ponašanje; tekst dolazi iz korisnikovih titlova. Ovo je pripremljen postupak za rad na kodu, a ne dodan AEP upload u aplikaciju.

## Kako tražiti novi stil

Pošalji `.aep` fajl ili njegovu lokalnu putanju i napiši, naprimjer:

> Napravi Edita stil od ovog AEP-a prema našim AE uputama. Zadrži izgled i animacije, a tekst neka bude moj. Stil nazovi „Naziv stila“.

Ako projekat sadrži više različitih predložaka, navedi željenu kompoziciju ili pošalji kratki preview. Ako ne navedeš ime, agent predlaže opisno ime. Korisni su i korišteni fontovi, povezani materijali i video koji prikazuje cijeli ulazak, mirovanje i izlazak. Njih ne tražimo ponovno ako su već dostupni.

## Šta bilježimo

| Dio stila | Podaci koje izdvajamo |
|---|---|
| Slova | Font, rez/debljina, veličina, razmak, redovi, poravnanje i kombinacije fontova |
| Boje | Jedna ili više boja, gradijenti, raspored po riječima/slovima/redovima i aktivna riječ |
| Rubovi i sjene | Svaki stroke i shadow zasebno, boja, debljina, smjer, pomak, zamućenje i prozirnost |
| Box i oblici | Pozadina, padding, radius, border, veličina prema tekstu i zasebna animacija |
| Kretanje | Položaj, skala, rotacija, anchor, opacity, ulazak, mirovanje, izlazak, ponavljanje i kašnjenje po riječi/slovu |
| Ritam | Keyframeovi, ubrzavanje/usporavanje, overshoot i odnos prema vremenu govora |
| Slojevi | Redoslijed, parent veze, maske, matte, blend i animirani pomoćni slojevi |
| 3D i efekti | Dubina, bevel, materijal, osvjetljenje, kamera i potrebni pluginovi |
| Prilagođavanje | Drugačiji tekst, duži red, dijakritika, kraći/duži titl i različiti formati videa |

Originalne rečenice, logotipi i tekst iz predloška ne postaju sadržaj novog stila. Zadržava se pravilo, naprimjer „aktivna riječ je žuta“, a ne konkretna riječ iz predloška. Ako je neko slovo ručno oblikovano ili pretvoreno u obrise, evidentira se da je za proizvoljan tekst potrebna prilagodba.

## Kako čitamo AEP

`.aep` je binarni projekat. Kad je dostupan After Effects, projekat se otvara i podaci se izdvajaju kroz njegov scripting interfejs; preview služi za poređenje. `.aepx` može pomoći u analizi, ali ni XML kopija ne izlaže sve podatke kao običan tekst.

Ako AEP nije moguće otvoriti, agent evidentira šta nedostaje i traži konkretan izvoz iz After Effectsa ili preview. Vrijednosti procijenjene iz videa označava kao procjenu. Ne tvrdi da je pročitao nečitljiv AEP i ne obećava identičan rezultat na osnovu jedne slike. Za sada nije dodan izvršivi AE izvoznik.

## Rezultat za svaki predložak

1. `docs/caption-styles/<style-id>.style.json` — opis originalnog dizajna bez izvornog teksta, prema shemi ispod; odvojene očitane vrijednosti i odluke o prilagodbi.
2. `docs/caption-styles/<style-id>.md` — pregled onoga što je preneseno, razlika, zavisnosti i stanja provjere.
3. Novi stil i potrebne dopune u Edita kodu, sa zajedničkim prikazom u oba editora i izvozu. Naziv i identitet stila ostaju stabilni kada korisnik mijenja tekst.

Izvorni AEP, sirovi izvozi, fontovi i snimke za poređenje drže se u lokalnom `work/aep/<style-id>/` ili na korisnikovoj postojećoj lokaciji. U projektne upute i javne resurse ne kopira se cijeli predložak.

Ograničenja se navode po efektu: **postojeća podrška**, **dopuna renderera**, **približan prikaz**, **nepodržano** ili **još nepoznato**. Renderovana animacija s fiksnim tekstom nije zamjena za stil koji prihvata korisnikove titlove.

## Datoteke postupka

- [Upute za agenta](skills/ae-caption-style/SKILL.md)
- [Značenje polja i pravila izdvajanja](skills/ae-caption-style/references/style-spec.md)
- [JSON Schema](skills/ae-caption-style/references/style-spec.schema.json)
- [Početni zapis za novi stil](skills/ae-caption-style/assets/style-spec.template.json)
- [Veza s postojećim Edita kodom](skills/ae-caption-style/references/edita-mapping.md)

Provjere i objava prate trenutni dogovor iz `LOCAL_CHANGES.md`. Neprovjeren stil se tako i označava; kreiranje stila samo po sebi ne podrazumijeva objavu live.
