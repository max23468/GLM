Attribute VB_Name = "modTypes"
Option Explicit

Public Type OfferRow
    BidderId As String
    BidderName As String
    LotId As String
    Enabled As Boolean
    TechnicalRaw As Double
    AvgDiscount As Double
End Type

Public Type LotResult
    BidderId As String
    BidderName As String
    LotId As String
    Admitted As Boolean
    TechnicalScore As Double
    EconomicScore As Double
    TotalScore As Double
End Type
