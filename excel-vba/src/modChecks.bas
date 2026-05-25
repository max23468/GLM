Attribute VB_Name = "modChecks"
Option Explicit

Public Function ValidateWorkbookSetup() As Boolean
    ValidateWorkbookSetup = False
    If Not SheetExists(SHEET_PARAMETRI) Then Exit Function
    If Not SheetExists(SHEET_OFFERTE) Then Exit Function
    If Not SheetExists(SHEET_CRITERI) Then Exit Function
    If Not SheetExists(SHEET_RISULTATI) Then Exit Function
    If Not SheetExists(SHEET_OTTIMIZZAZIONE) Then Exit Function
    If Not SheetExists(SHEET_LOG) Then Exit Function
    If ThresholdTech() < 0 Or ThresholdTech() > MAX_TECH_POINTS Then Exit Function
    ValidateWorkbookSetup = True
End Function

Public Sub CheckBeforeRun()
    Dim issues As Collection
    Set issues = New Collection

    If Not ValidateWorkbookSetup() Then
        MsgBox "Setup workbook non valido: controlla fogli obbligatori e soglia tecnica.", vbExclamation, "Verifica setup"
        Exit Sub
    End If

    ValidateOffers issues
    ValidateActiveCoverage issues

    If issues.Count = 0 Then
        MsgBox "Setup valido. Puoi eseguire simulazione e ottimizzazione.", vbInformation, "Verifica setup"
    Else
        MsgBox JoinIssues(issues), vbExclamation, "Verifica setup"
    End If
End Sub

Private Sub ValidateOffers(ByRef issues As Collection)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SHEET_OFFERTE)
    Dim lastRow As Long, r As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

    If lastRow < 2 Then
        issues.Add "Foglio Offerte vuoto: inserire almeno una riga dati"
        Exit Sub
    End If

    Dim keys As Collection
    Set keys = New Collection

    On Error Resume Next
    For r = 2 To lastRow
        Dim bidderId As String, lotId As String, enabled As Long
        Dim tech As Double, disc As Double
        bidderId = Trim$(CStr(ws.Cells(r, "A").Value))
        lotId = Trim$(CStr(ws.Cells(r, "C").Value))
        enabled = CLng(Val(ws.Cells(r, "D").Value))
        If Not IsNumeric(ws.Cells(r, "E").Value) Then issues.Add "Riga " & r & ": tecnico non numerico"
        If Not IsNumeric(ws.Cells(r, "F").Value) Then issues.Add "Riga " & r & ": ribasso non numerico"
        tech = CDbl(Val(ws.Cells(r, "E").Value))
        disc = CDbl(Val(ws.Cells(r, "F").Value))

        If bidderId = "" Then issues.Add "Riga " & r & ": BidderId mancante"
        If Trim$(CStr(ws.Cells(r, "B").Value)) = "" Then issues.Add "Riga " & r & ": BidderNome mancante"
        If lotId <> "L1" And lotId <> "L2" And lotId <> "L3" And lotId <> "L4" Then issues.Add "Riga " & r & ": Lotto non valido"
        If enabled <> 0 And enabled <> 1 Then issues.Add "Riga " & r & ": Attivo deve essere 0/1"
        If tech < 0 Or tech > MAX_TECH_POINTS Then issues.Add "Riga " & r & ": Punteggio tecnico fuori range 0-70"
        If disc < 0 Or disc > 100 Then issues.Add "Riga " & r & ": Ribasso fuori range 0-100"

        Dim key As String
        key = bidderId & "|" & lotId
        keys.Add key, key
        If Err.Number <> 0 Then
            issues.Add "Riga " & r & ": duplicato BidderId+Lotto"
            Err.Clear
        End If
    Next r
    On Error GoTo 0
End Sub

Private Function JoinIssues(ByVal issues As Collection) As String
    Dim i As Long, out As String
    out = "Trovate anomalie:" & vbCrLf
    For i = 1 To issues.Count
        out = out & "- " & CStr(issues(i)) & vbCrLf
    Next i
    JoinIssues = out
End Function

Private Function SheetExists(ByVal sheetName As String) As Boolean
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    SheetExists = Not ws Is Nothing
End Function

Private Sub ValidateActiveCoverage(ByRef issues As Collection)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SHEET_OFFERTE)
    Dim lot
    For Each lot In Array("L1", "L2", "L3", "L4")
        If Not HasActiveRowForLot(ws, CStr(lot)) Then issues.Add "Nessuna offerta attiva trovata per " & CStr(lot)
    Next lot
End Sub

Private Function HasActiveRowForLot(ByVal ws As Worksheet, ByVal lotId As String) As Boolean
    Dim lastRow As Long, r As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    For r = 2 To lastRow
        If Trim$(CStr(ws.Cells(r, "C").Value)) = lotId And CLng(Val(ws.Cells(r, "D").Value)) = 1 Then
            HasActiveRowForLot = True
            Exit Function
        End If
    Next r
    HasActiveRowForLot = False
End Function
