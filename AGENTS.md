# AGENTS.md

Istruzioni operative per agenti che lavorano in questa repository.

## Priorità delle istruzioni

1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. `README.md`, `docs/LOGICA_SIMULATORE.md` e documenti di progetto collegati.
4. Allegati e fonti ufficiali di gara, quando la task riguarda dati, criteri o regole.
5. Assunzioni dell'agente.

In caso di conflitto, segui sempre il livello più alto. Se una decisione nuova cambia stabilmente perimetro, dati, deploy, verifiche o documentazione, aggiorna il documento rilevante invece di lasciarla solo in chat.

## Identità del progetto

`Simulatore gara TPL lotti 1-4` è una web app React/Vite per simulare scenari della gara TPL 2026 sui lotti extraurbani `L1`-`L4`.

La repo combina:

- codice TypeScript/React;
- un motore di scoring locale;
- documenti di gara pesanti sotto Git LFS;
- deploy Cloudflare Pages.

Il prodotto è un simulatore esplorativo, non una fonte ufficiale di offerta o aggiudicazione.

### Perimetro e non-obiettivi

Il simulatore deve restare una console operativa per ragionare su punteggi, combinatorie, soglie, ribassi, scenari e criticità documentali della gara TPL lotti 1-4.

Una modifica ha senso quando rafforza almeno uno di questi assi:

- fedeltà e tracciabilità del modello di gara;
- simulazione, confronto, import/export, report o ottimizzazione degli scenari;
- chiarezza delle assunzioni e dei warning documentali;
- affidabilità, test, build, deploy Cloudflare Pages o manutenzione del simulatore;
- usabilità della console per analisi rapide e verificabili.

GLM non è:

- una fonte ufficiale di gara, offerta, aggiudicazione o consulenza legale/economica;
- un generatore automatico di offerte tecniche o economiche;
- una piattaforma procurement generalista;
- una dashboard marketing o landing page;
- un SaaS multi-utente con backend, account o database remoto;
- un progetto Vercel o Supabase.

Spostamenti verso questi perimetri richiedono richiesta esplicita e aggiornamento della documentazione.

## Prima di lavorare

1. Controlla sempre `git status --short`.
2. Leggi `README.md` e, per cambi di logica, `docs/LOGICA_SIMULATORE.md`.
3. Ispeziona codice, test e documentazione esistenti prima di proporre architetture o refactor.
4. Mantieni scope stretto: modifica solo ciò che serve alla richiesta.
5. Non sovrascrivere modifiche non tue e non usare comandi distruttivi senza conferma.

Se il worktree contiene modifiche non tue o non collegate alla richiesta, non normalizzarle e non includerle nel tuo diff. Per interventi non minuscoli crea una branch o un worktree dedicato da una base pulita; per interventi piccoli puoi lavorare nello stesso checkout solo se i file non si sovrappongono e lo dichiari nel riepilogo.

## Fonti primarie e contesto da leggere

Usa queste fonti prima di intervenire sulle aree corrispondenti:

- orientamento generale: `README.md`;
- logica, formule, soglie e assunzioni: `docs/LOGICA_SIMULATORE.md`;
- dati gara, criteri, fonti, warning e `verifiedAt`: `src/data/tender.ts`;
- scenari base e profili simulati: `src/data/base-scenarios.ts`;
- scoring, combinatorie e ranking: `src/lib/scoring.ts` e test vicini;
- ottimizzazione: `src/lib/optimization.ts`, `src/lib/tradeoff.ts` e `src/lib/optimization.test.ts`;
- persistenza, migrazioni storage e import/export JSON: `src/lib/scenario-persistence.ts`;
- UI principale, report, confronto e istruzioni: `src/App.tsx`, `src/components/scenario-panels.tsx`, `src/components/instructions-page.tsx`;
- versioning e changelog frontend: `CHANGELOG.md`, `src/lib/version.ts`, `src/lib/changelog.ts`, `src/components/release-panel.tsx`, `docs/guides/versioning-e-release.md`;
- layout, token e responsive: `src/styles.css`;
- deploy Cloudflare: `wrangler.toml`, `package.json` e script npm collegati;
- documenti ufficiali: `docs/milano-lotti-extraurbani-om/`.

Per prodotti, API, fonti pubbliche, prezzi, policy, provider o dati variabili, verifica fonti aggiornate e preferisci fonti ufficiali. Se un fetch fallisce, prova una via alternativa prima di fermarti.

## Stack e comandi

Stack principale:

- React 19
- TypeScript
- Vite
- Vitest
- Cloudflare Pages
- Git LFS per `docs/milano-lotti-extraurbani-om/**`

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
- `src/data/base-scenarios.ts`: scenari base, profili simulati e baseline operative.
- `src/lib/scoring.ts`: calcolo punteggi, combinatorie, ranking, scenario vincente.
- `src/lib/optimization.ts`: motore di ottimizzazione punteggio, leve tecniche e riallocazioni verso ribasso.
- `src/lib/tradeoff.ts`: logica interna dell'analisi puntuale criterio e costo stimato.
- `src/lib/scenario-persistence.ts`: normalizzazione workspace, migrazione storage e import/export JSON.
- `src/lib/version.ts`: versione applicativa e data build mostrate nel frontend.
- `src/lib/changelog.ts`: parser del changelog bundlato a build time.
- `src/lib/*.test.ts`: test Vitest del motore di scoring e della persistenza.
- `src/App.tsx`: UI principale, persistenza locale, import/export, analisi puntuale criterio e ottimizzazione.
- `src/components/release-panel.tsx`: scheda `Versione e changelog`.
- `src/components/scenario-panels.tsx`: pannelli scenario, confronto, report.
- `src/styles.css`: token CSS e layout responsive.
- `CHANGELOG.md`: storico versionato in formato Keep a Changelog.
- `docs/guides/versioning-e-release.md`: procedura SemVer e rilascio.
- `docs/milano-lotti-extraurbani-om/`: allegati gara, da trattare come fonti e non come file da riscrivere.
- `wrangler.toml`: configurazione Cloudflare Pages.

## Mappa modifiche, file e verifiche

| Tipo di modifica | File da controllare | Verifica minima |
| --- | --- | --- |
| Documentazione non runtime | `AGENTS.md`, `README.md`, `docs/**` | Rilettura e `git diff --check` |
| Dati o fonti di gara | `src/data/tender.ts`, allegati/fonte citata, `docs/LOGICA_SIMULATORE.md` | Test mirati, `npm test`, `npm run build` |
| Scenari base | `src/data/base-scenarios.ts`, `src/data/tender.ts` | Test demo/scoring pertinenti, `npm test`, `npm run build` |
| Scoring/combinatorie | `src/lib/scoring.ts`, `src/lib/*.test.ts` | Test mirati, `npm test`, `npm run build` |
| Ottimizzazione/tradeoff | `src/lib/optimization.ts`, `src/lib/tradeoff.ts`, `src/lib/optimization.test.ts` | Test ottimizzazione, `npm test`, `npm run build` |
| Persistenza/import/export | `src/lib/scenario-persistence.ts`, `src/App.tsx`, test persistence | Test persistence/import, `npm test`, `npm run build` |
| UI o microcopy | `src/App.tsx`, `src/components/**`, `src/styles.css` | `npm run build`; browser mirato se layout/flusso può cambiare |
| Versioning/changelog frontend | `CHANGELOG.md`, `src/lib/version.ts`, `src/lib/changelog.ts`, `src/components/release-panel.tsx`, `scripts/release.mjs`, `package.json`, `package-lock.json` | `npm test`, `npm run build`, browser mirato se cambia la scheda |
| Routing/istruzioni pubbliche | `src/components/instructions-page.tsx`, `public/_redirects`, routing Vite/Cloudflare | `npm run build`, preview e verifica rotta |
| Deploy/build config | `package.json`, `wrangler.toml`, config Vite | `npm run build`, controllo config e deploy solo se richiesto |

## Regole sui dati di gara

- Non inventare formule, soglie, valori o fonti.
- Distingui sempre tra `Documento di gara`, `Fonte pubblica` e `Assunzione simulativa`.
- Ogni nuovo dato rilevante deve avere fonte, tipo fonte e, quando pubblica/variabile, data di verifica.
- Non presentare scenari base o profili simulati come offerte ufficiali.
- Se aggiorni una fonte pubblica, verifica l'URL e aggiorna anche `verifiedAt`.
- Se cambi criteri, massimi, soglie o warning, aggiorna i test e la documentazione collegata.
- I costi dell'analisi puntuale criterio sono ipotesi dell'utente: non trattarli come dati di gara.
- I costi delle leve di ottimizzazione sono ipotesi dell'utente: non trattarli come dati di gara.
- Se una fonte è ambigua, incompleta o non verificabile, rendi il limite visibile in warning, documentazione o copy operativo invece di nasconderlo nel codice.
- Non inviare allegati o dati di gara a provider esterni senza richiesta esplicita e valutazione del rischio.

## Regole sugli allegati

La cartella `docs/milano-lotti-extraurbani-om/` contiene file binari e documenti ufficiali in Git LFS.

- Non modificare, convertire o rinominare allegati senza richiesta esplicita.
- Usa path quotati nei comandi shell perché molti file hanno spazi, apostrofi o maiuscole.
- Prima di aggiungere nuovi allegati pesanti, verifica `.gitattributes` e Git LFS.
- Non committare estrazioni temporanee, output o log: `tmp/`, `output/` e `dist/` sono ignorati.

## Sicurezza, privacy e file sensibili

- Non committare segreti, token, credenziali, file `.env`, dump, export personali, log o screenshot con dati riservati.
- Tratta allegati di gara, estrazioni, scenari di lavoro e report come materiale potenzialmente sensibile.
- Non copiare contenuti integrali degli allegati in issue, PR, fixture, log o risposte chat se basta citare path, sezione o sintesi.
- Non usare dati reali di offerte, costi interni o decisioni riservate in test, screenshot o documentazione senza richiesta esplicita.
- Prima di aggiungere dipendenze, script remoti o integrazioni esterne, valuta impatto su privacy, sicurezza, supply chain e deploy.
- I file generati o temporanei devono restare fuori dal commit; controlla in particolare `dist/`, `tmp/`, `output/`, log locali e artefatti di estrazione.

## Regole UI e testo

- UI, microcopy e documentazione devono restare in italiano.
- Usa accenti e apostrofi corretti.
- Mantieni tono operativo e chiaro: l'utente deve capire subito cosa può fare.
- Evita superfici marketing: questa è una console di simulazione, non una landing page.
- La prima schermata deve restare l'esperienza applicativa del simulatore, non una pagina promozionale.
- Evita acronimi o nomi interni poco leggibili nelle label visibili: preferisci nomi espliciti come `Simulatore gara TPL lotti 1-4`.
- Mantieni layout densi ma leggibili, con pannelli, tabelle, report e controlli pensati per confronto e analisi ripetuta.
- I testi non devono uscire dai contenitori o sovrapporsi su mobile, desktop, tema chiaro o tema scuro.
- Usa icone e controlli coerenti con l'interfaccia esistente; non introdurre librerie UI senza motivo esplicito.
- Su modifiche UI sostanziali verifica desktop/mobile e tema chiaro/scuro.

## Versioning e changelog

La versione applicativa è in `src/lib/version.ts` e va mantenuta sincronizzata con `package.json` e `package-lock.json`.

Il changelog segue `CHANGELOG.md` con sezioni in italiano:

- `### Novità`: capacità nuove e retrocompatibili, descritte dal punto di vista di chi usa il simulatore;
- `### Correzioni`: fix, miglioramenti visibili, chiarezza dei warning o leggibilità operativa;
- `### Non versionato`: note interne senza impatto sul prodotto pubblicato, supporto o comportamento operativo.

Il changelog è mostrato nel frontend: non includere voci rivolte a chi sviluppa il tool, come commit, PR, file interni, CI, test, release, deploy, dipendenze, script o regole agenti. Se una modifica tecnica ha un effetto reale per l'utente, descrivi solo l'effetto pratico nel simulatore.

Non creare una nuova versione visibile nel frontend se il blocco non contiene punti interessanti per l'utente finale. In quel caso lascia la modifica fuori dalle release pubbliche o, se serve traccia interna, usa `### Non versionato` senza eseguire una release SemVer.

Per preparare una nuova versione, aggiungi le voci sotto `## [Non rilasciato]` ed esegui:

```bash
npm run release
```

Il comando aggiorna `CHANGELOG.md`, `src/lib/version.ts`, `package.json` e `package-lock.json`; non esegue deploy. La procedura completa è in `docs/guides/versioning-e-release.md`.

La scheda `Versione e changelog` nel frontend legge `CHANGELOG.md` a build time e mostra solo versioni rilasciate. Non introdurre link, rimandi o informazioni su repository esterni nella scheda frontend.

Regola operativa per gli agenti: ogni modifica visibile e interessante per l'utente finale deve avere una voce in `CHANGELOG.md` dentro una release mostrata nel frontend. Prepara una nuova versione con `npm run release` solo quando ci sono contenuti end-user sufficienti per giustificarla. Una voce lasciata sotto `## [Non rilasciato]` non compare nella scheda frontend; una voce solo interna non deve generare una release pubblica.

## Errori comuni da evitare

- Non proporre o configurare Vercel: GLM usa Cloudflare Pages progetto `gare-lotti-milanesi`.
- Non confondere nome visibile del prodotto e URL pubblico: `https://gare-lotti-milanesi.pages.dev` resta stabile salvo richiesta esplicita.
- Non pubblicare da un worktree sporco includendo modifiche non committate o non collegate alla richiesta.
- Non presentare assunzioni, scenari base, profili simulati o costi utente come dati ufficiali.
- Non modificare, convertire o rinominare allegati LFS per comodità.
- Non includere criteri discrezionali `D` nell'ottimizzazione automatica.
- Non duplicare formule di scoring fuori da `src/lib/scoring.ts`; riusa `simulate()` dove previsto.
- Non rompere compatibilità con chiavi `localStorage` legacy o vecchi export JSON senza migrazione.
- Non introdurre backend, account, database remoto o autenticazione senza decisione esplicita.
- Non lasciare debiti noti impliciti: se uno step viene rimandato, dichiaralo come rischio o prossimo passo.

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

Quando tocchi `src/lib/optimization.ts`:

1. Mantieni i concorrenti fermi salvo richiesta esplicita diversa.
2. Non includere criteri discrezionali `D` nell'ottimizzazione automatica.
3. Rivaluta le mosse tramite `simulate()` invece di duplicare formule di scoring.
4. Aggiorna `src/lib/optimization.test.ts`.
5. Esegui `npm test` e `npm run build`.

## Persistenza locale

L'app usa `localStorage` con chiavi:

- `tpl-simulator-theme`
- `tpl-simulator-workspace`
- `tpl-simulator-scenarios`

Le chiavi attive sono:

- `tpl-lotti-1-4-theme`
- `tpl-lotti-1-4-workspace`
- `tpl-lotti-1-4-scenarios`
- `tpl-lotti-1-4-hidden-base-scenarios`

Le chiavi `tpl-simulator-*` sono legacy e vanno mantenute leggibili in fallback. Se cambi la forma degli snapshot JSON, aggiorna normalizzazione/import in `src/lib/scenario-persistence.ts` e mantieni compatibilità ragionevole con export precedenti.

## Verifiche prima di chiudere

Scegli verifiche proporzionate al tipo di diff: copri il rischio reale della modifica senza trasformare ogni chiusura in uno smoke test completo.

- Solo documentazione non renderizzata dall'app: `git diff --check`.
- Microcopy o testi statici nell'app, senza modifiche a stato, logica o layout: `npm run build`; aggiungi una verifica browser mirata solo se il testo può rompere layout o leggibilità.
- UI piccola e localizzata: `npm run build`, `npm run preview -- --port 4173` e controllo browser mirato della schermata coinvolta, includendo viewport o tema solo se pertinenti.
- UI sostanziale, layout responsive o flussi utente: `npm run build`, `npm run preview -- --port 4173` e verifica browser desktop/mobile e tema chiaro/scuro dei flussi coinvolti.
- Scoring, dati di gara, persistenza, import/export o ottimizzazione: `npm test` e `npm run build`, più i test mirati indicati nelle sezioni dedicate.
- Configurazione build, routing o deploy: `npm run build` e controllo mirato della configurazione o della rotta coinvolta.

Esegui `npm run smoke` solo quando il diff tocca o rischia di rompere flussi coperti dallo smoke, per esempio salvataggio scenario, schema storage, ottimizzazione, import/export, confronto, report o microcopy critica rimossa. Se salti una verifica più ampia, dichiarane il motivo nella risposta finale.

## Commit e PR

- Mantieni commit piccoli, atomici e coerenti con lo scope reale.
- Usa Conventional Commit in inglese quando non ci sono regole più specifiche: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Prima di commit o PR, fai self-review del diff e verifica che non includa modifiche estranee, file generati o allegati toccati per errore.
- Se lavori su `main` direttamente, stage solo i file pertinenti alla richiesta.
- Per lavori non banali o quando il worktree è già sporco, preferisci branch/worktree `codex/<tema>` e PR o merge esplicito verso `main`.
- Nella descrizione PR o nel riepilogo operativo indica cosa è cambiato, perché, verifiche eseguite, verifiche saltate intenzionalmente e rischi residui.
- Non aggiungere workflow GitHub Actions, policy di release o canali deploy alternativi senza richiesta esplicita.

## Risposte finali e prossimi passi

- Ogni volta che termini un'attività, considera sempre i prossimi passi nelle conclusioni, come nel flusso operativo di Pratix.
- Se c'è un seguito operativo reale, indica i prossimi passi consigliati: devono essere concreti, ordinati e proporzionati al lavoro appena concluso.
- Se ci sono alternative sensate, presentale in modo facile da scegliere, indicando l'effetto pratico di ciascuna.
- Se uno o più test/check falliscono, indica comando fallito, sintomo principale, impatto pratico e prossimo passo consigliato.
- Se non resta un prossimo passo utile, dichiaralo esplicitamente invece di forzare una lista artificiale.
- Evita riepiloghi rituali sui check: cita verifiche, limiti e rischi residui solo quando aiutano a capire lo stato reale del lavoro.

## Definizione di Done

Un'attività è chiusa quando:

- risolve la richiesta senza allargare lo scope;
- non sovrascrive modifiche non tue;
- mantiene coerenza con fonti, dati, UI italiana e deploy Cloudflare;
- include test o controlli proporzionati al rischio del diff;
- non lascia file temporanei, generati o sensibili nel commit;
- aggiorna documentazione, roadmap o note solo quando il cambio lo richiede davvero;
- dichiara esplicitamente limiti, controlli non eseguiti e rischi residui utili.

## Deploy e pubblicazione

Deploy solo su richiesta esplicita.

Quando l'utente dice `pubblica`, `rilascia`, `deploya` o formule equivalenti, interpreta la richiesta come flusso completo di pubblicazione, non come solo comando locale. In questa repository il flusso resta specifico di GLM: Cloudflare Pages progetto `gare-lotti-milanesi`, output Vite `dist`, niente Vercel.

Prima di pubblicare:

1. Verifica `git status --short`.
2. Rileggi il diff e assicurati che siano presenti solo modifiche intenzionali.
3. Se ci sono modifiche di codice o documentazione da portare in produzione, committale in modo esplicito e assicurati che il codice da pubblicare sia su `main` o sia stato mergeato secondo il flusso GitHub della repo. Non pubblicare codice non committato o una branch feature usando il flag `--branch main`.
4. Per ogni modifica visibile nel simulatore, controlla `CHANGELOG.md`: la voce deve stare in una versione rilasciata e `src/lib/version.ts`, `package.json` e `package-lock.json` devono essere sincronizzati dal comando `npm run release`.
5. Classifica il diff e applica le verifiche proporzionate della sezione "Verifiche prima di chiudere":
   - documentazione pura: solo `git diff --check`;
   - microcopy/UI minima: build e controllo mirato solo se serve;
   - UI sostanziale o flussi: build, preview e browser sui flussi coinvolti;
   - codice/logica/dati/persistenza: test mirati, `npm test` e `npm run build`;
   - deploy/configurazione: build e controllo della configurazione toccata.
6. Controlla che non ci siano modifiche indesiderate a `dist/`, `tmp/`, allegati o file generati.
7. Esegui il deploy Cloudflare solo se il diff cambia l'app pubblicata, asset pubblici, routing o configurazione di build/deploy, oppure se l'utente chiede esplicitamente una ridistribuzione anche per modifiche non runtime. In quel caso esegui:

```bash
npm run deploy:cloudflare
```

Al termine verifica la produzione in modo proporzionato, di norma su `https://gare-lotti-milanesi.pages.dev`: caricamento app sempre dopo un deploy, scenario base principale per modifiche runtime, salvataggio/confronto/report solo se coinvolti, tema chiaro/scuro solo per modifiche UI pertinenti. Comunica URL/risultato del deploy se il comando lo fornisce, commit o PR/merge rilevanti, controlli eseguiti, verifiche saltate intenzionalmente e rischi residui.
