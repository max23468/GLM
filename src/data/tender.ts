export type LotId = "L1" | "L2" | "L3" | "L4";
export type PairId = "L1+L2" | "L2+L3" | "L3+L4" | "L1+L4";
export type CriterionKind = "Q" | "T" | "D";
export type FormulaKind = "higher" | "lower" | "soil" | "tabular" | "discretionary";
export type InputKind = "percent" | "ratio" | "integer" | "index" | "sqm" | "yesno" | "judgement";
export type Effort = "basso" | "medio" | "alto";

export type QuantityInputDefinition = {
  kind: "ratio" | "percent";
  numeratorLabel: string;
  denominatorLabel: string;
  numeratorUnit: string;
  denominatorUnit: string;
  resultLabel: string;
  resultUnit: string;
};

export type Lot = {
  id: LotId;
  label: string;
  shortLabel: string;
  baseByPhase: [number, number, number];
  totalBase: number;
  minPassengerChecks: number;
  minProductionYears3to7: number;
};

export type Pair = {
  id: PairId;
  lots: [LotId, LotId];
  label: string;
};

export type Criterion = {
  id: string;
  ambit: string;
  ambitLabel: string;
  parentId: string;
  parentLabel: string;
  kind: CriterionKind;
  formula: FormulaKind;
  label: string;
  maxPoints: number;
  input: InputKind;
  unit: string;
  tradeoffUnit: string;
  effort: Effort;
  source: string;
  note?: string;
  quantityInput?: QuantityInputDefinition;
  dependency?: {
    criterionId: string;
    operator: ">=";
    value: number;
    message: string;
  };
};

export type Ambit = {
  id: string;
  label: string;
  maxPoints: number;
};

export type LotContext = {
  lotId: LotId;
  territory: string;
  operatingHint: string;
  source: string;
  sourceUrl: string;
};

export type PublicSourceNote = {
  id: string;
  title: string;
  metric: string;
  body: string;
  source: string;
  sourceUrl: string;
};

export const LOTS: Lot[] = [
  {
    id: "L1",
    label: "Lotto 1",
    shortLabel: "L1",
    baseByPhase: [20106000, 22692000, 137037000],
    totalBase: 179835000,
    minPassengerChecks: 60000,
    minProductionYears3to7: 7573000,
  },
  {
    id: "L2",
    label: "Lotto 2",
    shortLabel: "L2",
    baseByPhase: [42623000, 48108000, 277197000],
    totalBase: 367928000,
    minPassengerChecks: 100000,
    minProductionYears3to7: 11950000,
  },
  {
    id: "L3",
    label: "Lotto 3",
    shortLabel: "L3",
    baseByPhase: [40954000, 44417000, 249170000],
    totalBase: 334541000,
    minPassengerChecks: 100000,
    minProductionYears3to7: 11093000,
  },
  {
    id: "L4",
    label: "Lotto 4",
    shortLabel: "L4",
    baseByPhase: [42116000, 47783000, 276179000],
    totalBase: 366078000,
    minPassengerChecks: 100000,
    minProductionYears3to7: 13253000,
  },
];

export const PAIRS: Pair[] = [
  { id: "L1+L2", lots: ["L1", "L2"], label: "Lotti 1+2" },
  { id: "L2+L3", lots: ["L2", "L3"], label: "Lotti 2+3" },
  { id: "L3+L4", lots: ["L3", "L4"], label: "Lotti 3+4" },
  { id: "L1+L4", lots: ["L1", "L4"], label: "Lotti 1+4" },
];

export const LOT_CONTEXT: Record<LotId, LotContext> = {
  L1: {
    lotId: "L1",
    territory: "Bacino extraurbano milanese, primo lotto di simulazione",
    operatingHint: "Lotto più piccolo: pesa meno sul valore complessivo, ma resta sensibile alla qualità operativa e alle combinatorie.",
    source: "Agenzia TPL MLMP, gara TPL 2026",
    sourceUrl: "https://www.agenziatpl.it/agenzia/amministrazione-trasparente/19-bandi-di-gara-e-contratti/287-bando-di-gara-per-l-affidamento-di-servizi-di-tpl",
  },
  L2: {
    lotId: "L2",
    territory: "Area extraurbana con base d'asta più elevata",
    operatingHint: "La massa economica rende molto rilevanti ribasso medio, PEF e tenuta della soglia Q/T.",
    source: "Agenzia TPL MLMP, gara TPL 2026",
    sourceUrl: "https://www.agenziatpl.it/agenzia/amministrazione-trasparente/19-bandi-di-gara-e-contratti/287-bando-di-gara-per-l-affidamento-di-servizi-di-tpl",
  },
  L3: {
    lotId: "L3",
    territory: "Lotto intermedio con forte competizione su tecnologia e servizio",
    operatingHint: "Il profilo tecnico premia coperture di bordo, informazione all'utenza e miglioramenti di esercizio.",
    source: "Agenzia TPL MLMP, gara TPL 2026",
    sourceUrl: "https://www.agenziatpl.it/agenzia/amministrazione-trasparente/19-bandi-di-gara-e-contratti/287-bando-di-gara-per-l-affidamento-di-servizi-di-tpl",
  },
  L4: {
    lotId: "L4",
    territory: "Area extraurbana orientata a Lodi/Pavia nel set documentale",
    operatingHint: "Il valore e la produzione minima rendono credibili strategie locali con forte presidio operativo.",
    source: "Agenzia TPL MLMP, gara TPL 2026",
    sourceUrl: "https://www.agenziatpl.it/agenzia/amministrazione-trasparente/19-bandi-di-gara-e-contratti/287-bando-di-gara-per-l-affidamento-di-servizi-di-tpl",
  },
};

export const PUBLIC_SOURCE_NOTES: PublicSourceNote[] = [
  {
    id: "agency-tender",
    title: "Gara TPL MLMP",
    metric: "4 lotti / 30.09.2026",
    body: "La pubblicazione dell'Agenzia TPL indica procedura aperta, quattro lotti extraurbani e scadenza bando al 30 settembre 2026.",
    source: "Agenzia TPL Milano, Monza Brianza, Lodi e Pavia",
    sourceUrl: "https://www.agenziatpl.it/agenzia/amministrazione-trasparente/19-bandi-di-gara-e-contratti/287-bando-di-gara-per-l-affidamento-di-servizi-di-tpl",
  },
  {
    id: "sintel",
    title: "Procedura aperta Sintel",
    metric: "ID 218044617",
    body: "Il fascicolo pubblico Sintel espone il set documentale della procedura, inclusi allegati tecnici, PEF, offerta economica e modelli di partecipazione.",
    source: "ARIA Lombardia - Sintel",
    sourceUrl: "https://www.sintel.regione.lombardia.it/eprocdata/auctionDetail.xhtml?id=218044617",
  },
  {
    id: "lot-baselines",
    title: "Basi demo di lotto",
    metric: "484 mezzi / 4.682 fermate",
    body: "Le basi demo usano All. 09 per mezzi, All. 05 per fermate e All. 04.9-04.12 per corse annue stimate per lotto.",
    source: "Allegati locali di gara / Sintel",
    sourceUrl: "https://www.sintel.regione.lombardia.it/eprocdata/auctionDetail.xhtml?id=218044617",
  },
  {
    id: "autoguidovie",
    title: "Autoguidovie",
    metric: "777 mezzi",
    body: "Il profilo demo usa dati pubblici su classe emissiva Euro 5+, AVM, accessibilità, videosorveglianza, ADAS e rinnovo medio della flotta.",
    source: "Autoguidovie - Flotta",
    sourceUrl: "https://autoguidovie.it/it/flotta",
  },
  {
    id: "arriva",
    title: "Arriva Italia",
    metric: "1.920 mezzi",
    body: "Il profilo demo usa la scala nazionale del gruppo e gli investimenti dichiarati su rinnovo flotta, quota clean e classe emissiva minima.",
    source: "Arriva Italia - Piano investimenti",
    sourceUrl: "https://arriva.it/news/investimenti-pari-a-156-milioni-di-euro-nei-prossimi-5-anni/",
  },
  {
    id: "movibus",
    title: "Movibus",
    metric: "28 linee bus",
    body: "Il profilo RTI Ovest è ispirato al perimetro pubblico di Movibus nell'Alto Milanese e nell'area ovest della città metropolitana.",
    source: "Gruppo ATM - Movibus",
    sourceUrl: "https://www.atm.it/en/IlGruppo/ChiSiamo/Pages/Movibus.aspx",
  },
  {
    id: "net-atm",
    title: "NET / Gruppo ATM",
    metric: "49 comuni / 23 linee",
    body: "Il profilo urbano-tecnologico deriva dal presidio NET nel nord-est milanese e dalla traiettoria ATM verso una flotta bus elettrica.",
    source: "Gruppo ATM - NET",
    sourceUrl: "https://www.atm.it/it/IlGruppo/ChiSiamo/Pagine/NET.aspx",
  },
  {
    id: "star",
    title: "STAR Mobility",
    metric: "Lodi e Casalpusterlengo",
    body: "Il profilo locale sul lotto 4 usa segnali pubblici su servizio urbano, bigliettazione elettronica, pagamento contactless e presidio lodigiano.",
    source: "STAR Mobility - Servizio urbano",
    sourceUrl: "https://starmobility.it/servizio-urbano/",
  },
];

export const COMPATIBLE_PAIR_SETS: PairId[][] = [
  ["L1+L2", "L3+L4"],
  ["L1+L4", "L2+L3"],
];

export const AMBITS: Ambit[] = [
  { id: "A", label: "Contrasto all'evasione tariffaria", maxPoints: 7 },
  { id: "B", label: "Livello di servizio offerto", maxPoints: 14 },
  { id: "C", label: "Sistemi e tecnologie di bordo", maxPoints: 14 },
  { id: "D", label: "Impianti di fermata", maxPoints: 10 },
  { id: "E", label: "Informazione e rapporti con gli utenti", maxPoints: 4 },
  { id: "F", label: "Qualità ambientale del servizio", maxPoints: 14 },
  { id: "G", label: "Responsabilità sociale e organizzazione", maxPoints: 7 },
];

const ambitLabel = (ambit: string) => AMBITS.find((item) => item.id === ambit)?.label ?? ambit;

const PARENT_LABELS: Record<string, string> = {
  "A.1": "Miglioramento dell'efficacia dell'attività di contrasto all'evasione tariffaria",
  "B.1": "Riduzione dell'affollamento nelle fasce orarie di punta",
  "B.2": "Miglioramento del livello di servizio base offerto",
  "B.3": "Miglioramento della disponibilità di servizio serale",
  "B.4": "Anticipazione dei tempi di entrata a regime del servizio offerto",
  "B.5": "Miglioramento dell'offerta attraverso servizi DRT",
  "C.1": "Tecnologie ADAS per il miglioramento della sicurezza attiva",
  "C.2": "Dispositivi per la sicurezza degli utenti e del personale di guida",
  "C.3": "Tecnologie per l'informazione agli utenti",
  "D.1": "Miglioramento del comfort e dell'informazione alle fermate",
  "D.2": "Miglioramento dell'accessibilità al servizio per persone non vedenti o ipo-vedenti",
  "E.1": "Efficacia dell'informazione agli utenti durante il viaggio e accessibilità al servizio",
  "E.2": "Altre azioni di miglioramento delle informazioni e dei rapporti con gli utenti",
  "F.1": "Miglioramento delle performance ambientali della flotta",
  "F.2": "Riduzione dei consumi di carburante",
  "F.3": "Autoproduzione di energia",
  "F.4": "Riduzione del consumo di suolo",
  "F.5": "Certificazioni ambientali ESG",
  "G.1": "Controllo qualità del servizio",
  "G.2": "Sicurezza sul luogo di lavoro",
  "G.3": "Responsabilità sociale",
  "G.4": "Formazione del personale",
  "G.5": "Miglioramento clausola sociale",
};

const TRADEOFF_UNITS: Record<string, string> = {
  "A.1.1": "corse controllate annue",
  "A.1.2": "passeggeri controllati/anno",
  "B.1.1": "posti*km in punta",
  "B.2.1": "corse aggiuntive base",
  "B.3.1": "corse aggiuntive serali",
  "B.4.1": "vett*km nelle prime due fasi",
  "B.5.1": "miglioramento progettuale DRT",
  "C.1.1": "mezzi con BSD",
  "C.1.2": "mezzi con ADAS",
  "C.2.1": "mezzi con videosorveglianza",
  "C.2.2": "impegno software video/audio analisi",
  "C.2.3": "impegno centrale qualificata",
  "C.2.4": "mezzi con chiamata emergenza",
  "C.3.1": "mezzi con informazione dinamica",
  "C.3.2": "impegno interoperabilità coincidenze",
  "D.1.1": "fermate con pensiline",
  "D.1.2": "fermate con paline conformi",
  "D.1.3": "fermate con display connessi",
  "D.2.1": "fermate con segnali LVE",
  "E.1.1": "impegno travel planner PRM",
  "E.2.1": "miglioramento informazione utenti",
  "F.1.1": "punti indice I_CEA ridotti",
  "F.2.1": "mezzi con ECO-DRIVER",
  "F.3.1": "kWh/anno autoprodotti",
  "F.4.1": "m2 di consumo suolo ridotti",
  "F.5.1": "impegno rendicontazione sostenibilità",
  "G.1.1": "miglioramento centrale controllo",
  "G.2.1": "impegno ISO 45001",
  "G.3.1": "impegno certificazione sociale",
  "G.4.1": "miglioramento piano formazione",
  "G.5.1": "impegno clausola sociale",
};

const controlledRunsInput: QuantityInputDefinition = {
  kind: "percent",
  numeratorLabel: "Corse controllate annue",
  denominatorLabel: "Corse programmate annue",
  numeratorUnit: "corse",
  denominatorUnit: "corse",
  resultLabel: "TCor_contr",
  resultUnit: "%",
};

const busCoverageInput = (numeratorLabel: string, resultLabel: string): QuantityInputDefinition => ({
  kind: "ratio",
  numeratorLabel,
  denominatorLabel: "Autobus totali in offerta, incluse scorte",
  numeratorUnit: "autobus",
  denominatorUnit: "autobus",
  resultLabel,
  resultUnit: "0-1",
});

const criterion = (
  id: string,
  ambit: string,
  kind: CriterionKind,
  formula: FormulaKind,
  maxPoints: number,
  label: string,
  input: InputKind,
  unit: string,
  effort: Effort,
  source: string,
  note?: string,
  dependency?: Criterion["dependency"],
  quantityInput?: QuantityInputDefinition,
): Criterion => ({
  id,
  ambit,
  ambitLabel: ambitLabel(ambit),
  parentId: id.split(".").slice(0, 2).join("."),
  parentLabel: PARENT_LABELS[id.split(".").slice(0, 2).join(".")] ?? id,
  kind,
  formula,
  maxPoints,
  label,
  input,
  unit,
  tradeoffUnit: TRADEOFF_UNITS[id] ?? unit,
  effort,
  source,
  note,
  quantityInput,
  dependency,
});

export const CRITERIA: Criterion[] = [
  criterion("A.1.1", "A", "Q", "higher", 3, "Tasso aggiuntivo di corse controllate", "percent", "%", "medio", "All. 13, p. 22", undefined, undefined, controlledRunsInput),
  criterion("A.1.2", "A", "Q", "higher", 4, "Numero aggiuntivo di passeggeri controllati", "integer", "passeggeri/anno", "medio", "All. 13, p. 22", "Soglie minime: 60.000 per L1, 100.000 per L2-L4."),
  criterion("B.1.1", "B", "Q", "higher", 3, "Incremento dei posti offerti nelle fasce di punta", "integer", "posti*km", "alto", "All. 13, p. 23", "Output dal Modello presentazione PdE."),
  criterion("B.2.1", "B", "Q", "higher", 4, "Corse aggiuntive nell'arco giornaliero base", "integer", "corse", "alto", "All. 13, p. 23", "Output dal Modello presentazione PdE."),
  criterion("B.3.1", "B", "Q", "higher", 2, "Corse aggiuntive serali", "integer", "corse", "alto", "All. 13, p. 24", "Output dal Modello presentazione PdE."),
  criterion("B.4.1", "B", "Q", "higher", 3, "Percorrenze aggiuntive nelle prime due fasi", "integer", "vett*km", "alto", "All. 13, p. 25"),
  criterion("B.5.1", "B", "D", "discretionary", 2, "Efficacia del progetto di servizi complementari DRT", "judgement", "coeff.", "alto", "All. 13, p. 37"),
  criterion("C.1.1", "C", "Q", "higher", 2, "Copertura con telecamere BSD", "ratio", "0-1", "medio", "All. 13, p. 25", undefined, undefined, busCoverageInput("Autobus attrezzati con telecamere BSD", "Tbsd")),
  criterion("C.1.2", "C", "Q", "higher", 2, "Copertura con telecamere ADAS", "ratio", "0-1", "medio", "All. 13, p. 26", undefined, undefined, busCoverageInput("Autobus attrezzati con telecamere ADAS", "Tadas")),
  criterion("C.2.1", "C", "Q", "higher", 3, "Copertura con videosorveglianza di bordo", "ratio", "0-1", "medio", "All. 13 tabella criteri e All. 13.10", "Il paragrafo formula indica 2 punti e sigla PC31: criticità documentale segnalata.", undefined, busCoverageInput("Autobus attrezzati con videosorveglianza", "Tvideo")),
  criterion("C.2.2", "C", "T", "tabular", 1, "Software video/audio analisi per situazioni di pericolo", "yesno", "sì/no", "basso", "All. 13, p. 32"),
  criterion("C.2.3", "C", "T", "tabular", 1, "Collegamento con centrale qualificata di pronto intervento", "yesno", "sì/no", "basso", "All. 13, p. 33"),
  criterion("C.2.4", "C", "Q", "higher", 1, "Copertura con chiamata emergenza conducente", "ratio", "0-1", "medio", "All. 13 tabella criteri e All. 13.10", "Il testo formula riporta 2 punti: criticità documentale segnalata.", undefined, busCoverageInput("Autobus attrezzati con chiamata di emergenza", "Tall")),
  criterion("C.3.1", "C", "Q", "higher", 2, "Copertura con informazione dinamica a bordo", "ratio", "0-1", "medio", "All. 13, p. 27", undefined, undefined, busCoverageInput("Autobus con monitor e indicatori vocali", "Tinfo")),
  criterion("C.3.2", "C", "T", "tabular", 2, "Informazioni a bordo su coincidenze ai nodi", "yesno", "sì/no", "basso", "All. 13, p. 34", undefined, {
    criterionId: "C.3.1",
    operator: ">=",
    value: 0.5,
    message: "Ammessa solo se C.3.1 è uguale o superiore a 0,5.",
  }),
  criterion("D.1.1", "D", "Q", "higher", 3, "Installazione di pensiline", "integer", "fermate", "medio", "All. 13, p. 28", "Il testo formula usa variabili Tpensi/Tpensmax: criticità redazionale."),
  criterion("D.1.2", "D", "Q", "higher", 3, "Paline di fermata conformi DGR 581/2023", "integer", "fermate", "medio", "All. 13 tabella criteri e All. 13.10", "Il testo formula indica 2 punti pur con max 3 in tabella/modello."),
  criterion("D.1.3", "D", "Q", "higher", 2, "Display informativi connessi alle fermate", "integer", "fermate", "medio", "All. 13, p. 29"),
  criterion("D.2.1", "D", "Q", "higher", 2, "Segnali tattili Loges-Vet-Evolution", "integer", "fermate", "medio", "All. 13, p. 29"),
  criterion("E.1.1", "E", "T", "tabular", 2, "Mobile app con travel planner PRM", "yesno", "sì/no", "basso", "All. 13, p. 34"),
  criterion("E.2.1", "E", "D", "discretionary", 2, "Altre azioni informative e rapporti con gli utenti", "judgement", "coeff.", "alto", "All. 13, p. 37"),
  criterion("F.1.1", "F", "Q", "lower", 7, "Performance ambientali del parco mezzi - I_CEA", "index", "indice", "alto", "All. 13, p. 30 e All. 13.11", "Punteggio inverso: migliore il CEA più basso."),
  criterion("F.2.1", "F", "Q", "higher", 2, "Copertura con dispositivi ECO-DRIVER", "ratio", "0-1", "medio", "All. 13, p. 31", undefined, undefined, busCoverageInput("Autobus attrezzati con dispositivi ECO-DRIVER", "Tecod")),
  criterion("F.3.1", "F", "Q", "higher", 2, "Autoproduzione consumi elettrici per trazione", "integer", "kWh/anno", "alto", "All. 13, p. 31"),
  criterion("F.4.1", "F", "Q", "soil", 2, "Indice di consumo di suolo", "sqm", "m2", "alto", "All. 13, p. 32", "Se <= 0 assegna il massimo; se > 0 usa la formula su ICsuolomax."),
  criterion("F.5.1", "F", "T", "tabular", 1, "Rendicontazione di sostenibilità ambientale", "yesno", "sì/no", "basso", "All. 13, p. 34"),
  criterion("G.1.1", "G", "D", "discretionary", 2, "Qualità del progetto di centrale di controllo aziendale", "judgement", "coeff.", "alto", "All. 13, p. 37"),
  criterion("G.2.1", "G", "T", "tabular", 1, "Certificazione ISO 45001", "yesno", "sì/no", "basso", "All. 13, p. 35"),
  criterion("G.3.1", "G", "T", "tabular", 1, "Certificazioni di responsabilità sociale", "yesno", "sì/no", "basso", "All. 13, p. 35"),
  criterion("G.4.1", "G", "D", "discretionary", 2, "Qualità del piano di formazione del personale", "judgement", "coeff.", "alto", "All. 13, p. 37"),
  criterion("G.5.1", "G", "T", "tabular", 1, "Miglioramento clausola sociale", "yesno", "sì/no", "basso", "All. 13 tabella/PDF e All. 13.10", "Descrizione non perfettamente allineata fra PDF e modello All. 13.10."),
];

export const DISCRETIONARY_SCALE = [
  { label: "Eccellente", value: 1 },
  { label: "Ottimo", value: 0.85 },
  { label: "Buono", value: 0.7 },
  { label: "Adeguato", value: 0.6 },
  { label: "Discreto", value: 0.5 },
  { label: "Mediocre", value: 0.3 },
  { label: "Scarso", value: 0.1 },
  { label: "Non migliorativa", value: 0 },
] as const;

export const THRESHOLD_OPTIONS = [
  {
    id: "disciplinare-37",
    label: "37 pt - Disciplinare",
    value: 37,
    source: "Disciplinare, art. 23.1",
  },
  {
    id: "allegato13-38",
    label: "38 pt - Allegato 13",
    value: 38,
    source: "All. 13, p. 21",
  },
  {
    id: "qt-70-43-4",
    label: "43,4 pt - 70% dei Q/T",
    value: 43.4,
    source: "Calcolo su somma sub-criteri Q/T pari a 62",
  },
] as const;

export const DOCUMENT_WARNINGS = [
  {
    title: "Soglia di sbarramento non univoca",
    body: "Il Disciplinare indica 37 punti, l'Allegato 13 indica 38 punti, mentre il 70% dei sub-criteri Q/T ricostruiti dalla tabella è 43,4 punti.",
  },
  {
    title: "Massimi di alcuni sub-criteri non allineati al testo formula",
    body: "C.2.1, C.2.4 e D.1.2 presentano differenze tra tabella/modello e frase formula. Il simulatore usa i massimi della tabella e del modello All. 13.10 e segnala la criticità.",
  },
  {
    title: "Criteri aggregati con refusi nei massimi",
    body: "Nella tabella PDF alcuni massimi di criterio non coincidono con la somma dei sub-criteri, pur restando coerenti i totali per ambito.",
  },
  {
    title: "G.5.1 ha descrizione non identica tra PDF e modello",
    body: "Il PDF parla di continuità lavorativa dei lavoratori subaffidatari; il modello All. 13.10 cita il mantenimento delle garanzie del contratto di secondo livello.",
  },
];
