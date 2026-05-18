# Gare Lotti Milanesi

Web app locale per simulare scenari di aggiudicazione della gara TPL dei lotti 1-4.

## Avvio

```bash
npm install
npm run dev -- --port 4173
```

Apri `http://127.0.0.1:4173/`.

## Perimetro

- Inserimento di più offerenti e relativa forma di partecipazione.
- Scelta, per ciascun operatore, dei lotti singoli L1-L4 a cui partecipa.
- Scelta delle offerte combinatorie ammesse: 1+2, 2+3, 3+4, 1+4.
- Simulazione dei sub-criteri tecnici Q/T/D, con raggruppamento per criterio padre e ambito A-G.
- Calcolo di soglia Q/T, riparametrazione per ambito, offerta economica singola e combinatoria, classifica e scenario vincente.
- Pannello di suggerimenti prioritizzati e criticità documentali.
- Tradeoff tecnico/economico per sub-criterio: delta operativo, costo unitario/totale, variazione del punteggio tecnico, economico e totale.

## Fonti

La logica è ricostruita dai documenti allegati nella cartella `milano-lotti-extraurbani-om`, in particolare:

- `DISCIPLINARE DI GARA.pdf`
- `All 13 - Offerta tecnica e criteri di valutazione.pdf`
- `All 131_2.XLS`
- `All 18 - Offerta economica.pdf`
- modelli `All 18.1` - `All 18.8`

I costi unitari dei tradeoff non sono contenuti nei documenti di gara: sono ipotesi dell'utente e vengono trattati come riduzione del ribasso medio del lotto.
