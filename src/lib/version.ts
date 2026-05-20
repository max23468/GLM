/**
 * Versione corrente del Simulatore gara TPL lotti 1-4.
 *
 * Convenzione SemVer adattata al simulatore:
 * - MAJOR: cambia in modo non retrocompatibile scoring, persistenza, import/export
 *   o un comportamento operativo già usato.
 * - MINOR: aggiunge una nuova capacità retrocompatibile di simulazione, confronto,
 *   report, import/export o analisi.
 * - PATCH: corregge bug, migliora UI/copy/accessibilità, dati documentati o processo.
 *
 * Per preparare una nuova versione:
 * 1. aggiungi le voci sotto `[Non rilasciato]` in `CHANGELOG.md`
 * 2. esegui `npm run release`
 * 3. verifica il diff generato
 * 4. pubblica su Cloudflare Pages solo quando viene richiesto esplicitamente
 *
 * Vedi `docs/guides/versioning-e-release.md` per la procedura completa.
 */
export const APP_VERSION = "0.2.7";
export const BUILD_DATE = "2026-05-20";
