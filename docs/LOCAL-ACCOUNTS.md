# Lokalni računi

Lokalna instalacija kreira račune Abdullah i Rijad s različitim privremenim lozinkama, zapisanim samo u ignorisani `.local/pocetne-prijave.txt`. Prvi ulazak obavezno otvara promjenu lozinke; korisnik bira svoju novu lozinku prije pristupa alatima. Ponovna instalacija ili GitHub pull ne resetuju postojeće račune. Javna registracija nije dostupna u lokalnoj aplikaciji.

Za prijavu se koristi **korisničko ime**, a ne prikazno ime. Lozinke se u bazi čuvaju kao hash; nije ih moguće pročitati kao izvorni tekst.

## Promjena zaboravljene lozinke

Na svom razvojnom računaru otvori `5-PROMIJENI-LOZINKU.cmd` u korijenu projekta. Upiši korisničko ime, pa novu lozinku dva puta. Pri unosu lozinke terminal ne prikazuje znakove. Zatim se prijavi novom lozinkom.

Isto se može uraditi iz foldera `backend` nakon aktiviranja Python okruženja:

```powershell
python manage.py changepassword KORISNICKO_IME
```

To mijenja lozinku postojećeg računa, bez brisanja projekata. Postojeće prijave tog računa mogu zahtijevati novu prijavu. Ovo je lokalni administratorski postupak; javni tok za reset lozinke emailom još nije implementiran.

Ako korisnik izričito zada privremenu lozinku za određenog korisnika, postavi je samo u lokalnoj bazi i uključi `LocalAccount.must_change_password`. Ne unositi tu lozinku u izvorni kod, dokumentaciju ili Git. To je jednokratna postavka za navedenu instalaciju, a ne pravilo za reset pri svakom pokretanju. Nakon uspješne promjene nova lozinka zamjenjuje privremenu.

## Lokacije

- `backend/studio/accounts.py`: registracija, prijava, odjava i provjera sesije.
- `backend/config/settings.py`: Django postavke provjere lozinki i sesija.
- `backend/db.sqlite3`: lokalni računi i podaci o projektima (nije u Gitu).
- `backend/media/`: datoteke projekata (nije u Gitu).
- `frontend/src/pages/AccountPage/`: React forma i njeni SCSS stilovi.

`localhost` i `127.0.0.1` koriste istu bazu preko ovog servera, ali preglednik ih tretira kao različite adrese za kolačiće. Koristi dosljedno `http://127.0.0.1:5175/`.
