# Toolchain GLM

## Runtime

| Area | Versione | Fonte |
| --- | --- | --- |
| Node | `22` in CI; usare Node `>=22` in locale | `.github/workflows/ci.yml`, dipendenze in `package-lock.json` |
| npm | npm con lockfile v3 | `package-lock.json` |
| Python | non applicabile | nessun runtime Python |

`package.json` non dichiara ancora `engines.node` o `packageManager`.

## Package manager e lockfile

- JavaScript/TypeScript: npm.
- Lockfile JS: `package-lock.json`.
- Python: non applicabile.
- Lockfile Python: non applicabile.

## Tool esterni

| Tool | Versione/canale | Uso |
| --- | --- | --- |
| `git` | locale | stato repository, branch e commit |
| `gh` | locale | GitHub, PR, issue e Codex feedback inbox |
| `wrangler` | `^4.93.0` | Cloudflare Pages deploy e diagnosi |
| `react-doctor` | `0.2.3` | qualità React dopo release minor o modifiche React trasversali |
| Playwright | `^1.60.0` | smoke browser |

## Comandi

- install/setup: `npm install` oppure `npm ci` in CI.
- dev: `npm run dev -- --port 4173`.
- typecheck/build: `npm run build`.
- test: `npm test`.
- validazione dati: `npm run validate:data`.
- validazione scenari base: `npm run validate:base`.
- smoke: `npm run smoke`.
- benchmark ottimizzazione: `npm run benchmark:optimization`.
- check pre-publish: `npm run prepublish:check`.
- React Doctor: `npm run quality:react-doctor`.
- release locale: `npm run release`.
- release dry-run: `npm run release -- --dry-run`.
- deploy doctor: `npm run deploy:doctor`.
- deploy preview: `npm run deploy:preview -- --branch nome-branch`.
- deploy produzione: `npm run deploy:cloudflare`, solo su richiesta esplicita.

## GitHub Actions

- `.github/workflows/ci.yml`: validazione dati, test, build e preview Cloudflare su PR interne quando i secret sono configurati.
- `.github/workflows/codex-pr-comments.yml`: sincronizza la Codex feedback inbox.
- `.github/workflows/pr-title.yml`: verifica titolo PR in stile Conventional Commit.

## Regole

- Non introdurre Vercel, Supabase, backend, database remoto o autenticazione senza decisione esplicita.
- Non pubblicare produzione da branch diverse da `main`.
- Non eseguire deploy produzione senza richiesta esplicita.
- Non cambiare versione Node, package manager o deploy target senza aggiornare roadmap/backlog o ADR.
- Per modifiche documentali pure basta `git diff --check`.
- Per modifiche runtime seguire la matrice verifiche in `AGENTS.md`.

## Eccezioni e guardrail

- Gli allegati in `docs/milano-lotti-extraurbani-om/` sono fonti Git LFS, non contenuto da normalizzare o riscrivere.
- `CHANGELOG.md` è visibile nel frontend: non usarlo per note interne se non nella sezione `### Non versionato` prevista dalla policy.
- React Doctor è obbligatorio prima della prossima release minor React o quando una modifica React trasversale lo rende proporzionato.
