# Roadmap GLM

La roadmap descrive direzione, priorità e prossimi passi del `Simulatore gara TPL lotti 1-4`. Le idee non ancora scelte stanno in `docs/BACKLOG.md`.

## Ora

- Usare la baseline documentale e GitHub introdotta con Atlas senza cambiare logica, UI, allegati o deploy fuori scope.

## Prossimo

- Valutare quali debiti del simulatore promuovere dal backlog: fedeltà del modello, aggiornamento fonti pubbliche, robustezza import/export o chiarezza operativa.
- Decidere se estrarre ADR autonome per scelte già stabili, in particolare Cloudflare Pages come unico target deploy e separazione tra nome visibile e URL pubblico.

## Più avanti

- Migliorare la tracciabilità delle fonti pubbliche e delle date `verifiedAt` usate dagli scenari base.
- Rafforzare i test di persistenza quando cambiano schema JSON, normalizzazione o compatibilità con snapshot legacy.
- Valutare controlli periodici su allegati Git LFS, workflow GitHub, preview Cloudflare e dipendenze.
- Usare React Doctor prima della prossima release minor applicabile o quando cambia codice React trasversale.

## Bloccato

- Deploy produzione: solo su richiesta esplicita, con Cloudflare Pages progetto `gare-lotti-milanesi`.
- Dominio custom, WAF di zona e rate limiting avanzato: dipendono da una decisione operativa esterna al dominio `pages.dev`.

## Fatto recente

- Consolidato il prodotto come `Simulatore gara TPL lotti 1-4` mantenendo stabile l'URL `https://gare-lotti-milanesi.pages.dev`.
- Rafforzati accessibilità, React health, preview Cloudflare e Codex feedback inbox.
- Creati documenti canonici Atlas per GLM: indice, roadmap, backlog, contesto, toolchain e indice decisioni.

## Regole

- La roadmap non è un changelog.
- La roadmap non è un dump di idee.
- Le idee non ancora scelte stanno in `docs/BACKLOG.md`.
- Le decisioni stabili stanno in `docs/decisions/`.
- Ogni voce deve indicare un prossimo passo operativo reale.
