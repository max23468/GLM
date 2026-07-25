# 0002 - Cloudflare Pages come unico target deploy

Data: 2026-05-31

Aggiornata: 2026-07-21

Stato: Accettata

## Contesto

GLM è una web app statica React/Vite con Pages Function limitata a `/api/*`.
Il deploy operativo esistente usa Cloudflare Pages progetto
`gare-lotti-milanesi`, output Vite `dist` e script locali basati su Wrangler.

Introdurre Vercel, Supabase, backend, database remoto o autenticazione
aumenterebbe superficie tecnica e rischio privacy senza rafforzare il
perimetro attuale del simulatore.

## Decisione

Cloudflare Pages resta l'unico target deploy approvato per GLM.

Ogni push/merge autorizzato su `main` avvia il job `deploy-production`, che
esegue `npm run deploy:cloudflare` e lo smoke. Il comando locale resta
disponibile per redeploy manuali richiesti. Le preview usano
`npm run deploy:preview`.
Vercel, Supabase, backend, account, database remoto o autenticazione richiedono
una nuova decisione esplicita prima di essere progettati o configurati.

## Alternative considerate

- `Vercel`: scartato perché il progetto ha già runbook, script e URL pubblico
  Cloudflare stabili.
- `Supabase o database remoto`: scartato perché lo stato vive nel browser e gli
  scenari possono contenere materiale sensibile.
- `Backend custom`: scartato perché non serve al simulatore esplorativo attuale.

## Impatti

- Prodotto: il simulatore resta una console locale/static-first senza account.
- Tecnico: build e deploy restano Vite, Wrangler e Cloudflare Pages.
- Dati/privacy: gli scenari restano nel browser o negli export dell'utente.
- Deploy/release: preparazione della versione e deploy restano concetti
  distinti; il merge su `main` avvia il deploy.
- Documentazione: AGENTS, README, Toolchain e guida Cloudflare restano fonti
  operative coerenti con questa ADR.

## Conseguenze operative

- Non proporre provider alternativi per deploy o persistenza senza nuova ADR.
- Non aggiungere configurazioni Vercel/Supabase o workflow paralleli.
- Trattare push e merge su `main` come azioni di pubblicazione.
- Verificare deploy/config con `npm run deploy:doctor` quando si tocca la
  configurazione Cloudflare.

## Verifiche

- Review documentale.
- `git diff --check`.

## Collegamenti

- Guida: `docs/guides/cloudflare-pages.md`
- Toolchain: `docs/TOOLCHAIN.md`
- Runbook agenti: `AGENTS.md`
