# AGENTS.md

Istruzioni operative condivise per chi lavora in questa repository.
`CLAUDE.md` importa questo file: mantieni qui le regole comuni e non duplicarle.

## Progetto e perimetro

`Simulatore gara TPL lotti 1-4` è una web app React/Vite per esplorare scenari
della gara TPL 2026 sui lotti extraurbani `L1`-`L4`. Include scoring locale,
ottimizzazione, import/export, report e un toolkit Excel/VBA.

Il simulatore non è una fonte ufficiale, un'offerta, un'aggiudicazione o una
consulenza. Non trasformarlo in landing page, SaaS multiutente, backend,
database remoto o generatore automatico di offerte. Cloudflare Pages è l'unico
target deploy approvato; Vercel e Supabase sono fuori perimetro.

## Autonomia e scope

- Per analisi, review o diagnosi, ispeziona e riferisci senza modificare.
- Per fix o implementazioni, esegui le modifiche locali richieste e i controlli
  non distruttivi pertinenti.
- Decidi autonomamente naming, formattazione, default e altre scelte locali
  equivalenti. Chiedi solo per azioni distruttive o difficili da annullare,
  deploy/release e ambiguità che cambierebbero materialmente il lavoro.
- Mantieni lo scope stretto. Non aggiungere astrazioni, dipendenze, workflow,
  compatibilità o documenti non richiesti.
- Non sovrascrivere modifiche altrui. Se il checkout è sporco, lavora attorno
  ai file non pertinenti; fermati solo se devi sovrapporli.
- Pubblicazione, merge, deploy e release richiedono richiesta esplicita; parole
  come `pubblica`, `rilascia` o `deploya` autorizzano senza una seconda conferma
  il flusso completo applicabile, inclusa la preparazione della versione quando
  necessaria. Poiché il push/merge su `main` attiva il deploy produzione,
  trattalo come pubblicazione.

## Prima di modificare

1. Esegui `git status --short`.
2. Leggi `README.md` e ispeziona codice, test e documenti vicini all'area.
3. Per lavori non minuti usa una branch/worktree dedicata. Per microcambi puoi
   restare nel checkout sporco se i file non si sovrappongono.
4. Scegli i controlli in base al rischio reale del diff.

Non caricare tutta la documentazione per ogni task. Usa queste fonti quando
pertinenti:

| Area | Fonte primaria |
| --- | --- |
| Indice e handoff | `docs/INDEX.md`, `docs/CONTEXT.md` |
| Priorità e debiti | `docs/ROADMAP.md`, `docs/BACKLOG.md` |
| Runtime e comandi | `docs/TOOLCHAIN.md`, `package.json` |
| Decisioni stabili | `docs/DECISIONS.md`, `docs/decisions/` |
| Logica e assunzioni | `docs/LOGICA_SIMULATORE.md` |
| Dati e fonti gara | `src/data/tender.ts`, allegato citato |
| Scenari base | `src/data/base-scenarios.ts` |
| Scoring e ranking | `src/lib/scoring.ts`, test vicini |
| Ottimizzazione | `src/lib/optimization.ts`, `src/lib/tradeoff.ts` |
| Persistenza | `src/lib/scenario-persistence.ts` |
| UI | `src/App.tsx`, `src/components/`, `src/styles.css` |
| Versione e changelog | `CHANGELOG.md`, `src/lib/version.ts`, guida release |
| Deploy | `.github/workflows/ci.yml`, `wrangler.toml`, guida Cloudflare |
| Toolkit Excel | `excel-vba/EXCEL_VBA_GUIDE.md`, script `package/validate` |

Le fonti ufficiali di gara sotto `docs/milano-lotti-extraurbani-om/` prevalgono
sulle ricostruzioni. Convenzioni dedotte dal codice vengono dopo documenti e
decisioni esplicite.

## Vincoli di dominio e sicurezza

- Non inventare formule, soglie, valori o fonti.
- Distingui sempre `Documento di gara`, `Fonte pubblica` e `Assunzione
  simulativa`. Per dati pubblici variabili verifica URL e aggiorna `verifiedAt`.
- I costi dell'analisi criterio e delle leve di ottimizzazione sono ipotesi
  dell'utente, non dati di gara.
- Se una fonte è ambigua o incompleta, rendi il limite visibile in warning,
  copy o documentazione.
- Non modificare, convertire o rinominare allegati Git LFS senza richiesta
  esplicita. Quota i path; non committare estrazioni, output o log.
- Non inviare allegati, scenari o dati di gara a provider esterni senza
  autorizzazione e valutazione del rischio.
- Non committare segreti, `.env`, credenziali, dump, export personali o
  screenshot riservati. Non stampare valori sensibili nei log.

## Contratti del codice

- Riusa `simulate()` e la logica condivisa in `src/lib/scoring.ts`; non
  duplicare formule.
- Se tocchi scoring o dati, copri soglia di sbarramento, riparametrazione,
  combinatorie e limite di due lotti.
- Nell'ottimizzazione mantieni fermi i concorrenti salvo richiesta diversa,
  escludi i criteri discrezionali `D` e rivaluta ogni mossa tramite `simulate()`.
- Se cambia lo schema degli snapshot, aggiorna normalizzazione e import/export.
  Le chiavi attive sono `tpl-lotti-1-4-*`; i fallback `tpl-simulator-*` restano
  leggibili finché esistono snapshot locali precedenti.
- UI, microcopy e documentazione restano in italiano, con tono operativo.
  Mantieni il nome visibile `Simulatore gara TPL lotti 1-4`, separato dallo slug
  Cloudflare, e verifica che testo e controlli restino accessibili e leggibili.
- Segui stile, naming e densità di commenti del codice circostante. Non
  introdurre librerie UI o dipendenze per capacità già native o locali.

## Verifiche proporzionate

| Diff | Verifica minima |
| --- | --- |
| Docs/governance non runtime | rilettura e `git diff --check` |
| Microcopy o UI minima | `npm run build`; browser solo se può cambiare layout |
| UI/flussi sostanziali | build, preview, desktop/mobile e chiaro/scuro pertinenti |
| Dati, scoring, ottimizzazione, persistenza | test mirati, `npm test`, `npm run build` |
| Import/export o flussi coperti dallo smoke | quanto sopra e `npm run smoke` |
| Build, routing o deploy | `npm run build`, controllo config; `deploy:doctor` se pertinente |

Usa `npm run benchmark:optimization` solo se cambia il costo computazionale.
Usa `npm run quality:react-doctor` per modifiche React trasversali o prima di
una release major/minor React. Non eseguire smoke completi per diff docs-only.

## Versione, changelog e release

- `package.json` è la fonte della versione; `npm run release` sincronizza
  changelog, lockfile e data build, ma non pubblica.
- Correzioni UI percepibili, modifiche a dati o formule che cambiano i risultati
  e nuove capacità richiedono una voce end-user in una release mostrata dal
  frontend. Prima di pubblicarle prepara la versione con `npm run release`,
  salvo che siano già incluse in una versione preparata.
- Governance, CI e docs interne non richiedono SemVer; usa `### Non versionato`
  solo se serve tracciarle.
- Non inserire nel changelog pubblico commit, PR, file, test, deploy,
  dipendenze o regole agentiche.
- Ogni nuova versione preparata e portata su `main` richiede tag `vX.Y.Z` e
  GitHub Release secondo `docs/decisions/0001-tag-e-github-release.md`; i push
  senza nuova versione non generano tag.

## Git, PR e pubblicazione

- Mantieni commit atomici e Conventional Commit in inglese. Il titolo PR deve
  essere esplicito, non il nome della branch.
- Prima di commit o PR rileggi il diff e scarta file generati o fuori scope.
- Prima di PR ready, merge, pubblicazione, deploy o release controlla la issue
  `Codex feedback inbox` e gestisci i thread actionable.
- `main` attiva automaticamente la pipeline in `.github/workflows/ci.yml`:
  `verify`, poi `deploy-production` con build, deploy Cloudflare e smoke.
- Target produzione: progetto `gare-lotti-milanesi`, output `dist`, URL
  `https://gare-lotti-milanesi.pages.dev`. Il deploy manuale
  `npm run deploy:cloudflare` è solo per un redeploy esplicitamente richiesto;
  le preview usano `npm run deploy:preview -- --branch nome-branch`.
- `pubblica`, `rilascia` o `deploya` indicano il flusso completo applicabile:
  check, PR/merge su `main`, eventuale release/tag, verifica app e
  `/api/version`, quindi pulizia di branch/worktree assorbiti.
- Non pubblicare un worktree sporco o una branch feature come `main`. Se il
  checkout contiene cambi non correlati, isola il diff richiesto in un
  worktree pulito senza assorbirli; chiedi solo se i cambi si sovrappongono.

## Comunicazione e chiusura

Aggiorna brevemente all'avvio e solo su scoperte importanti o cambi di
direzione. Chiudi partendo dall'esito e includi, in modo proporzionato:

- cosa è cambiato o emerso;
- controlli eseguiti e limiti rilevanti;
- stato di PR, release, deploy e checkout quando applicabile;
- rischi residui e prossimo passo concreto, oppure che non ne resta alcuno.

Il lavoro è chiuso quando soddisfa la richiesta senza ampliare lo scope,
preserva modifiche concorrenti e fonti, supera i controlli pertinenti e non
lascia artefatti o residui non dichiarati.
