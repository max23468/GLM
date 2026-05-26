# Versioning e procedura di rilascio

Questa guida descrive come preparare una nuova versione del **Simulatore gara TPL lotti 1-4**.

## Pubblicazione non è sempre release

In GLM ci sono due azioni diverse:

1. **Preparare una release**: chiudere il blocco `## [Non rilasciato]` del changelog, aggiornare `package.json`, `package-lock.json` e la data build in `src/lib/version.ts`.
2. **Pubblicare**: portare la modifica su `main` e, solo quando richiesto esplicitamente, distribuire `dist` su Cloudflare Pages progetto `gare-lotti-milanesi`.

Documentazione interna, regole agenti, note operative e piani non esposti nel simulatore possono essere pubblicati nel repo senza bump SemVer. In quel caso usa `### Non versionato` nel changelog solo se serve tenere traccia del lavoro: queste note non devono comparire nel changelog pubblico del simulatore.

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

Bump per correzioni e miglioramenti visibili che non cambiano la forma del prodotto.

- Bugfix.
- Microcopy, accessibilità, leggibilità o layout.
- Correzioni documentali o warning più chiari.
- Miglioramenti tecnici solo quando producono un effetto pratico per chi usa il simulatore.

Usa `### Correzioni` e descrivi l'effetto utente, non il dettaglio tecnico.

### Nessuna release

Usa `### Non versionato` quando il cambiamento non modifica prodotto pubblicato, supporto, contenuti visibili o comportamento operativo.

Esempi: note interne, piani non implementati, regole agenti, refusi in documentazione non renderizzata, appunti temporanei.

Non mescolare `### Non versionato` con voci versionate nello stesso blocco `## [Non rilasciato]`: il comando di release si ferma.

Se una versione non avrebbe punti interessanti per l'utente finale, non preparare una release SemVer e non farla apparire nel changelog frontend. Il changelog pubblico deve raccontare solo cambiamenti utili nell'uso del simulatore.

## Comando automatizzato

```sh
npm run release
```

Il comando:

- legge `CHANGELOG.md`;
- inferisce il bump da `Novità`, `Correzioni`, `Sotto il cofano`, `Rimosso` o `Breaking`;
- riconosce `Non versionato` come categoria senza release;
- usa `package.json` come fonte della versione applicativa;
- aggiorna `CHANGELOG.md`, `package.json`, `package-lock.json` e la data build in `src/lib/version.ts`;
- usa la data italiana corrente nel formato `YYYY-MM-DD`.

In modalità `--dry-run`, se il blocco `## [Non rilasciato]` è vuoto il comando termina senza errore e segnala che non c'è nulla da rilasciare.

`Sotto il cofano` resta riconosciuto dallo script per compatibilità, ma non usarlo nel changelog pubblico ordinario: le note pubblicate nel frontend devono parlare a chi usa il simulatore.

Comandi utili:

```sh
npm run release -- --dry-run
npm run release -- --bump patch
npm run release -- --version 0.3.0
npm run release -- --date 2026-05-20
```

## Changelog pubblico nel frontend

La scheda `Versione e changelog` legge `CHANGELOG.md` a build time e mostra solo le versioni rilasciate. Le sezioni `Non rilasciato` e `Non versionato` restano fuori dalla scheda.

Prima di pubblicare una modifica visibile e interessante per l'utente finale, controlla che la voce sia descritta in una versione mostrata nel frontend. Prepara una nuova versione con `npm run release` solo quando ci sono contenuti end-user sufficienti; lasciare la descrizione sotto `## [Non rilasciato]` è utile durante il lavoro, ma non aggiorna il changelog mostrato nel frontend.

Scrivi le voci dal punto di vista di chi usa il simulatore:

- niente riferimenti a commit, PR, file interni, CI, test, release, deploy, dipendenze, script o regole agenti;
- frasi brevi e operative;
- aree in grassetto quando aiutano la scansione, per esempio `**Ottimizzazione**: ...`;
- distinzione esplicita tra dati di gara, fonti pubbliche e assunzioni simulative quando la voce riguarda il modello.

## Deploy

La release non pubblica automaticamente.

Quando viene chiesto `pubblica`, `rilascia`, `deploya` o equivalente, segui `AGENTS.md`: controlla il diff, esegui le verifiche proporzionate, porta il codice su `main` se necessario e distribuisci solo su Cloudflare Pages progetto `gare-lotti-milanesi`.

## Tag e GitHub Release

Oggi GLM usa versioning locale con `package.json`, `CHANGELOG.md` e
`npm run release`. Non creare tag Git o GitHub Release finché la decisione
aperta in `docs/DECISIONS_PENDING.md` non definisce formato tag, source of
truth, relazione con Cloudflare Pages e migrazione dello storico.
