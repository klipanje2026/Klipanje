# Lokalna instalacija: šta unijeti u `.env`

Koristi **jedan `.env` u korijenu Klipanje paketa**, pored `package.json`. `1-INSTALIRAJ.cmd` ga priprema prema `.env.example`; `node scripts/init-env.mjs` priprema lokalni Django ključ ako nedostaje. Stvarni `.env` se ne šalje na GitHub.

## Podaci koje dostavlja vlasnik novog računara

| Podatak | Kada je potreban | Gdje se unosi |
| --- | --- | --- |
| Vlastiti OpenAI API ključ | AI skripte, slike i druge OpenAI obrade | `OPENAI_API_KEY` |
| Vlastiti ElevenLabs API ključ | Generisanje naracije i druge ElevenLabs obrade | `ELEVENLABS_API_KEY` |
| Vlastiti Modal račun/profil | VideoGen GPU generisanje | Lokalna Modal prijava i izbor računa u VideoGenu; nije Klipanje lozinka |
| Pristup ograničenom modelu, ako ga izabrani model traži | Samo takvi VideoGen modeli | Lokalno podešavanje/Modal secret prema `apps/VideoGen/README.md` |

Bez OpenAI i ElevenLabs ključeva možeš pisati skripte, uvoziti svoje slike, videe i zvukove, montirati, koristiti EffectCraft i izvoziti. ChatGPT pretplata ne zamjenjuje OpenAI API ključ. Ne treba slati ključeve uz GitHub kod, README ili snimke ekrana.

## Postavke koje instalacija priprema

| Varijabla | Lokalna vrijednost / smisao |
| --- | --- |
| `DJANGO_SECRET_KEY` | Instalacija generiše nasumičan ključ za ovaj računar. Sačuvaj ga pri ažuriranjima. |
| `DJANGO_DEBUG` | `true` za lokalni Klipanje razvojni server. |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost` |
| `CSRF_TRUSTED_ORIGINS` | `http://127.0.0.1:5175,http://localhost:5175` za Klipanje; mijenjati samo ako mijenjaš njegov port. |
| `OPENAI_MODEL` | `gpt-4.1-mini` u primjeru; opcionalni zadani tekstualni model, nije ključ. |
| `STORAGE_BACKEND` | `local`; baze i datoteke ostaju na računaru. |
| `ACCESS_APPROVAL_REQUIRED` | `false` za ovu lokalnu instalaciju. |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend`; lokalni rad ne traži SMTP lozinku. |

## Opcionalno za VideoGen

`VIDEOGEN_ALLOW_PAID=0` ostavlja stvarno GPU generisanje isključeno. Tek nakon podešavanja vlastitog računa i workera vlasnik može postaviti `VIDEOGEN_ALLOW_PAID=1`. `VIDEOGEN_MODAL_APP=videogen-gpu` je zadani naziv osnovnog workera. Ostali modeli imaju workere navedene u VideoGen uputama. Instalacija i pokretanje aplikacije sami ne pokreću plaćeni posao.

EffectCraft nema poseban obavezni API ključ. Suno nije dio paketa.

## Lozinke, projekti i ažuriranje

Prijavne lozinke nisu `.env` varijable. Novi lokalni računi dobijaju svoje privremene lozinke kroz instalaciju i mijenjaju ih pri prvoj prijavi. Naghun ostaje isti login, s folderom `workspace/Abdullah`.

Pri kasnijem pullu sačuvaj `.env`, `backend/db.sqlite3`, `backend/media`, `workspace`, VideoGen bazu/medije i njegove lokalne postavke. Ne kopiraj tuđe baze ili `.env` iz arhive. Za Rijadov računar slijedi [RIJAD-INSTALLATION.md](RIJAD-INSTALLATION.md).
