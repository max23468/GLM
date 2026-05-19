# AGENTS.md

Istruzioni operative per agenti che lavorano in questa repository.

## Identità del progetto

`Gare Lotti Milanesi` è una web app React/Vite per simulare scenari della gara TPL MLMP 2026 sui lotti extraurbani `L1`-`L4`.

La repo combina:

- codice TypeScript/React;
- un motore di scoring locale;
- documenti di gara pesanti sotto Git LFS;
- deploy Cloudflare Pages.

Il prodotto è un simulatore esplorativo, non una fonte ufficiale di offerta o aggiudicazione.

## Prima di lavorare

1. Controlla sempre `git status --short`.
2. Leggi `README.md` e, per cambi di logica, `docs/LOGICA_SIMULATORE.md`.
3. Ispeziona codice, test e documentazione esistenti prima di proporre architetture o refactor.
4. Mantieni scope stretto: modifica solo ciò che serve alla richiesta.
5. Non sovrascrivere modifiche non tue e non usare comandi distruttivi senza conferma.

## Stack e comandi

Stack principale:

- React 19
- TypeScript
- Vite
- Vitest
- Cloudflare Pages
- Git LFS per `milano-lotti-extraurbani-om/**`

Comandi utili:

```bash
npm install
npm run dev -- --port 4173
npm test
npm run build
npm run preview -- --port 4173
npm run deploy:cloudflare
```

`npm run deploy:cloudflare` pubblica su Cloudflare Pages progetto `gare-lotti-milanesi`. Usalo solo se l'utente chiede esplicitamente deploy/pubblicazione.

## Struttura da conoscere

- `src/data/tender.ts`: lotti, coppie, criteri, soglie, fonti, warning documentali.
- `src/lib/scoring.ts`: calcolo punteggi, combinatorie, ranking, scenario vincente.
- `src/lib/scoring.test.ts`: test Vitest del motore di scoring.
- `src/App.tsx`: UI principale, preset demo, persistenza locale, import/export, tradeoff.
- `src/components/scenario-panels.tsx`: pannelli scenario, confronto, report.
- `src/styles.css`: token CSS e layout responsive.
- `milano-lotti-extraurbani-om/`: allegati gara, da trattare come fonti e non come file da riscrivere.
- `wrangler.toml`: configurazione Cloudflare Pages.

## Regole sui dati di gara

- Non inventare formule, soglie, valori o fonti.
- Distingui sempre tra `Documento di gara`, `Fonte pubblica` e `Assunzione demo`.
- Non presentare i preset demo come offerte ufficiali.
- Se aggiorni una fonte pubblica, verifica l'URL e aggiorna anche `verifiedAt`.
- Se cambi criteri, massimi, soglie o warning, aggiorna i test e la documentazione collegata.
- I costi dei tradeoff sono ipotesi dell'utente: non trattarli come dati di gara.

## Regole sugli allegati

La cartella `milano-lotti-extraurbani-om/` contiene file binari e documenti ufficiali in Git LFS.

- Non modificare, convertire o rinominare allegati senza richiesta esplicita.
- Usa path quotati nei comandi shell perché molti file hanno spazi, apostrofi o maiuscole.
- Prima di aggiungere nuovi allegati pesanti, verifica `.gitattributes` e Git LFS.
- Non committare estrazioni temporanee, output o log: `tmp/`, `output/` e `dist/` sono ignorati.

## Regole UI e testo

- UI, microcopy e documentazione devono restare in italiano.
- Usa accenti e apostrofi corretti.
- Mantieni tono operativo e chiaro: l'utente deve capire subito cosa può fare.
- Evita superfici marketing: questa è una console di simulazione, non una landing page.
- Su modifiche UI sostanziali verifica desktop/mobile e tema chiaro/scuro.

## Regole sul motore di scoring

Quando tocchi `src/lib/scoring.ts` o `src/data/tender.ts`:

1. Cerca il comportamento esistente con `rg`.
2. Leggi i test vicini.
3. Aggiungi o aggiorna test per:
   - soglia Q/T;
   - riparametrazione;
   - combinatorie;
   - limite di due lotti;
   - import/export o normalizzazione dati, se coinvolti.
4. Esegui `npm test` e `npm run build`.

## Persistenza locale

L'app usa `localStorage` con chiavi:

- `tpl-simulator-theme`
- `tpl-simulator-workspace`
- `tpl-simulator-scenarios`

Se cambi la forma degli snapshot JSON, aggiorna normalizzazione/import in `src/App.tsx` e mantieni compatibilità ragionevole con export precedenti.

## Verifiche prima di chiudere

Per modifiche documentali:

```bash
git diff --check
```

Per modifiche codice/logica:

```bash
npm test
npm run build
```

Per modifiche UI:

```bash
npm run build
npm run preview -- --port 4173
```

Poi verifica nel browser i flussi coinvolti: preset demo, cambio offerente/lotto, salvataggio scenario, import/export, confronto, report e tema.

## Risposte finali e prossimi passi

- Ogni volta che termini un'attività, includi nelle conclusioni i prossimi passi consigliati quando c'è un seguito operativo reale.
- I prossimi passi devono essere concreti, ordinati e proporzionati al lavoro appena concluso.
- Se ci sono alternative sensate, presentale in modo facile da scegliere, indicando l'effetto pratico di ciascuna.
- Se uno o più test/check falliscono, indica comando fallito, sintomo principale, impatto pratico e prossimo passo consigliato.
- Se non resta un prossimo passo utile, dichiaralo esplicitamente invece di forzare una lista artificiale.
- Evita riepiloghi rituali sui check: cita verifiche, limiti e rischi residui solo quando aiutano a capire lo stato reale del lavoro.

## Deploy

Deploy solo su richiesta esplicita.

Prima del deploy:

1. Verifica `git status --short`.
2. Esegui test/build pertinenti.
3. Controlla che non ci siano modifiche indesiderate a `dist/`, `tmp/`, allegati o file generati.
4. Esegui:

```bash
npm run deploy:cloudflare
```

Al termine comunica URL/risultato del deploy se il comando lo fornisce, controlli eseguiti e rischi residui.
