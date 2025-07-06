import { AuthState } from './auth.state';
import { BudgetState } from './budget.state';
import { GoalState } from './goal.state';
import { ReportState } from './report.state';
import { TransactionState } from './transaction.state'; // Import TransactionState
import { transactionFeatureKey } from '../reducers/transaction.reducer'; // Import key for consistency

// Root state interface for the application
export interface AppState {
  auth: AuthState;
  budgets: BudgetState;
  goals: GoalState;
  reports: ReportState;
  [transactionFeatureKey]: TransactionState; // Add TransactionState
  // TODO: Add other feature states
}
