# Rijad — instalacija na trećem računaru

Dogovor od 11.10.2026: razgovor koji je korisnik odredio za Rijada koristi se za pripremu aplikacije na drugom poslu, na trećem računaru. Instalacija počinje kada korisnik u tom razgovoru zatraži „povuci izmjene sa GitHuba”.

Repozitorij je **https://github.com/klipanje2026/Klipanje.git**, grana `main`. Zadržati postojeću Klipanje aplikaciju, njen izgled, Editin player, timeline i zajednički renderer.

## Prva instalacija

1. Provjeri na kojem računaru radiš i postoji li lokalna Klipanje instalacija. Ako ne postoji, kreiraj projektni folder `Klipanje App` u korisnikovom folderu Documents i kloniraj navedeni repozitorij. Putanju prilagodi stvarnom korisniku računara; nemoj pretpostaviti da je njegov Windows profil Budad.
2. Provjeri Python 3.12+ i Node.js 22.13+, pa koristi `1-INSTALIRAJ.cmd` / `scripts/setup.ps1`. To priprema zavisnosti, root `.env`, migracije, početne lokalne račune i workspace foldere.
3. Zatraži korisnikov OpenAI API ključ i ElevenLabs API ključ ako na tom računaru nedostaju. Spremi ih samo u tamošnji root `.env`, bez prikazivanja vrijednosti u izvještaju ili upisivanja u praćene datoteke. Ne preuzimaj ključeve ili baze iz arhiva ili s drugog računara.
4. Pripremi lokalni račun **Rijad** s vlastitim workspaceom. Za tu prvu instalaciju korisnik je u Rijadovom razgovoru zadao privremenu lozinku; upotrijebi je iz dostupnog razgovora, nikada iz dokumentacije. Ako taj razgovor nije dostupan, zatraži novu privremenu lozinku ili koristi lokalno generisanu početnu prijavu. Uključi `LocalAccount.must_change_password=True`. Rijad pri prvom ulasku bira svoju novu lozinku; kasniji pull ne vraća privremenu lozinku.
5. Pokreni `node scripts/backend.mjs sync_workspace`. Struktura je `workspace/Rijad/Naziv projekta/`, s `projekat.json`, `skripte.json` i `mediji/`. Naslovi zadržavaju razmake i bosanska slova; nedozvoljeni znakovi se prilagođavaju Windowsu, a duplikati dobijaju `(2)`, `(3)`. Postojeći UUID folderi prelaze na naziv projekta uz očuvanje kopija. Ne kreiraj demo projekte ili reference.
6. Pokreni aplikaciju kroz `3-POKRENI.cmd` / `scripts/dev.mjs`, uz skriveni prozor ako se pokreće u pozadini. Provjeri dostupnost početne na `http://127.0.0.1:5175/` i backenda na `http://127.0.0.1:8002/api/health`, te obaveznu prvu promjenu lozinke bez njenog mijenjanja u ime korisnika. Ne pokreći plaćeno AI generisanje kao provjeru.

## Kasnije „povuci sa GitHuba”

- Koristi postojeći lokalni checkout i navedeni origin. Provjeri lokalne izmjene prije pulla; sačuvaj ih i ne koristi prisilni reset, clean ili prepisivanje.
- Preuzmi objavljene izmjene sa `main`, osvježi zavisnosti kada se promijene njihove zaključane verzije, primijeni migracije i osvježi workspace komandom `sync_workspace`.
- Sačuvaj root `.env`, postojeću bazu, korisničke lozinke, `backend/media/` i `workspace/`. Ne traži ponovo već postavljene ključeve. Ne resetuj Rijadovu prijavu.
- Po potrebi ponovo pokreni samo procese ove Klipanje instalacije i provjeri dostupnost. Nemoj automatski implementirati stavke iz `PRIJEDLOZI.txt`.

GitHub prenosi objavljeni kod i dizajn. Lokalni projekti, mediji, računi i ključevi ne putuju s pullom; svaki računar ima vlastite podatke. Za potpunu jednakost aplikacije sve željene dorade moraju prethodno biti objavljene s izvornog računara uz korisnikovo odobrenje. Ovaj dogovor sam po sebi ne daje odobrenje za commit ili push.
