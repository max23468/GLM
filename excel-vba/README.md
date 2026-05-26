# Template Excel e moduli VBA

Implementazione Excel + VBA del simulatore con estensioni avanzate:

- simulazione punteggi tecnici/economici per lotti L1-L4;
- soglia di sbarramento tecnica;
- ranking per lotto;
- valutazione combinatorie principali (L1+L2, L2+L3, L3+L4, L1+L4);
- scenario vincente per lotti singoli con tie-break su punteggio tecnico;
- foglio `Combinatorie` con input espliciti per coppie, buste, PEF e ribasso migliorativo;
- foglio `ScenarioGlobale` con matrice indicativa singoli/combinatorie compatibili;
- foglio `CriteriTecnici` con input e punteggi dei sub-criteri A-G;
- foglio `ScambioWeb` con JSON copiabile per import/export con il simulatore web;
- ottimizzazione iterativa su lotto attivo con leve separate Q/T (escluso D);
- foglio di confronto golden con expected dal web.

## Template pronto all'uso

Nel pacchetto è incluso `templates/Simulatore-TPL-Lotti-1-4-template.xlsm`, già predisposto con dashboard, guida integrata, fogli operativi allineati all'organizzazione della web app e moduli VBA incorporati. I sorgenti `.bas` restano in `src/` per audit e manutenzione, ma non devono essere importati dall'utente finale.

Fogli visibili nel percorso quotidiano:
1. `Dashboard`
2. `Parametri` (area Scenario)
3. `CriteriTecnici` (area Tecnica)
4. `Offerte` (area Economica)
5. `Ottimizzazione`
6. `Combinatorie`
7. `Risultati`
8. `Guida`

Fogli avanzati presenti ma nascosti per ridurre complessità:
- `Istruzioni`
- `ScenarioGlobale`
- `ScambioWeb`
- `ConfrontoWeb`
- `LogOttimizzazione`
- `Glossario`

Questi fogli restano nel file per formule, macro, audit, scambio JSON con il web e manutenzione. Se servono, possono essere riattivati da Excel con `Mostra foglio`.

## Mappatura minima celle

### Foglio `Parametri`
- `B2`: soglia tecnica
- `B3`: lotto attivo (`L1`/`L2`/`L3`/`L4`)

### Foglio `Offerte`
- `A`: BidderId
- `B`: BidderNome
- `C`: Lotto (`L1`..`L4`)
- `D`: Attivo (`1/0`)
- `E`: TecnicoRiparametrato (0-70), alimentato da `CriteriTecnici`
- `F`: RibassoMedioPercento (0-100)
- `G:P`: colonne calcolate per ammissibilità, `Rmax`, economico, totale, chiavi di scenario, soglia Q/T e fonte del tecnico.

### Foglio `CriteriTecnici`
- `A:C`: collegamento a `BidderId`, `BidderNome` e `Lotto` della riga offerta.
- `D:I`: metadati del sub-criterio A-G.
- `J:M`: input utente per valore, numeratore/denominatore, flag tabellare o coefficiente discrezionale.
- `N:O`: valore calcolato e punteggio raw del sub-criterio.
- `Q:T`: chiavi tecniche nascoste usate da formule, ammissibilità e scambio web.

### Foglio `Combinatorie`
- `A`: BidderId
- `C`: Coppia (`L1+L2`, `L2+L3`, `L3+L4`, `L1+L4`)
- `D`: Attivo (`1/0`)
- `E`: RibassoCombinatoria (0-100)
- `F`: InseritoBuste (`1/0`)
- `G`: PEFCoerente (`1/0`)
- `H:W`: colonne calcolate per lotti, soglia, ammissibilità, punteggio, note e chiavi.

### Foglio `ScambioWeb`
- `A`: JSON generato dal workbook.
- Formato: `glm-excel-v1`.
- Campi offerta: `bidderId`, `bidderName`, `lotId`, `enabled`, `technicalRaw`, `discount`.
- Campi criterio: `bidderId`, `lotId`, `criterionId`, `kind`, `value`, `numerator`, `denominator`, `flag`, `rawScore`.
- Campi combinatoria: `bidderId`, `bidderName`, `pairId`, `enabled`, `discount`, `insertedInBothBuste`, `pefCoherent`.

### Foglio `Ottimizzazione`
- `B2`: BidderId selezionato
- `B3`: Max iterazioni
- `B4`: Delta tecnico leva Q
- `B6`: Delta ribasso finanziabile per step
- `B7`: Tetto tecnico leva Q
- `B8`: Delta tecnico leva T
- `B9`: Tetto tecnico leva T

## Macro principali
- `CheckBeforeRun`
- `SimulaScenario`
- `ValutaCombinatorie`
- `OttimizzaLottoAttivo`
- `ResetLogOttimizzazione`
- `ConfrontoWebGolden`

## Avvio rapido (ready to use)
1. Apri `templates/Simulatore-TPL-Lotti-1-4-template.xlsm`.
2. Abilita le macro se Excel lo richiede.
3. Verifica `Parametri` e aggiorna `Offerte` (puoi partire da `templates/offerte-esempio.csv`).
4. Esegui in ordine: `CheckBeforeRun`, `SimulaScenario`, `OttimizzaLottoAttivo`, `ConfrontoWebGolden`.
5. Se devi passare al web, copia il JSON generato in `ScambioWeb`.
6. Per uso quotidiano, assegna queste macro alla Barra di accesso rapido di Excel (File > Opzioni > Barra di accesso rapido).

## Come usare il confronto golden
1. Esegui `SimulaScenario`.
2. Apri il tool web con lo stesso input scenario.
3. Copia i totali migliori lotto in `ConfrontoWeb!J2:J5`.
4. Esegui `ConfrontoWebGolden`.
5. Verifica esito `OK/KO` con tolleranza.


## Gap analysis: Excel vs Web

### Coperto nel pacchetto Excel VBA
- Simulazione per lotto con soglia tecnica e punteggio economico.
- Calcolo tecnico da sub-criteri A-G tramite foglio `CriteriTecnici`.
- Valutazione combinatorie principali (`L1+L2`, `L2+L3`, `L3+L4`, `L1+L4`).
- Ottimizzazione iterativa su lotto attivo con log iterazioni.
- Scambio JSON con il simulatore web tramite foglio `ScambioWeb`.
- Confronto golden con valori attesi dal tool web.

### Gap funzionali rispetto al tool Web
- **Modello criteri**: Excel ora espone i sub-criteri A-G, ma alcune letture documentali avanzate e warning restano più ricchi nel web.
- **Combinatorie**: la logica Excel è semplificata e non copre integralmente tutti i vincoli documentali e i warning avanzati.
- **Scenario globale**: la matrice Excel confronta singoli e coppie compatibili principali, ma non replica ancora enumerazione completa, deroga al limite di due lotti e batch/stress test del web.
- **Persistenza**: lo scambio `glm-excel-v1` è supportato, ma non sostituisce snapshot completi, migrazioni schema/versioni e compatibilità legacy del web.
- **UX operativa**: assenti confronto scenari salvati, report estesi, pannelli insight e filtri completi della UI React.

### Gap non funzionali
- **Test automatici**: VBA non ha suite automatica equivalente a `npm test`.
- **Tracciabilità release**: il pacchetto Excel non ha pipeline CI/CD o smoke test automatico.
- **Manutenibilità**: maggiore rischio divergenza formula/comportamento tra Excel e web nel tempo.

### Priorità di chiusura gap consigliata
1. Allineare formule di scoring e warning critici con casi golden versionati.
2. Estendere i warning documentali nel workbook senza duplicare logica non necessaria.
3. Aggiungere batteria di test regressivi macro (casi campione su file dedicato).


## Versione pacchetto web

Il sito legge il badge versione da `public/downloads/pacchetto-excel-vba.manifest.json`.
Quando aggiorni il workbook pubblico, aggiorna anche il manifest (`version`, `builtAt`, `sha256`, `file`, `templateFile`, `minAppVersion`, `generatedBy`).

## Manutenzione del template `.xlsm`

Quando modifichi i sorgenti `src/*.bas`, apri `templates/Simulatore-TPL-Lotti-1-4-template.xlsm`, sostituisci o reimporta i moduli nel progetto VBA, salva il workbook, rifinisci layout/guida con `scripts/enhance-excel-workbook.py` e poi rigenera il file pubblico con `npm run package:excel`.


## Priorità implementate

1. **Golden versionati**: aggiunto `templates/golden-cases.csv` per tracciare expected Lotto L1-L4.
2. **Leve Q/T**: ottimizzazione con step separati e massimali distinti per ridurre divergenza con web.
3. **Validazioni macro**: aggiunto `modChecks.bas` con `CheckBeforeRun` e verifica setup fogli/soglia.
4. **Packaging ripetibile**: aggiunto script `scripts/package-excel-vba.mjs` per rigenerare workbook pubblico + manifest + hash dal template `.xlsm` macro-abilitato.
5. **Confronto strutturato**: `ConfrontoWebGolden` ora include colonna lotto e output tabellare più esplicito.
6. **Matrice scenario globale**: aggiunti `Combinatorie` e `ScenarioGlobale` per leggere in Excel singoli e coppie compatibili senza file esterni.
7. **Criteri tecnici A-G**: aggiunto `CriteriTecnici` per calcolare il tecnico dai sub-criteri invece che da un solo aggregato.
8. **Scambio Excel-web**: aggiunto `ScambioWeb` con payload `glm-excel-v1` copiabile e importabile dalla web app.

## Prossimi step operativi (1-4)

1. Compilare `templates/golden-cases.csv` con expected reali per 5-10 scenari campione.
2. Eseguire `npm run package:excel` ad ogni aggiornamento del toolkit prima del rilascio.
3. Usare il badge web con tooltip hash breve per verificare l'allineamento del file scaricato.
4. Eseguire `CheckBeforeRun` nel workbook prima di simulazione/ottimizzazione.


## Golden session consigliata (operativa)

1. Carica `templates/offerte-esempio.csv` in `Offerte`.
2. Esegui `CheckBeforeRun`.
3. Esegui `SimulaScenario`.
4. Sul web replica lo stesso scenario e annota i totali migliori lotto.
5. Inserisci gli expected nel file `templates/golden-cases.csv` e in `ConfrontoWeb!J2:J5`.
6. Esegui `ConfrontoWebGolden` e salva esiti `OK/KO`.


## Verifica pacchetto

Dopo `npm run package:excel`, esegui `npm run validate:excel-package` per verificare hash, schema manifest, presenza del file `.xlsm` unico, fogli operativi principali, content type macro-enabled e progetto VBA incorporato.
