import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileJson,
  GitCompareArrows,
  Route,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
} from "lucide-react";

type InstructionsPageProps = {
  onBack: () => void;
};

type InstructionSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  checks: string[];
};

const quickSteps = [
  "Apri `Gestisci workspace` nella barra laterale.",
  "Scegli scenario base e concorrente; cambia lotto dalla barra `Lotto di lavoro`.",
  "Compila la parte tecnica e verifica la soglia Q/T.",
  "Compila ribassi e controlli economici.",
  "Usa Ottimizzazione per confrontare investimenti tecnici, rinunce tecniche e ribasso.",
  "Salva lo scenario, confrontalo e genera il report.",
];

const sections: InstructionSection[] = [
  {
    id: "istruzioni-perimetro",
    eyebrow: "Prima di iniziare",
    title: "Perimetro e attendibilità",
    body: "Il simulatore è una console esplorativa per ragionare su lotti, combinatorie, qualità tecnica, ribassi e scenario vincente. Non produce offerte ufficiali e non sostituisce la lettura degli allegati di gara.",
    bullets: [
      "Tratta i profili precaricati come basi di lavoro, non come offerte reali.",
      "Distingui sempre tra dati da documento di gara, fonti pubbliche e assunzioni simulative.",
      "Usa il risultato come supporto decisionale interno, non come certificazione dell'esito di gara.",
      "Prima di condividere una simulazione, esporta il JSON e controlla i warning del report.",
    ],
    checks: ["Scenario base corretto", "Soglia Q/T coerente con l'ipotesi", "Warning letti e accettati"],
  },
  {
    id: "istruzioni-scenario",
    eyebrow: "Scenario",
    title: "Scegliere, rinominare e salvare lo scenario",
    body: "La colonna sinistra governa lo stato di lavoro. Apri `Gestisci workspace` per scegliere lo scenario base, rinominare la simulazione, salvare una fotografia in libreria e importare o esportare JSON. Il pulsante `Indietro` chiude tutta la gestione workspace.",
    bullets: [
      "Scegli `Mercato realistico` per partire da un assetto equilibrato.",
      "Usa `Tecnologia e flotta` quando vuoi stressare dotazioni, monitoraggio e informazione all'utenza.",
      "Usa `Ribasso aggressivo` per capire quanto pesa la leva economica.",
      "Usa `Presidio locale` quando vuoi valutare continuità operativa e radicamento territoriale.",
      "Usa i bottoni rapidi: `+` crea, il dischetto salva, la copia duplica e `X` elimina.",
      "Rinomina sempre lo scenario prima di salvarlo, così il confronto resta leggibile.",
    ],
    checks: ["Nome scenario chiaro", "Scenario salvato in libreria", "Export JSON creato se deve essere condiviso"],
  },
  {
    id: "istruzioni-offerenti",
    eyebrow: "Concorrenti",
    title: "Gestire concorrenti, lotti e partecipazioni",
    body: "Ogni concorrente può partecipare a lotti singoli e combinatorie. Aggiunta, rinomina, eliminazione e opzioni di partecipazione si gestiscono solo nella barra laterale.",
    bullets: [
      "Apri `Gestisci workspace` e seleziona un concorrente dalla lista prima di compilare tecnica o economica.",
      "Cambia il lotto di lavoro dalla barra compatta sopra le tab operative.",
      "Aggiungi un nuovo concorrente con il pulsante `+`.",
      "Rinomina il concorrente dal campo laterale `Nome concorrente`.",
      "Usa `X` sulla riga del concorrente per eliminarlo.",
      "Spunta solo i lotti che il concorrente presenta davvero nello scenario.",
      "Per una combinatoria, attiva anche entrambi i lotti singoli collegati.",
      "Le combinatorie disponibili sono `1+2`, `2+3`, `3+4` e `1+4`.",
    ],
    checks: ["Concorrente selezionato", "Lotti singoli coerenti", "Combinatorie attivate solo dove ammissibili"],
  },
  {
    id: "istruzioni-tecnica",
    eyebrow: "Tecnica",
    title: "Compilare criteri Q/T/D",
    body: "La tab `Tecnica` raccoglie criteri quantitativi, tabellari e discrezionali. I valori vengono usati per soglia Q/T, riparametrazione e punteggio tecnico complessivo.",
    bullets: [
      "`Quantitativo`: inserisci il valore richiesto o, quando presente, numeratore e denominatore operativo.",
      "`Tabellare`: attiva il requisito solo se lo scenario lo prevede.",
      "`Discrezionale`: inserisci un punteggio simulato entro il massimo del criterio.",
      "Usa `Da lavorare` per vedere dove resta margine operativo.",
      "Usa `Verifica` per concentrarti su criteri con warning o attenzione documentale.",
      "Usa `Scoperti` per trovare leve ancora a zero o poco valorizzate.",
    ],
    checks: ["Numeratori e denominatori completi", "Punteggi discrezionali entro massimale", "Criteri con warning verificati"],
  },
  {
    id: "istruzioni-soglia",
    eyebrow: "Soglia Q/T",
    title: "Controllare ammissibilità tecnica",
    body: "La soglia Q/T determina se un'offerta passa alla fase successiva. Cambiarla serve a testare le diverse letture documentali già evidenziate nel simulatore.",
    bullets: [
      "`37 pt - Disciplinare`: lettura base del disciplinare.",
      "`38 pt - Allegato 13`: scenario coerente con l'indicazione dell'allegato tecnico.",
      "`43,4 pt - 70% dei Q/T`: stress test più selettivo.",
      "Un'offerta sotto soglia non contribuisce alla valutazione economica.",
      "Se un lotto risulta non assegnato, valuta se il problema è tecnico, economico o di partecipazione.",
    ],
    checks: ["Soglia scelta consapevolmente", "Lotti sotto soglia individuati", "Eventuale deroga al limite due lotti valutata"],
  },
  {
    id: "istruzioni-analisi-puntuale",
    eyebrow: "Analisi puntuale criterio",
    title: "Stimare costo e impatto di un criterio",
    body: "L'analisi puntuale criterio aiuta a capire se un singolo miglioramento tecnico conviene rispetto al costo stimato e alla riduzione implicita del ribasso economico.",
    bullets: [
      "Inserisci unità aggiunte o migliorate.",
      "Inserisci un costo unitario realistico per la tua ipotesi interna.",
      "Compila il denominatore quando il criterio è un rapporto operativo.",
      "Leggi insieme delta tecnico, costo totale, delta economico e delta totale.",
      "Ricorda che i costi non arrivano dai documenti di gara: sono ipotesi dell'utente.",
    ],
    checks: ["Costo unitario motivato", "Denominatore presente dove serve", "Delta totale positivo o accettato come scelta strategica"],
  },
  {
    id: "istruzioni-economica",
    eyebrow: "Economica",
    title: "Compilare ribassi e leggere il punteggio",
    body: "La tab `Economica` replica la struttura dell'All. 18 in forma navigabile: ribassi di fase, ribasso medio ponderato, corrispettivi offerti e punteggio economico.",
    bullets: [
      "Inserisci tre ribassi: mesi 1-12, mesi 13-24 e mesi 25-84.",
      "Controlla il ribasso medio ponderato: è il valore usato per il confronto economico.",
      "Il punteggio economico usa la formula `30 x R(i) / Rmax`.",
      "Il simulatore inverso stima il ribasso medio necessario per raggiungere un target di punteggio.",
      "La tabella €/km serve a leggere i corrispettivi unitari medi, ma non modifica il punteggio.",
    ],
    checks: ["Tre fasi compilate", "Ribasso medio confrontato con Rmax", "€/km letto come controllo gestionale, non come nuova formula"],
  },
  {
    id: "istruzioni-ottimizza",
    eyebrow: "Ottimizzazione",
    title: "Ottimizzazione",
    body: "La tab `Ottimizzazione` parte dall'offerta corrente e cerca il miglior punteggio raggiungibile con concorrenti fermi, costi unitari e massimali configurati.",
    bullets: [
      "Scegli `Lotto attivo` per ottimizzare solo il lotto selezionato.",
      "Scegli `Tutti i lotti attivi` per distribuire le mosse sulle offerte singole del concorrente.",
      "Scegli `Scenario complessivo` per misurare il contributo del concorrente nello scenario vincente simulato.",
      "`Tecnica + ribasso` confronta miglioramenti tecnici e riallocazioni da tecnica a ribasso.",
      "`Solo tecnica` esclude il ribasso e usa solo leve tecniche.",
      "Il ribasso aumenta solo se una rinuncia tecnica libera risorse sufficienti e il saldo netto è positivo.",
      "Il piano mostra quanti punti tecnici perdi e quanti punti economici guadagni nelle riallocazioni.",
      "`Dashboard dove investire` ordina le aree più interessanti per punti, costo e rendimento.",
      "`Mappa impatto per ambito` evidenzia dove il piano aggiunge punti o sacrifica tecnica.",
      "Compila costo unitario, quantità massima e base per le leve che vuoi rendere ottimizzabili.",
    ],
    checks: ["Obiettivo scelto", "Costi e massimali motivati", "Mappa impatto letta", "Piano applicato dopo lettura di delta e costo"],
  },
  {
    id: "istruzioni-combinatorie",
    eyebrow: "Combinatorie",
    title: "Verificare coppie, miglioratività e warning",
    body: "La tab `Combinatorie` controlla se una coppia è tecnicamente ed economicamente ammissibile rispetto ai due lotti singoli.",
    bullets: [
      "Attiva la coppia solo se entrambi i lotti singoli sono presentati.",
      "Controlla inserimento in entrambe le buste e coerenza PEF.",
      "Verifica che la combinatoria sia migliorativa rispetto alla somma dei singoli.",
      "Leggi il risparmio stimato e i warning prima di considerarla candidata.",
      "Se una coppia non è ammissibile, correggi prima lotti singoli, ribassi o flag documentali.",
    ],
    checks: ["Buste coerenti", "PEF coerente", "Combinatoria economicamente migliorativa"],
  },
  {
    id: "istruzioni-risultati",
    eyebrow: "Risultati",
    title: "Leggere scenario vincente, confronto e report",
    body: "La tab `Risultati` mostra assegnazioni, punteggi e confronto con scenari salvati. È il punto in cui trasformare la compilazione in una lettura operativa.",
    bullets: [
      "Controlla il vincitore simulato per ciascun lotto.",
      "Guarda punteggio totale e punteggio tecnico, soprattutto nei casi vicini.",
      "Se ci sono lotti non assegnati, torna a partecipazioni, soglia Q/T e combinatorie.",
      "Seleziona uno scenario salvato per confrontare delta di punteggio e assegnazioni.",
      "Usa il report per stampare o salvare una sintesi in PDF dal browser.",
    ],
    checks: ["Scenario salvato prima del confronto", "Lotti non assegnati spiegati", "Report letto prima di stamparlo"],
  },
  {
    id: "istruzioni-dati-locali",
    eyebrow: "Dati locali",
    title: "Salvataggio, import/export e privacy",
    body: "Il tool non invia scenari a un server e non recupera dati live dal cloud durante l'uso. Gli scenari salvati vivono nel browser.",
    bullets: [
      "Il workspace corrente è salvato in `localStorage`.",
      "La libreria scenari resta nel browser e nel profilo utente corrente.",
      "Cancellare i dati del sito può eliminare gli scenari non esportati.",
      "L'export JSON è il modo corretto per archiviare o condividere una simulazione.",
      "I link alle fonti pubbliche aprono siti esterni solo quando vengono cliccati.",
    ],
    checks: ["Export creato per scenari importanti", "File JSON archiviato fuori dal browser", "Fonti esterne verificate manualmente se servono dati aggiornati"],
  },
];

const sectionIcon = (id: string) => {
  const iconSize = 19;
  if (id.includes("scenario")) return <FileJson size={iconSize} />;
  if (id.includes("offerenti")) return <Route size={iconSize} />;
  if (id.includes("tecnica")) return <SlidersHorizontal size={iconSize} />;
  if (id.includes("analisi-puntuale")) return <SlidersHorizontal size={iconSize} />;
  if (id.includes("ottimizza")) return <Sparkles size={iconSize} />;
  if (id.includes("economica")) return <CircleDollarSign size={iconSize} />;
  if (id.includes("combinatorie")) return <GitCompareArrows size={iconSize} />;
  if (id.includes("risultati")) return <Trophy size={iconSize} />;
  if (id.includes("dati")) return <ShieldCheck size={iconSize} />;
  return <ClipboardList size={iconSize} />;
};

export function InstructionsPage({ onBack }: InstructionsPageProps) {
  return (
    <div className="guide-page">
      <header className="guide-topbar">
        <button className="guide-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Torna al simulatore
        </button>
        <div className="guide-title-block">
          <span className="guide-kicker">
            <BookOpen size={16} />
            Guida operativa
          </span>
          <h1>Istruzioni di compilazione</h1>
          <p>Pagina navigabile per compilare uno scenario, leggere i punteggi e preparare un report coerente.</p>
        </div>
      </header>

      <main className="guide-layout">
        <aside className="guide-index" aria-label="Indice istruzioni">
          <div className="guide-index-title">Indice</div>
          <nav>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.eyebrow}
              </a>
            ))}
          </nav>
        </aside>

        <div className="guide-content">
          <section className="guide-overview" id="istruzioni">
            <div>
              <span className="guide-kicker">
                <ClipboardCheck size={16} />
                Percorso rapido
              </span>
              <h2>Dal modello base al report</h2>
              <p>
                Usa questo percorso quando devi costruire una simulazione leggibile: prima definisci lo scenario, poi compili tecnica ed economica, infine salvi e confronti.
              </p>
            </div>
            <ol className="guide-quicksteps">
              {quickSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {sections.map((section) => (
            <section className="guide-section" id={section.id} key={section.id}>
              <div className="guide-section-head">
                <div className="guide-section-icon">{sectionIcon(section.id)}</div>
                <div>
                  <span>{section.eyebrow}</span>
                  <h2>{section.title}</h2>
                </div>
              </div>
              <p>{section.body}</p>
              <div className="guide-detail-grid">
                <div>
                  <h3>Come procedere</h3>
                  <ul>
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="guide-checklist">
                  <h3>Controlli</h3>
                  <ul>
                    {section.checks.map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={15} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}

          <section className="guide-final">
            <Save size={20} />
            <div>
              <h2>Regola pratica</h2>
              <p>
                Quando uno scenario diventa utile, salvalo in libreria e poi esportalo in JSON. La libreria è comoda per il confronto immediato, l'export è la copia da conservare.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
