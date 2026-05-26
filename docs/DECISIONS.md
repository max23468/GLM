# Decisioni GLM

Questo indice raccoglie le decisioni stabili del `Simulatore gara TPL lotti 1-4`.

## Decisioni attive

Nessuna ADR autonoma ancora registrata.

Decisioni operative già effettive sono documentate in:

- `AGENTS.md`: perimetro del simulatore, fonti primarie, dati di gara, allegati, sicurezza, verifiche, commit, PR e deploy.
- `docs/guides/cloudflare-pages.md`: Cloudflare Pages come target deploy, preview, Access, Web Analytics, cache e rollback.
- `docs/guides/versioning-e-release.md`: SemVer locale, changelog e pubblicazione.
- `docs/LOGICA_SIMULATORE.md`: contratto di fiducia del modello, scoring, ottimizzazione, persistenza e scenari base.

## Decisioni da valutare come ADR

- Cloudflare Pages come unico target deploy e divieto di Vercel/Supabase senza decisione esplicita.
- Separazione tra nome visibile `Simulatore gara TPL lotti 1-4` e URL pubblico `gare-lotti-milanesi.pages.dev`.
- Policy su allegati Git LFS e fonti ufficiali di gara.

## Decisioni sostituite o superate

- Nessuna decisione superata registrata.

## Regole

- Ogni decisione stabile autonoma vive in `docs/decisions/`.
- `docs/decisions/template.md` è il template da copiare per nuove ADR.
- Decisioni non ancora approvate stanno in backlog, roadmap o issue, ma devono essere linkate da `docs/INDEX.md` quando diventano operative.
- Non duplicare decisioni con lo stesso titolo o lo stesso scopo.
- Quando una decisione sostituisce documentazione precedente, migrare o collegare il contenuto utile prima di rimuovere il vecchio documento.
