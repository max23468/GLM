# Simulatore gara TPL lotti 1-4

Simulatore operativo per ragionare su scenari di aggiudicazione della gara TPL 2026 sui lotti extraurbani 1-4.

L'app non produce offerte ufficiali: aiuta a confrontare operatori, lotti singoli, offerte combinatorie, soglie tecniche, ribassi e criticità documentali ricostruite dagli allegati di gara.

## Avvio rapido

```bash
npm install
npm run dev -- --port 4173
```

Apri `http://127.0.0.1:4173/`.

Per una build locale:

```bash
npm run build
npm run preview -- --port 4173
```

## Cosa fa

- Gestisce scenari, concorrenti e partecipazioni dalla barra laterale `Workspace`, con modalità `Gestisci workspace` e rientro unico tramite `Indietro`.
- Gestisce più concorrenti e la partecipazione ai lotti singoli `L1`, `L2`, `L3`, `L4`.
- Cambia lotto di lavoro dalla scheda centrale, senza aprire la gestione laterale.
- Simula le combinatorie ammesse `L1+L2`, `L2+L3`, `L3+L4`, `L1+L4`.
- Calcola punteggi tecnici Q/T/D, soglia Q/T, riparametrazione per ambito, punteggio economico e scenario vincente.
- Evidenzia warning su soglie, dipendenze, combinatorie non ammissibili, sorteggio e deroga al limite di due lotti.
- Offre scenari base con profili simulati ispirati a fonti pubbliche e allegati locali, senza trasformarli in offerte reali.
- Permette salvataggio locale, duplicazione, import/export JSON e confronto fra scenari.
- Mostra l'analisi puntuale criterio per sub-criterio, con costo stimato e impatto su punteggio/ribasso.
- Usa l'ottimizzazione per partire da un'offerta iniziale, massimizzare il punteggio con leve tecniche e riallocare automaticamente tecnica verso ribasso.
- Genera un report stampabile o salvabile in PDF dal browser.
- Mostra versione locale, data build e changelog bundlato direttamente nel sito.
- Espone una pagina web di istruzioni raggiungibile dal pulsante `Istruzioni` nella testata e dall'URL `/istruzioni/`.
- Supporta tema chiaro/scuro/automatico e layout responsive.

## Scenari base

Gli scenari precompilati sono basi di lavoro, non simulazioni certificate:

- `Mercato realistico`: operatori noti del bacino, combinatorie plausibili e profili tecnici differenziati.
- `Tecnologia e flotta`: maggiore peso a tecnologie di bordo, informazione dinamica e performance ambientali.
- `Ribasso aggressivo`: stress test su soglia Q/T e convenienza economica.
- `Presidio locale`: focus sul lotto 4 e sulle leve territoriali.

Le basi operative degli scenari derivano da documenti locali di gara e segnali pubblici web. Quando si aggiornano questi dati, va mantenuta esplicita la distinzione tra `Documento di gara`, `Fonte pubblica` e `Assunzione simulativa`.

## Mappa del repository

```text
src/App.tsx                            UI principale, gestione workspace laterale, stato, import/export, analisi puntuale criterio e ottimizzazione
src/components/scenario-panels.tsx     Pannelli scenario, confronto, riepilogo e report
src/data/base-scenarios.ts             Scenari base, profili simulati e baseline operative
src/data/tender.ts                     Lotti, coppie, criteri, soglie, fonti e criticità documentali
src/lib/optimization.ts                Motore di ottimizzazione punteggio, leve tecniche e riallocazioni verso ribasso
src/lib/scenario-persistence.ts        Normalizzazione snapshot, migrazione storage e import JSON
src/lib/scoring.ts                     Motore di scoring e selezione scenario
src/lib/tradeoff.ts                    Logica interna di analisi puntuale criterio e costo tecnico
src/lib/version.ts                     Versione applicativa e data build mostrate nel frontend
src/lib/changelog.ts                   Parser del changelog bundlato a build time
src/lib/*.test.ts                      Test Vitest su scoring e persistenza
src/components/instructions-page.tsx   Pagina web navigabile con istruzioni di compilazione
src/components/release-panel.tsx       Scheda Versione e changelog
src/styles.css                         Design system locale e layout responsive
public/_redirects                      Fallback Cloudflare Pages per URL /istruzioni
.github/workflows/ci.yml               CI GitHub Actions con validazione dati, test e build
CHANGELOG.md                           Storico versionato in formato Keep a Changelog
docs/guides/versioning-e-release.md    Procedura SemVer e rilascio
docs/LOGICA_SIMULATORE.md              Logica e assunzioni operative del simulatore
docs/milano-lotti-extraurbani-om/      Allegati di gara versionati con Git LFS
wrangler.toml                          Configurazione Cloudflare Pages
```

Per i dettagli sul calcolo, vedi [`docs/LOGICA_SIMULATORE.md`](docs/LOGICA_SIMULATORE.md).

## Comandi utili

```bash
npm run dev -- --port 4173
npm test
npm run build
npm run validate:data
npm run validate:demo
npm run smoke
npm run prepublish:check
npm run release -- --dry-run
npm run release
npm run preview -- --port 4173
```

`npm test` esegue i test Vitest su scoring, persistenza e dati demo. `npm run validate:data` concentra i controlli automatici su dati gara e scenari demo. `npm run build` esegue TypeScript e build Vite. `npm run smoke` avvia una preview locale e verifica con Playwright i flussi principali della tab `Ottimizzazione`; `npm run prepublish:check` raggruppa i controlli prima della pubblicazione. `npm run release` prepara una nuova versione locale aggiornando `CHANGELOG.md`, `src/lib/version.ts`, `package.json` e `package-lock.json`, ma non esegue il deploy.

## CI e changelog locale

Il repository espone controlli automatici e un changelog locale bundlato nel sito:

- CI GitHub Actions su push, pull request e avvio manuale, con `npm run validate:data`, `npm test` e `npm run build`;
- validatori Vitest per coerenza di lotti, criteri, soglie, fonti, warning e scenari demo;
- pannello `Versione e changelog` con versione locale, data build e note lette da `CHANGELOG.md` a build time, senza link o rimandi a repository esterni nel frontend.

## Fonti e allegati

La logica è ricostruita dai documenti nella cartella `docs/milano-lotti-extraurbani-om`, versionata tramite Git LFS perché contiene allegati binari pesanti. Per clonare il repository con i documenti completi serve Git LFS attivo.

Documenti principali:

- `DISCIPLINARE DI GARA.pdf`
- `All 13 - Offerta tecnica e criteri di valutazione.pdf`
- `All 131_2.XLS`
- `All 18 - Offerta economica.pdf`
- modelli `All 18.1` - `All 18.8`

I costi unitari dell'analisi puntuale criterio e delle leve di ottimizzazione non sono contenuti nei documenti di gara: sono ipotesi dell'utente. Gli scenari base li precompilano come assunzioni operative modificabili, inclusi quantità massime, granularità interna, basi di calcolo e catalogo leve per tutti i lotti. L'ottimizzazione cerca il miglior punteggio raggiungibile con le leve abilitate e i massimali configurati. In modalità `Tecnica + ribasso`, il ribasso può aumentare solo se una rinuncia tecnica libera risorse sufficienti; l'aumento finanziabile viene calcolato automaticamente e non esiste un fondo esterno implicito.

Le fonti pubbliche citate negli scenari base includono Agenzia TPL, ARIA/Sintel, Autoguidovie, Arriva Italia, Gruppo ATM/NET/Movibus e STAR Mobility. Se cambiano metriche, URL o claim pubblici, verificare la fonte e aggiornare anche la data `verifiedAt` in `src/data/tender.ts`.

## Sviluppo

Prima di cambiare la logica di gara:

1. Leggi `src/data/tender.ts` e `src/lib/scoring.ts`.
2. Verifica se il comportamento è già coperto in `src/lib/*.test.ts`.
3. Aggiorna o aggiungi test quando cambiano soglie, formule, combinatorie, ammissibilità o import/export.
4. Esegui almeno `npm test` e `npm run build`.

Per cambiare l'ottimizzazione:

1. Mantieni separata la logica in `src/lib/optimization.ts`.
2. Rivaluta le mosse tramite `simulate()` invece di duplicare formule di scoring.
3. Non includere criteri discrezionali `D` nell'ottimizzazione automatica.
4. Aggiorna `src/lib/optimization.test.ts`, persistenza e documentazione quando cambiano input o output del piano.
5. Verifica la leggibilità di `Dashboard dove investire`, `Mappa impatto per ambito` e `Piano consigliato`.

Prima di cambiare UI o testi:

1. Mantieni la lingua italiana e il tono operativo.
2. Non presentare scenari base o profili simulati come offerte ufficiali.
3. Verifica che i pannelli restino leggibili su desktop e mobile.
4. Per microcopy o UI minima esegui almeno `npm run build` e, se serve, un controllo browser mirato della schermata coinvolta.
5. Esegui `npm run smoke` quando la modifica tocca o rischia di rompere salvataggio scenario, schema storage, ottimizzazione, import/export, confronto o microcopy critica rimossa.

## Versioning

La versione applicativa è definita in `src/lib/version.ts` e sincronizzata con `package.json` e `package-lock.json` dal comando di release.

Il changelog segue il formato Keep a Changelog con sezioni in italiano:

- `### Novità` per capacità nuove e retrocompatibili;
- `### Correzioni` per fix e miglioramenti visibili;
- `### Sotto il cofano` per modifiche tecniche consegnate con il prodotto;
- `### Non versionato` per note o documentazione senza impatto sul prodotto pubblicato.

Per preparare una release:

```bash
npm run release
```

La procedura completa è in [`docs/guides/versioning-e-release.md`](docs/guides/versioning-e-release.md).

## Deploy

Il deploy ufficiale è Cloudflare Pages, progetto `gare-lotti-milanesi`.

L'URL pubblico resta `https://gare-lotti-milanesi.pages.dev`: il project name Cloudflare e lo script di deploy non vanno rinominati senza richiesta esplicita.

```bash
npm run deploy:cloudflare
```

Il comando compila l'app con Vite e pubblica la cartella `dist` sul branch `main`.

Eseguire il deploy solo quando richiesto esplicitamente. Quando la richiesta è `pubblica`, `rilascia`, `deploya` o equivalente, il flusso atteso è una pubblicazione completa ma proporzionata al tipo di diff:

1. verificare `git status --short` e il diff;
2. portare su `main` solo modifiche intenzionali, con commit e PR/merge se necessari;
3. eseguire i check pertinenti:
   - documentazione pura: `git diff --check`;
   - microcopy/UI minima: `npm run build` e controllo mirato solo se utile;
   - UI sostanziale o flussi: `npm run build`, preview e verifica browser dei flussi coinvolti;
   - codice/logica/dati/persistenza: test mirati, `npm test` e `npm run build`;
   - configurazione deploy/build: `npm run build` e controllo della configurazione toccata;
4. controllare che `dist/`, `tmp/`, allegati e file generati non contengano modifiche indesiderate;
5. eseguire `npm run deploy:cloudflare` solo se il diff cambia l'app pubblicata, asset pubblici, routing o configurazione di build/deploy, oppure se viene chiesta esplicitamente una ridistribuzione anche per modifiche non runtime;
6. verificare la produzione su `https://gare-lotti-milanesi.pages.dev` in modo proporzionato: caricamento app sempre dopo un deploy, scenario base principale per modifiche runtime, flussi specifici e temi solo se coinvolti;
7. comunicare risultato, controlli eseguiti, verifiche saltate intenzionalmente e rischi residui.

## Limiti noti

- La ricostruzione dei criteri dipende dagli allegati disponibili e dalle incongruenze già segnalate nel pannello criticità.
- Gli scenari base usano assunzioni simulate e fonti pubbliche, quindi non sostituiscono verifiche legali, tecniche o economiche.
- Il salvataggio è locale nel browser tramite `localStorage`; per condividere uno scenario usare export/import JSON.
- Le fonti pubbliche possono cambiare: data, metriche e affidabilità vanno riverificate prima di usare gli scenari base come base decisionale aggiornata.

## Storage e compatibilità

Le chiavi attive di `localStorage` sono `tpl-lotti-1-4-theme`, `tpl-lotti-1-4-workspace` e `tpl-lotti-1-4-scenarios`.

Gli export correnti usano `schemaVersion: 7` e includono anche la configurazione della tab `Ottimizzazione`, senza tetti finanziari esterni, step economici o massimi di ribasso. Gli scenari salvati con le vecchie chiavi `tpl-simulator-*` o senza configurazione di ottimizzazione restano leggibili: la normalizzazione in `src/lib/scenario-persistence.ts` migra i campi legacy, inclusi `demoScenarioId`, snapshot incompleti, vecchi `stepUnits`, vecchi parametri economici e input mancanti.
