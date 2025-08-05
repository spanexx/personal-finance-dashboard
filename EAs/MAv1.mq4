//--- Input parameters
input int MagicNumber = 202407;       // Unique identifier for EA trades
input int FastMA_Period = 10;         // Fast Moving Average period
input int SlowMA_Period = 50;         // Slow Moving Average period
input int TrendMA_Period = 200;       // Trend-filtering MA period (on D1)
input int Slippage = 3;               // Allowed slippage in points
input int CheckNewsIntervalSeconds = 3600; // How often to check for news (1 hour)

//--- Initial Trend Entry Inputs
input double RiskPercent = 2.0;         // Risk for initial trend entry (in percent)

//--- Pyramiding Inputs
input bool UsePyramiding = true;      // Enable/disable adding to winning trades
input double PyramidRiskPercent = 1.0;  // Risk for pyramid entries (in percent)
input double PyramidProfitPips = 50;  // Min profit (pips) to open next trade
input int MaxPyramidTrades = 5;       // Max number of trades to pyramid

//--- Trade Management Inputs
input double StopLossPercent = 2.0; // Stop loss in percentage (for pyramid trades)
input double TakeProfitPercent = 4.0;     // Take profit in percentage (for pyramid trades)
input bool   UseTrailingStop = true;   // Enable/disable trailing stop
input double TrailingStopPips = 50;   // Trailing stop distance in pips
input double TrailingTriggerPips = 100; // Pips in profit to activate trailing stop
input bool   ExitOnSignalReverse = true; // Close trade if MA signal reverses

//--- Global variables
datetime lastNewsCheckTime = 0;
bool isHighImpactNews = false;
datetime lastTrendEntryBar = 0; // Prevents opening a new trend trade on every tick of the same bar

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    //--- Initial news check
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
    Comment("No high impact news. Trading is active.");
    CheckForTradeSignals();
    ManageOpenTrades();
}

//+------------------------------------------------------------------+
//| Scrapes the web for news                                         |
//+------------------------------------------------------------------+
void CheckForNews() {
    lastNewsCheckTime = TimeCurrent();
    isHighImpactNews = false; // Reset flag before checking
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
//| Checks the long-term trend on the Daily chart                    |
//+------------------------------------------------------------------+
bool IsTrendUp() {
    double trendMA = iMA(Symbol(), PERIOD_D1, TrendMA_Period, 0, MODE_SMA, PRICE_CLOSE, 1);
    double dailyClose = iClose(Symbol(), PERIOD_D1, 1);
    return(dailyClose > trendMA);
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
//| Checks for all trade signals (Initial and Pyramid)               |
//+------------------------------------------------------------------+
void CheckForTradeSignals() {
    //--- Prevent trading faster than 1 bar
    if(Time[0] == lastTrendEntryBar) return;

    //--- Get signal states
    bool trendIsUp = IsTrendUp();
    double fastMA_current = iMA(NULL, 0, FastMA_Period, 0, MODE_SMA, PRICE_CLOSE, 0);
    double slowMA_current = iMA(NULL, 0, SlowMA_Period, 0, MODE_SMA, PRICE_CLOSE, 0);
    double fastMA_previous = iMA(NULL, 0, FastMA_Period, 0, MODE_SMA, PRICE_CLOSE, 1);
    double slowMA_previous = iMA(NULL, 0, SlowMA_Period, 0, MODE_SMA, PRICE_CLOSE, 1);

    bool buySignal = fastMA_previous < slowMA_previous && fastMA_current > slowMA_current && trendIsUp;
    bool sellSignal = fastMA_previous > slowMA_previous && fastMA_current < slowMA_current && !trendIsUp;

    if(!buySignal && !sellSignal) return; // No valid signal, exit.

    lastTrendEntryBar = Time[0]; // Update bar time only when a signal occurs

    int type = buySignal ? OP_BUY : OP_SELL;
    int openTrades = CountOpenTrades();

    //--- Logic for Initial Entry
    if(openTrades == 0) {
        OpenTrade(type, RiskPercent);
        return; // Exit after opening initial trade
    }

    //--- Logic for Pyramiding
    if(UsePyramiding && openTrades > 0 && openTrades < MaxPyramidTrades) {
        datetime lastOrderOpenTime = 0;
        double lastOrderProfitPips = -1;
        int lastOrderType = -1;

        for(int i = OrdersTotal() - 1; i >= 0; i--) {
            if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
                if(OrderMagicNumber() == MagicNumber && OrderSymbol() == Symbol()) {
                    if(OrderOpenTime() > lastOrderOpenTime) {
                        lastOrderOpenTime = OrderOpenTime();
                        lastOrderType = OrderType();
                        if(OrderType() == OP_BUY) lastOrderProfitPips = (Bid - OrderOpenPrice()) / _Point;
                        else lastOrderProfitPips = (OrderOpenPrice() - Ask) / _Point;
                    }
                }
            }
        }

        // Check if the last trade is profitable and the new signal matches the existing trade direction
        if(lastOrderProfitPips >= PyramidProfitPips) {
            if(buySignal && lastOrderType == OP_BUY) OpenTrade(type, PyramidRiskPercent);
            if(sellSignal && lastOrderType == OP_SELL) OpenTrade(type, PyramidRiskPercent);
        }
    }
}

//+------------------------------------------------------------------+
//| Opens a new trade with risk-calculated lot size                  |
//+------------------------------------------------------------------+
void OpenTrade(int type, double riskPercent) {
    double price = (type == OP_BUY) ? Ask : Bid;

    // Calculate SL and TP prices based on percentage
    double sl_percent = StopLossPercent / 100.0;
    double tp_percent = TakeProfitPercent / 100.0;
    double sl_price = (type == OP_BUY) ? price * (1 - sl_percent) : price * (1 + sl_percent);
    double tp_price = (type == OP_BUY) ? price * (1 + tp_percent) : price * (1 - tp_percent);

    // Calculate Stop Loss in pips for lot size calculation
    double stopLossInPoints = MathAbs(price - sl_price) / _Point;
    double stopLossInPips = stopLossInPoints;
    // For 5/3 digit brokers, 1 pip = 10 points. For 4/2 digit, 1 pip = 1 point.
    if(_Digits == 3 || _Digits == 5)
    {
        stopLossInPips = stopLossInPoints / 10.0;
    }

    // Calculate Lot Size based on risk
    double riskAmount = AccountEquity() * (riskPercent / 100.0);
    double lotSize = CalculateLotSize(riskAmount, stopLossInPips);
    if(lotSize <= 0) {
        Print("Invalid lot size calculated for entry. Lot Size: ", lotSize, ". Risk: ", riskPercent, "%, SL Pips: ", stopLossInPips);
        return;
    }

    // Send the order
    string ea_comment = (CountOpenTrades() == 0) ? "EA Initial Entry" : "EA Pyramid";
    int ticket = OrderSend(Symbol(), type, lotSize, price, Slippage, sl_price, tp_price, ea_comment, MagicNumber, 0, (type == OP_BUY ? clrGreen : clrRed));
    if(ticket < 0) {
        Print(ea_comment, " OrderSend failed with error #", GetLastError());
    }
}

//+------------------------------------------------------------------+
//| Calculates Lot Size based on fixed monetary risk and stop pips   |
//+------------------------------------------------------------------+
double CalculateLotSize(double riskAmount, double stopLossPips) {
    //--- Get market information
    double minLot = MarketInfo(Symbol(), MODE_MINLOT);
    double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);
    double lotStep = MarketInfo(Symbol(), MODE_LOTSTEP);
    double tickValue = MarketInfo(Symbol(), MODE_TICKVALUE);

    //--- Validate inputs
    if(stopLossPips <= 0 || tickValue <= 0) {
        Print("Invalid inputs for lot size calculation. SL Pips: ", stopLossPips, ", Tick Value: ", tickValue);
        return 0.0;
    }

    //--- Calculate the value of 1 pip for 1 lot
    double pipValuePerLot = tickValue;
    // For 5 and 3 digit brokers, 1 pip = 10 points (ticks). TickValue is the value of 1 point.
    if(_Digits == 5 || _Digits == 3) {
        pipValuePerLot = tickValue * 10;
    }

    //--- Calculate the exact lot size
    double lotSize = 0;
    if(stopLossPips > 0 && pipValuePerLot > 0)
    {
       lotSize = riskAmount / (stopLossPips * pipValuePerLot);
    }

    //--- Normalize the lot size according to the broker's rules
    lotSize = MathRound(lotSize / lotStep) * lotStep;

    //--- Clamp the lot size to the broker's min/max limits
    if(lotSize < minLot) {
        lotSize = minLot;
    }
    if(lotSize > maxLot) {
        lotSize = maxLot;
    }

    return lotSize;
}

//+------------------------------------------------------------------+
//| Manages all open trades (Exits and Trailing Stops)               |
//+------------------------------------------------------------------+
void ManageOpenTrades() {
    double fastMA_current = iMA(NULL, 0, FastMA_Period, 0, MODE_SMA, PRICE_CLOSE, 0);
    double slowMA_current = iMA(NULL, 0, SlowMA_Period, 0, MODE_SMA, PRICE_CLOSE, 0);

    for(int i = OrdersTotal() - 1; i >= 0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() != MagicNumber || OrderSymbol() != Symbol()) continue;

            //--- Exit on Signal Reversal
            if(ExitOnSignalReverse) {
                bool closeTrade = false;
                if(OrderType() == OP_BUY && fastMA_current < slowMA_current) closeTrade = true;
                if(OrderType() == OP_SELL && fastMA_current > slowMA_current) closeTrade = true;
                
                if(closeTrade) {
                    if(!OrderClose(OrderTicket(), OrderLots(), (OrderType() == OP_BUY ? Bid : Ask), Slippage, clrYellow)) {
                        Print("OrderClose failed for ticket #", OrderTicket(), " with error: ", GetLastError());
                    }
                    continue; // Move to next trade
                }
            }

            //--- Trailing Stop Logic
            if(UseTrailingStop) {
                double newStopLoss = 0;
                bool modify = false;

                if(OrderType() == OP_BUY) {
                    if(Bid > OrderOpenPrice() + (TrailingTriggerPips * _Point)) {
                        newStopLoss = Bid - (TrailingStopPips * _Point);
                        if(OrderStopLoss() < newStopLoss) {
                            modify = true;
                        }
                    }
                } else if(OrderType() == OP_SELL) {
                    if(Ask < OrderOpenPrice() - (TrailingTriggerPips * _Point)) {
                        newStopLoss = Ask + (TrailingStopPips * _Point);
                        if(OrderStopLoss() > newStopLoss || OrderStopLoss() == 0) {
                            modify = true;
                        }
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
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    Comment("");
}
//+------------------------------------------------------------------+
