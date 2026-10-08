# Čišćenje projekta — 9. septembar 2026.

Aktivna aplikacija ostaje u `frontend/` i `backend/`. Pomoćne komande su u `scripts/`, a upute u `docs/` i pripadajućim README datotekama.

Uklonjeno iz radne strukture:

- `legacy-sites/`: 77 datoteka upoređeno je po sadržaju s `backups/pre-django-2026-09-09.zip`; sve su identične. Jedina dodatna migracijska skripta sačuvana je u novoj arhivi prije uklanjanja foldera.
- Neupotrebljavana stara `MarketHome` stranica, komponenta `SelectedWork`, njihovi SCSS stilovi i `data/content.ts`.
- Partnerski logotipi i stari društveni preview resursi koje aktivna aplikacija ne koristi.
- Jednokratne skripte za migraciju i preuređenje iz `work/`.
- Prazan stari `frontend/src/ui/` folder.
- Duplirane pune upute: `PROCITAJ-PRVO.md` sada upućuje na glavni README.

Uklonjene jedinstvene datoteke sačuvane su u lokalnoj, provjerenoj ZIP arhivi `backups/cleanup-20260909-152022.zip`. Arhive se ne šalju u Git.

Zadržani su `backend/db.sqlite3`, `backend/media/`, `.env`, instalirane zavisnosti i aktivne podstranice `/book`, `/services/:slug`, `/work/:slug`, `/privacy` te administratorski CRM. Njihov kod nije duplikat nove početne. Django migracije su potrebne za instalaciju baze i nisu uklanjane.

`work/` i `outputs/` su ignorisani razvojni izlazi; testovi ih ponovo koriste. Njihove postojeće provjere i pregledne slike ostaju dostupne. `.venv` i `node_modules` su potrebni za trenutno lokalno pokretanje.
