Attribute VB_Name = "modOptimization"
Option Explicit

Public Sub ResetLogOttimizzazione()
    Dim wsLog As Worksheet
    Set wsLog = ThisWorkbook.Worksheets(SHEET_LOG)
    wsLog.Cells.Clear
    wsLog.Range("A1:J1").Value = Array("Iterazione", "BidderId", "Lotto", "Leva", "TecnicoPrima", "TecnicoDopo", "RibassoPrima", "RibassoDopo", "DeltaTotale", "Esito")
End Sub

Public Sub OttimizzaLottoAttivo()
    Dim wsOff As Worksheet, wsOpt As Worksheet, wsLog As Worksheet
    Dim bidderId As String, lotId As String
    Dim maxIter As Long, i As Long, rowIdx As Long
    Dim techQStep As Double, techTStep As Double, discStep As Double
    Dim maxTechQ As Double, maxTechT As Double

    Set wsOff = ThisWorkbook.Worksheets(SHEET_OFFERTE)
    Set wsOpt = ThisWorkbook.Worksheets(SHEET_OTTIMIZZAZIONE)
    Set wsLog = ThisWorkbook.Worksheets(SHEET_LOG)

    bidderId = Trim$(CStr(wsOpt.Range("B2").Value))
    maxIter = CLng(Val(wsOpt.Range("B3").Value))
    techQStep = CDbl(wsOpt.Range("B4").Value)
    techTStep = CDbl(wsOpt.Range("B8").Value)
    discStep = CDbl(wsOpt.Range("B6").Value)
    maxTechQ = CDbl(wsOpt.Range("B7").Value)
    maxTechT = CDbl(wsOpt.Range("B9").Value)
    lotId = ActiveLot()

    If bidderId = "" Or lotId = "" Then Exit Sub
    If maxIter <= 0 Then maxIter = 100

    rowIdx = FindOfferRow(wsOff, bidderId, lotId)
    If rowIdx = 0 Then Exit Sub

    ResetLogOttimizzazione

    Application.ScreenUpdating = False
    For i = 1 To maxIter
        Dim oldTech As Double, oldDisc As Double, oldTotal As Double
        oldTech = CDbl(wsOff.Cells(rowIdx, "E").Value)
        oldDisc = CDbl(wsOff.Cells(rowIdx, "F").Value)
        oldTotal = SimulatedTotalForRow(wsOff, rowIdx)

        Dim candQ As Double, candT As Double
        candQ = EvaluateCandidateStep(wsOff, rowIdx, oldTech, oldDisc, techQStep, maxTechQ, discStep, "Q")
        candT = EvaluateCandidateStep(wsOff, rowIdx, oldTech, oldDisc, techTStep, maxTechT, discStep, "T")

        If candQ <= 0.0001 And candT <= 0.0001 Then
            AppendOptimizationLog wsLog, i, bidderId, lotId, "stop", oldTech, oldTech, oldDisc, oldDisc, 0, "Nessun delta positivo"
            Exit For
        End If

        Dim selectedLever As String, selectedStep As Double, selectedMax As Double
        If candQ >= candT Then
            selectedLever = "Q"
            selectedStep = techQStep
            selectedMax = maxTechQ
        Else
            selectedLever = "T"
            selectedStep = techTStep
            selectedMax = maxTechT
        End If

        Dim newTech As Double, newDisc As Double, newTotal As Double, delta As Double
        newTech = Clamp(oldTech + selectedStep, 0, IIf(selectedMax > 0, selectedMax, MAX_TECH_POINTS))
        newDisc = Clamp(oldDisc + discStep, 0, 100)

        wsOff.Cells(rowIdx, "E").Value = newTech
        wsOff.Cells(rowIdx, "F").Value = newDisc

        newTotal = SimulatedTotalForRow(wsOff, rowIdx)
        delta = newTotal - oldTotal

        If delta <= 0.0001 Then
            wsOff.Cells(rowIdx, "E").Value = oldTech
            wsOff.Cells(rowIdx, "F").Value = oldDisc
            AppendOptimizationLog wsLog, i, bidderId, lotId, selectedLever, oldTech, oldTech, oldDisc, oldDisc, 0, "Rollback"
            Exit For
        End If

        AppendOptimizationLog wsLog, i, bidderId, lotId, selectedLever, oldTech, newTech, oldDisc, newDisc, delta, "OK"
    Next i
    Application.ScreenUpdating = True

    SimulaScenario
End Sub

Private Function EvaluateCandidateStep(ByVal wsOff As Worksheet, ByVal rowIdx As Long, ByVal oldTech As Double, ByVal oldDisc As Double, ByVal techStep As Double, ByVal techMax As Double, ByVal discStep As Double, ByVal lever As String) As Double
    Dim newTech As Double, newDisc As Double, oldTotal As Double, newTotal As Double
    oldTotal = SimulatedTotalForRow(wsOff, rowIdx)
    newTech = Clamp(oldTech + techStep, 0, IIf(techMax > 0, techMax, MAX_TECH_POINTS))
    newDisc = Clamp(oldDisc + discStep, 0, 100)

    wsOff.Cells(rowIdx, "E").Value = newTech
    wsOff.Cells(rowIdx, "F").Value = newDisc
    newTotal = SimulatedTotalForRow(wsOff, rowIdx)

    wsOff.Cells(rowIdx, "E").Value = oldTech
    wsOff.Cells(rowIdx, "F").Value = oldDisc

    EvaluateCandidateStep = Round4(newTotal - oldTotal)
End Function

Public Function FindOfferRow(ByVal wsOff As Worksheet, ByVal bidderId As String, ByVal lotId As String) As Long
    Dim lastRow As Long, r As Long
    lastRow = wsOff.Cells(wsOff.Rows.Count, "A").End(xlUp).Row
    For r = 2 To lastRow
        If Trim$(CStr(wsOff.Cells(r, "A").Value)) = bidderId And Trim$(CStr(wsOff.Cells(r, "C").Value)) = lotId Then
            FindOfferRow = r
            Exit Function
        End If
    Next r
    FindOfferRow = 0
End Function

Private Function SimulatedTotalForRow(ByVal wsOff As Worksheet, ByVal rowIdx As Long) As Double
    Dim lotId As String, tech As Double, disc As Double, threshold As Double, rMax As Double
    lotId = Trim$(CStr(wsOff.Cells(rowIdx, "C").Value))
    tech = CDbl(wsOff.Cells(rowIdx, "E").Value)
    disc = CDbl(wsOff.Cells(rowIdx, "F").Value)
    threshold = ThresholdTech()
    rMax = MaxDiscountForLot(wsOff, lotId)

    If tech < threshold Then
        SimulatedTotalForRow = tech
    Else
        SimulatedTotalForRow = tech + ComputeEconomicScore(disc, rMax)
    End If
End Function

Private Sub AppendOptimizationLog(ByVal wsLog As Worksheet, ByVal iterN As Long, ByVal bidderId As String, ByVal lotId As String, _
                                  ByVal lever As String, ByVal techBefore As Double, ByVal techAfter As Double, ByVal discBefore As Double, ByVal discAfter As Double, ByVal delta As Double, ByVal outcome As String)
    Dim outRow As Long
    outRow = wsLog.Cells(wsLog.Rows.Count, "A").End(xlUp).Row + 1
    wsLog.Cells(outRow, "A").Value = iterN
    wsLog.Cells(outRow, "B").Value = bidderId
    wsLog.Cells(outRow, "C").Value = lotId
    wsLog.Cells(outRow, "D").Value = lever
    wsLog.Cells(outRow, "E").Value = Round4(techBefore)
    wsLog.Cells(outRow, "F").Value = Round4(techAfter)
    wsLog.Cells(outRow, "G").Value = Round4(discBefore)
    wsLog.Cells(outRow, "H").Value = Round4(discAfter)
    wsLog.Cells(outRow, "I").Value = Round4(delta)
    wsLog.Cells(outRow, "J").Value = outcome
End Sub
