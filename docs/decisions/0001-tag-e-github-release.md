# 0001 - Tag e GitHub Release

Data: 2026-05-26

Aggiornata: 2026-07-21

Stato: Accettata

## Contesto

GLM usa già versioning locale con `package.json`, `CHANGELOG.md`,
`package-lock.json`, `src/lib/version.ts` e `npm run release`.

Preparare una release non pubblica da solo. Il successivo push/merge su `main`
avvia automaticamente il deploy Cloudflare; pubblicare documenti interni non
richiede invece una nuova versione visibile nel simulatore.

Esiste uno storico GitHub tag/Release `v1.0.0`, mentre la versione applicativa
corrente è più avanti. Questo storico non va corretto retroattivamente con tag
inventati: la policy vale dalla prossima release prodotto reale.

## Decisione

Quando GLM prepara una release prodotto reale:

- la source of truth della versione è `package.json`, aggiornato da
  `npm run release`;
- il tag Git deve avere formato `vX.Y.Z` e corrispondere esattamente alla
  versione in `package.json`;
- la GitHub Release è parte del default di pubblicazione: deve partire da quel
  tag e usare note derivate dalla sezione rilasciata di `CHANGELOG.md`;
- il merge su `main` avvia il deploy Cloudflare; tag e GitHub Release restano
  passaggi distinti dal job di deploy;
- modifiche docs-only, governance-only o `### Non versionato` non creano tag e
  non creano GitHub Release.

Release Please non è adottato in GLM. Può essere rivalutato solo con una nuova
decisione esplicita.

## Alternative considerate

- Taggare retroattivamente le versioni già presenti in `package.json`: scartato
  perché creerebbe uno storico non verificato.
- Creare una GitHub Release a ogni merge su `main`: scartato perché
  confonderebbe pubblicazione GitHub, release prodotto e deploy Cloudflare.
- Restare senza tag per sempre: scartato perché una release prodotto reale deve
  avere un riferimento GitHub chiaro e verificabile.

## Impatti

- Prodotto: il simulatore continua a mostrare solo release preparate dal
  changelog pubblico.
- Tecnico: il comando locale `npm run release` resta il gate della versione.
- Dati/privacy: nessun impatto sui dati di gara o sugli allegati.
- Deploy/release: tag e GitHub Release diventano obbligatori per release
  prodotto reali; il deploy Cloudflare è conseguenza del merge su `main`.
- Documentazione: la guida versioning e l'indice decisioni chiudono la decisione
  pendente.

## Conseguenze operative

- Dopo il merge su `main` di una release prodotto reale, creare e pubblicare il
  tag `vX.Y.Z` e la relativa GitHub Release prima di chiudere il lavoro.
- Non creare tag o GitHub Release per questo allineamento documentale.
- Non usare GitHub Release come sostituto del deploy Cloudflare Pages.

## Verifiche

- Review documentale.
- `git diff --check`.

## Collegamenti

- Guida: `docs/guides/versioning-e-release.md`
- Changelog: `CHANGELOG.md`
- Versione applicativa: `package.json`
