# Decisioni GLM

Questo indice raccoglie le decisioni stabili del `Simulatore gara TPL lotti 1-4`.

## Decisioni attive

- [0001 - Tag e GitHub Release](decisions/0001-tag-e-github-release.md): policy
  per tag `vX.Y.Z`, GitHub Release e rapporto con release locale e deploy
  Cloudflare Pages.
- [0002 - Cloudflare Pages come unico target deploy](decisions/0002-cloudflare-pages-unico-target-deploy.md):
  conferma Cloudflare Pages progetto `gare-lotti-milanesi` come unico target
  deploy approvato.
- [0003 - Stabilità dell'URL pubblico](decisions/0003-stabilita-url-pubblico.md):
  separa nome visibile del prodotto e URL pubblico stabile.
- [0004 - Allegati di gara come fonti Git LFS non riscritte](decisions/0004-policy-allegati-git-lfs.md):
  preserva gli allegati di gara come fonti non normalizzate.

Decisioni operative già effettive sono documentate in:

- `AGENTS.md`: perimetro del simulatore, fonti primarie, dati di gara, allegati, sicurezza, verifiche, commit, PR e deploy.
- `docs/guides/cloudflare-pages.md`: Cloudflare Pages come target deploy, preview, Access, Web Analytics, cache e rollback.
- `docs/guides/versioning-e-release.md`: SemVer locale, changelog e pubblicazione.
- `docs/LOGICA_SIMULATORE.md`: contratto di fiducia del modello, scoring, ottimizzazione, persistenza e scenari base.

## Decisioni da valutare come ADR

- Nessuna decisione già candidata resta da estrarre.

## Decisioni sostituite o superate

- Nessuna decisione superata registrata.

## Regole

- Ogni decisione stabile autonoma vive in `docs/decisions/`.
- `docs/decisions/template.md` è il template da copiare per nuove ADR.
- Decisioni non ancora approvate stanno in backlog, roadmap o issue, ma devono essere linkate da `docs/INDEX.md` quando diventano operative.
- Non duplicare decisioni con lo stesso titolo o lo stesso scopo.
- Quando una decisione sostituisce documentazione precedente, migrare o collegare il contenuto utile prima di rimuovere il vecchio documento.
