# Klipanje + EffectCraft + VideoGen

Repozitorij sadrži sva tri alata i njihove veze. Suno/Muzički studio nije dio paketa.

## Instalacija i pokretanje na Windowsu

1. Instaliraj Python 3.12+ i Node.js 22.13+.
2. Preuzmi cijeli repozitorij i pokreni `1-INSTALIRAJ.cmd`. Instalira Klipanje i zasebno VideoGen okruženje. EffectCraft je uključen kao gotov web alat s licencama.
3. Pokreni `9-POKRENI-PAKET.cmd` za sva tri alata. Postojeći serveri ostaju pokrenuti; otvoreni editor se ne osvježava.
4. Klipanje: http://127.0.0.1:5175 — EffectCraft: http://127.0.0.1:5175/slike-s-pokretima — VideoGen: http://127.0.0.1:5176.

`3-POKRENI.cmd` ostaje pokretanje samo Klipanja i ugrađenog EffectCrafta. `7-VIDEOGEN.cmd` pokreće samo VideoGen. Pokretanje paketa ne pokreće generisanje videa niti objavljuje GPU workere. VideoGen servere zaustavlja `apps/VideoGen/scripts/stop.ps1`; prozor pokrenut kroz `3-POKRENI.cmd` zatvara se pomoću Ctrl+C. Zajednički launcher radi u pozadini; njegov Klipanje proces zapisan je u `.local/package/process.txt`.

## Prenos rezultata

- U VideoGenu odaberi **Poveži Klipanje projekat**, zatim projekt i skriptu. Prihvaćene videe iz galerije prenesi pomoću **Prebaci u Klipanje**. Već generisani video možeš naknadno povezati. U Klipanju je dostupna i `/videogen-galerija`.
- U **Slike s pokretima** odaberi projekt i skriptu. EffectCraft koristi kompatibilni prikaz. Završene izvoze čuva lokalna biblioteka; obradi video kroz **Prilagodi i spremi**, pa prenesi u medije odabrane skripte.
- Izvorni mediji i spremljena montaža se ne zamjenjuju samim povezivanjem alata.

## Postavke i podaci

OpenAI/ElevenLabs ključevi koriste samo korijenski `.env`. VideoGen također čita taj `.env`; zasebna prijava na Modal podešava se lokalno kroz njegov izbor računa. Za stvarno GPU generisanje potreban je vlastiti Modal račun i odgovarajući workeri; instalacija sama ne aktivira plaćeno generisanje. Upute za workere su u `apps/VideoGen/README.md`.

Baze, korisnici, prijave, snimci, projekti, izlazni folderi, ZIP arhive i instalirane biblioteke nisu na GitHubu. Novi računar dobija programe, ne kopiju privatnih projekata. Prilikom ažuriranja ne briši lokalni `.env`, baze, `workspace`, `backend/media`, VideoGen `media` ili `.runtime`. EffectCraft radovi ostaju i u podacima preglednika; ne briši ih pri ažuriranju.

EffectCraft 0.9.2 je uključen s MIT/Apache licencama i evidencijom lokalnih prilagodbi u `frontend/public/effectcraft/0.9.2`. Lični `*-job` folderi nisu dio distribucije. Privatni staging konektor nije dio ovog paketa.
