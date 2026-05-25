Attribute VB_Name = "modScenario"
Option Explicit

Public Sub ValutaCombinatorie()
    Dim wsOff As Worksheet, wsRes As Worksheet
    Dim outRow As Long
    Set wsOff = ThisWorkbook.Worksheets(SHEET_OFFERTE)
    Set wsRes = ThisWorkbook.Worksheets(SHEET_RISULTATI)

    EnsureResultHeaders wsRes
    outRow = wsRes.Cells(wsRes.Rows.Count, "A").End(xlUp).Row + 2
    wsRes.Cells(outRow, "A").Value = "Combinatorie"
    outRow = outRow + 1
    wsRes.Range("A" & outRow & ":G" & outRow).Value = Array("BidderId", "BidderNome", "Coppia", "Ammissibile", "RibassoCoppia", "ScoreCoppia", "Note")
    outRow = outRow + 1

    EvaluatePair wsOff, wsRes, outRow, "L1", "L2"
    EvaluatePair wsOff, wsRes, outRow, "L2", "L3"
    EvaluatePair wsOff, wsRes, outRow, "L3", "L4"
    EvaluatePair wsOff, wsRes, outRow, "L1", "L4"

    outRow = outRow + 1
    wsRes.Cells(outRow, "A").Value = "Scenario vincente (singoli)"
    outRow = outRow + 1
    wsRes.Range("A" & outRow & ":E" & outRow).Value = Array("Lotto", "BidderId", "BidderNome", "Totale", "Note tie-break")
    outRow = outRow + 1
    WriteSingleLotWinners wsRes, outRow

    wsRes.Columns("A:G").AutoFit
End Sub

Private Sub WriteSingleLotWinners(ByVal wsRes As Worksheet, ByRef outRow As Long)
    Dim lot
    For Each lot In Array("L1", "L2", "L3", "L4")
        Dim bestRow As Long, tieNote As String
        bestRow = BestResultRowForLot(wsRes, CStr(lot), tieNote)
        wsRes.Cells(outRow, "A").Value = CStr(lot)
        If bestRow > 0 Then
            wsRes.Cells(outRow, "B").Value = wsRes.Cells(bestRow, "A").Value
            wsRes.Cells(outRow, "C").Value = wsRes.Cells(bestRow, "B").Value
            wsRes.Cells(outRow, "D").Value = wsRes.Cells(bestRow, "G").Value
            wsRes.Cells(outRow, "E").Value = tieNote
        Else
            wsRes.Cells(outRow, "E").Value = "Nessuna offerta ammessa"
        End If
        outRow = outRow + 1
    Next lot
End Sub

Private Function BestResultRowForLot(ByVal wsRes As Worksheet, ByVal lotId As String, ByRef tieNote As String) As Long
    Dim lastRow As Long, r As Long
    Dim bestTotal As Double, bestTech As Double, bestRow As Long, ties As Long
    bestTotal = -1
    bestTech = -1
    lastRow = wsRes.Cells(wsRes.Rows.Count, "A").End(xlUp).Row

    For r = 2 To lastRow
        If Trim$(CStr(wsRes.Cells(r, "C").Value)) = lotId And Trim$(CStr(wsRes.Cells(r, "D").Value)) = "SI" Then
            Dim total As Double, tech As Double
            total = CDbl(Val(wsRes.Cells(r, "G").Value))
            tech = CDbl(Val(wsRes.Cells(r, "E").Value))
            If total > bestTotal Then
                bestTotal = total
                bestTech = tech
                bestRow = r
                ties = 0
            ElseIf Abs(total - bestTotal) < 0.0001 Then
                ties = ties + 1
                If tech > bestTech Then
                    bestTech = tech
                    bestRow = r
                End If
            End If
        End If
    Next r

    If bestRow > 0 Then
        If ties > 0 Then
            tieNote = "Parità totale risolta su punteggio tecnico"
        Else
            tieNote = ""
        End If
    End If

    BestResultRowForLot = bestRow
End Function

Private Sub EvaluatePair(ByVal wsOff As Worksheet, ByVal wsRes As Worksheet, ByRef outRow As Long, ByVal lotA As String, ByVal lotB As String)
    Dim bidders As Collection, i As Long
    Set bidders = DistinctBidders(wsOff)

    For i = 1 To bidders.Count
        Dim bidderId As String, bidderName As String
        bidderId = CStr(bidders(i)(0))
        bidderName = CStr(bidders(i)(1))

        Dim rowA As Long, rowB As Long
        rowA = FindOfferRow(wsOff, bidderId, lotA)
        rowB = FindOfferRow(wsOff, bidderId, lotB)
        If rowA = 0 Or rowB = 0 Then GoTo SkipBidder

        Dim enabledA As Boolean, enabledB As Boolean
        enabledA = (CLng(Val(wsOff.Cells(rowA, "D").Value)) = 1)
        enabledB = (CLng(Val(wsOff.Cells(rowB, "D").Value)) = 1)

        Dim techA As Double, techB As Double, discA As Double, discB As Double
        techA = CDbl(wsOff.Cells(rowA, "E").Value)
        techB = CDbl(wsOff.Cells(rowB, "E").Value)
        discA = CDbl(wsOff.Cells(rowA, "F").Value)
        discB = CDbl(wsOff.Cells(rowB, "F").Value)

        Dim admissible As Boolean, note As String
        admissible = enabledA And enabledB And AdmittedByThreshold(techA, ThresholdTech()) And AdmittedByThreshold(techB, ThresholdTech())
        If Not enabledA Or Not enabledB Then note = "Uno dei lotti non è attivo"
        If enabledA And enabledB And (Not AdmittedByThreshold(techA, ThresholdTech()) Or Not AdmittedByThreshold(techB, ThresholdTech())) Then note = "Soglia tecnica non superata"

        Dim pairDiscount As Double, pairScore As Double
        pairDiscount = Round4((discA + discB) / 2)
        pairScore = IIf(admissible, Round4((techA + techB) + pairDiscount), 0)

        wsRes.Cells(outRow, "A").Value = bidderId
        wsRes.Cells(outRow, "B").Value = bidderName
        wsRes.Cells(outRow, "C").Value = lotA & "+" & lotB
        wsRes.Cells(outRow, "D").Value = IIf(admissible, "SI", "NO")
        wsRes.Cells(outRow, "E").Value = pairDiscount
        wsRes.Cells(outRow, "F").Value = pairScore
        wsRes.Cells(outRow, "G").Value = note
        outRow = outRow + 1
SkipBidder:
    Next i
End Sub

Private Function DistinctBidders(ByVal wsOff As Worksheet) As Collection
    Dim c As New Collection
    Dim lastRow As Long, r As Long
    lastRow = wsOff.Cells(wsOff.Rows.Count, "A").End(xlUp).Row
    On Error Resume Next
    For r = 2 To lastRow
        Dim k As String, arr(1) As String
        k = Trim$(CStr(wsOff.Cells(r, "A").Value))
        If k <> "" Then
            arr(0) = k
            arr(1) = Trim$(CStr(wsOff.Cells(r, "B").Value))
            c.Add arr, k
        End If
    Next r
    On Error GoTo 0
    Set DistinctBidders = c
End Function

Private Sub EnsureResultHeaders(ByVal wsRes As Worksheet)
    If Trim$(CStr(wsRes.Range("A1").Value)) = "" Then
        wsRes.Range("A1:G1").Value = Array("BidderId", "BidderNome", "Lotto", "Ammesso", "Tecnico", "Economico", "Totale")
    End If
End Sub
