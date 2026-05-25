# Changelog

Tutte le modifiche significative al Simulatore gara TPL lotti 1-4 sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

### Novità

- **Pacchetto Excel**: aggiunti controlli setup e validazione dati pre-run, template golden con metadati fonte/verifica e tooltip hash sul badge versione.
- **Pacchetto Excel**: definita modalità light e routine operativa golden/package per allineare più rapidamente Excel e simulatore web.
- **Download Excel**: aggiunto in testata il pulsante `Pacchetto Excel` accanto a `Istruzioni`, per scaricare subito il toolkit VBA del simulatore.
- **Download Excel**: il badge accanto al pulsante mostra ora versione e data lette dal manifest del pacchetto, così resta allineato agli aggiornamenti del file scaricabile.

## [1.1.1] — 2026-05-23

### Correzioni

- **Interfaccia**: migliorata accessibilità e robustezza dei controlli di scenario, criteri, ottimizzazione e risultati senza cambiare le formule di simulazione.

## [1.1.0] — 2026-05-20

### Novità

- **Pacchetto Excel**: aggiunti controlli setup e validazione dati pre-run, template golden con metadati fonte/verifica e tooltip hash sul badge versione.
- **Pacchetto Excel**: definita modalità light e routine operativa golden/package per allineare più rapidamente Excel e simulatore web.
- **Lotto di lavoro**: il simulatore permette di lavorare solo sui lotti a cui partecipa il concorrente selezionato e riallinea il focus quando la partecipazione cambia.
- **Economica**: aggiunta una lettura PEF/CEA con stress rapido sui ribassi, scostamento €/km fra fasi e margine simulato dopo i costi puntuali.
- **Risultati**: aggiunta una matrice batch che incrocia soglie, deroga e stress ribasso per individuare lotti fragili e varianti ancora stabili.
- **Reset totale**: nuovo comando per riportare workspace, scenari salvati, input e preferenze locali allo stato iniziale del simulatore.

### Correzioni

- **Import JSON**: gli scenari importati sono più robusti con file incapsulati, librerie esportate, ID concorrente duplicati e valori booleani legacy.
- **Fonti e soglie**: aggiornate le verifiche delle fonti pubbliche e resa più esplicita la lettura operativa della soglia di sbarramento.
- **Sidebar**: la barra laterale resta integrata nello scroll della pagina e non introduce spostamenti orizzontali quando cambia il contenuto.

## [1.0.0] — 2026-05-20

### Novità

- **Pacchetto Excel**: aggiunti controlli setup e validazione dati pre-run, template golden con metadati fonte/verifica e tooltip hash sul badge versione.
- **Pacchetto Excel**: definita modalità light e routine operativa golden/package per allineare più rapidamente Excel e simulatore web.
- **Qualità decisionale**: il confronto scenari evidenzia delta totale, lotti cambiati, warning nuovi/risolti e dettaglio per lotto; i risultati includono lettura decisionale, scarto dal secondo e sensitività rapida su soglie e deroga.

## [0.2.12] — 2026-05-20

### Correzioni

- **Offerta tecnica**: le descrizioni nei bottoni rapidi dei sotto-criteri restano leggibili per intero, senza tagli nelle label lunghe.

## [0.2.11] — 2026-05-20

### Correzioni

- **Offerta tecnica**: aggiunti bottoni rapidi per selezionare i sotto-criteri dell'ambito attivo, con codice, titolo e punteggio visibili prima dell'editor.

## [0.2.10] — 2026-05-20

### Correzioni

- **Import JSON**: quando un file viene aggiornato alla forma corrente, il simulatore indica quali parti sono state ricostruite invece di importare in silenzio.

## [0.2.9] — 2026-05-20

### Correzioni

- **Interfaccia**: rimossi duplicati tra riepilogo, focus operativo e pannelli insight; gli scenari base sono più compatti e le azioni di gestione restano nascoste finché servono.

## [0.2.8] — 2026-05-20

### Correzioni

- **Economica**: resa esplicita la voce `valori complessivi` nel modello All. 18.

## [0.2.7] — 2026-05-20

### Correzioni

- **Punteggi sotto criterio**: la tabella include subtotali per ambito, offerta economica e totale offerta, con colonne più compatte su desktop.

## [0.2.6] — 2026-05-20

### Correzioni

- **Punteggi sotto criterio**: la tabella mostra solo i concorrenti che partecipano al lotto selezionato, senza colonne `non partecipa` o celle `n/p`.
- **Versione pubblica**: rafforzati i controlli di stato e integrità della build online, così la verifica della versione pubblicata è più affidabile.

## [0.2.5] — 2026-05-20

### Correzioni

- **Riepilogo scenario**: il box alto mantiene solo l'azione `Risultati`, evitando scorciatoie duplicate verso `Tecnica` ed `Economica`.

## [0.2.4] — 2026-05-20

### Correzioni

- **Criteri tecnici**: la tab `Tecnica` mostra sempre tutti i criteri dell'ambito senza pulsanti filtro non necessari.

## [0.2.3] — 2026-05-20

### Correzioni

- **Soglia di sbarramento**: il simulatore usa una dicitura più chiara e mostra un indicatore con spunta o X senza esporre il punteggio tecnico grezzo nella vista principale.

## [0.2.2] — 2026-05-20

### Correzioni

- **Punteggi scenario**: riepilogo, risultati, assegnazioni e confronto scenari mostrano i valori separati per lotto invece del punteggio aggregato sui quattro lotti.
- **Istruzioni**: l'indice della guida è navigabile, include il percorso rapido e indica visivamente la sezione attiva durante la lettura.

## [0.2.1] — 2026-05-20

### Correzioni

- **Sidebar workspace**: la barra laterale mostra subito le azioni operative senza passare da `Gestisci workspace`, sposta `Parametri` in fondo e rende gli scenari base eliminabili/ripristinabili con righe coerenti con il resto della sidebar.
- **Changelog**: il pannello mostra solo note utili all'uso del simulatore e omette le versioni composte soltanto da cambiamenti interni.

## [0.2.0] — 2026-05-20

### Novità

- **Pacchetto Excel**: aggiunti controlli setup e validazione dati pre-run, template golden con metadati fonte/verifica e tooltip hash sul badge versione.
- **Pacchetto Excel**: definita modalità light e routine operativa golden/package per allineare più rapidamente Excel e simulatore web.
- **Versione e changelog**: la scheda nel simulatore mostra direttamente versione corrente, data build e note delle release, senza rimandi tecnici esterni.

## [0.1.0] — 2026-05-20

### Novità

- **Pacchetto Excel**: aggiunti controlli setup e validazione dati pre-run, template golden con metadati fonte/verifica e tooltip hash sul badge versione.
- **Pacchetto Excel**: definita modalità light e routine operativa golden/package per allineare più rapidamente Excel e simulatore web.
- **Console simulatore**: gestione workspace, concorrenti, lotti singoli e combinatorie ammesse per la gara TPL lotti 1-4.
- **Motore di scoring**: calcolo locale di punteggi tecnici, soglie di sbarramento, riparametrazione, punteggio economico e scenario vincente.
- **Scenari base**: profili simulati, fonti e warning documentali separati tra documento di gara, fonte pubblica e assunzione simulativa.
- **Import/export e report**: salvataggio locale, duplicazione, import/export JSON, confronto tra scenari e report stampabile.
- **Ottimizzazione**: analisi puntuale dei criteri e piano consigliato per riallocare investimenti tecnici verso ribasso quando sostenibile.
