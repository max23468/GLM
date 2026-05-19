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
- `src/lib/optimization.ts`: genera piani di miglioramento da un'offerta iniziale, con leve tecniche e riallocazioni verso ribasso.
- `src/lib/tradeoff.ts`: applica l'analisi puntuale criterio e calcola il relativo costo stimato.
- `src/lib/scenario-persistence.ts`: normalizza workspace, scenari salvati, import JSON e migrazione dai campi legacy.
- `src/App.tsx`: gestisce stato UI, gestione workspace laterale, salvataggio locale, import/export JSON, selezione tab, analisi puntuale criterio e ottimizzazione.
- `src/components/scenario-panels.tsx`: contiene pannelli scenario, riepilogo strategico, confronto e report.
- `src/lib/*.test.ts`: copre motore di scoring e normalizzazione della persistenza.

## Flusso di calcolo

1. Ogni concorrente ha offerte per lotti singoli e combinatorie.
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
9. Il limite ordinario di due lotti per concorrente può essere derogato solo se l'impostazione è attiva e il limite lascerebbe lotti non assegnati.
10. La tab `Ottimizzazione` non sostituisce lo scoring: applica mosse candidate su una copia dello scenario e rivaluta sempre tramite `simulate()`.

## Dati tecnici e quantitativi

Per alcuni criteri il valore non è inserito come numero finale, ma come rapporto operativo:

- numeratore, per esempio autobus attrezzati o corse controllate;
- denominatore, per esempio autobus totali o corse programmate;
- valore calcolato, usato nel punteggio.

Questa scelta rende più chiari i suggerimenti operativi e l'analisi puntuale criterio. Se si aggiunge un nuovo criterio con rapporto derivato, preferire `quantityInput` in `src/data/tender.ts` invece di chiedere all'utente un valore già sintetizzato.

## Analisi Puntuale Criterio

Il pannello di analisi puntuale criterio simula l'effetto di un singolo miglioramento operativo:

- `deltaUnits`: unità operative aggiunte o ridotte;
- `unitCost`: costo unitario ipotizzato;
- `denominator`: base tecnica quando serve calcolare un rapporto.

Il costo totale non arriva dai documenti di gara. È un'ipotesi dell'utente e viene trattato come riduzione del ribasso medio del lotto. Per questo la UI deve continuare a presentarlo come stima, non come dato ufficiale.

Gli scenari base precompilano `deltaUnits`, `unitCost` e `denominator` per ogni lotto e criterio non discrezionale, così l'analisi puntuale criterio è subito utilizzabile anche dopo import o migrazione di snapshot privi dei nuovi campi. I criteri discrezionali restano definiti ma senza costo unitario deterministico.

## Ottimizzazione

L'ottimizzazione parte dall'offerta corrente del concorrente selezionato e tiene fermi gli altri concorrenti. Il motore genera mosse candidate, le applica su copie dello scenario e sceglie progressivamente la leva con maggior incremento di punteggio finché non restano miglioramenti positivi. Il piano massimizza il punteggio entro massimali, costi unitari e input configurati, senza introdurre fondi esterni o ribassi diretti non finanziati.

Quando `Tecnica + ribasso` è attivo, il motore valuta anche riallocazioni tecnico-economiche: riduce una leva tecnica rispetto all'offerta iniziale, calcola le risorse liberate con il costo unitario inserito dall'utente e usa tali risorse per finanziare un maggiore ribasso. La mossa entra nel piano solo se il saldo netto tra punti tecnici persi e punti economici guadagnati è positivo. Il ribasso può aumentare solo tramite questa riallocazione.

Gli obiettivi disponibili sono:

- `Lotto attivo`: massimizza il punteggio dell'offerta singola sul lotto selezionato;
- `Tutti i lotti attivi`: massimizza la somma dei punteggi singoli del concorrente sui lotti attivi;
- `Scenario complessivo`: massimizza il contributo del concorrente nelle assegnazioni dello scenario vincente simulato.

Le modalità considerate sono:

- `Tecnica + ribasso`: confronta leve tecniche Q/T e riallocazioni verso maggiore ribasso economico;
- `Solo tecnica`: usa solo leve tecniche Q/T e ignora il ribasso.

Il costo complessivo stimato del piano resta una lettura gestionale delle mosse consigliate. Per le riallocazioni, il simulatore mostra quante risorse vengono liberate dalla rinuncia tecnica e quanta parte finanzia il maggiore ribasso.

I criteri discrezionali `D` sono esclusi dall'ottimizzazione automatica perché dipendono dal giudizio della Commissione e non hanno una funzione deterministica costo-punteggio nel disciplinare. Restano compilabili manualmente nella tab `Tecnica`.

Per ogni leva tecnica l'utente può indicare:

- `enabled`: se la leva entra nel piano;
- `stepUnits`: incremento operativo valutato a ogni iterazione;
- `maxUnits`: incremento massimo rispetto all'offerta iniziale; se è `0`, il simulatore usa un limite operativo ricavabile dal criterio o dal migliore valore corrente;
- `unitCost`: costo unitario stimato dall'utente;
- `denominator`: base di calcolo quando il criterio è un rapporto.

Per le riallocazioni tecnica-ribasso, `unitCost` viene letto come risorsa liberabile se quella leva tecnica viene ridotta. Sui criteri in cui un valore più alto migliora il punteggio, la riduzione può scendere sotto l'offerta iniziale; se `maxUnits` è maggiore di `0`, limita anche quanto si può sacrificare. Sui criteri inversi, come indici ambientali o consumo di suolo, la rinuncia tecnica richiede `maxUnits` maggiore di `0`, perché il simulatore non può dedurre da solo un peggioramento massimo credibile.

Per la leva economica l'utente indica step e massimo in punti percentuali di ribasso. Il costo è calcolato come minore corrispettivo offerto sul lotto. Anche questo è un input simulativo, non un dato di gara.

## Offerta economica

La sezione economica replica in forma navigabile la struttura dell'All. 18:

- tre ribassi di fase, sui periodi 1-12, 13-24 e 25-84 mesi;
- ribasso medio ponderato sulle basi di fase;
- corrispettivo offerto per fase;
- punteggio economico calcolato come `30 x R(i) / Rmax`;
- lettura dei corrispettivi unitari medi €/km usando le vett*km dei modelli All. 18.1-18.8.

I corrispettivi unitari sono una lettura di gestione della flessibilità contrattuale. Non modificano il punteggio economico e non vanno presentati come valore ufficiale di offerta se l'utente non ha compilato un'offerta reale.

Il simulatore inverso del target economico usa lo scenario corrente come fotografia statica: stima il ribasso medio necessario a raggiungere un punteggio economico scelto rispetto all'`Rmax` corrente. Se il concorrente selezionato è già il riferimento `Rmax`, un ulteriore ribasso non aumenta il suo punteggio oltre 30, ma può ridurre il punteggio relativo degli altri concorrenti.

## Persistenza e scambio scenari

Lo stato vive nel browser:

- `tpl-lotti-1-4-theme`: preferenza tema;
- `tpl-lotti-1-4-workspace`: workspace corrente;
- `tpl-lotti-1-4-scenarios`: scenari salvati.

Le chiavi legacy `tpl-simulator-*` restano lette in fallback. L'import/export usa JSON con snapshot dello scenario; se cambia la forma dei dati, aggiornare i normalizzatori in `src/lib/scenario-persistence.ts` e mantenere compatibilità ragionevole con scenari esportati in precedenza.

Gli snapshot correnti usano `schemaVersion: 5` e includono la configurazione di ottimizzazione senza tetti finanziari esterni o massimi. La normalizzazione deve continuare ad accettare snapshot precedenti privi del blocco `optimization` o con i vecchi campi legacy.

La gestione di scenari, concorrenti, lotti e opzioni di partecipazione è concentrata nella barra laterale. La vista ordinaria mostra solo il riepilogo `Workspace`; il pulsante `Gestisci workspace` apre i controlli laterali e `Indietro` chiude l'intera gestione.

## Scenari base

Gli scenari base sono definiti in `src/data/base-scenarios.ts`:

- `Mercato realistico`
- `Tecnologia e flotta`
- `Ribasso aggressivo`
- `Presidio locale`

Usano basi ricavate dagli allegati locali e segnali pubblici per operatori reali. Non rappresentano offerte ufficiali e non devono essere descritti come tali in UI, README o report.

Ogni scenario base genera anche una configurazione completa di ottimizzazione: modalità, leva economica, scope di default, step, massimali, basi e costi unitari per tutti i lotti. La normalizzazione di workspace e JSON usa questi valori come fallback quando uno scenario salvato non contiene ancora i campi introdotti dall'ottimizzazione.

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
- cambio lotto/concorrente;
- salvataggio scenario;
- import/export JSON;
- pannelli `Tecnica`, `Economica`, `Combinatorie`, `Risultati`;
- tema chiaro/scuro;
- layout mobile.
