import { Routes } from '@angular/router';
import { AuthGuard, NonAuthGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule),
    canActivate: [NonAuthGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(c => c.DashboardComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'budgets',
    children: [
      {
        path: '',
        loadComponent: () => import('./features/budgets/budget-overview/budget-overview.component').then(c => c.BudgetOverviewComponent)
      },
      {
        path: 'overview',
        loadComponent: () => import('./features/budgets/budget-overview/budget-overview.component').then(c => c.BudgetOverviewComponent)
      },
      {
        path: 'setup',
        loadComponent: () => import('./features/budgets/budget-setup/budget-setup.component').then(c => c.BudgetSetupComponent)
      },
      {
        path: 'analysis',
        loadComponent: () => import('./features/budgets/budget-analysis/budget-analysis.component').then(c => c.BudgetAnalysisComponent)
      },
      {
        path: 'setup/:id',
        loadComponent: () => import('./features/budgets/budget-setup/budget-setup.component').then(c => c.BudgetSetupComponent)
      },
      {
        path: 'analysis/:id',
        loadComponent: () => import('./features/budgets/budget-analysis/budget-analysis.component').then(c => c.BudgetAnalysisComponent)
      }
    ],
    canActivate: [AuthGuard]
  },
  {
    path: 'transactions',
    loadChildren: () => import('./features/transactions/transactions.module').then(m => m.TransactionsModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'goals',
    loadChildren: () => import('./features/goals/goals.module').then(m => m.GoalsModule),
    canActivate: [AuthGuard]
  },  {
    path: 'reports',
    loadChildren: () => import('./features/reports/reports.module').then(m => m.ReportsModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.module').then(m => m.SettingsModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  }
];
