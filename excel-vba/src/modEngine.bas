Attribute VB_Name = "modEngine"
Option Explicit

Public Function Round4(ByVal v As Double) As Double
    Round4 = WorksheetFunction.Round(v, 4)
End Function

Public Function Clamp(ByVal v As Double, ByVal minV As Double, ByVal maxV As Double) As Double
    If v < minV Then v = minV
    If v > maxV Then v = maxV
    Clamp = v
End Function

Public Function ComputeEconomicScore(ByVal discount As Double, ByVal rMax As Double) As Double
    If rMax <= 0 Then
        ComputeEconomicScore = 0
    Else
        ComputeEconomicScore = MAX_ECON_POINTS * (discount / rMax)
    End If
End Function

Public Function AdmittedByThreshold(ByVal technicalRaw As Double, ByVal threshold As Double) As Boolean
    AdmittedByThreshold = (technicalRaw >= threshold)
End Function
