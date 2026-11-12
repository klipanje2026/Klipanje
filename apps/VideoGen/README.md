# VideoGen

Lokalni React + Django studio, uključen u Klipanje paket. Baza i mediji ostaju na računaru; GPU generisanje koristi vlastiti Modal račun.

## Instalacija

Iz korijena cijelog repozitorija pokreni `1-INSTALIRAJ.cmd`, zatim `9-POKRENI-PAKET.cmd`. Za zasebno pokretanje koristi `7-VIDEOGEN.cmd`. VideoGen je na http://127.0.0.1:5176 (backend 8003). Klipanje je na portu 5175.

Instalacija ne uključuje privatne projekte, historiju, tokene ni generisane snimke. Na postojećoj instalaciji podaci ostaju sačuvani. `scripts/stop.ps1` zaustavlja VideoGen servere pokrenute njegovim launcherom.

## Generisanje i povezivanje

Kroz radnu sobu poveži Klipanje projekt i skriptu. Odaberi model, sliku, prompt i trajanje. Prihvaćene snimke iz galerije prenesi dugmetom Prebaci u Klipanje. Snimak koji je nastao prije povezivanja može se naknadno prenijeti.

Ključevi OpenAI/ElevenLabs čitaju se samo iz korijenskog `.env` cijelog Klipanje paketa. `VIDEOGEN_ALLOW_PAID=1` omogućava stvarne poslove nakon lokalne konfiguracije; podrazumijevano su isključeni. Modal prijava je lokalna i nije u repozitoriju. Račun se bira u VideoGen aplikaciji.

## Workeri

`gpu/` sadrži Modal workere za modele ponuđene u katalogu. Na novom Modal računu objavi potrebne workere iz VideoGen foldera, npr. `.venv\Scripts\python.exe -m modal deploy gpu/modal_app.py`. Ostali moduli su `lab_app.py`, `realism_app.py`, `pose_app.py` i `ltx25_app.py`; svaki ima vlastite postavke i zavisnosti u izvoru. Za modele s ograničenim pristupom potreban je odgovarajući Hugging Face pristup i Modal secret naveden u modulu. Koristi izabrani vlastiti Modal profil. Instalacija i launcher ne objavljuju workere niti pokreću plaćene poslove.

Postojeći workeri na računu nisu dio GitHub kopije, kao ni model cache. Stvarni GPU poslovi i pohrana naplaćuju se prema tom računu. Lokalni prikaz potrošnje je procjena, ne račun pružaoca usluge.

Detalji zajedničkog paketa: `../../docs/POVEZANI-PAKET.md`.
