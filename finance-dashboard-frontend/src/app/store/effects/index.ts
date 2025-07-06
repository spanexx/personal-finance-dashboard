import { AuthEffects } from './auth.effects';
import { GoalEffects } from './goal.effects';
import { BudgetEffects } from './budget.effects';
import { ReportEffects } from './report.effects';
import { TransactionEffects } from './transaction.effects'; // Import TransactionEffects

export const effects = [
  AuthEffects,
  GoalEffects,
  BudgetEffects,
  ReportEffects,
  TransactionEffects, // Add TransactionEffects
];