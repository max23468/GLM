# Backlog GLM

Il backlog raccoglie possibilità, debiti, bug e idee non ancora promosse in roadmap.

Una voce nel backlog non è scope approvato.

## Idee prodotto

- Migliorare la lettura operativa delle differenze tra scenari, con focus sui lotti più fragili e sui warning decisivi.
- Valutare viste o report più sintetici per condividere scenari senza trasformare il simulatore in generatore di offerta.
- Migliorare la chiarezza dei limiti del modello quando fonti pubbliche e assunzioni simulative incidono sugli scenari base.

## Backlog tecnico

- Rafforzare test e normalizzazione quando cambia lo schema export/import o la compatibilità con chiavi `localStorage` legacy.
- Valutare controlli periodici su fonti pubbliche, URL e date `verifiedAt`.
- Valutare un controllo scriptabile leggero su documenti canonici e link interni.
- Mantenere allineati `engines.node`, `packageManager`, `.node-version` e CI
  quando cambiano dipendenze, action o versione runtime.

## Pattern emersi dall'allineamento Atlas

Questi elementi non vanno persi né copiati automaticamente in altre repo. Vanno classificati caso per caso.

| Pattern GLM | Valutazione | Possibile uso trasversale |
| --- | --- | --- |
| `docs/LOGICA_SIMULATORE.md` come contratto di fiducia del modello | Mantenere in GLM | Pattern utile per repo con motori decisionali, scoring, parser o AI governata. |
| Changelog mostrato nel frontend | Mantenere in GLM | Può essere utile per web app operative; non va imposto a bot o repo docs-first. |
| Cloudflare Pages runbook molto concreto | Mantenere in GLM | Pattern riusabile per repo Cloudflare; non trasferire a Vercel/Supabase. |
| Separazione nome prodotto / URL deploy | Mantenere e forse trasformare in ADR | Pattern utile per tutte le repo con brand visibile distinto da slug tecnico. |
| Allegati gara Git LFS come fonti non modificabili | Mantenere in GLM | Pattern utile per repo con documenti ufficiali o dataset sorgente. |
| Smoke browser proporzionato al rischio | Mantenere in GLM | Pattern trasversale: check più profondi solo quando il diff tocca flussi coperti. |
| Codex feedback inbox già presente | Mantenere | Standard già trasversale nelle repo coordinate. |

Prima di promuovere uno di questi pattern ad Atlas, verificare almeno una seconda repo comparabile.

## Bug

- Nessun bug promosso in backlog al momento.

## Debiti

- La fedeltà del modello dipende da allegati, warning documentali e fonti pubbliche che possono cambiare o richiedere riesame.
- La robustezza sugli snapshot importati resta un'area da presidiare quando si aggiungono campi a scenari, ottimizzazione o persistenza.

## Decisioni sospese

- Definire se aggiungere branch protection/CODEOWNERS oltre alla baseline GitHub già presente.
- Definire se Atlas deve avere una regola esplicita di discovery degli extra repo-specifici prima di ogni allineamento.

## Attività operative ricorrenti

- Controllare `Codex feedback inbox` prima di PR ready, merge, pubblicazione o deploy.
- Eseguire verifiche proporzionate secondo `AGENTS.md`.
- Non modificare allegati in `docs/milano-lotti-extraurbani-om/` senza richiesta esplicita.
- Aggiornare `docs/ROADMAP.md` quando cambia priorità o fase.
- Aggiornare `docs/CONTEXT.md` dopo passaggi lunghi, release, deploy o decisioni operative.

## Regole

- Quando una voce diventa prioritaria, promuoverla in `docs/ROADMAP.md`.
- Quando una voce diventa decisione stabile, collegarla o spostarla in `docs/decisions/`.
- Non usare il backlog come storico dei lavori completati.
