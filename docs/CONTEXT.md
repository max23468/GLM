# Contesto operativo GLM

## Stato progetto

- Fase: web app React/Vite operativa su Cloudflare Pages.
- Nome prodotto visibile: `Simulatore gara TPL lotti 1-4`.
- Versione applicativa: `1.1.1` da `package.json`.
- Deploy produzione: Cloudflare Pages progetto `gare-lotti-milanesi`, URL `https://gare-lotti-milanesi.pages.dev`.
- Branch principale: `main`.
- Remote: `git@github.com:max23468/Gare-Lotti-Milanesi.git`.

## Fonte di verità

- Regole operative: `AGENTS.md`.
- Ingresso e comandi: `README.md`.
- Indice documentale: `docs/INDEX.md`.
- Roadmap: `docs/ROADMAP.md`.
- Backlog: `docs/BACKLOG.md`.
- Toolchain: `docs/TOOLCHAIN.md`.
- Decisioni: `docs/decisions/`.
- Logica simulatore: `docs/LOGICA_SIMULATORE.md`.
- Versioning/release: `docs/guides/versioning-e-release.md`.
- Deploy Cloudflare: `docs/guides/cloudflare-pages.md`.

## Ultimo contesto utile

- GLM usa Cloudflare Pages, non Vercel o Supabase.
- L'URL pubblico `https://gare-lotti-milanesi.pages.dev` resta stabile salvo richiesta esplicita.
- Il nome visibile del prodotto è separato dallo slug deploy.
- La Codex feedback inbox GitHub non segnala thread actionable al controllo del 2026-05-24.
- L'allineamento Atlas è documentale e di processo: non cambia logica, UI, allegati, release o deploy.

## Vincoli repo-specifici

- Non trattare il simulatore come fonte ufficiale di gara, offerta, aggiudicazione o consulenza.
- Non inventare formule, soglie, valori o fonti.
- Distinguere sempre `Documento di gara`, `Fonte pubblica` e `Assunzione simulativa`.
- Non modificare, convertire o rinominare allegati Git LFS senza richiesta esplicita.
- Non inviare allegati o dati di gara a provider esterni senza richiesta esplicita e valutazione del rischio.
- Non introdurre backend, account, database remoto, autenticazione, Vercel o Supabase senza decisione esplicita.
- Deploy produzione solo con `npm run deploy:cloudflare` e solo su richiesta esplicita.

## Verifiche da ricordare

- Documentazione pura: `git diff --check`.
- Dati, scoring, persistenza o import/export: `npm test` e `npm run build`.
- Build/runtime: `npm run build`.
- Smoke browser completo: `npm run smoke` solo quando il diff può toccare flussi coperti dallo smoke.
- Deploy doctor: `npm run deploy:doctor` quando si tocca deploy/configurazione o prima di pubblicare.
- Codex inbox: issue GitHub `Codex feedback inbox`.

## Handoff per nuova chat

Prima di procedere:

1. leggere `AGENTS.md`;
2. controllare `git status --short`;
3. leggere `README.md`;
4. leggere `docs/INDEX.md`, `docs/CONTEXT.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md` e `docs/TOOLCHAIN.md`;
5. se la task riguarda logica, dati o UI, leggere `docs/LOGICA_SIMULATORE.md` e i file sorgenti indicati da `AGENTS.md`;
6. controllare Codex feedback inbox se si va verso PR, merge, pubblicazione o deploy;
7. identificare verifiche proporzionate.

Durante handoff e migrazioni, non perdere contenuti: se una nota viene spostata, indicare nuova posizione o motivo della rimozione.

## Rischi aperti

- Confondere il nome visibile del prodotto con lo slug Cloudflare Pages.
- Trasformare un allineamento documentale in modifica runtime o release non richiesta.
- Toccare allegati Git LFS o file generati per errore.
- Lasciare implicite assunzioni su fonti pubbliche o dati variabili.
- Appesantire GLM con standard generici che non aggiungono controllo reale.

## Prossimo passo

- Chiudere la prima PR di allineamento Atlas.
- Poi scegliere dal backlog il primo debito prodotto/tecnico da promuovere, se serve.
