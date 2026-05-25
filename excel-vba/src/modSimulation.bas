Attribute VB_Name = "modSimulation"
Option Explicit

Public Sub SimulaScenario()
    Dim wsOff As Worksheet, wsRes As Worksheet
    Dim lastRow As Long, r As Long, outRow As Long
    Dim lot As Variant, rMax As Double, threshold As Double
    
    Set wsOff = ThisWorkbook.Worksheets(SHEET_OFFERTE)
    Set wsRes = ThisWorkbook.Worksheets(SHEET_RISULTATI)
    threshold = ThresholdTech()
    
    wsRes.Cells.Clear
    wsRes.Range("A1:G1").Value = Array("BidderId", "BidderNome", "Lotto", "Ammesso", "Tecnico", "Economico", "Totale")
    
    lastRow = wsOff.Cells(wsOff.Rows.Count, "A").End(xlUp).Row
    outRow = 2
    
    For Each lot In Array("L1", "L2", "L3", "L4")
        rMax = MaxDiscountForLot(wsOff, CStr(lot))
        
        For r = 2 To lastRow
            If Trim$(CStr(wsOff.Cells(r, "C").Value)) = CStr(lot) And CLng(Val(wsOff.Cells(r, "D").Value)) = 1 Then
                Dim tech As Double, disc As Double, econ As Double, total As Double, admitted As Boolean
                tech = CDbl(wsOff.Cells(r, "E").Value)
                disc = CDbl(wsOff.Cells(r, "F").Value)
                admitted = AdmittedByThreshold(tech, threshold)
                
                If admitted Then
                    econ = ComputeEconomicScore(disc, rMax)
                Else
                    econ = 0
                End If
                
                total = IIf(admitted, tech + econ, tech)
                
                wsRes.Cells(outRow, "A").Value = wsOff.Cells(r, "A").Value
                wsRes.Cells(outRow, "B").Value = wsOff.Cells(r, "B").Value
                wsRes.Cells(outRow, "C").Value = lot
                wsRes.Cells(outRow, "D").Value = IIf(admitted, "SI", "NO")
                wsRes.Cells(outRow, "E").Value = Round4(tech)
                wsRes.Cells(outRow, "F").Value = Round4(econ)
                wsRes.Cells(outRow, "G").Value = Round4(total)
                outRow = outRow + 1
            End If
        Next r
    Next lot
    
    wsRes.Columns("A:G").AutoFit
    ValutaCombinatorie
End Sub

Public Function MaxDiscountForLot(ByVal wsOff As Worksheet, ByVal lotId As String) As Double
    Dim lastRow As Long, r As Long, m As Double, d As Double
    lastRow = wsOff.Cells(wsOff.Rows.Count, "A").End(xlUp).Row
    m = 0
    For r = 2 To lastRow
        If Trim$(CStr(wsOff.Cells(r, "C").Value)) = lotId And CLng(Val(wsOff.Cells(r, "D").Value)) = 1 Then
            d = CDbl(wsOff.Cells(r, "F").Value)
            If d > m Then m = d
        End If
    Next r
    MaxDiscountForLot = m
End Function
