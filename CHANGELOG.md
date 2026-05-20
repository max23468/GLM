# Changelog

Tutte le modifiche significative al Simulatore gara TPL lotti 1-4 sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il versionamento aderisce a [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

## [0.2.0] — 2026-05-20

### Novità

- **Versione e changelog**: la scheda nel simulatore mostra direttamente versione corrente, data build e note delle release, senza rimandi tecnici esterni.
- **Versioning SemVer**: aggiunto un comando di rilascio locale per chiudere il blocco non rilasciato e preparare la versione successiva.

### Sotto il cofano

- **Release Cloudflare**: documentata la procedura che separa preparazione della versione e pubblicazione su Cloudflare Pages.

## [0.1.0] — 2026-05-20

### Novità

- **Console simulatore**: gestione workspace, concorrenti, lotti singoli e combinatorie ammesse per la gara TPL lotti 1-4.
- **Motore di scoring**: calcolo locale di punteggi Q/T/D, soglie, riparametrazione, punteggio economico e scenario vincente.
- **Scenari base**: profili simulati, fonti e warning documentali separati tra documento di gara, fonte pubblica e assunzione simulativa.
- **Import/export e report**: salvataggio locale, duplicazione, import/export JSON, confronto tra scenari e report stampabile.
- **Ottimizzazione**: analisi puntuale dei criteri e piano consigliato per riallocare investimenti tecnici verso ribasso quando sostenibile.

### Sotto il cofano

- **Cloudflare Pages**: configurazione di build e deploy per il progetto `gare-lotti-milanesi`.
