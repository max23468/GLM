# Indice documentazione GLM

Questo è l'indice documentale unico del `Simulatore gara TPL lotti 1-4`.

La root resta il punto di ingresso operativo. `docs/` contiene governance, logica del simulatore, guide, decisioni e allegati di gara.

## Ingresso

- `README.md`: introduzione, mappa repository, comandi, fonti, sviluppo, versioning e deploy.
- `AGENTS.md`: regole operative per Codex e agenti.
- `CHANGELOG.md`: changelog versionato mostrato nel frontend.

## Stato e lavoro

- `docs/ROADMAP.md`: direzione, priorità e prossimi passi.
- `docs/BACKLOG.md`: idee, debiti, bug e attività non ancora promosse.
- `docs/CONTEXT.md`: handoff per nuove chat e lavoro continuativo.
- `docs/TOOLCHAIN.md`: runtime, package manager, tool e verifiche.

## Logica e prodotto

- `docs/LOGICA_SIMULATORE.md`: logica, assunzioni, flusso di calcolo, ottimizzazione, persistenza e verifiche.
- `docs/milano-lotti-extraurbani-om/`: allegati ufficiali di gara versionati con Git LFS. Non modificarli, convertirli o rinominarli senza richiesta esplicita.

## Pubblicazione e operatività

- `docs/guides/versioning-e-release.md`: SemVer locale, changelog e rilascio.
- `docs/guides/cloudflare-pages.md`: deploy Cloudflare Pages, preview, Access, Web Analytics, header, cache, rollback e checklist pubblicazione.
- `docs/doppler-setup.md`: integrazione Doppler, variabili GitHub e verifica segreti CI.

## Decisioni

- `docs/decisions/`: ADR e decisioni stabili.
- `docs/DECISIONS.md`: indice delle decisioni.
- `docs/DECISIONS_PENDING.md`: decisioni strutturali non ancora approvate.
- `docs/decisions/template.md`: template ADR.
- `docs/decisions/0001-tag-e-github-release.md`: policy tag, GitHub Release e
  relazione con release locale e deploy Cloudflare Pages.

Le decisioni operative esistenti sono oggi documentate in `AGENTS.md`, `README.md` e nelle guide. Quando una decisione deve diventare autonoma, crearla in `docs/decisions/` e collegarla qui.

## GitHub

- Repository: `git@github.com:max23468/GLM.git`
- Branch principale: `main`
- Codex feedback inbox: issue GitHub `Codex feedback inbox`.
- Workflow principali: `.github/workflows/ci.yml`, `.github/workflows/codex-pr-comments.yml`, `.github/workflows/pr-title.yml`.

## Note di manutenzione

Non creare un secondo documento con lo stesso titolo o lo stesso scopo di uno già indicato qui.

Se un documento viene migrato o sostituito, aggiornare questo indice e lasciare un rinvio temporaneo quando serve preservare tracciabilità.

Prima di rimuovere un documento, verificare che ogni contenuto utile sia stato migrato, collegato o dichiarato superato.
