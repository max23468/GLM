# Hardening tecnico-operativo (2026-05-27)

## Rischio iniziale

- Livello: **basso**.
- Stato in questa ondata: **P1/P2 con review preventiva**.
- Rotazione segreti: **non inclusa** in questa fase (espressamente esclusa).

## Contesto operativo rilevante

- Progetto Cloudflare Pages, UI/docs simulatoriale con superficie runtime limitata.
- Nessuna dipendenza backend sensibile non già esplicitata.

## Piano tecnico (P0/P1/P2)

### P0

- Confermare deploy target unico su Cloudflare Pages e impedire spill in provider alternativi.
- Verificare che la superficie pubblica non includa configurazioni operative inattese.

### P1

- Hardening deploy target: verificare che il deploy resti su Cloudflare Pages nel target previsto, senza introdurre provider non autorizzati.
- Audit lockfile e dipendenze: controllo trimestrale con rilascio informato.
- Protezione di contenuti demo e alias interni nel caso fossero presenti nell’UI.

### P2

- Consolidare check periodici su contenuti esposti e versioni deployate.
- Mantenere governance docs-first: revisioni documentali e source-of-truth aggiornati.
- Verifica semiannuale su superficie pubblica e output generati.

## Piano operativo e di governo

### P1

- Aggiornare `docs/ROADMAP.md` / `docs/HEALTH.md` solo su cambi reali.
- Mantenere controllo delle varianti di simulazione e documenti LFS non alterati.
- Verificare che non emergano integrazioni esterne non autorizzate nel ciclo corrente.

### P2

- Riesame semestrale con check di dipendenze e accessi publish.
- Inserire nel `docs/CONTEXT.md` eventuali limiti operativi non più validi.
