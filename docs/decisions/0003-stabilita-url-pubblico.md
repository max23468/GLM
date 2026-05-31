# 0003 - Stabilità dell'URL pubblico

Data: 2026-05-31

Stato: Accettata

## Contesto

Il nome visibile del prodotto è `Simulatore gara TPL lotti 1-4`, mentre lo slug
tecnico Cloudflare Pages e l'URL pubblico sono `gare-lotti-milanesi`.

Confondere brand visibile e slug deploy può rompere link condivisi, smoke
post-deploy, guide operative e aspettative di chi usa il simulatore.

## Decisione

L'URL pubblico stabile resta:

```text
https://gare-lotti-milanesi.pages.dev
```

Il nome visibile può evolvere solo come copy prodotto. Project name Cloudflare,
URL pubblico, endpoint `/api/version` e script di deploy non vanno rinominati
senza richiesta esplicita e aggiornamento coordinato della documentazione.

## Alternative considerate

- `Rinominare project name in base al titolo prodotto`: scartato perché cambia
  URL e introduce lavoro di migrazione senza beneficio operativo.
- `Usare un dominio custom subito`: scartato finché non serve stabilizzare un
  canale pubblico diverso da Pages.

## Impatti

- Prodotto: link e riferimenti pubblici restano stabili.
- Tecnico: script, smoke e Pages Function continuano a usare lo stesso target.
- Dati/privacy: nessun impatto.
- Deploy/release: ogni cambio URL diventa modifica strutturale, non microcopy.
- Documentazione: README, contesto e guida Cloudflare devono mantenere la
  distinzione fra nome prodotto e URL.

## Conseguenze operative

- Non rinominare `wrangler.toml`, project name o URL nei documenti per semplice
  coerenza estetica.
- Dopo ogni deploy verificare app e `/api/version` sull'URL stabile.

## Verifiche

- Review documentale.
- `git diff --check`.

## Collegamenti

- Guida: `docs/guides/cloudflare-pages.md`
- Contesto: `docs/CONTEXT.md`
- README: `README.md`
