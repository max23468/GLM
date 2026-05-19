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

- Gestisce più offerenti e la partecipazione ai lotti singoli `L1`, `L2`, `L3`, `L4`.
- Simula le combinatorie ammesse `L1+L2`, `L2+L3`, `L3+L4`, `L1+L4`.
- Calcola punteggi tecnici Q/T/D, soglia Q/T, riparametrazione per ambito, punteggio economico e scenario vincente.
- Evidenzia warning su soglie, dipendenze, combinatorie non ammissibili, sorteggio e deroga al limite di due lotti.
- Offre scenari base con profili simulati ispirati a fonti pubbliche e allegati locali, senza trasformarli in offerte reali.
- Permette salvataggio locale, duplicazione, import/export JSON e confronto fra scenari.
- Mostra tradeoff tecnico/economici per sub-criterio, con costo stimato e impatto su punteggio/ribasso.
- Genera un report stampabile o salvabile in PDF dal browser.
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
src/App.tsx                            UI principale, stato workspace, import/export e tradeoff
src/components/scenario-panels.tsx     Pannelli scenario, confronto, riepilogo e report
src/data/base-scenarios.ts             Scenari base, profili simulati e baseline operative
src/data/tender.ts                     Lotti, coppie, criteri, soglie, fonti e criticità documentali
src/lib/scenario-persistence.ts        Normalizzazione snapshot, migrazione storage e import JSON
src/lib/scoring.ts                     Motore di scoring e selezione scenario
src/lib/*.test.ts                      Test Vitest su scoring e persistenza
src/components/instructions-page.tsx   Pagina web navigabile con istruzioni di compilazione
src/styles.css                         Design system locale e layout responsive
public/_redirects                      Fallback Cloudflare Pages per URL /istruzioni
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
npm run preview -- --port 4173
```

`npm test` esegue i test Vitest su scoring e persistenza. `npm run build` esegue TypeScript e build Vite.

## Fonti e allegati

La logica è ricostruita dai documenti nella cartella `docs/milano-lotti-extraurbani-om`, versionata tramite Git LFS perché contiene allegati binari pesanti. Per clonare il repository con i documenti completi serve Git LFS attivo.

Documenti principali:

- `DISCIPLINARE DI GARA.pdf`
- `All 13 - Offerta tecnica e criteri di valutazione.pdf`
- `All 131_2.XLS`
- `All 18 - Offerta economica.pdf`
- modelli `All 18.1` - `All 18.8`

I costi unitari dei tradeoff non sono contenuti nei documenti di gara: sono ipotesi dell'utente e vengono trattati come riduzione del ribasso medio del lotto.

Le fonti pubbliche citate negli scenari base includono Agenzia TPL, ARIA/Sintel, Autoguidovie, Arriva Italia, Gruppo ATM/NET/Movibus e STAR Mobility. Se cambiano metriche, URL o claim pubblici, verificare la fonte e aggiornare anche la data `verifiedAt` in `src/data/tender.ts`.

## Sviluppo

Prima di cambiare la logica di gara:

1. Leggi `src/data/tender.ts` e `src/lib/scoring.ts`.
2. Verifica se il comportamento è già coperto in `src/lib/*.test.ts`.
3. Aggiorna o aggiungi test quando cambiano soglie, formule, combinatorie, ammissibilità o import/export.
4. Esegui almeno `npm test` e `npm run build`.

Prima di cambiare UI o testi:

1. Mantieni la lingua italiana e il tono operativo.
2. Non presentare scenari base o profili simulati come offerte ufficiali.
3. Verifica che i pannelli restino leggibili su desktop e mobile.

## Deploy

Il deploy ufficiale è Cloudflare Pages, progetto `gare-lotti-milanesi`.

L'URL pubblico resta `https://gare-lotti-milanesi.pages.dev`: il project name Cloudflare e lo script di deploy non vanno rinominati senza richiesta esplicita.

```bash
npm run deploy:cloudflare
```

Il comando compila l'app con Vite e pubblica la cartella `dist` sul branch `main`.

Eseguire il deploy solo quando richiesto esplicitamente. Quando la richiesta è `pubblica`, `rilascia`, `deploya` o equivalente, il flusso atteso è una pubblicazione completa:

1. verificare `git status --short` e il diff;
2. portare su `main` solo modifiche intenzionali, con commit e PR/merge se necessari;
3. eseguire i check pertinenti (`git diff --check` per documenti, `npm test` e `npm run build` per codice/logica, preview e verifica browser per UI);
4. controllare che `dist/`, `tmp/`, allegati e file generati non contengano modifiche indesiderate;
5. eseguire `npm run deploy:cloudflare`;
6. verificare la produzione su `https://gare-lotti-milanesi.pages.dev` e comunicare risultato, controlli e rischi residui.

## Limiti noti

- La ricostruzione dei criteri dipende dagli allegati disponibili e dalle incongruenze già segnalate nel pannello criticità.
- Gli scenari base usano assunzioni simulate e fonti pubbliche, quindi non sostituiscono verifiche legali, tecniche o economiche.
- Il salvataggio è locale nel browser tramite `localStorage`; per condividere uno scenario usare export/import JSON.
- Le fonti pubbliche possono cambiare: data, metriche e affidabilità vanno riverificate prima di usare gli scenari base come base decisionale aggiornata.

## Storage e compatibilità

Le chiavi attive di `localStorage` sono `tpl-lotti-1-4-theme`, `tpl-lotti-1-4-workspace` e `tpl-lotti-1-4-scenarios`.

Gli export e gli scenari salvati con le vecchie chiavi `tpl-simulator-*` restano leggibili: la normalizzazione in `src/lib/scenario-persistence.ts` migra i campi legacy, inclusi `demoScenarioId` e snapshot incompleti.
