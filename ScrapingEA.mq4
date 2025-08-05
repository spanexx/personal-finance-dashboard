//+------------------------------------------------------------------+
//|            Optimized Expert Advisor by Gemini v2.0               |
//+------------------------------------------------------------------+
#property strict
#property copyright "Gemini"
#property link      "https://gemini.google.com"
#property version   "2.00"

//--- Input parameters
input int MagicNumber = 202407;       // Unique identifier for EA trades
input int Slippage = 3;               // Allowed slippage in points
input int CheckNewsIntervalSeconds = 3600; // How often to check for news (1 hour)

//--- Core Strategy Inputs
input int FastMA_Period = 12;         // Fast Moving Average period
input int SlowMA_Period = 26;         // Slow Moving Average period
input int RSI_Period = 14;            // RSI Period for momentum filter
input int ADX_Period = 14;            // ADX Period for trend strength
input double ADX_Min_Level = 20;      // Minimum ADX value to consider a trend

//--- Risk Management Inputs
input double RiskPercent = 2.0;         // Risk for initial trade (in percent)
input int    ATR_Period = 14;           // ATR period for Stop Loss calculation
input double ATR_Multiplier_SL = 2.0;   // ATR Multiplier for Stop Loss
input double ATR_Multiplier_TP = 4.0;   // ATR Multiplier for Take Profit

//--- Pyramiding Inputs
input bool   UsePyramiding = true;      // Enable/disable adding to winning trades
input double PyramidProfitPips = 100; // Min profit (pips) to open next trade
input int    MaxPyramidTrades = 3;      // Max number of trades to pyramid
input double PyramidLots = 0.01;        // Fixed lot size for pyramid trades

//--- Trade Management Inputs
input bool   UseTrailingStop = true;   // Enable/disable trailing stop
input double TrailingStopPips = 50;   // Trailing stop distance in pips
input double TrailingTriggerPips = 100; // Pips in profit to activate trailing stop

//--- Global variables
datetime lastNewsCheckTime = 0;
bool isHighImpactNews = false;
datetime lastSignalBarTime = 0; // Prevents multiple entries on the same bar

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    CheckForNews();
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
    //--- Master Safety Switch: News Filter
    if(TimeCurrent() - lastNewsCheckTime >= CheckNewsIntervalSeconds) {
        CheckForNews();
    }
    if(isHighImpactNews) {
        Comment("High impact news detected. Trading is paused.");
        return;
    }

    //--- Main Logic
    Comment("No high impact news. Awaiting high-quality signal...");
    CheckForSignal();
    ManageOpenTrades();
}

//+------------------------------------------------------------------+
//| Scrapes the web for news                                         |
//+------------------------------------------------------------------+
void CheckForNews() {
    lastNewsCheckTime = TimeCurrent();
    isHighImpactNews = false;
    char data[]; string response_headers; string request_headers = ""; char post_data[];
    string url = "https://www.forexfactory.com/news";
    int timeout = 5000;
    ResetLastError();
    int res = WebRequest("GET", url, request_headers, timeout, post_data, data, response_headers);
    if(res == -1) {
        Print("Error in WebRequest. Error code = ", GetLastError());
        return;
    }
    string html = CharArrayToString(data);
    if(StringFind(html, "impact--high") != -1) {
        Print("High impact news detected!");
        isHighImpactNews = true;
    } else {
        Print("No high impact news found.");
        isHighImpactNews = false;
    }
}

//+------------------------------------------------------------------+
//| Counts open trades for this EA on the current symbol             |
//+------------------------------------------------------------------+
int CountOpenTrades() {
    int count = 0;
    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() == MagicNumber && OrderSymbol() == Symbol()) {
                count++;
            }
        }
    }
    return count;
}

//+------------------------------------------------------------------+
//| Checks for a high-quality trading signal                         |
//+------------------------------------------------------------------+
void CheckForSignal() {
    //--- Prevent multiple signals on the same bar
    if(Time[0] == lastSignalBarTime) return;

    int openTrades = CountOpenTrades();
    if(openTrades >= MaxPyramidTrades) return;
    if(!UsePyramiding && openTrades > 0) return;

    //--- Get Indicator Values (from the last closed bar)
    int shift = 1;
    double adxValue = iADX(NULL, 0, ADX_Period, PRICE_CLOSE, MODE_MAIN, shift);
    double rsiValue = iRSI(NULL, 0, RSI_Period, PRICE_CLOSE, shift);
    double fastMA = iMA(NULL, 0, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE, shift);
    double slowMA = iMA(NULL, 0, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE, shift);
    double prevFastMA = iMA(NULL, 0, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE, shift + 1);
    double prevSlowMA = iMA(NULL, 0, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE, shift + 1);

    //--- Define Signal Conditions
    bool isTrending = adxValue >= ADX_Min_Level;
    bool buyCrossover = prevFastMA < prevSlowMA && fastMA > slowMA;
    bool sellCrossover = prevFastMA > prevSlowMA && fastMA < slowMA;
    bool bullishMomentum = rsiValue > 50;
    bool bearishMomentum = rsiValue < 50;

    //--- Final Buy/Sell Signals
    bool buySignal = isTrending && buyCrossover && bullishMomentum;
    bool sellSignal = isTrending && sellCrossover && bearishMomentum;

    if(!buySignal && !sellSignal) return; // No valid signal, exit.

    lastSignalBarTime = Time[0]; // Mark this bar as having a signal

    //--- Entry Logic
    if(openTrades == 0) {
        // Initial Entry with Dynamic Risk
        if(buySignal) OpenInitialTrade(OP_BUY);
        if(sellSignal) OpenInitialTrade(OP_SELL);
    } else {
        // Pyramid Entry
        if(buySignal && IsLastTradeType(OP_BUY)) OpenPyramidTrade(OP_BUY);
        if(sellSignal && IsLastTradeType(OP_SELL)) OpenPyramidTrade(OP_SELL);
    }
}

//+------------------------------------------------------------------+
//| Opens the first trade with dynamic lot size based on ATR         |
//+------------------------------------------------------------------+
void OpenInitialTrade(int type) {
    double atrValue = iATR(NULL, 0, ATR_Period, 1);
    double stopPips = NormalizeDouble(atrValue * ATR_Multiplier_SL / _Point, 0);
    double takeProfitPips = NormalizeDouble(atrValue * ATR_Multiplier_TP / _Point, 0);

    double riskAmount = AccountEquity() * (RiskPercent / 100.0);
    double lotSize = CalculateLotSize(riskAmount, stopPips);

    if(lotSize <= 0) {
        Print("Invalid lot size calculated for initial entry. Lot Size: ", lotSize);
        return;
    }

    double price = (type == OP_BUY) ? Ask : Bid;
    double sl_price = (type == OP_BUY) ? price - (stopPips * _Point) : price + (stopPips * _Point);
    double tp_price = (type == OP_BUY) ? price + (takeProfitPips * _Point) : price - (takeProfitPips * _Point);

    string ea_comment = "EA Initial";
    int ticket = OrderSend(Symbol(), type, lotSize, price, Slippage, sl_price, tp_price, ea_comment, MagicNumber, 0, (type == OP_BUY ? clrDeepSkyBlue : clrOrangeRed));
    if(ticket < 0) {
        Print("Initial OrderSend failed with error #", GetLastError());
    }
}

//+------------------------------------------------------------------+
//| Opens a subsequent pyramid trade with fixed lot size             |
//+------------------------------------------------------------------+
void OpenPyramidTrade(int type) {
    // Check if last trade is profitable enough
    double lastProfit = GetLastTradeProfitPips();
    if(lastProfit < PyramidProfitPips) return;

    double price = (type == OP_BUY) ? Ask : Bid;
    double atrValue = iATR(NULL, 0, ATR_Period, 1);
    double stopPips = NormalizeDouble(atrValue * ATR_Multiplier_SL / _Point, 0);
    double takeProfitPips = NormalizeDouble(atrValue * ATR_Multiplier_TP / _Point, 0);
    
    double sl_price = (type == OP_BUY) ? price - (stopPips * _Point) : price + (takeProfitPips * _Point);
    double tp_price = (type == OP_BUY) ? price + (takeProfitPips * _Point) : price - (takeProfitPips * _Point);

    string ea_comment = "EA Pyramid";
    int ticket = OrderSend(Symbol(), type, PyramidLots, price, Slippage, sl_price, tp_price, ea_comment, MagicNumber, 0, (type == OP_BUY ? clrGreen : clrRed));
    if(ticket < 0) {
        Print("Pyramid OrderSend failed with error #", GetLastError());
    }
}

//+------------------------------------------------------------------+
//| Calculates Lot Size based on fixed monetary risk and stop pips   |
//+------------------------------------------------------------------+
double CalculateLotSize(double riskAmount, double stopLossPips) {
    double tickValue = MarketInfo(Symbol(), MODE_TICKVALUE);
    double tickSize = MarketInfo(Symbol(), MODE_TICKSIZE);
    
    if(tickValue <= 0 || stopLossPips <= 0) return 0.0;

    double pipsValuePerLot = tickValue / tickSize;
    double lots = riskAmount / (stopLossPips * pipsValuePerLot);

    //--- Normalize and clamp to broker limits
    double minLot = MarketInfo(Symbol(), MODE_MINLOT);
    double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);
    double lotStep = MarketInfo(Symbol(), MODE_LOTSTEP);
    
    lots = MathRound(lots / lotStep) * lotStep;
    
    if(lots < minLot) lots = minLot;
    if(lots > maxLot) lots = maxLot;

    return lots;
}

//+------------------------------------------------------------------+
//| Manages all open trades (Trailing Stops)                         |
//+------------------------------------------------------------------+
void ManageOpenTrades() {
    if(!UseTrailingStop) return;

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() != MagicNumber || OrderSymbol() != Symbol()) continue;

            double newStopLoss = 0;
            bool modify = false;

            if(OrderType() == OP_BUY) {
                if(Bid > OrderOpenPrice() + (TrailingTriggerPips * _Point)) {
                    newStopLoss = Bid - (TrailingStopPips * _Point);
                    if(OrderStopLoss() < newStopLoss) modify = true;
                }
            } else if(OrderType() == OP_SELL) {
                if(Ask < OrderOpenPrice() - (TrailingTriggerPips * _Point)) {
                    newStopLoss = Ask + (TrailingStopPips * _Point);
                    if(OrderStopLoss() > newStopLoss || OrderStopLoss() == 0) modify = true;
                }
            }
            
            if(modify) {
                if(!OrderModify(OrderTicket(), OrderOpenPrice(), newStopLoss, OrderTakeProfit(), 0, clrAqua)) {
                    Print("OrderModify for trailing stop failed for ticket #", OrderTicket(), " with error: ", GetLastError());
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Helper function to get the profit of the most recent trade       |
//+------------------------------------------------------------------+
double GetLastTradeProfitPips() {
    datetime lastOrderOpenTime = 0;
    double profitPips = -1;

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() == MagicNumber && OrderSymbol() == Symbol()) {
                if(OrderOpenTime() > lastOrderOpenTime) {
                    lastOrderOpenTime = OrderOpenTime();
                    if(OrderType() == OP_BUY) profitPips = (Bid - OrderOpenPrice()) / _Point;
                    else profitPips = (OrderOpenPrice() - Ask) / _Point;
                }
            }
        }
    }
    return profitPips;
}

//+------------------------------------------------------------------+
//| Helper function to check the type of the last trade              |
//+------------------------------------------------------------------+
bool IsLastTradeType(int type) {
    datetime lastOrderOpenTime = 0;
    int lastOrderType = -1;

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() == MagicNumber && OrderSymbol() == Symbol()) {
                if(OrderOpenTime() > lastOrderOpenTime) {
                    lastOrderOpenTime = OrderOpenTime();
                    lastOrderType = OrderType();
                }
            }
        }
    }
    return (lastOrderType == type);
}


//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    Comment("");
}
//+------------------------------------------------------------------+
