# Toolchain GLM

## Runtime

| Area | Versione | Fonte |
| --- | --- | --- |
| Node | `>=24.19 <25` | `.node-version`, `package.json`, `.github/workflows/ci.yml` |
| npm | `npm@12.0.2` con lockfile v3 | `package.json`, `package-lock.json` |
| Python | `python3` con `openpyxl==3.1.5` | solo per rigenerare e rifinire la base tecnica Excel |

## Package manager e lockfile

- JavaScript/TypeScript: npm.
- Lockfile JS: `package-lock.json`.
- Python: usato solo per generare o rifinire la base tecnica Excel quando si manutiene il template.
- Dipendenza Python: `requirements-excel.txt`, installata in un ambiente virtuale locale `.venv`.

## Tool esterni

| Tool | Versione/canale | Uso |
| --- | --- | --- |
| `git` | locale | stato repository, branch e commit |
| `gh` | locale | GitHub, PR, issue e Codex feedback inbox |
| `wrangler` | `^4.119.0` | Cloudflare Pages deploy e diagnosi |
| React Doctor | `0.9.5` via `npm run quality:react-doctor` | qualità React dopo release major/minor o modifiche React trasversali |
| Playwright | `^1.62.1` | smoke browser |

## Comandi

- setup locale: `npm install --global npm@12.0.2`, poi `npm install`.
- setup CI: installazione globale di npm `12.0.2`, verifica della versione e
  `npm ci --ignore-scripts`.
- setup Excel: `python3 -m venv .venv`, poi `.venv/bin/python -m pip install -r requirements-excel.txt`.
- dev: `npm run dev -- --port 4173`.
- typecheck/build: `npm run build`.
- test: `npm test`.
- coverage core: `npm run test:coverage:core`.
- validazione dati: `npm run validate:data`.
- validazione scenari base: `npm run validate:base`.
- smoke: `npm run smoke`.
- benchmark ottimizzazione: `npm run benchmark:optimization`.
- check pre-publish: `npm run prepublish:check`.
- package Excel: `npm run package:excel`.
- validazione package Excel: `npm run validate:excel-package`.
- finitura workbook Excel: `scripts/enhance-excel-workbook.py` con un Python che includa `openpyxl`.
- React Doctor: `npm run quality:react-doctor`.
- release locale: `npm run release`.
- release dry-run: `npm run release -- --dry-run`.
- deploy doctor: `npm run deploy:doctor`.
- deploy preview: `npm run deploy:preview -- --branch nome-branch`.
- deploy produzione ordinario: job `deploy-production` automatico dopo push o
  merge su `main`;
- redeploy manuale: `npm run deploy:cloudflare`, solo su richiesta esplicita.

## GitHub Actions

- `.github/workflows/ci.yml`: validazione dati, test, coverage core e build
  sulle PR; deploy produzione su `main`. Le preview Cloudflare si avviano
  manualmente da un checkout revisionato; il workflow usa `NODE_VERSION`
  condiviso per evitare divergenze fra job.
- `.github/workflows/codex-pr-comments.yml`: sincronizza la Codex feedback inbox.
- `.github/workflows/pr-title.yml`: verifica titolo PR in stile Conventional Commit.

## Regole

- Non introdurre Vercel, Supabase, backend, database remoto o autenticazione senza decisione esplicita.
- Non pubblicare produzione da branch diverse da `main`.
- Non eseguire push/merge su `main` o redeploy manuali senza richiesta
  esplicita di pubblicazione.
- Non cambiare versione Node, package manager o deploy target senza aggiornare roadmap/backlog o ADR.
- Per modifiche documentali pure basta `git diff --check`.
- Per modifiche runtime seguire la matrice verifiche in `AGENTS.md`.
- `npm run test:coverage:core` è il check mirato di coverage core: misura solo i moduli core del simulatore e applica le soglie minime `85%` linee e `75%` rami senza imporre coverage su UI, allegati o superfici non core.

## Eccezioni e guardrail

- Gli allegati in `docs/milano-lotti-extraurbani-om/` sono fonti Git LFS, non contenuto da normalizzare o riscrivere.
- `CHANGELOG.md` è visibile nel frontend: non usarlo per note interne se non nella sezione `### Non versionato` prevista dalla policy.
- React Doctor è obbligatorio prima della prossima release major/minor React o quando una modifica React trasversale lo rende proporzionato.
