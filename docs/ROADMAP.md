# Roadmap GLM

La roadmap descrive direzione, priorità e prossimi passi del `Simulatore gara
TPL lotti 1-4`. Le idee non ancora scelte stanno in `docs/BACKLOG.md`; le
decisioni stabili stanno in `docs/decisions/` o nei documenti di dominio.

## Ora

- Preservare il perimetro esplorativo del simulatore: nessuna fonte ufficiale,
  offerta o consulenza; dati e warning sempre distinguibili fra documento di
  gara, fonte pubblica e assunzione simulativa.
- Riesaminare fonti pubbliche, URL, metriche e date `verifiedAt` prima di usare
  gli scenari base come riferimento aggiornato.
- Rendere più leggibile quando un warning deriva da incongruenza documentale,
  scelta simulativa o fonte pubblica variabile.

## Prossimo

- Rafforzare test su migrazioni snapshot, import JSON incompleti, legacy o
  costruiti manualmente.
- Migliorare la lettura decisionale di lotti fragili, warning decisivi e scarti
  tra scenari.
- Valutare `engines.node` e `packageManager` in `package.json`, allineando CI e
  setup locale.
- Decidere se estrarre ADR autonome per Cloudflare-only, stabilità URL e policy
  allegati Git LFS.

## Più avanti

- Valutare un report condivisibile leggero senza trasformare il tool in
  generatore automatico di offerta.
- Rivalutare branch protection o CODEOWNERS solo se aggiungono controllo reale.

## Bloccato

- Backend, account, database remoto, autenticazione, Vercel o Supabase restano
  bloccati finché non esiste una decisione esplicita.

## Fatto recente

- Nome visibile, URL Cloudflare Pages stabile e perimetro esplorativo sono
  definiti.
- La logica simulatore è documentata in `docs/LOGICA_SIMULATORE.md`.
- Gli allegati gara in Git LFS e la distinzione delle fonti sono preservati.
- CI, smoke browser, React Doctor e changelog frontend sono disponibili secondo
  la policy locale.

## Regole

- La roadmap non è un changelog.
- La roadmap non è un dump di idee.
- Gli item completati restano solo come sintesi recente.
- Le idee non ancora scelte stanno in `docs/BACKLOG.md`.
- Le decisioni stabili stanno in `docs/decisions/` o nei documenti canonici di
  dominio.
- Ogni voce attiva deve indicare un prossimo passo operativo reale.
