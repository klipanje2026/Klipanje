# AE reference za Edita

1. U After Effectsu otvori kopiju svog AEP-a i aktiviraj kompoziciju koja prikazuje željeni naslov/stil.
2. File → Scripts → Run Script File → odaberi `export-edita-reference.jsx`.
3. Odaberi mjesto za JSON. Ako AE blokira pisanje, u Scripting & Expressions uključi Allow Scripts to Write Files and Access Network (skripta ne koristi mrežu).
4. Pošalji JSON, AEP, potrebne fontove i kratki MP4 koji prikazuje ulazak, mirovanje i izlazak. Za više različitih stilova ponovi izvoz s odgovarajućom aktivnom kompozicijom.

Skripta čita aktivnu i povezane podkompozicije: tekst, osnovne i dostupne pojedinačne stilove znakova, fontove, transformacije, efekte, maske, roditelje, matte veze, remap, keyframeove, temporal easing i prostorne tangente. Ne mijenja niti sprema projekt. Izrazi se bilježe kao tekst, ali ne izvršavaju. Vrijednosti su prije evaluacije izraza, što je eksplicitno navedeno u izvozu. Svojstva koja AE verzija ne podržava završavaju u `issues`; nestala svojstva nisu dokaz odsutnosti efekta.

JSON je sirova referenca, nije browser importer ni runtime stil. Može sadržavati originalni tekst, nazive slojeva, putanje medija i izraze; čuvati lokalno u work/aep, ne objavljivati uz aplikaciju. Agent iz njega izrađuje neutralnu specifikaciju u docs/caption-styles i implementira podržani dizajn u zajedničkom rendereru. Za expressions, dodatke, kameru, 3D, matte i motion blur potreban je referentni render; ne tvrditi identičan rezultat samo na osnovu ovog izvoza.

Status: implementirano, nije pokrenuto u After Effectsu jer nije instaliran u trenutnom okruženju. Nema potvrde kompatibilnosti sa svim AE verzijama. Ovo ne pretvara postojeći Preset Titles.aep automatski.

Dokumentacija: [Adobe Scripts](https://helpx.adobe.com/in/after-effects/desktop/automate-in-after-effects/automate-animation/scripts.html), [Property API](https://ae-scripting.docsforadobe.dev/property/property/), [TextDocument API](https://ae-scripting.docsforadobe.dev/text/textdocument/).
