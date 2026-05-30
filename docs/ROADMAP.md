# Roadmap GLM

La roadmap descrive direzione, priorità e prossimi passi del `Simulatore gara TPL lotti 1-4`. Le idee non ancora scelte stanno in `docs/BACKLOG.md`.

Legenda stato: `Fatto`, `In corso`, `Da fare`, `Idea`, `Bloccato`.

## 0. Identità e perimetro

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | Nome visibile `Simulatore gara TPL lotti 1-4` | Nome prodotto e URL pubblico sono separati. |
| Fatto | URL pubblico stabile | `https://gare-lotti-milanesi.pages.dev` resta stabile salvo richiesta esplicita. |
| Fatto | Perimetro esplorativo | Il simulatore aiuta a ragionare su scenari; non è fonte ufficiale, offerta o consulenza. |
| Fatto | No Vercel/Supabase | GLM usa Cloudflare Pages e non deve introdurre backend, auth o database senza decisione esplicita. |

## 1. Modello gara e fonti

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | Logica simulatore documentata | `docs/LOGICA_SIMULATORE.md` è la fonte per scoring, soglie, ottimizzazione e persistenza. |
| Fatto | Allegati gara in Git LFS | `docs/milano-lotti-extraurbani-om/` contiene fonti da preservare, non normalizzare. |
| Fatto | Distinzione fonti | Ogni dato rilevante deve restare classificato come `Documento di gara`, `Fonte pubblica` o `Assunzione simulativa`. |
| Da fare | Riesame fonti pubbliche | Verificare URL, metriche e date `verifiedAt` prima di usare gli scenari base come base decisionale aggiornata. |
| Da fare | Tracciabilità warning | Rendere ancora più leggibile quando un warning deriva da incongruenza documentale, scelta simulativa o fonte pubblica variabile. |

## 2. Esperienza simulatore

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | Console operativa React/Vite | L'esperienza principale resta il simulatore, non una landing o dashboard marketing. |
| Fatto | Scenari, confronto e import/export | Salvataggio locale, duplicazione, import/export JSON e confronto sono già presenti. |
| Fatto | Ottimizzazione e analisi puntuale | La logica resta simulativa e rivalutata tramite `simulate()`. |
| Da fare | Lettura decisionale più sintetica | Migliorare evidenza di lotti fragili, warning decisivi e scarti tra scenari. |
| Idea | Report condivisibile leggero | Valutare output sintetici senza trasformare il tool in generatore automatico di offerta. |

## 3. Persistenza, compatibilità e dati locali

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | Storage browser e chiavi legacy | Le chiavi `tpl-simulator-*` restano leggibili in fallback. |
| Fatto | Export/import con `schemaVersion` | Gli snapshot correnti usano `schemaVersion: 8`. |
| Da fare | Test su migrazioni snapshot | Rafforzare test quando cambiano campi di scenario, ottimizzazione o normalizzazione. |
| Da fare | Robustezza import JSON | Presidiare snapshot incompleti, legacy o costruiti manualmente. |

## 4. Qualità, release e verifica

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | CI principale | `.github/workflows/ci.yml` esegue validazione dati, test e build. |
| Fatto | Smoke browser | `npm run smoke` copre flussi critici, da usare solo quando proporzionato. |
| Fatto | React Doctor | `npm run quality:react-doctor` è disponibile per release minor o modifiche React trasversali. |
| Fatto | Changelog nel frontend | `CHANGELOG.md` è contenuto utente: niente note tecniche irrilevanti per chi usa il simulatore. |
| Da fare | Toolchain esplicita | Valutare `engines.node` e `packageManager` in `package.json`, allineando CI e setup locale. |

## 5. GitHub, deploy e governance

| Stato | Voce | Note |
| --- | --- | --- |
| Fatto | Cloudflare Pages | Produzione solo su progetto `gare-lotti-milanesi`, tramite `npm run deploy:cloudflare` e solo su richiesta esplicita. |
| Fatto | Preview Cloudflare PR | Preview PR interna presente quando i secret sono configurati. |
| Fatto | Codex feedback inbox | Issue GitHub presente; nessun thread actionable al controllo del 2026-05-24. |
| Fatto | Baseline Atlas | Indice, roadmap, backlog, contesto, toolchain, ADR index/template e template GitHub introdotti con PR `max23468/GLM#7`. |
| Da fare | ADR autonome | Valutare ADR per Cloudflare-only, stabilità URL e policy allegati Git LFS. |
| Idea | Branch protection/CODEOWNERS | Da valutare solo se aggiunge controllo reale. |

## Prossime mosse suggerite

1. Scegliere se estrarre subito una ADR Cloudflare-only o lasciarla come decisione documentata in guide e `AGENTS.md`.
2. Promuovere un solo debito dal backlog, preferibilmente tracciabilità fonti pubbliche o robustezza import/export.
3. Aggiornare Atlas se dai pattern GLM emerge uno standard utile anche alle altre repo.

## Regole

- La roadmap non è un changelog.
- La roadmap non è un dump di idee.
- Le idee non ancora scelte stanno in `docs/BACKLOG.md`.
- Le decisioni stabili stanno in `docs/decisions/`.
- Ogni voce deve indicare un prossimo passo operativo reale.
