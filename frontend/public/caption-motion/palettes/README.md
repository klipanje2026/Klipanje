# Izvoz stilova i paleta

Devet stilova, devet animiranih GIF pregleda, JS/Node izvori i njihove početne palete. `PALETE.json` sadrži HEX boje, gradijente i put do renderera svakog stila.

Za dva Three.js stila postoji izravan izbor boja: font, border, sjena, dubina i pozadina. Pokreni `node server.mjs` iz `three-title-lab/`, pa otvori http://127.0.0.1:4191/. „↓ Paleta“ daje JSON trenutnog stila. „↓ GIF“ koristi odabrane boje. Za vlastiti GIF potrebno je `npm install` u tom folderu; gotovi GIF-ovi već su u paketu.

Boje se mogu promijeniti i bez interfejsa:

```js
const title = await createTitleEffect(canvas, {
  style: 'crystal',
  colors: {
    font: '#e7e8e6', border: '#73cfb2',
    shadow: '#17152f', side: '#65717a', background: '#111820'
  }
});
title.setPalette({font:'#f6bd60'});
const preset = title.getPreset();
```

Sedam Canvas stilova zadržava samostalne Node skripte. Njihove boje su navedene u `PALETE.json`, a mijenjaju se u navedenim izvorima; nisu povezane na kontrole Three.js pregleda. Voda/lava i Mosaic imaju računato sjenčenje, pa paleta opisuje osnovne materijale i raspon nijansi.

Prikaz slova i animacije nacrtani su u JS Canvas/WebGL. Minimalna browser stranica služi samo za učitavanje modula i kontrolu pregleda. Edita aplikacija nije mijenjana.
