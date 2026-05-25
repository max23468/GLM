Attribute VB_Name = "modValidation"
Option Explicit

Public Sub ConfrontoWebGolden()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("ConfrontoWeb")

    Dim expectedL1 As Double, expectedL2 As Double, expectedL3 As Double, expectedL4 As Double
    expectedL1 = CDbl(Val(ws.Range("J2").Value))
    expectedL2 = CDbl(Val(ws.Range("J3").Value))
    expectedL3 = CDbl(Val(ws.Range("J4").Value))
    expectedL4 = CDbl(Val(ws.Range("J5").Value))

    ws.Cells.Clear
    ws.Range("A1:H1").Value = Array("Caso", "Lotto", "AttesoWeb", "CalcolatoExcel", "Delta", "Tolleranza", "Esito", "Note")

    Dim wsRes As Worksheet
    Set wsRes = ThisWorkbook.Worksheets(SHEET_RISULTATI)

    Dim rowOut As Long
    rowOut = 2

    BuildGoldenCase ws, rowOut, "Totale L1 migliore", "L1", expectedL1, BestTotalForLot(wsRes, "L1"), 0.05
    BuildGoldenCase ws, rowOut, "Totale L2 migliore", "L2", expectedL2, BestTotalForLot(wsRes, "L2"), 0.05
    BuildGoldenCase ws, rowOut, "Totale L3 migliore", "L3", expectedL3, BestTotalForLot(wsRes, "L3"), 0.05
    BuildGoldenCase ws, rowOut, "Totale L4 migliore", "L4", expectedL4, BestTotalForLot(wsRes, "L4"), 0.05

    ws.Range("I1:J1").Value = Array("Input expected", "Valore")
    ws.Range("I2").Value = "Web L1"
    ws.Range("I3").Value = "Web L2"
    ws.Range("I4").Value = "Web L3"
    ws.Range("I5").Value = "Web L4"
    ws.Range("J2").Value = expectedL1
    ws.Range("J3").Value = expectedL2
    ws.Range("J4").Value = expectedL3
    ws.Range("J5").Value = expectedL4

    Dim passCount As Long, failCount As Long
    CountGoldenResults ws, passCount, failCount
    ws.Range("A7").Value = "Riepilogo golden"
    ws.Range("A8:C8").Value = Array("Pass", "Fail", "Esito complessivo")
    ws.Range("A9").Value = passCount
    ws.Range("B9").Value = failCount
    ws.Range("C9").Value = IIf(failCount = 0, "PASS", "FAIL")

    ws.Columns("A:J").AutoFit
End Sub

Private Sub BuildGoldenCase(ByVal ws As Worksheet, ByRef rowOut As Long, ByVal label As String, ByVal lotId As String, ByVal expected As Double, ByVal actual As Double, ByVal tol As Double)
    Dim delta As Double, esito As String
    delta = Round4(actual - expected)
    If Abs(delta) <= tol Then
        esito = "OK"
    Else
        esito = "KO"
    End If

    ws.Cells(rowOut, "A").Value = label
    ws.Cells(rowOut, "B").Value = lotId
    ws.Cells(rowOut, "C").Value = expected
    ws.Cells(rowOut, "D").Value = actual
    ws.Cells(rowOut, "E").Value = delta
    ws.Cells(rowOut, "F").Value = tol
    ws.Cells(rowOut, "G").Value = esito
    ws.Cells(rowOut, "H").Value = "Incolla in J2:J5 i valori attesi dal tool web"
    rowOut = rowOut + 1
End Sub

Private Function BestTotalForLot(ByVal wsRes As Worksheet, ByVal lotId As String) As Double
    Dim lastRow As Long, r As Long, best As Double
    best = -1
    lastRow = wsRes.Cells(wsRes.Rows.Count, "A").End(xlUp).Row
    For r = 2 To lastRow
        If Trim$(CStr(wsRes.Cells(r, "C").Value)) = lotId And Trim$(CStr(wsRes.Cells(r, "D").Value)) = "SI" Then
            If CDbl(Val(wsRes.Cells(r, "G").Value)) > best Then best = CDbl(Val(wsRes.Cells(r, "G").Value))
        End If
    Next r
    If best < 0 Then best = 0
    BestTotalForLot = Round4(best)
End Function

Private Sub CountGoldenResults(ByVal ws As Worksheet, ByRef passCount As Long, ByRef failCount As Long)
    Dim r As Long
    passCount = 0
    failCount = 0
    For r = 2 To 5
        Select Case Trim$(CStr(ws.Cells(r, "G").Value))
            Case "OK": passCount = passCount + 1
            Case "KO": failCount = failCount + 1
        End Select
    Next r
End Sub
