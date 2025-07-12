export interface TimePeriod {
  value: string;
  label: string;
}

export interface BudgetItem {
  category: string;
  limit: number;
  spent: number;
  color?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

export interface CategoryExpense {
  category: {
    id: string;
    name: string;
    color: string;
  };
  amount: number;
  percentage: number;
}

export interface PeriodCashflow {
  // Fields from backend transaction trends
  year?: number;   
  period?: number;  // Day or month number from backend
  // Legacy fields for cashflow API
  periodNumber?: number; // Mapped from backend's period for frontend use
  periodLabel?: string; // For display purposes
  income: number;
  expense: number; // Backend uses this field name
  expenses?: number; // For backward compatibility
  net?: number;    // For backward compatibility
}

