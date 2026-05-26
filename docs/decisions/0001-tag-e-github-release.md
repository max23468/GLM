# 0001 - Tag e GitHub Release

Data: 2026-05-26

Stato: Accettata

## Contesto

GLM usa già versioning locale con `package.json`, `CHANGELOG.md`,
`package-lock.json`, `src/lib/version.ts` e `npm run release`.

Release prodotto e deploy Cloudflare Pages restano azioni separate: preparare
una release non pubblica automaticamente su Cloudflare, e pubblicare documenti
interni su GitHub non richiede una nuova versione visibile nel simulatore.

Esiste uno storico GitHub tag/Release `v1.0.0`, mentre la versione applicativa
corrente è più avanti. Questo storico non va corretto retroattivamente con tag
inventati: la policy vale dalla prossima release prodotto reale.

## Decisione

Quando GLM prepara una release prodotto reale:

- la source of truth della versione è `package.json`, aggiornato da
  `npm run release`;
- il tag Git deve avere formato `vX.Y.Z` e corrispondere esattamente alla
  versione in `package.json`;
- la GitHub Release, se creata, deve partire da quel tag e usare note derivate
  dalla sezione rilasciata di `CHANGELOG.md`;
- il deploy Cloudflare Pages resta separato e richiede il flusso dedicato della
  repo;
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
- Deploy/release: tag e GitHub Release diventano ammessi solo per release
  prodotto reali; deploy Cloudflare resta indipendente.
- Documentazione: la guida versioning e l'indice decisioni chiudono la decisione
  pendente.

## Conseguenze operative

- Alla prossima release prodotto scegliere se taggare la versione corrente
  allineata o preparare un bump successivo con `npm run release`.
- Non creare tag o GitHub Release per questo allineamento documentale.
- Non usare GitHub Release come sostituto del deploy Cloudflare Pages.

## Verifiche

- Review documentale.
- `git diff --check`.

## Collegamenti

- Guida: `docs/guides/versioning-e-release.md`
- Changelog: `CHANGELOG.md`
- Versione applicativa: `package.json`
