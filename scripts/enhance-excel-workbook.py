#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

from openpyxl import load_workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKBOOK = ROOT / "excel-vba" / "templates" / "Simulatore-TPL-Lotti-1-4-template.xlsm"
EXCEL_README = ROOT / "excel-vba" / "README.md"

NAVY = "1F4E78"
BLUE = "2563EB"
SKY = "DCEBFF"
CYAN = "CFFAFE"
GREEN = "D9EAD3"
AMBER = "FFF2CC"
RED = "FCE4D6"
INK = "1F2937"
MUTED = "6B7280"
GRID = "D9E2F3"
WHITE = "FFFFFF"
INPUT = "FFF8CC"
OUTPUT = "EAF7EA"
SECTION = "E8EEF8"

MAX_OFFER_ROWS = 200
MAX_COMBO_ROWS = 80

THIN_GRID = Side(style="thin", color=GRID)
BORDER = Border(left=THIN_GRID, right=THIN_GRID, top=THIN_GRID, bottom=THIN_GRID)


def workbook_path() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).resolve()
    return DEFAULT_WORKBOOK


def fill(color: str) -> PatternFill:
    return PatternFill(start_color=color, end_color=color, fill_type="solid")


def reset_sheet(wb, name: str):
    if name in wb.sheetnames:
        del wb[name]
    return wb.create_sheet(name)


def move_sheet_first(wb, sheet):
    wb._sheets.remove(sheet)
    wb._sheets.insert(0, sheet)


def reorder_sheets(wb, ordered_names: list[str]):
    by_name = {sheet.title: sheet for sheet in wb.worksheets}
    ordered = [by_name[name] for name in ordered_names if name in by_name]
    ordered.extend(sheet for sheet in wb.worksheets if sheet.title not in ordered_names)
    wb._sheets = ordered


def clear_layout_helpers(ws):
    ws.tables.clear()
    ws.data_validations.dataValidation = []
    ws.conditional_formatting._cf_rules.clear()
    ws.auto_filter.ref = None


def title(ws, text: str, subtitle: str | None = None):
    ws["A1"] = text
    ws["A1"].font = Font(size=18, bold=True, color=WHITE)
    ws["A1"].fill = fill(NAVY)
    ws["A1"].alignment = Alignment(vertical="center")
    ws.merge_cells("A1:H1")
    ws.row_dimensions[1].height = 28

    if subtitle:
        ws["A2"] = subtitle
        ws["A2"].font = Font(size=11, color=MUTED)
        ws["A2"].alignment = Alignment(wrap_text=True)
        ws.merge_cells("A2:H2")


def style_cells(ws, cell_range: str, fill_color: str | None = None, bold: bool = False, font_color: str = INK):
    for row in ws[cell_range]:
        for cell in row:
            cell.border = BORDER
            cell.font = Font(bold=bold, color=font_color)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if fill_color:
                cell.fill = fill(fill_color)


def section_header(ws, row: int, text: str, end_col: str = "H"):
    ws[f"A{row}"] = text
    ws[f"A{row}"].font = Font(size=12, bold=True, color=WHITE)
    ws[f"A{row}"].fill = fill(BLUE)
    ws[f"A{row}"].alignment = Alignment(vertical="center")
    ws.merge_cells(f"A{row}:{end_col}{row}")
    ws.row_dimensions[row].height = 22


def set_widths(ws, widths: dict[str, float]):
    for col, width in widths.items():
        ws.column_dimensions[col].width = width


def add_sheet_link(cell, label: str, sheet_name: str):
    cell.value = label
    cell.hyperlink = f"#'{sheet_name}'!A1"
    cell.style = "Hyperlink"
    cell.font = Font(color=BLUE, underline="single", bold=True)


def create_dashboard(wb):
    ws = reset_sheet(wb, "Dashboard")
    move_sheet_first(wb, ws)
    ws.sheet_properties.tabColor = NAVY
    ws.sheet_view.showGridLines = False
    title(
        ws,
        "Simulatore gara TPL lotti 1-4",
        "Console Excel in modalità light: compila le offerte, esegui le macro e usa il web per i controlli avanzati.",
    )

    section_header(ws, 4, "Stato rapido", "H")
    cards = [
        ("A5:B7", "Righe offerte", "=COUNTA(Offerte!A2:A200)", "Righe compilate in Offerte"),
        ("C5:D7", "Offerte attive", '=COUNTIF(Offerte!D2:D200,"1")+COUNTIF(Offerte!D2:D200,1)', "Righe abilitate"),
        ("E5:F7", "Lotto attivo", "=Parametri!B3", "Usato da ottimizzazione"),
        ("G5:H7", "Soglia tecnica", "=Parametri!B2", "Minimo ammissibilità"),
    ]
    for cell_range, label, formula, note in cards:
        start_ref, end_ref = cell_range.split(":")
        start = ws[start_ref]
        end = ws[end_ref]
        for row in range(start.row, end.row + 1):
            ws.merge_cells(start_row=row, start_column=start.column, end_row=row, end_column=end.column)
            cell = ws.cell(row=row, column=start.column)
            cell.fill = fill(SKY)
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.cell(row=start.row, column=start.column).value = label
        ws.cell(row=start.row, column=start.column).font = Font(color=INK, bold=True, size=10)
        ws.cell(row=start.row + 1, column=start.column).value = formula
        ws.cell(row=start.row + 1, column=start.column).font = Font(color=NAVY, bold=True, size=16)
        ws.cell(row=start.row + 2, column=start.column).value = note
        ws.cell(row=start.row + 2, column=start.column).font = Font(color=MUTED, size=9)
        for row in range(start.row, end.row + 1):
            ws.row_dimensions[row].height = 24

    section_header(ws, 10, "Flusso operativo", "H")
    workflow = [
        ("1", "Controlla Parametri", "Soglia tecnica e lotto attivo."),
        ("2", "Compila Offerte", "Una riga per concorrente e lotto."),
        ("3", "Esegui SimulaScenario", "Popola risultati, combinatorie e vincitori."),
        ("4", "Rifinisci con OttimizzaLottoAttivo", "Usa leve Q/T sul concorrente selezionato."),
        ("5", "Confronta con web", "Incolla expected in ConfrontoWeb!J2:J5."),
    ]
    ws.append([])
    start = 11
    for idx, (step, action, detail) in enumerate(workflow, start=start):
        ws[f"A{idx}"] = step
        ws[f"B{idx}"] = action
        ws[f"C{idx}"] = detail
        ws.merge_cells(f"C{idx}:H{idx}")
    style_cells(ws, f"A{start}:H{start + len(workflow) - 1}", WHITE)
    for row in range(start, start + len(workflow)):
        ws[f"A{row}"].fill = fill(NAVY)
        ws[f"A{row}"].font = Font(color=WHITE, bold=True)
        ws[f"A{row}"].alignment = Alignment(horizontal="center")
        ws[f"B{row}"].fill = fill(SECTION)
        ws[f"B{row}"].font = Font(bold=True, color=INK)

    section_header(ws, 18, "Navigazione e macro", "H")
    links = [
        ("A19", "Parametri", "Parametri"),
        ("C19", "Offerte", "Offerte"),
        ("E19", "Combinatorie", "Combinatorie"),
        ("G19", "Scenario globale", "ScenarioGlobale"),
        ("A21", "Guida", "Guida"),
        ("C21", "Glossario", "Glossario"),
        ("E21", "Risultati", "Risultati"),
        ("G21", "Confronto web", "ConfrontoWeb"),
        ("A22", "Log ottimizzazione", "LogOttimizzazione"),
    ]
    for ref, label, sheet_name in links:
        add_sheet_link(ws[ref], label, sheet_name)
    macro_rows = [
        ("CheckBeforeRun", "Controlla setup e dati prima di simulare."),
        ("SimulaScenario", "Calcola punteggi, combinatorie e vincitori."),
        ("OttimizzaLottoAttivo", "Applica iterazioni Q/T al bidder indicato."),
        ("ConfrontoWebGolden", "Verifica i totali attesi copiati dal web."),
    ]
    for row, (macro, description) in enumerate(macro_rows, start=23):
        ws[f"A{row}"] = macro
        ws[f"C{row}"] = description
        ws.merge_cells(f"C{row}:H{row}")
    style_cells(ws, "A23:H26", WHITE)
    for row in range(23, 27):
        ws[f"A{row}"].fill = fill(GREEN)
        ws[f"A{row}"].font = Font(bold=True, color=INK)

    section_header(ws, 29, "Limiti da ricordare", "H")
    limits = [
        "Excel resta in modalità light: il web conserva scoring completo, warning avanzati, persistenza e confronto scenari.",
        "I costi e le leve sono ipotesi operative: non sono dati ufficiali di gara.",
        "Se Excel blocca le macro dopo il download, sblocca il file dalle proprietà del sistema prima dell'uso.",
    ]
    for row, text in enumerate(limits, start=30):
        ws[f"A{row}"] = text
        ws.merge_cells(f"A{row}:H{row}")
        ws[f"A{row}"].fill = fill(AMBER if row == 30 else WHITE)
        ws[f"A{row}"].border = BORDER
        ws[f"A{row}"].alignment = Alignment(wrap_text=True)

    set_widths(ws, {"A": 14, "B": 22, "C": 18, "D": 18, "E": 18, "F": 18, "G": 18, "H": 18})
    ws.freeze_panes = "A4"


def create_guide(wb):
    ws = reset_sheet(wb, "Guida")
    ws.sheet_properties.tabColor = BLUE
    ws.sheet_view.showGridLines = False
    title(ws, "Guida integrata", "README operativo incorporato nel workbook: niente file esterni necessari per iniziare.")

    rows = [
        ("Avvio rapido", "1. Apri il file .xlsm e abilita le macro se richiesto.\n2. Vai a Parametri e scegli soglia/lotto attivo.\n3. Compila Offerte.\n4. Esegui CheckBeforeRun e poi SimulaScenario.\n5. Usa ConfrontoWebGolden solo dopo aver copiato gli expected dal web."),
        ("Macro principali", "CheckBeforeRun: valida setup e input.\nSimulaScenario: calcola risultati.\nOttimizzaLottoAttivo: lavora sul bidder e lotto selezionati.\nConfrontoWebGolden: confronta i totali Excel con valori web incollati in J2:J5."),
        ("Modalità light", "Questo workbook supporta analisi offline rapide. Non sostituisce il simulatore web per scoring completo, warning documentali, persistenza, import/export JSON e confronto scenari salvati."),
        ("Sicurezza macro", "Dopo download da web Excel può bloccare le macro. Su macOS/Windows può servire sbloccare il file o spostarlo in una posizione attendibile."),
    ]
    row = 4
    for heading, body in rows:
        section_header(ws, row, heading, "H")
        row += 1
        ws[f"A{row}"] = body
        ws.merge_cells(f"A{row}:H{row + 2}")
        ws[f"A{row}"].alignment = Alignment(wrap_text=True, vertical="top")
        ws[f"A{row}"].border = BORDER
        row += 4

    section_header(ws, row, "README incorporato", "H")
    row += 1
    for line in EXCEL_README.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        ws[f"A{row}"] = line
        ws.merge_cells(f"A{row}:H{row}")
        ws[f"A{row}"].alignment = Alignment(wrap_text=True, vertical="top")
        if line.startswith("#"):
            ws[f"A{row}"].font = Font(bold=True, color=NAVY, size=12)
            ws[f"A{row}"].fill = fill(SECTION)
        else:
            ws[f"A{row}"].font = Font(color=INK, size=10)
        row += 1

    set_widths(ws, {"A": 18, "B": 16, "C": 16, "D": 16, "E": 16, "F": 16, "G": 16, "H": 16})
    ws.freeze_panes = "A4"


def create_glossary(wb):
    ws = reset_sheet(wb, "Glossario")
    ws.sheet_properties.tabColor = "70AD47"
    ws.sheet_view.showGridLines = False
    title(ws, "Glossario e campi", "Riferimento rapido per compilare senza cercare istruzioni esterne.")
    headers = ["Area", "Campo/Macro", "Dove", "Significato", "Note operative"]
    ws.append([])
    ws.append(headers)
    rows = [
        ("Parametri", "SogliaTecnica", "Parametri!B2", "Punteggio tecnico minimo per essere ammessi.", "Valore 0-70."),
        ("Parametri", "LottoAttivo", "Parametri!B3", "Lotto usato dalle macro di ottimizzazione.", "Dropdown L1-L4."),
        ("Offerte", "Attivo", "Offerte!D:D", "1 include la riga nella simulazione, 0 la esclude.", "Usare 0/1."),
        ("Offerte", "PunteggioTecnicoRaw", "Offerte!E:E", "Punteggio tecnico simulato aggregato.", "Modalità light, 0-70."),
        ("Offerte", "RibassoMedioPercento", "Offerte!F:F", "Ribasso economico medio simulato.", "0-100."),
        ("Offerte", "TotaleFormula", "Offerte!J:J", "Totale calcolato direttamente nel foglio.", "Replica light di tecnico + economico."),
        ("Combinatorie", "Attivo", "Combinatorie!D:D", "1 include la coppia nella matrice scenario.", "Richiede lotti singoli ammessi."),
        ("Combinatorie", "RibassoCombinatoria", "Combinatorie!E:E", "Ribasso medio della coppia.", "Deve migliorare il riferimento singolo indicativo."),
        ("Scenario globale", "Matrice scenari", "ScenarioGlobale", "Confronta singoli e combinatorie compatibili.", "Indicativa: per vincoli avanzati resta centrale la web app."),
        ("Ottimizzazione", "BidderId", "Ottimizzazione!B2", "Concorrente target.", "Deve esistere in Offerte."),
        ("Macro", "CheckBeforeRun", "Macro", "Controllo input e struttura workbook.", "Eseguire prima di simulare."),
        ("Macro", "SimulaScenario", "Macro", "Calcola risultati, combinatorie e vincitori.", "Aggiorna Risultati."),
        ("Macro", "OttimizzaLottoAttivo", "Macro", "Itera sulle leve Q/T del bidder target.", "Aggiorna Offerte e Log."),
        ("Macro", "ConfrontoWebGolden", "Macro", "Confronta Excel con expected web.", "Usa J2:J5 in ConfrontoWeb."),
    ]
    for item in rows:
        ws.append(item)
    style_header_row(ws, 3, len(headers))
    style_cells(ws, f"A4:E{3 + len(rows)}", WHITE)
    set_widths(ws, {"A": 18, "B": 24, "C": 24, "D": 45, "E": 42})
    ws.freeze_panes = "A4"


def style_header_row(ws, row: int, cols: int):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill(NAVY)
        cell.font = Font(bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 24


def add_table(ws, name: str, ref: str):
    if name in ws.tables:
        del ws.tables[name]
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)


def polish_instruction_sheet(wb):
    ws = wb["Istruzioni"]
    ws.sheet_properties.tabColor = "5B9BD5"
    ws.sheet_view.showGridLines = False
    ws.delete_rows(1, ws.max_row)
    title(ws, "Istruzioni rapide", "Punto di partenza per usare il file senza leggere documenti esterni.")
    rows = [
        ("1", "Dashboard", "Apri la dashboard per orientarti e passare ai fogli principali."),
        ("2", "Parametri", "Imposta soglia tecnica e lotto attivo."),
        ("3", "Offerte", "Compila concorrenti, lotti attivi, tecnico e ribasso."),
        ("4", "Macro", "Esegui CheckBeforeRun, SimulaScenario e, se serve, OttimizzaLottoAttivo."),
        ("5", "Confronto web", "Incolla i valori attesi in ConfrontoWeb!J2:J5 e lancia ConfrontoWebGolden."),
    ]
    section_header(ws, 4, "Percorso consigliato", "H")
    for row, item in enumerate(rows, start=5):
        ws[f"A{row}"], ws[f"B{row}"], ws[f"C{row}"] = item
        ws.merge_cells(f"C{row}:H{row}")
    style_cells(ws, "A5:H9", WHITE)
    for row in range(5, 10):
        ws[f"A{row}"].fill = fill(NAVY)
        ws[f"A{row}"].font = Font(color=WHITE, bold=True)
        ws[f"B{row}"].fill = fill(SECTION)
        ws[f"B{row}"].font = Font(bold=True)
    section_header(ws, 12, "Avviso", "H")
    ws["A13"] = "Il workbook è un supporto offline in modalità light. Per analisi completa, warning documentali e confronto scenari salvati resta centrale la web app."
    ws.merge_cells("A13:H14")
    ws["A13"].alignment = Alignment(wrap_text=True, vertical="top")
    ws["A13"].fill = fill(AMBER)
    ws["A13"].border = BORDER
    set_widths(ws, {"A": 8, "B": 20, "C": 24, "D": 16, "E": 16, "F": 16, "G": 16, "H": 16})
    ws.freeze_panes = "A4"


def polish_parametri(wb):
    ws = wb["Parametri"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "FFC000"
    ws.sheet_view.showGridLines = False
    style_header_row(ws, 1, 3)
    style_cells(ws, f"A2:C{ws.max_row}", WHITE)
    for row in range(2, ws.max_row + 1):
        ws[f"B{row}"].fill = fill(INPUT)
        ws[f"B{row}"].font = Font(bold=True, color=INK)
    dv_lot = DataValidation(type="list", formula1='"L1,L2,L3,L4"', allow_blank=False)
    ws.add_data_validation(dv_lot)
    dv_lot.add(ws["B3"])
    dv_threshold = DataValidation(type="decimal", operator="between", formula1="0", formula2="70", allow_blank=False)
    ws.add_data_validation(dv_threshold)
    dv_threshold.add(ws["B2"])
    ws["B2"].comment = Comment("Valore fra 0 e 70. Usato da tutte le macro di ammissibilità.", "Codex")
    ws["B3"].comment = Comment("Lotto attivo per OttimizzaLottoAttivo.", "Codex")
    add_table(ws, "tblParametri", f"A1:C{ws.max_row}")
    set_widths(ws, {"A": 24, "B": 16, "C": 60})
    ws.freeze_panes = "A2"


def polish_ottimizzazione(wb):
    ws = wb["Ottimizzazione"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "70AD47"
    ws.sheet_view.showGridLines = False
    style_header_row(ws, 1, 3)
    style_cells(ws, f"A2:C{ws.max_row}", WHITE)
    for row in [2, 3, 4, 6, 7, 8, 9]:
        ws[f"B{row}"].fill = fill(INPUT)
        ws[f"B{row}"].font = Font(bold=True, color=INK)
    dv_iter = DataValidation(type="whole", operator="between", formula1="1", formula2="1000")
    dv_decimal = DataValidation(type="decimal", operator="between", formula1="0", formula2="100")
    ws.add_data_validation(dv_iter)
    ws.add_data_validation(dv_decimal)
    dv_iter.add(ws["B3"])
    for ref in ["B4", "B6", "B7", "B8", "B9"]:
        dv_decimal.add(ws[ref])
    add_table(ws, "tblOttimizzazione", f"A1:C{ws.max_row}")
    set_widths(ws, {"A": 24, "B": 16, "C": 64})
    ws.freeze_panes = "A2"


def polish_offerte(wb):
    ws = wb["Offerte"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "ED7D31"
    ws.sheet_view.showGridLines = False
    headers = [
        "BidderId",
        "BidderNome",
        "Lotto",
        "Attivo",
        "PunteggioTecnicoRaw",
        "RibassoMedioPercento",
        "AmmessoFormula",
        "RMaxAmmessi",
        "EconomicoFormula",
        "TotaleFormula",
        "Warning",
        "ChiaveOfferta",
        "ChiaveLottoTotale",
    ]
    for col, header in enumerate(headers, start=1):
        ws.cell(row=1, column=col).value = header
    style_header_row(ws, 1, len(headers))
    style_cells(ws, f"A2:M{MAX_OFFER_ROWS}", WHITE)
    for row in range(2, MAX_OFFER_ROWS + 1):
        for col in range(1, 7):
            ws.cell(row=row, column=col).fill = fill(INPUT)
        for col in range(7, 14):
            ws.cell(row=row, column=col).fill = fill(OUTPUT)

        ws[f"G{row}"] = f'=IF($A{row}="","",IF(IFERROR(VALUE($D{row}),0)<>1,"NO",IF(IFERROR(VALUE($E{row}),0)>=Parametri!$B$2,"SI","NO")))'
        ws[f"H{row}"] = (
            f'=IF($G{row}="SI",'
            f'SUMPRODUCT(MAX(($C$2:$C${MAX_OFFER_ROWS}=$C{row})*(IFERROR($D$2:$D${MAX_OFFER_ROWS}*1,0)=1)*'
            f'(IFERROR($E$2:$E${MAX_OFFER_ROWS}*1,0)>=Parametri!$B$2)*IFERROR($F$2:$F${MAX_OFFER_ROWS}*1,0))),0)'
        )
        ws[f"I{row}"] = f'=IF($G{row}="SI",IF($H{row}>0,30*(IFERROR(VALUE($F{row}),0)/$H{row}),0),0)'
        ws[f"J{row}"] = f'=IF($A{row}="",0,IF($G{row}="SI",ROUND(IFERROR(VALUE($E{row}),0)+$I{row},4),ROUND(IFERROR(VALUE($E{row}),0),4)))'
        ws[f"K{row}"] = (
            f'=IF($A{row}="","",'
            f'IF(IFERROR(VALUE($D{row}),0)<>1,"Non attiva",IF(IFERROR(VALUE($E{row}),0)<Parametri!$B$2,"Sotto soglia","")))'
        )
        ws[f"L{row}"] = f'=IF($A{row}="","",$A{row}&"|"&$C{row})'
        ws[f"M{row}"] = f'=IF($A{row}="","",$C{row}&"|"&TEXT($J{row},"0.0000"))'
    dv_lot = DataValidation(type="list", formula1='"L1,L2,L3,L4"', allow_blank=True)
    dv_active = DataValidation(type="list", formula1='"1,0"', allow_blank=True)
    dv_tech = DataValidation(type="decimal", operator="between", formula1="0", formula2="70", allow_blank=True)
    dv_discount = DataValidation(type="decimal", operator="between", formula1="0", formula2="100", allow_blank=True)
    for dv in [dv_lot, dv_active, dv_tech, dv_discount]:
        ws.add_data_validation(dv)
    dv_lot.add(f"C2:C{MAX_OFFER_ROWS}")
    dv_active.add(f"D2:D{MAX_OFFER_ROWS}")
    dv_tech.add(f"E2:E{MAX_OFFER_ROWS}")
    dv_discount.add(f"F2:F{MAX_OFFER_ROWS}")
    ws.conditional_formatting.add(f"D2:D{MAX_OFFER_ROWS}", CellIsRule(operator="equal", formula=['"0"'], fill=fill(RED)))
    ws.conditional_formatting.add(f"E2:E{MAX_OFFER_ROWS}", FormulaRule(formula=['AND($E2<Parametri!$B$2,$A2<>"")'], fill=fill(AMBER)))
    ws.conditional_formatting.add(f"G2:G{MAX_OFFER_ROWS}", CellIsRule(operator="equal", formula=['"SI"'], fill=fill(GREEN)))
    ws.conditional_formatting.add(f"G2:G{MAX_OFFER_ROWS}", CellIsRule(operator="equal", formula=['"NO"'], fill=fill(RED)))
    add_table(ws, "tblOfferte", f"A1:M{MAX_OFFER_ROWS}")
    set_widths(ws, {"A": 16, "B": 26, "C": 12, "D": 12, "E": 24, "F": 24, "G": 18, "H": 14, "I": 18, "J": 18, "K": 22, "L": 22, "M": 18})
    ws.column_dimensions["M"].hidden = True
    ws.freeze_panes = "A2"


def create_combinatorie(wb):
    ws = reset_sheet(wb, "Combinatorie")
    ws.sheet_properties.tabColor = "8064A2"
    ws.sheet_view.showGridLines = False
    title(
        ws,
        "Combinatorie",
        "Input light per confrontare coppie L1+L2, L2+L3, L3+L4 e L1+L4 nella matrice scenario globale.",
    )
    headers = [
        "BidderId",
        "BidderNome",
        "Coppia",
        "Attivo",
        "RibassoCombinatoria",
        "InseritoBuste",
        "PEFCoerente",
        "LottoA",
        "LottoB",
        "AttivoA",
        "AttivoB",
        "TecnicoA",
        "TecnicoB",
        "Ammissibile",
        "EconomicoA",
        "EconomicoB",
        "TotaleCoppia",
        "Note",
        "RibassoSingoloA",
        "RibassoSingoloB",
        "RibassoMinimoIndicativo",
        "ChiaveCoppiaTotale",
        "ChiaveCoppiaBidder",
    ]
    header_row = 4
    for col, header in enumerate(headers, start=1):
        ws.cell(row=header_row, column=col).value = header
    style_header_row(ws, header_row, len(headers))
    style_cells(ws, f"A{header_row + 1}:W{MAX_COMBO_ROWS}", WHITE)

    pair_a = 'IF($C{row}="L1+L2","L1",IF($C{row}="L2+L3","L2",IF($C{row}="L3+L4","L3",IF($C{row}="L1+L4","L1",""))))'
    pair_b = 'IF($C{row}="L1+L2","L2",IF($C{row}="L2+L3","L3",IF($C{row}="L3+L4","L4",IF($C{row}="L1+L4","L4",""))))'

    offer_rows: dict[tuple[str, str], float] = {}
    bidders: dict[str, str] = {}
    ws_off = wb["Offerte"]
    for offer_row in range(2, MAX_OFFER_ROWS + 1):
        bidder_id = str(ws_off[f"A{offer_row}"].value or "").strip()
        bidder_name = str(ws_off[f"B{offer_row}"].value or "").strip()
        lot_id = str(ws_off[f"C{offer_row}"].value or "").strip()
        if not bidder_id or lot_id not in {"L1", "L2", "L3", "L4"}:
            continue
        bidders.setdefault(bidder_id, bidder_name)
        try:
            offer_rows[(bidder_id, lot_id)] = float(ws_off[f"F{offer_row}"].value or 0)
        except (TypeError, ValueError):
            offer_rows[(bidder_id, lot_id)] = 0

    pairs = [("L1+L2", "L1", "L2"), ("L2+L3", "L2", "L3"), ("L3+L4", "L3", "L4"), ("L1+L4", "L1", "L4")]
    seed_rows: list[tuple[str, str, float]] = []
    for bidder_id in bidders:
        for pair_id, first_lot, second_lot in pairs:
            if (bidder_id, first_lot) in offer_rows and (bidder_id, second_lot) in offer_rows:
                reference = (offer_rows[(bidder_id, first_lot)] + offer_rows[(bidder_id, second_lot)]) / 2
                seed_rows.append((bidder_id, pair_id, round(min(reference + 0.1, 100), 4)))

    for row in range(header_row + 1, MAX_COMBO_ROWS + 1):
        seed_index = row - (header_row + 1)
        if seed_index < len(seed_rows):
            bidder_id, pair_id, discount = seed_rows[seed_index]
            ws[f"A{row}"] = bidder_id
            ws[f"C{row}"] = pair_id
            ws[f"D{row}"] = 0
            ws[f"E{row}"] = discount
            ws[f"F{row}"] = 1
            ws[f"G{row}"] = 1
        for col in range(1, 8):
            ws.cell(row=row, column=col).fill = fill(INPUT)
        for col in range(8, 24):
            ws.cell(row=row, column=col).fill = fill(OUTPUT)

        ws[f"B{row}"] = f'=IF($A{row}="","",IFERROR(INDEX(Offerte!$B$2:$B${MAX_OFFER_ROWS},MATCH($A{row},Offerte!$A$2:$A${MAX_OFFER_ROWS},0)),""))'
        ws[f"H{row}"] = "=" + pair_a.format(row=row)
        ws[f"I{row}"] = "=" + pair_b.format(row=row)
        ws[f"J{row}"] = f'=IF($H{row}="","",IFERROR(INDEX(Offerte!$D$2:$D${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$H{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"K{row}"] = f'=IF($I{row}="","",IFERROR(INDEX(Offerte!$D$2:$D${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$I{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"L{row}"] = f'=IF($H{row}="","",IFERROR(INDEX(Offerte!$E$2:$E${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$H{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"M{row}"] = f'=IF($I{row}="","",IFERROR(INDEX(Offerte!$E$2:$E${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$I{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"S{row}"] = f'=IF($H{row}="","",IFERROR(INDEX(Offerte!$F$2:$F${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$H{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"T{row}"] = f'=IF($I{row}="","",IFERROR(INDEX(Offerte!$F$2:$F${MAX_OFFER_ROWS},MATCH($A{row}&"|"&$I{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"U{row}"] = f'=IF($A{row}="","",ROUND((IFERROR(VALUE($S{row}),0)+IFERROR(VALUE($T{row}),0))/2,4))'
        ws[f"N{row}"] = (
            f'=IF($A{row}="","",IF(IFERROR(VALUE($D{row}),0)<>1,"NO",'
            f'IF(AND(IFERROR(VALUE($J{row}),0)=1,IFERROR(VALUE($K{row}),0)=1,IFERROR(VALUE($L{row}),0)>=Parametri!$B$2,IFERROR(VALUE($M{row}),0)>=Parametri!$B$2,'
            f'IFERROR(VALUE($F{row}),0)=1,IFERROR(VALUE($G{row}),0)=1,IFERROR(VALUE($E{row}),0)>$U{row}),"SI","NO")))'
        )
        ws[f"O{row}"] = (
            f'=IF($N{row}="SI",IFERROR(30*(IFERROR(VALUE($E{row}),0)/MAX('
            f'SUMPRODUCT(MAX((Offerte!$C$2:$C${MAX_OFFER_ROWS}=$H{row})*(IFERROR(Offerte!$D$2:$D${MAX_OFFER_ROWS}*1,0)=1)*'
            f'(IFERROR(Offerte!$E$2:$E${MAX_OFFER_ROWS}*1,0)>=Parametri!$B$2)*IFERROR(Offerte!$F$2:$F${MAX_OFFER_ROWS}*1,0))),'
            f'SUMPRODUCT(MAX(($H$5:$H${MAX_COMBO_ROWS}=$H{row})*($N$5:$N${MAX_COMBO_ROWS}="SI")*IFERROR($E$5:$E${MAX_COMBO_ROWS}*1,0))),'
            f'SUMPRODUCT(MAX(($I$5:$I${MAX_COMBO_ROWS}=$H{row})*($N$5:$N${MAX_COMBO_ROWS}="SI")*IFERROR($E$5:$E${MAX_COMBO_ROWS}*1,0))))),0),0)'
        )
        ws[f"P{row}"] = (
            f'=IF($N{row}="SI",IFERROR(30*(IFERROR(VALUE($E{row}),0)/MAX('
            f'SUMPRODUCT(MAX((Offerte!$C$2:$C${MAX_OFFER_ROWS}=$I{row})*(IFERROR(Offerte!$D$2:$D${MAX_OFFER_ROWS}*1,0)=1)*'
            f'(IFERROR(Offerte!$E$2:$E${MAX_OFFER_ROWS}*1,0)>=Parametri!$B$2)*IFERROR(Offerte!$F$2:$F${MAX_OFFER_ROWS}*1,0))),'
            f'SUMPRODUCT(MAX(($H$5:$H${MAX_COMBO_ROWS}=$I{row})*($N$5:$N${MAX_COMBO_ROWS}="SI")*IFERROR($E$5:$E${MAX_COMBO_ROWS}*1,0))),'
            f'SUMPRODUCT(MAX(($I$5:$I${MAX_COMBO_ROWS}=$I{row})*($N$5:$N${MAX_COMBO_ROWS}="SI")*IFERROR($E$5:$E${MAX_COMBO_ROWS}*1,0))))),0),0)'
        )
        ws[f"Q{row}"] = f'=IF($N{row}="SI",ROUND($L{row}+$M{row}+$O{row}+$P{row},4),0)'
        ws[f"R{row}"] = (
            f'=IF($A{row}="","",IF(IFERROR(VALUE($D{row}),0)<>1,"Non attiva",'
            f'IF(OR(IFERROR(VALUE($J{row}),0)<>1,IFERROR(VALUE($K{row}),0)<>1),"Singoli non attivi",'
            f'IF(OR(IFERROR(VALUE($L{row}),0)<Parametri!$B$2,IFERROR(VALUE($M{row}),0)<Parametri!$B$2),"Soglia non superata",'
            f'IF(OR(IFERROR(VALUE($F{row}),0)<>1,IFERROR(VALUE($G{row}),0)<>1),"Buste/PEF non confermati",'
            f'IF(IFERROR(VALUE($E{row}),0)<=$U{row},"Ribasso non migliorativo",""))))))'
        )
        ws[f"V{row}"] = f'=IF($A{row}="","",$C{row}&"|"&TEXT($Q{row},"0.0000"))'
        ws[f"W{row}"] = f'=IF($A{row}="","",$C{row}&"|"&$A{row})'

    dv_pair = DataValidation(type="list", formula1='"L1+L2,L2+L3,L3+L4,L1+L4"', allow_blank=True)
    dv_binary = DataValidation(type="list", formula1='"1,0"', allow_blank=True)
    dv_discount = DataValidation(type="decimal", operator="between", formula1="0", formula2="100", allow_blank=True)
    for dv in [dv_pair, dv_binary, dv_discount]:
        ws.add_data_validation(dv)
    dv_pair.add(f"C5:C{MAX_COMBO_ROWS}")
    for ref in [f"D5:D{MAX_COMBO_ROWS}", f"F5:F{MAX_COMBO_ROWS}", f"G5:G{MAX_COMBO_ROWS}"]:
        dv_binary.add(ref)
    dv_discount.add(f"E5:E{MAX_COMBO_ROWS}")
    ws.conditional_formatting.add(f"N5:N{MAX_COMBO_ROWS}", CellIsRule(operator="equal", formula=['"SI"'], fill=fill(GREEN)))
    ws.conditional_formatting.add(f"N5:N{MAX_COMBO_ROWS}", CellIsRule(operator="equal", formula=['"NO"'], fill=fill(RED)))
    add_table(ws, "tblCombinatorie", f"A4:W{MAX_COMBO_ROWS}")
    set_widths(
        ws,
        {
            "A": 16,
            "B": 26,
            "C": 14,
            "D": 10,
            "E": 22,
            "F": 14,
            "G": 14,
            "H": 10,
            "I": 10,
            "J": 10,
            "K": 10,
            "L": 12,
            "M": 12,
            "N": 14,
            "O": 14,
            "P": 14,
            "Q": 16,
            "R": 32,
            "S": 16,
            "T": 16,
            "U": 22,
            "V": 18,
            "W": 18,
        },
    )
    ws.column_dimensions["V"].hidden = True
    ws.column_dimensions["W"].hidden = True
    ws.freeze_panes = "A5"


def create_scenario_globale(wb):
    ws = reset_sheet(wb, "ScenarioGlobale")
    ws.sheet_properties.tabColor = "00A6A6"
    ws.sheet_view.showGridLines = False
    title(
        ws,
        "Scenario globale",
        "Matrice operativa per confrontare singoli e combinatorie compatibili dentro Excel.",
    )

    section_header(ws, 4, "Migliori singoli per lotto", "H")
    single_headers = ["Lotto", "BidderId", "BidderNome", "Totale", "Tecnico", "Economico", "Warning", "Origine"]
    for col, header in enumerate(single_headers, start=1):
        ws.cell(row=5, column=col).value = header
    style_header_row(ws, 5, len(single_headers))
    for row, lot_id in enumerate(["L1", "L2", "L3", "L4"], start=6):
        ws[f"A{row}"] = lot_id
        ws[f"D{row}"] = f'=SUMPRODUCT(MAX((Offerte!$C$2:$C${MAX_OFFER_ROWS}=$A{row})*(Offerte!$G$2:$G${MAX_OFFER_ROWS}="SI")*Offerte!$J$2:$J${MAX_OFFER_ROWS}))'
        ws[f"B{row}"] = f'=IF($D{row}=0,"",IFERROR(INDEX(Offerte!$A$2:$A${MAX_OFFER_ROWS},MATCH($A{row}&"|"&TEXT($D{row},"0.0000"),Offerte!$M$2:$M${MAX_OFFER_ROWS},0)),""))'
        ws[f"C{row}"] = f'=IF($B{row}="","",IFERROR(INDEX(Offerte!$B$2:$B${MAX_OFFER_ROWS},MATCH($B{row}&"|"&$A{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),""))'
        ws[f"E{row}"] = f'=IF($B{row}="","",IFERROR(INDEX(Offerte!$E$2:$E${MAX_OFFER_ROWS},MATCH($B{row}&"|"&$A{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"F{row}"] = f'=IF($B{row}="","",IFERROR(INDEX(Offerte!$I$2:$I${MAX_OFFER_ROWS},MATCH($B{row}&"|"&$A{row},Offerte!$L$2:$L${MAX_OFFER_ROWS},0)),0))'
        ws[f"G{row}"] = f'=IF($B{row}="","Nessuna offerta ammessa","")'
        ws[f"H{row}"] = "Singolo"
    style_cells(ws, "A6:H9", OUTPUT)

    section_header(ws, 12, "Migliori combinatorie per coppia", "H")
    combo_headers = ["Coppia", "BidderId", "BidderNome", "Totale", "Ammissibile", "Ribasso", "Note", "Origine"]
    for col, header in enumerate(combo_headers, start=1):
        ws.cell(row=13, column=col).value = header
    style_header_row(ws, 13, len(combo_headers))
    for row, pair_id in enumerate(["L1+L2", "L2+L3", "L3+L4", "L1+L4"], start=14):
        ws[f"A{row}"] = pair_id
        ws[f"D{row}"] = f'=SUMPRODUCT(MAX((Combinatorie!$C$5:$C${MAX_COMBO_ROWS}=$A{row})*(Combinatorie!$N$5:$N${MAX_COMBO_ROWS}="SI")*Combinatorie!$Q$5:$Q${MAX_COMBO_ROWS}))'
        ws[f"B{row}"] = f'=IF($D{row}=0,"",IFERROR(INDEX(Combinatorie!$A$5:$A${MAX_COMBO_ROWS},MATCH($A{row}&"|"&TEXT($D{row},"0.0000"),Combinatorie!$V$5:$V${MAX_COMBO_ROWS},0)),""))'
        ws[f"C{row}"] = f'=IF($B{row}="","",IFERROR(INDEX(Combinatorie!$B$5:$B${MAX_COMBO_ROWS},MATCH($A{row}&"|"&$B{row},Combinatorie!$W$5:$W${MAX_COMBO_ROWS},0)),""))'
        ws[f"E{row}"] = f'=IF($B{row}="","NO","SI")'
        ws[f"F{row}"] = f'=IF($B{row}="","",IFERROR(INDEX(Combinatorie!$E$5:$E${MAX_COMBO_ROWS},MATCH($A{row}&"|"&$B{row},Combinatorie!$W$5:$W${MAX_COMBO_ROWS},0)),0))'
        ws[f"G{row}"] = f'=IF($B{row}="","Nessuna combinatoria ammessa","")'
        ws[f"H{row}"] = "Combinatoria"
    style_cells(ws, "A14:H17", OUTPUT)

    section_header(ws, 20, "Matrice scenario indicativa", "H")
    scenario_headers = ["Scenario", "L1", "L2", "L3", "L4", "Totale", "Nota", "Rank"]
    for col, header in enumerate(scenario_headers, start=1):
        ws.cell(row=21, column=col).value = header
    style_header_row(ws, 21, len(scenario_headers))
    scenarios = [
        ("Tutti singoli", "Singolo L1", "Singolo L2", "Singolo L3", "Singolo L4", "SUM($D$6:$D$9)"),
        ("L1+L2 + singoli", "Combo L1+L2", "Combo L1+L2", "Singolo L3", "Singolo L4", "$D$14+$D$8+$D$9"),
        ("L2+L3 + singoli", "Singolo L1", "Combo L2+L3", "Combo L2+L3", "Singolo L4", "$D$6+$D$15+$D$9"),
        ("L3+L4 + singoli", "Singolo L1", "Singolo L2", "Combo L3+L4", "Combo L3+L4", "$D$6+$D$7+$D$16"),
        ("L1+L4 + singoli", "Combo L1+L4", "Singolo L2", "Singolo L3", "Combo L1+L4", "$D$17+$D$7+$D$8"),
        ("L1+L2 e L3+L4", "Combo L1+L2", "Combo L1+L2", "Combo L3+L4", "Combo L3+L4", "$D$14+$D$16"),
        ("L2+L3 e L1+L4", "Combo L1+L4", "Combo L2+L3", "Combo L2+L3", "Combo L1+L4", "$D$15+$D$17"),
    ]
    for row, scenario in enumerate(scenarios, start=22):
        name, l1, l2, l3, l4, total_formula = scenario
        ws[f"A{row}"] = name
        ws[f"B{row}"] = l1
        ws[f"C{row}"] = l2
        ws[f"D{row}"] = l3
        ws[f"E{row}"] = l4
        ws[f"F{row}"] = "=" + total_formula
        ws[f"G{row}"] = f'=IF($F{row}=0,"Nessun dato sufficiente",IF($H{row}=1,"Scenario migliore nella matrice",""))'
        ws[f"H{row}"] = f'=IF($F{row}=0,"",RANK($F{row},$F$22:$F$28,0))'
    style_cells(ws, "A22:H28", WHITE)
    ws.conditional_formatting.add("H22:H28", CellIsRule(operator="equal", formula=["1"], fill=fill(GREEN)))

    section_header(ws, 31, "Limiti della matrice Excel", "H")
    notes = [
        "La matrice è pensata per analisi operative rapide: considera singoli e coppie compatibili principali.",
        "Per warning documentali avanzati, persistenza JSON, simulazioni batch e deroga al limite di due lotti resta più affidabile la web app.",
        "Se una combinatoria non compare, controlla foglio Combinatorie: singoli attivi, soglia, buste, PEF e ribasso migliorativo.",
    ]
    for row, text in enumerate(notes, start=32):
        ws[f"A{row}"] = text
        ws.merge_cells(f"A{row}:H{row}")
        ws[f"A{row}"].fill = fill(AMBER if row == 32 else WHITE)
        ws[f"A{row}"].alignment = Alignment(wrap_text=True, vertical="top")
        ws[f"A{row}"].border = BORDER

    set_widths(ws, {"A": 24, "B": 18, "C": 18, "D": 18, "E": 18, "F": 14, "G": 34, "H": 10})
    ws.freeze_panes = "A5"


def polish_results(wb):
    ws = wb["Risultati"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "A5A5A5"
    ws.sheet_view.showGridLines = False
    if ws.max_row >= 1:
        style_header_row(ws, 1, min(ws.max_column, 8))
    style_cells(ws, f"A2:H{max(ws.max_row, 30)}", OUTPUT)
    ws.conditional_formatting.add("D2:D200", CellIsRule(operator="equal", formula=['"NO"'], fill=fill(RED)))
    ws.conditional_formatting.add("D2:D200", CellIsRule(operator="equal", formula=['"SI"'], fill=fill(GREEN)))
    set_widths(ws, {"A": 18, "B": 16, "C": 24, "D": 14, "E": 14, "F": 14, "G": 14, "H": 30})
    ws.freeze_panes = "A2"


def polish_confronto(wb):
    ws = wb["ConfrontoWeb"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "7030A0"
    ws.sheet_view.showGridLines = False
    ws["I1"] = "Input expected"
    ws["J1"] = "Valore"
    style_header_row(ws, 1, 10)
    expected_labels = ["Web L1", "Web L2", "Web L3", "Web L4"]
    for idx, label in enumerate(expected_labels, start=2):
        ws[f"I{idx}"] = label
        if ws[f"J{idx}"].value is None:
            ws[f"J{idx}"] = 0
        ws[f"J{idx}"].fill = fill(INPUT)
    style_cells(ws, f"A2:J{max(ws.max_row, 8)}", WHITE)
    dv_expected = DataValidation(type="decimal", operator="between", formula1="0", formula2="100")
    ws.add_data_validation(dv_expected)
    dv_expected.add("J2:J5")
    add_table(ws, "tblConfrontoWeb", f"A1:J{max(ws.max_row, 8)}")
    set_widths(ws, {"A": 18, "B": 22, "C": 12, "D": 16, "E": 12, "F": 34, "G": 14, "H": 34, "I": 18, "J": 14})
    ws.freeze_panes = "A2"


def polish_log(wb):
    ws = wb["LogOttimizzazione"]
    clear_layout_helpers(ws)
    ws.sheet_properties.tabColor = "4472C4"
    ws.sheet_view.showGridLines = False
    style_header_row(ws, 1, max(ws.max_column, 7))
    style_cells(ws, f"A2:J{max(ws.max_row, 50)}", OUTPUT)
    set_widths(ws, {"A": 14, "B": 16, "C": 12, "D": 12, "E": 16, "F": 16, "G": 16, "H": 16, "I": 16, "J": 20})
    ws.freeze_panes = "A2"


def add_common_footer(wb):
    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = False
        ws.page_margins.left = 0.25
        ws.page_margins.right = 0.25
        ws.page_margins.top = 0.5
        ws.page_margins.bottom = 0.5
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0


def main():
    path = workbook_path()
    wb = load_workbook(path, keep_vba=True)

    create_dashboard(wb)
    create_guide(wb)
    create_glossary(wb)
    polish_instruction_sheet(wb)
    polish_parametri(wb)
    polish_ottimizzazione(wb)
    polish_offerte(wb)
    create_combinatorie(wb)
    create_scenario_globale(wb)
    polish_results(wb)
    polish_confronto(wb)
    polish_log(wb)
    add_common_footer(wb)
    wb.calculation.calcMode = "auto"
    wb.calculation.fullCalcOnLoad = True
    wb.calculation.forceFullCalc = True
    reorder_sheets(
        wb,
        [
            "Dashboard",
            "Istruzioni",
            "Parametri",
            "Ottimizzazione",
            "Offerte",
            "Combinatorie",
            "ScenarioGlobale",
            "Risultati",
            "ConfrontoWeb",
            "LogOttimizzazione",
            "Guida",
            "Glossario",
        ],
    )

    for ws in wb.worksheets:
        ws.sheet_view.tabSelected = False
    wb["Dashboard"].sheet_view.tabSelected = True
    wb.active = wb.sheetnames.index("Dashboard")
    wb.save(path)
    print(f"Workbook Excel migliorato: {path}")


if __name__ == "__main__":
    main()
