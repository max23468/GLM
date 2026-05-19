# Logica del Simulatore

Questa nota descrive come è organizzata la simulazione di `Simulatore gara TPL lotti 1-4` e quali punti verificare quando si evolvono dati, formule o interfaccia.

## Perimetro

Il simulatore modella scenari di aggiudicazione per i lotti `L1`-`L4` della gara TPL 2026. La finalità è esplorativa e operativa: confrontare combinazioni di offerenti, offerte singole, offerte combinatorie, soglie tecniche e ribassi.

Non va usato come fonte ufficiale autonoma. Ogni dato deve restare riconducibile a una delle tre categorie già presenti in `src/data/tender.ts`:

- `Documento di gara`
- `Fonte pubblica`
- `Assunzione simulativa`

## Dove vive la logica

- `src/data/tender.ts`: definisce lotti, coppie combinatorie, ambiti A-G, sub-criteri, soglie Q/T, fonti pubbliche e warning documentali.
- `src/data/base-scenarios.ts`: definisce scenari base, profili simulati, baseline operative e assunzioni numeriche non ufficiali.
- `src/lib/scoring.ts`: calcola punteggi tecnici/economici, ammissibilità combinatorie, ranking lotti e scenario migliore.
- `src/lib/scenario-persistence.ts`: normalizza workspace, scenari salvati, import JSON e migrazione dai campi legacy.
- `src/App.tsx`: gestisce stato UI, salvataggio locale, import/export JSON, selezione tab e tradeoff.
- `src/components/scenario-panels.tsx`: contiene pannelli scenario, riepilogo strategico, confronto e report.
- `src/lib/*.test.ts`: copre motore di scoring e normalizzazione della persistenza.

## Flusso di calcolo

1. Ogni offerente ha offerte per lotti singoli e combinatorie.
2. Per ogni lotto attivo il simulatore calcola i sub-score dei criteri Q/T/D.
3. I criteri Q e T concorrono alla soglia Q/T configurata.
4. Solo le offerte ammesse superano la fase tecnica e ricevono riparametrazione per ambito.
5. Il punteggio economico deriva dai ribassi di fase pesati sulle basi d'asta.
6. Le combinatorie sono ammissibili solo se:
   - entrambi i lotti singoli sono attivi;
   - entrambi superano la soglia tecnica;
   - la coppia non si sovrappone a un'altra coppia non ammessa;
   - il set di coppie rispetta le combinazioni compatibili;
   - inserimento nelle buste e PEF sono coerenti;
   - il valore combinatorio è economicamente migliorativo rispetto alle offerte singole.
7. I candidati singoli e combinatori sono enumerati per costruire scenari di assegnazione.
8. Lo scenario migliore massimizza il punteggio totale, poi il punteggio tecnico.
9. Il limite ordinario di due lotti per offerente può essere derogato solo se l'impostazione è attiva e il limite lascerebbe lotti non assegnati.

## Dati tecnici e quantitativi

Per alcuni criteri il valore non è inserito come numero finale, ma come rapporto operativo:

- numeratore, per esempio autobus attrezzati o corse controllate;
- denominatore, per esempio autobus totali o corse programmate;
- valore calcolato, usato nel punteggio.

Questa scelta rende più chiari i suggerimenti operativi e i tradeoff. Se si aggiunge un nuovo criterio con rapporto derivato, preferire `quantityInput` in `src/data/tender.ts` invece di chiedere all'utente un valore già sintetizzato.

## Tradeoff

Il pannello tradeoff simula l'effetto di un miglioramento operativo:

- `deltaUnits`: unità operative aggiunte o ridotte;
- `unitCost`: costo unitario ipotizzato;
- `denominator`: base tecnica quando serve calcolare un rapporto.

Il costo totale non arriva dai documenti di gara. È un'ipotesi dell'utente e viene trattato come riduzione del ribasso medio del lotto. Per questo la UI deve continuare a presentarlo come stima, non come dato ufficiale.

## Offerta economica

La sezione economica replica in forma navigabile la struttura dell'All. 18:

- tre ribassi di fase, sui periodi 1-12, 13-24 e 25-84 mesi;
- ribasso medio ponderato sulle basi di fase;
- corrispettivo offerto per fase;
- punteggio economico calcolato come `30 x R(i) / Rmax`;
- lettura dei corrispettivi unitari medi €/km usando le vett*km dei modelli All. 18.1-18.8.

I corrispettivi unitari sono una lettura di gestione della flessibilità contrattuale. Non modificano il punteggio economico e non vanno presentati come valore ufficiale di offerta se l'utente non ha compilato un'offerta reale.

Il simulatore inverso del target economico usa lo scenario corrente come fotografia statica: stima il ribasso medio necessario a raggiungere un punteggio economico scelto rispetto all'`Rmax` corrente. Se l'offerente selezionato è già il riferimento `Rmax`, un ulteriore ribasso non aumenta il suo punteggio oltre 30, ma può ridurre il punteggio relativo degli altri concorrenti.

## Persistenza e scambio scenari

Lo stato vive nel browser:

- `tpl-lotti-1-4-theme`: preferenza tema;
- `tpl-lotti-1-4-workspace`: workspace corrente;
- `tpl-lotti-1-4-scenarios`: scenari salvati.

Le chiavi legacy `tpl-simulator-*` restano lette in fallback. L'import/export usa JSON con snapshot dello scenario; se cambia la forma dei dati, aggiornare i normalizzatori in `src/lib/scenario-persistence.ts` e mantenere compatibilità ragionevole con scenari esportati in precedenza.

## Scenari base

Gli scenari base sono definiti in `src/data/base-scenarios.ts`:

- `Mercato realistico`
- `Tecnologia e flotta`
- `Ribasso aggressivo`
- `Presidio locale`

Usano basi ricavate dagli allegati locali e segnali pubblici per operatori reali. Non rappresentano offerte ufficiali e non devono essere descritti come tali in UI, README o report.

## Criticità documentali

Le incongruenze note sono centralizzate in `DOCUMENT_WARNINGS` in `src/data/tender.ts`. Prima di correggere un criterio, verificare se si tratta di:

- refuso del PDF;
- differenza tra tabella e formula;
- differenza tra PDF e modello Excel;
- scelta simulativa intenzionale.

Quando si modifica una scelta ricostruttiva, aggiornare insieme dato, warning e test.

## Verifiche consigliate

Per modifiche solo documentali:

```bash
git diff --check
```

Per modifiche a scoring, dati o import/export:

```bash
npm test
npm run build
```

Per modifiche UI significative:

```bash
npm run build
npm run preview -- --port 4173
```

Poi aprire l'app e controllare almeno:

- caricamento scenario base;
- cambio lotto/offerente;
- salvataggio scenario;
- import/export JSON;
- pannelli `Tecnica`, `Economica`, `Combinatorie`, `Risultati`;
- tema chiaro/scuro;
- layout mobile.
