//+------------------------------------------------------------------+
//| Expert Advisor: Bulls & Bears Power EMA/ATR/SMA Strategy         |
//+------------------------------------------------------------------+
#property strict

//--- Input parameters
input double InitialCapital = 10000.0;
input int MaxConcurrentTrades = 10;
input int MagicNumber = 202406; // Unique identifier for EA trades

//--- Constants
#define SL_PCT 0.02
#define TP_PCT 0.05
#define ATR_MIN 0.005

//--- ATR filter option
input bool UseATRFilter = true; // Set to false to disable ATR filter

//--- Trailing Stop option
input bool UseTrailingStop = true; // Set to false to disable trailing stop

//--- Utility function to count open trades for this EA
int CountOpenTrades() {
    int count = 0;
    for(int i=0; i<OrdersTotal(); i++) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() == MagicNumber && OrderSymbol() == Symbol()) {
                count++;
            }
        }
    }
    return count;
}

//--- Utility function to count all open trades for this EA (all symbols)
int CountAllOpenTrades() {
    int count = 0;
    for(int i=0; i<OrdersTotal(); i++) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() == MagicNumber) {
                count++;
            }
        }
    }
    return count;
}

//--- Indicator calculations
double GetEMA13(int shift) {
    return iMA(NULL, PERIOD_D1, 13, 0, MODE_EMA, PRICE_CLOSE, shift);
}
double GetSMA50(int shift) {
    return iMA(NULL, PERIOD_D1, 50, 0, MODE_SMA, PRICE_CLOSE, shift);
}
double GetATR14(int shift) {
    return iATR(NULL, PERIOD_D1, 14, shift);
}
double GetBullsPower(int shift) {
    return iHigh(NULL, PERIOD_D1, shift) - GetEMA13(shift);
}
double GetBearsPower(int shift) {
    return iLow(NULL, PERIOD_D1, shift) - GetEMA13(shift);
}

//--- Position sizing: risk 2% of equity per trade
double GetTradeLots(double entryPrice, double stopLoss) {
    // Calculate risk per trade (2% of equity)
    double equity = AccountBalance();
    double riskAmount = equity * SL_PCT; // SL_PCT is 0.02

    // Calculate stop loss distance in points
    double point = MarketInfo(Symbol(), MODE_POINT);
    double slDistance;
    if (entryPrice > stopLoss)
        slDistance = entryPrice - stopLoss;
    else
        slDistance = stopLoss - entryPrice;

    // Value per lot per point
    double lotValuePerPoint = MarketInfo(Symbol(), MODE_TICKVALUE) / point;

    // Calculate lots so that riskAmount = lots * slDistance * lotValuePerPoint
    double lots = riskAmount / (slDistance * lotValuePerPoint);

    // Clamp to broker min/max lot size
    lots = MathMax(lots, MarketInfo(Symbol(), MODE_MINLOT));
    lots = MathMin(lots, MarketInfo(Symbol(), MODE_MAXLOT));
    return NormalizeDouble(lots, 2);
}

//--- Entry logic
void CheckEntry() {
    // Only at end of day (new bar)
    static datetime lastBarTime = 0;
    if (Time[0] == lastBarTime) return;
    lastBarTime = Time[0];

    // Only one trade per symbol
    if (CountOpenTrades() > 0) return;
    // Global max trades
    if (CountAllOpenTrades() >= MaxConcurrentTrades) return;

    // Get indicator values for previous bar (signals at close, enter at next open)
    int shift = 1;
    double ema13 = GetEMA13(shift);
    double sma50 = GetSMA50(shift);
    double atr14 = GetATR14(shift);
    double bulls = GetBullsPower(shift);
    double bears = GetBearsPower(shift);
    double close = iClose(NULL, PERIOD_D1, shift);

    // Buy signal
    bool buySignal = bulls > 0 && bears > 0 && close > sma50;
    if (UseATRFilter) buySignal = buySignal && (atr14 >= ATR_MIN);

    if (buySignal) {
        double price = iOpen(NULL, PERIOD_D1, 0); // Next day's open
        double sl = price * (1.0 - SL_PCT);
        double tp = price * (1.0 + TP_PCT);
        double lotSize = GetTradeLots(price, sl);
        OrderSend(Symbol(), OP_BUY, lotSize, price, 3, sl, tp, "EA Buy", MagicNumber, 0, clrGreen);
    }

    // Sell signal
    bool sellSignal = bulls < 0 && bears < 0 && close < sma50;
    if (UseATRFilter) sellSignal = sellSignal && (atr14 >= ATR_MIN);

    if (sellSignal) {
        double price = iOpen(NULL, PERIOD_D1, 0); // Next day's open
        double sl = price * (1.0 + SL_PCT);
        double tp = price * (1.0 - TP_PCT);
        double lotSize = GetTradeLots(price, sl);
        OrderSend(Symbol(), OP_SELL, lotSize, price, 3, sl, tp, "EA Sell", MagicNumber, 0, clrRed);
    }
}

//--- Exit logic
void CheckExit() {
    for(int i=OrdersTotal()-1; i>=0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() != MagicNumber) continue;
            if(OrderSymbol() != Symbol()) continue;

            double entryPrice = OrderOpenPrice();
            int type = OrderType();
            double slPrice, tpPrice;
            bool exit = false;

            // Get indicator values for current bar
            double bulls = GetBullsPower(0);
            double bears = GetBearsPower(0);

            // SL/TP check
            if(type == OP_BUY) {
                slPrice = entryPrice * (1.0 - SL_PCT);
                tpPrice = entryPrice * (1.0 + TP_PCT);
                if(Bid <= slPrice || Bid >= tpPrice) exit = true;
                // Indicator reversal
                if(!exit && bulls <= 0) exit = true;
            }
            if(type == OP_SELL) {
                slPrice = entryPrice * (1.0 + SL_PCT);
                tpPrice = entryPrice * (1.0 - TP_PCT);
                if(Ask >= slPrice || Ask <= tpPrice) exit = true;
                // Indicator reversal
                if(!exit && bears >= 0) exit = true;
            }
            // Exit trade if any condition met
            if(exit) {
                OrderClose(OrderTicket(), OrderLots(), (type == OP_BUY ? Bid : Ask), 3, clrYellow);
            }
        }
    }
}

//--- Trailing Stop parameters
input double TrailingStopPips = 100; // trailing stop distance in points (adjust as needed)

//--- Trailing Stop logic (activate only after price moves 2% profit from entry)
void CheckTrailingStop() {
    if(!UseTrailingStop) return;
    for(int i=OrdersTotal()-1; i>=0; i--) {
        if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
            if(OrderMagicNumber() != MagicNumber) continue;
            if(OrderSymbol() != Symbol()) continue;

            int type = OrderType();
            double openPrice = OrderOpenPrice();
            double stopLoss = OrderStopLoss();
            double point = MarketInfo(Symbol(), MODE_POINT);

            // Minimum profit threshold for trailing stop activation
            double minProfitPct = 0.02; // 2%
            // For BUY orders
            if(type == OP_BUY) {
                double minProfitPrice = openPrice * (1.0 + minProfitPct);
                if(Bid >= minProfitPrice) {
                    double newStop = Bid - TrailingStopPips * point;
                    if(stopLoss < newStop) {
                        OrderModify(OrderTicket(), OrderOpenPrice(), newStop, OrderTakeProfit(), 0, clrAqua);
                    }
                }
            }
            // For SELL orders
            if(type == OP_SELL) {
                double minProfitPrice = openPrice * (1.0 - minProfitPct);
                if(Ask <= minProfitPrice) {
                    double newStop = Ask + TrailingStopPips * point;
                    if(stopLoss == 0 || stopLoss > newStop) {
                        OrderModify(OrderTicket(), OrderOpenPrice(), newStop, OrderTakeProfit(), 0, clrAqua);
                    }
                }
            }
        }
    }
}

//--- Main EA loop
int start() {
    CheckEntry();
    CheckExit();
    CheckTrailingStop();
    return(0);
}

//+------------------------------------------------------------------+
