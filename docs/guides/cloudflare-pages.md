# Cloudflare Pages: deploy, preview e controlli operativi

Questa guida descrive l'integrazione Cloudflare del `Simulatore gara TPL lotti 1-4`.

Il progetto resta una web app Vite pubblicata su Cloudflare Pages:

- progetto Pages: `gare-lotti-milanesi`;
- output pubblicato: `dist`;
- produzione: `https://gare-lotti-milanesi.pages.dev`;
- branch produzione: `main`.

Non usare Vercel per questa repository.

## Script locali

```bash
npm run deploy:preview -- --branch nome-branch
npm run deploy:doctor
npm run deploy:cloudflare
```

`npm run deploy:preview` compila l'app, pubblica `dist` su Cloudflare Pages come preview e poi esegue `npm run smoke` contro l'URL pubblicato.

`npm run deploy:cloudflare` compila l'app, pubblica `dist` su `main`, esegue lo smoke contro `https://gare-lotti-milanesi.pages.dev` e stampa un riepilogo con branch Pages, commit e URL rilevati.

`npm run deploy:doctor` non pubblica nulla: verifica Wrangler locale, credenziali Cloudflare tramite variabili o login Wrangler e completezza dell'eventuale service token Access senza stampare valori sensibili.

Lo script blocca il deploy se:

- il worktree non è pulito;
- un deploy produzione viene lanciato fuori da `main`;
- `dist` non esiste dopo la build;
- Wrangler non è installato localmente.

Usa `--skip-smoke` solo quando devi isolare un problema di deploy e dichiara il rischio residuo. Usa `--allow-dirty` o `--allow-non-main` solo per diagnosi consapevoli, non per pubblicazioni ordinarie.

## GitHub Actions

Il workflow `.github/workflows/ci.yml` mantiene due livelli automatici:

- `verify`: `npm run validate:data`, `npm test`, `npm run build`;
- `deploy-preview`: su pull request interne, esegue `npm run deploy:doctor`, pubblica una preview Cloudflare e lancia lo smoke sull'URL preview quando i secret necessari sono configurati.

La produzione non parte più automaticamente da push a `main`: resta un'azione esplicita tramite `npm run deploy:cloudflare`, dopo review del diff e check proporzionati.

I job di deploy cacheano il browser Playwright usato dallo smoke in `~/.cache/ms-playwright`, così i run successivi evitano il download completo di Chromium.

Configura questi repository secrets in GitHub:

- `CLOUDFLARE_ACCOUNT_ID`: account ID Cloudflare;
- `CLOUDFLARE_API_TOKEN`: token con permesso Cloudflare Pages Edit sull'account;
- `VITE_CF_WEB_ANALYTICS_TOKEN`: opzionale, token pubblico Web Analytics se non usi l'iniezione automatica dal dashboard Pages;
- `CF_ACCESS_CLIENT_ID`: opzionale, service token per smoke CI su preview protette da Access;
- `CF_ACCESS_CLIENT_SECRET`: opzionale, secret del service token Access.

Se i secret Cloudflare principali non sono presenti, il job preview non pubblica e mostra una notice nel log.

## Preview protette con Cloudflare Access

Cloudflare Pages può proteggere le preview direttamente dal progetto:

1. apri Cloudflare Dashboard;
2. vai in `Workers & Pages`;
3. seleziona `gare-lotti-milanesi`;
4. apri `Settings > General`;
5. abilita `Enable access policy` per le preview;
6. limita l'accesso agli utenti o al gruppo autorizzato.

Questo protegge le preview hashate e gli alias di branch, non la produzione.

Per permettere allo smoke GitHub Actions di verificare preview protette, crea un service token in Cloudflare Access e aggiungilo nei secret `CF_ACCESS_CLIENT_ID` e `CF_ACCESS_CLIENT_SECRET`. Lo smoke invia questi valori come header `CF-Access-Client-Id` e `CF-Access-Client-Secret`, senza stamparli nei log.

## Web Analytics

Ci sono due modi supportati:

1. Dashboard Pages: `Workers & Pages > gare-lotti-milanesi > Metrics > Enable Web Analytics`. Cloudflare inietta automaticamente il beacon al deploy successivo.
2. Token Vite: imposta `VITE_CF_WEB_ANALYTICS_TOKEN` in Cloudflare Pages/GitHub Actions. Il frontend carica il beacon solo quando il token è presente.

Non inserire il token direttamente nel codice. Anche se è un identificatore pubblico, tenerlo come variabile evita differenze manuali tra ambienti.

## Header, cache e routing

Il repo versiona:

- `public/_headers`: header di sicurezza e cache lunga per gli asset Vite hashati;
- `public/robots.txt`: blocco dell'indicizzazione per crawler e motori che rispettano robots.txt;
- `public/_redirects`: canonicalizzazione `/istruzioni`;
- `public/_routes.json`: limita l'invocazione Pages Functions alle rotte `/api/*`.

La produzione deve restare non indicizzata: `index.html` espone meta `noindex`, `_headers` applica `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` a tutte le risposte statiche e `robots.txt` usa `Disallow: /`. Questi segnali riducono l'indicizzazione da crawler conformi, ma non sostituiscono una protezione di accesso se serve riservatezza forte.

Il fallback SPA è lasciato al comportamento predefinito di Cloudflare Pages: in assenza di `404.html`, Pages serve l'app root per le rotte non trovate. Evita quindi un rewrite globale `/* /index.html 200`, perché Wrangler può segnalarlo come loop con la normalizzazione di `index.html`.

Le regole `_headers` si applicano agli asset statici. Le Pages Functions devono impostare direttamente i propri header nelle risposte.

Se in futuro viene configurato un dominio custom proxato da Cloudflare, aggiungi anche Cache Rules di zona per:

- mantenere `index.html` non cacheato o con TTL breve;
- lasciare gli asset hashati con cache lunga;
- evitare cache su `/api/*`.

## WAF e rate limiting

WAF e rate limiting sono controlli di zona/account, non file della build Vite. Per attivarli serve un dominio custom gestito o proxato da Cloudflare.

Baseline consigliata quando il dominio custom esiste:

1. abilita Cloudflare WAF Managed Rules;
2. aggiungi una regola custom di challenge/block per pattern chiaramente anomali;
3. aggiungi una regola rate limiting su `/api/*`, più severa degli asset statici;
4. lascia passare bot verificati e traffico umano ordinario;
5. osserva i log prima di irrigidire le soglie.

Per il solo dominio `pages.dev`, mantieni la protezione lato Pages, Access sulle preview e gli header versionati nel repo.

## Endpoint runtime

La Pages Function `/api/version` espone un JSON leggero con:

- nome app;
- progetto Cloudflare;
- ambiente `production` o `preview`;
- branch Pages;
- commit Pages, quando disponibile;
- URL runtime;
- timestamp della risposta.

Usalo per controlli post-deploy e diagnosi di "cosa sto vedendo in produzione?".

## Rollback

Cloudflare Pages supporta rollback immediato a un deployment production precedente:

1. apri `Workers & Pages > gare-lotti-milanesi`;
2. vai in `Deployments`;
3. scegli un deployment production riuscito;
4. dal menu azioni seleziona `Rollback to this deployment`;
5. verifica `https://gare-lotti-milanesi.pages.dev`;
6. esegui `SMOKE_URL=https://gare-lotti-milanesi.pages.dev npm run smoke`.

Le preview non sono target di rollback produzione.

## Checklist pubblicazione

Prima di pubblicare:

1. `git status --short`;
2. controlla che il diff sia intenzionale;
3. `npm run deploy:doctor`;
4. `npm run prepublish:check` o controlli proporzionati al diff;
5. `npm run deploy:cloudflare`;
6. verifica `/api/version`;
6. se qualcosa non torna, rollback dal dashboard e poi diagnosi sul commit.
