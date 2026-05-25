# Versione Excel avanzata (VBA/Macro)

Implementazione Excel + VBA del simulatore con estensioni avanzate:

- simulazione punteggi tecnici/economici per lotti L1-L4;
- soglia di sbarramento tecnica;
- ranking per lotto;
- valutazione combinatorie principali (L1+L2, L2+L3, L3+L4, L1+L4);
- scenario vincente per lotti singoli con tie-break su punteggio tecnico;
- ottimizzazione iterativa su lotto attivo con leve separate Q/T (escluso D);
- foglio di confronto golden con expected dal web.

## Template pronto all'uso

Nel pacchetto è incluso `templates/Simulatore-TPL-Lotti-1-4-template.xlsm`, già predisposto con fogli, intestazioni, parametri base, log ottimizzazione e sezione confronto web.

Fogli inclusi nel template:
1. `Istruzioni`
2. `Parametri`
3. `Offerte`
4. `Risultati`
5. `Ottimizzazione`
6. `LogOttimizzazione`
7. `ConfrontoWeb`

## Mappatura minima celle

### Foglio `Parametri`
- `B2`: soglia tecnica
- `B3`: lotto attivo (`L1`/`L2`/`L3`/`L4`)

### Foglio `Offerte`
- `A`: BidderId
- `B`: BidderNome
- `C`: Lotto (`L1`..`L4`)
- `D`: Attivo (`1/0`)
- `E`: PunteggioTecnicoRaw (0-70)
- `F`: RibassoMedioPercento (0-100)

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
2. Premi `ALT+F11` e importa tutti i moduli `.bas` da `src/`.
3. Verifica `Parametri` e aggiorna `Offerte` (puoi partire da `templates/offerte-esempio.csv`).
4. Esegui in ordine: `CheckBeforeRun`, `SimulaScenario`, `OttimizzaLottoAttivo`, `ConfrontoWebGolden`.
5. Per uso quotidiano, assegna queste macro alla Barra di accesso rapido di Excel (File > Opzioni > Barra di accesso rapido).

## Come usare il confronto golden
1. Esegui `SimulaScenario`.
2. Apri il tool web con lo stesso input scenario.
3. Copia i totali migliori lotto in `ConfrontoWeb!J2:J5`.
4. Esegui `ConfrontoWebGolden`.
5. Verifica esito `OK/KO` con tolleranza.


## Gap analysis: Excel vs Web

### Coperto nel pacchetto Excel VBA
- Simulazione per lotto con soglia tecnica e punteggio economico.
- Valutazione combinatorie principali (`L1+L2`, `L2+L3`, `L3+L4`, `L1+L4`).
- Ottimizzazione iterativa su lotto attivo con log iterazioni.
- Confronto golden con valori attesi dal tool web.

### Gap funzionali rispetto al tool Web
- **Modello criteri**: Excel usa leve aggregate e non replica ancora tutti i sub-criteri A-G con pari granularità.
- **Combinatorie**: la logica Excel è semplificata e non copre integralmente tutti i vincoli documentali e i warning avanzati.
- **Scenario globale**: manca un motore completo di enumerazione/cross-scenario equivalente al ranking avanzato del web.
- **Persistenza**: non ci sono migrazioni schema/versioni snapshot e compatibilità legacy come nel web.
- **UX operativa**: assenti confronto scenari salvati, report estesi, pannelli insight e filtri completi della UI React.

### Gap non funzionali
- **Test automatici**: VBA non ha suite automatica equivalente a `npm test`.
- **Tracciabilità release**: il pacchetto Excel non ha pipeline CI/CD o smoke test automatico.
- **Manutenibilità**: maggiore rischio divergenza formula/comportamento tra Excel e web nel tempo.

### Priorità di chiusura gap consigliata
1. Allineare formule di scoring e warning critici con casi golden versionati.
2. Portare le leve da aggregate a struttura per criterio (Q/T), mantenendo esclusione discrezionali `D`.
3. Introdurre export/import snapshot Excel stabile e controlli di validazione in macro.
4. Aggiungere batteria di test regressivi macro (casi campione su file dedicato).


## Versione pacchetto web

Il sito legge il badge versione da `public/downloads/pacchetto-excel-vba.manifest.json`.
Quando aggiorni lo ZIP, aggiorna anche il manifest (`version`, `builtAt`, `sha256`, `templateFile`, `minAppVersion`, `generatedBy`).


## Priorità implementate

1. **Golden versionati**: aggiunto `templates/golden-cases.csv` per tracciare expected Lotto L1-L4.
2. **Leve Q/T**: ottimizzazione con step separati e massimali distinti per ridurre divergenza con web.
3. **Validazioni macro**: aggiunto `modChecks.bas` con `CheckBeforeRun` e verifica setup fogli/soglia.
4. **Packaging ripetibile**: aggiunto script `scripts/package-excel-vba.mjs` per rigenerare ZIP + manifest + hash.
5. **Confronto strutturato**: `ConfrontoWebGolden` ora include colonna lotto e output tabellare più esplicito.


## Modalità di prodotto

Questa implementazione segue modalità **light**: supporto operativo offline e confronto rapido, senza parità completa con il motore web.

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

Dopo `npm run package:excel`, esegui `npm run validate:excel-package` per verificare hash, schema manifest e presenza del template XLSM nello ZIP.
