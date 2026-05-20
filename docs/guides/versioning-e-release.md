# Versioning e procedura di rilascio

Questa guida descrive come preparare una nuova versione del **Simulatore gara TPL lotti 1-4**.

## Pubblicazione non è sempre release

In GLM ci sono due azioni diverse:

1. **Preparare una release**: chiudere il blocco `## [Non rilasciato]` del changelog, aggiornare `src/lib/version.ts`, `package.json` e `package-lock.json`.
2. **Pubblicare**: portare la modifica su `main` e, solo quando richiesto esplicitamente, distribuire `dist` su Cloudflare Pages progetto `gare-lotti-milanesi`.

Documentazione interna, regole agenti, note operative e piani non esposti nel simulatore possono essere pubblicati nel repo senza bump SemVer. In quel caso usa `### Non versionato` nel changelog solo se serve tenere traccia del lavoro.

## TL;DR

Per preparare la versione `X.Y.Z`:

1. Scrivi le voci sotto `## [Non rilasciato]` in `CHANGELOG.md`.
2. Esegui `npm run release`.
3. Controlla il diff generato.
4. Esegui i check proporzionati al diff secondo `AGENTS.md`.
5. Se e solo se viene chiesto di pubblicare, usa il flusso Cloudflare Pages della repo.

## Quando bumpare quale numero

GLM usa quattro categorie: **MAJOR**, **MINOR**, **PATCH** e **nessuna release**.

### MAJOR

Bump quando cambia in modo non retrocompatibile ciò che il simulatore calcola, salva o importa.

- Formula di scoring, soglia o riparametrazione incompatibile con i risultati precedenti.
- Formato export/import non più leggibile senza migrazione.
- Rimozione o cambio semantico di un flusso già usato.
- Dato di gara o criterio corretto in modo da cambiare materialmente gli esiti.

Usa `### Rimosso` o `### Breaking`.

### MINOR

Bump quando aggiungi una capacità retrocompatibile.

- Nuovo pannello, vista, report o comando.
- Nuova simulazione o nuova lettura comparativa.
- Nuovo formato di export affiancato a quello esistente.
- Nuovo dato o fonte tracciata senza rompere scenari salvati.

Usa `### Novità`.

### PATCH

Bump per correzioni e miglioramenti che non cambiano la forma del prodotto.

- Bugfix.
- Microcopy, accessibilità, leggibilità o layout.
- Correzioni documentali o warning più chiari.
- Miglioramenti a build, test, deploy o processo che accompagnano il prodotto.

Usa `### Correzioni` oppure `### Sotto il cofano`.

### Nessuna release

Usa `### Non versionato` quando il cambiamento non modifica prodotto pubblicato, supporto, contenuti visibili o comportamento operativo.

Esempi: note interne, piani non implementati, regole agenti, refusi in documentazione non renderizzata, appunti temporanei.

Non mescolare `### Non versionato` con voci versionate nello stesso blocco `## [Non rilasciato]`: il comando di release si ferma.

## Comando automatizzato

```sh
npm run release
```

Il comando:

- legge `CHANGELOG.md`;
- inferisce il bump da `Novità`, `Correzioni`, `Sotto il cofano`, `Rimosso` o `Breaking`;
- riconosce `Non versionato` come categoria senza release;
- aggiorna `CHANGELOG.md`, `src/lib/version.ts`, `package.json` e `package-lock.json`;
- usa la data italiana corrente nel formato `YYYY-MM-DD`.

Comandi utili:

```sh
npm run release -- --dry-run
npm run release -- --bump patch
npm run release -- --version 0.3.0
npm run release -- --date 2026-05-20
```

## Changelog pubblico nel frontend

La scheda `Versione e changelog` legge `CHANGELOG.md` a build time e mostra solo le versioni rilasciate. Le sezioni `Non rilasciato` e `Non versionato` restano fuori dalla scheda.

Prima di pubblicare una modifica visibile del simulatore, controlla sempre che la voce sia già stata chiusa in una versione rilasciata con `npm run release`. Lasciare la descrizione sotto `## [Non rilasciato]` è utile durante il lavoro, ma non aggiorna il changelog mostrato nel frontend.

Scrivi le voci dal punto di vista di chi usa il simulatore:

- niente riferimenti a commit, PR o file interni;
- frasi brevi e operative;
- aree in grassetto quando aiutano la scansione, per esempio `**Ottimizzazione**: ...`;
- distinzione esplicita tra dati di gara, fonti pubbliche e assunzioni simulative quando la voce riguarda il modello.

## Deploy

La release non pubblica automaticamente.

Quando viene chiesto `pubblica`, `rilascia`, `deploya` o equivalente, segui `AGENTS.md`: controlla il diff, esegui le verifiche proporzionate, porta il codice su `main` se necessario e distribuisci solo su Cloudflare Pages progetto `gare-lotti-milanesi`.
