# Gare Lotti Milanesi

Simulatore operativo per ragionare su scenari di aggiudicazione della gara TPL MLMP 2026 sui lotti extraurbani 1-4.

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
- Offre preset demo ispirati a fonti pubbliche e allegati locali, senza trasformarli in offerte reali.
- Permette salvataggio locale, duplicazione, import/export JSON e confronto fra scenari.
- Mostra tradeoff tecnico/economici per sub-criterio, con costo stimato e impatto su punteggio/ribasso.
- Genera un report stampabile o salvabile in PDF dal browser.
- Supporta tema chiaro/scuro/automatico e layout responsive.

## Scenari demo

Gli scenari precompilati sono basi di lavoro, non simulazioni certificate:

- `Mercato realistico`: operatori noti del bacino, combinatorie plausibili e profili tecnici differenziati.
- `Tecnologia e flotta`: maggiore peso a tecnologie di bordo, informazione dinamica e performance ambientali.
- `Ribasso aggressivo`: stress test su soglia Q/T e convenienza economica.
- `Presidio locale`: focus sul lotto 4 e sulle leve territoriali.

Le basi operative dei preset derivano da documenti locali di gara e segnali pubblici web. Quando si aggiornano questi dati, va mantenuta esplicita la distinzione tra `Documento di gara`, `Fonte pubblica` e `Assunzione demo`.

## Mappa del repository

```text
src/App.tsx                         UI principale, stato workspace, preset demo, import/export
src/components/scenario-panels.tsx  Pannelli scenario, confronto, riepilogo e report
src/data/tender.ts                  Lotti, coppie, criteri, soglie, fonti e criticità documentali
src/lib/scoring.ts                  Motore di scoring e selezione scenario
src/lib/scoring.test.ts             Test Vitest sulla logica di simulazione
src/styles.css                      Design system locale e layout responsive
milano-lotti-extraurbani-om/        Allegati di gara versionati con Git LFS
wrangler.toml                       Configurazione Cloudflare Pages
```

Per i dettagli sul calcolo, vedi [`docs/LOGICA_SIMULATORE.md`](docs/LOGICA_SIMULATORE.md).

## Comandi utili

```bash
npm run dev -- --port 4173
npm test
npm run build
npm run preview -- --port 4173
```

`npm test` esegue i test Vitest sul motore di scoring. `npm run build` esegue TypeScript e build Vite.

## Fonti e allegati

La logica è ricostruita dai documenti nella cartella `milano-lotti-extraurbani-om`, versionata tramite Git LFS perché contiene allegati binari pesanti. Per clonare il repository con i documenti completi serve Git LFS attivo.

Documenti principali:

- `DISCIPLINARE DI GARA.pdf`
- `All 13 - Offerta tecnica e criteri di valutazione.pdf`
- `All 131_2.XLS`
- `All 18 - Offerta economica.pdf`
- modelli `All 18.1` - `All 18.8`

I costi unitari dei tradeoff non sono contenuti nei documenti di gara: sono ipotesi dell'utente e vengono trattati come riduzione del ribasso medio del lotto.

Le fonti pubbliche citate negli scenari demo includono Agenzia TPL MLMP, ARIA/Sintel, Autoguidovie, Arriva Italia, Gruppo ATM/NET/Movibus e STAR Mobility. Se cambiano metriche, URL o claim pubblici, verificare la fonte e aggiornare anche la data `verifiedAt` in `src/data/tender.ts`.

## Sviluppo

Prima di cambiare la logica di gara:

1. Leggi `src/data/tender.ts` e `src/lib/scoring.ts`.
2. Verifica se il comportamento è già coperto in `src/lib/scoring.test.ts`.
3. Aggiorna o aggiungi test quando cambiano soglie, formule, combinatorie, ammissibilità o import/export.
4. Esegui almeno `npm test` e `npm run build`.

Prima di cambiare UI o testi:

1. Mantieni la lingua italiana e il tono operativo.
2. Non presentare preset demo come offerte ufficiali.
3. Verifica che i pannelli restino leggibili su desktop e mobile.

## Deploy

Il deploy ufficiale è Cloudflare Pages, progetto `gare-lotti-milanesi`.

```bash
npm run deploy:cloudflare
```

Il comando compila l'app con Vite e pubblica la cartella `dist` sul branch `main`.

Eseguire il deploy solo quando richiesto esplicitamente e dopo aver verificato build, test e stato Git.

## Limiti noti

- La ricostruzione dei criteri dipende dagli allegati disponibili e dalle incongruenze già segnalate nel pannello criticità.
- Gli scenari demo usano assunzioni simulate e fonti pubbliche, quindi non sostituiscono verifiche legali, tecniche o economiche.
- Il salvataggio è locale nel browser tramite `localStorage`; per condividere uno scenario usare export/import JSON.
- Le fonti pubbliche possono cambiare: data, metriche e affidabilità vanno riverificate prima di usare i preset come base decisionale aggiornata.
