# Changelog

Tutte le modifiche significative al Simulatore gara TPL lotti 1-4 sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

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

- **Versione e changelog**: la scheda nel simulatore mostra direttamente versione corrente, data build e note delle release, senza rimandi tecnici esterni.

## [0.1.0] — 2026-05-20

### Novità

- **Console simulatore**: gestione workspace, concorrenti, lotti singoli e combinatorie ammesse per la gara TPL lotti 1-4.
- **Motore di scoring**: calcolo locale di punteggi tecnici, soglie di sbarramento, riparametrazione, punteggio economico e scenario vincente.
- **Scenari base**: profili simulati, fonti e warning documentali separati tra documento di gara, fonte pubblica e assunzione simulativa.
- **Import/export e report**: salvataggio locale, duplicazione, import/export JSON, confronto tra scenari e report stampabile.
- **Ottimizzazione**: analisi puntuale dei criteri e piano consigliato per riallocare investimenti tecnici verso ribasso quando sostenibile.
