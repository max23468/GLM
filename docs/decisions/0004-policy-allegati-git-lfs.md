# 0004 - Allegati di gara come fonti Git LFS non riscritte

Data: 2026-05-31

Stato: Accettata

## Contesto

La cartella `docs/milano-lotti-extraurbani-om/` contiene allegati ufficiali di
gara e modelli pesanti versionati con Git LFS. Questi file sono fonti, non
artefatti di lavoro da normalizzare per comodità.

Modificare, convertire o rinominare gli allegati può perdere tracciabilità e
alterare la distinzione fra documento di gara, fonte pubblica e assunzione
simulativa.

## Decisione

Gli allegati sotto `docs/milano-lotti-extraurbani-om/` restano fonti immutabili
per default.

Non vanno modificati, convertiti, rinominati o estratti in file committati senza
richiesta esplicita. Nuovi allegati pesanti devono rispettare `.gitattributes`
e Git LFS. Citazioni, warning e ricostruzioni operative vanno mantenuti in dati,
documentazione e test, non dentro copie alterate degli allegati.

## Alternative considerate

- `Convertire gli allegati in formati più comodi`: scartato perché aumenta il
  rischio di divergenza dalla fonte.
- `Estrarre dati permanenti in file generati`: ammesso solo se richiesto e
  documentato come derivazione, non come sostituzione della fonte.

## Impatti

- Prodotto: resta chiaro che il simulatore non è fonte ufficiale autonoma.
- Tecnico: Git LFS resta necessario per gli allegati.
- Dati/privacy: si riduce il rischio di committare estrazioni o output
  sensibili.
- Deploy/release: gli allegati non entrano in release applicative salvo scelta
  esplicita.
- Documentazione: warning e scelte ricostruttive devono citare le fonti senza
  duplicarle integralmente.

## Conseguenze operative

- Usare path quotati nei comandi sugli allegati.
- Controllare `.gitattributes` prima di aggiungere file pesanti.
- Non committare output temporanei, estrazioni o log.

## Verifiche

- `git lfs ls-files` quando si toccano allegati o file pesanti.
- `git diff --check` per modifiche documentali.

## Collegamenti

- Allegati: `docs/milano-lotti-extraurbani-om/`
- Runbook agenti: `AGENTS.md`
- Logica simulatore: `docs/LOGICA_SIMULATORE.md`
