Attribute VB_Name = "modConfig"
Option Explicit

Public Const SHEET_PARAMETRI As String = "Parametri"
Public Const SHEET_OFFERTE As String = "Offerte"
Public Const SHEET_RISULTATI As String = "Risultati"
Public Const SHEET_OTTIMIZZAZIONE As String = "Ottimizzazione"
Public Const SHEET_LOG As String = "LogOttimizzazione"

Public Const MAX_TECH_POINTS As Double = 70#
Public Const MAX_ECON_POINTS As Double = 30#

Public Function ThresholdTech() As Double
    ThresholdTech = CDbl(ThisWorkbook.Worksheets(SHEET_PARAMETRI).Range("B2").Value)
End Function

Public Function ActiveLot() As String
    ActiveLot = Trim$(CStr(ThisWorkbook.Worksheets(SHEET_PARAMETRI).Range("B3").Value))
End Function
