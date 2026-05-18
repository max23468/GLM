# Gare Lotti Milanesi

Web app locale per simulare scenari di aggiudicazione della gara TPL dei lotti 1-4.

## Avvio

```bash
npm install
npm run dev -- --port 4173
```

Apri `http://127.0.0.1:4173/`.

## Perimetro

- Scenari demo già compilati con operatori e profili ispirati a dati pubblici reperibili sul web.
- Basi operative degli scenari demo ricavate dagli allegati locali di gara: mezzi, fermate e corse annue stimate per lotto.
- Inserimento di più offerenti.
- Scelta, per ciascun operatore, dei lotti singoli L1-L4 a cui partecipa.
- Scelta delle offerte combinatorie ammesse: 1+2, 2+3, 3+4, 1+4.
- Simulazione dei sub-criteri tecnici Q/T/D, con raggruppamento per criterio padre e ambito A-G.
- Input operativi per i tassi derivati: l'utente inserisce numeratori e basi tecniche, per esempio autobus attrezzati e autobus totali, e il simulatore calcola il rapporto usato nel punteggio.
- Calcolo di soglia Q/T, riparametrazione per ambito, offerta economica singola e combinatoria, classifica e scenario vincente.
- Pannello di suggerimenti prioritizzati e criticità documentali.
- Tradeoff tecnico/economico per sub-criterio: delta operativo, costo unitario/totale, variazione del punteggio tecnico, economico e totale.

## Fonti

La logica è ricostruita dai documenti di gara nella cartella `milano-lotti-extraurbani-om`, versionata tramite Git LFS perché contiene allegati binari pesanti.
Per clonare il repository con i documenti completi serve Git LFS attivo.

Documenti principali:

- `DISCIPLINARE DI GARA.pdf`
- `All 13 - Offerta tecnica e criteri di valutazione.pdf`
- `All 131_2.XLS`
- `All 18 - Offerta economica.pdf`
- modelli `All 18.1` - `All 18.8`

I costi unitari dei tradeoff non sono contenuti nei documenti di gara: sono ipotesi dell'utente e vengono trattati come riduzione del ribasso medio del lotto.

Per rendere l'app più realistica, gli scenari demo usano anche segnali pubblici web, sempre come base simulativa e non come offerte ufficiali:

- Agenzia TPL Milano, Monza Brianza, Lodi e Pavia: pubblicazione gara TPL MLMP 2026.
- ARIA Lombardia / Sintel: procedura aperta ID 218044617.
- Autoguidovie: dati pubblici di flotta, AVM, accessibilità, videosorveglianza e ADAS.
- Arriva Italia: dati pubblici su scala del gruppo e investimenti di rinnovo flotta.
- Gruppo ATM: pagine pubbliche NET e Movibus.
- STAR Mobility: presidio pubblico nell'area di Lodi e bigliettazione elettronica urbana.
