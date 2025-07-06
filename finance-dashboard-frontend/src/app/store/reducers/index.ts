import { ActionReducerMap } from '@ngrx/store';
import { AppState } from '../state/app.state';
import { authReducer } from './auth.reducer';
import { goalReducer } from './goal.reducer';
import { budgetReducer } from './budget.reducer';
import { reportReducer } from './report.reducer';
import { transactionReducer, transactionFeatureKey } from './transaction.reducer'; // Import transaction reducer and key

export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  goals: goalReducer,
  budgets: budgetReducer,
  reports: reportReducer,
  [transactionFeatureKey]: transactionReducer, // Add transaction reducer
};