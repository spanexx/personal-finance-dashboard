import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { BudgetSetupComponent } from './budget-setup/budget-setup.component';
import { BudgetAnalysisComponent } from './budget-analysis/budget-analysis.component';
import { BudgetWizardComponent } from './budget-wizard/budget-wizard.component';
import { BudgetTemplatesComponent } from './budget-templates/budget-templates.component';
import { BudgetTrackingEnhancedComponent } from './budget-tracking/budget-tracking.component';
import { BudgetOptimizationComponent } from './budget-optimization/budget-optimization.component';

const routes: Routes = [
  {
    path: '',
    component: BudgetOverviewComponent
  },
  {
    path: 'overview',
    component: BudgetOverviewComponent
  },
  {
    path: 'create',
    component: BudgetCreateComponent,
    data: { title: 'Create Budget' }
  },
  {
    path: 'edit/:id',
    component: BudgetEditComponent,
    data: { title: 'Edit Budget' }
  },
  {
    path: 'wizard',
    component: BudgetWizardComponent,
    data: { title: 'Create New Budget' }
  },
  {
    path: 'templates',
    component: BudgetTemplatesComponent,
    data: { title: 'Budget Templates' }
  },  {
    path: 'analysis',
    component: BudgetAnalysisComponent
  },  {
    path: 'tracking',
    component: BudgetTrackingEnhancedComponent,
    data: { title: 'Budget Tracking & Monitoring' }
  },
  {
    path: 'optimization',
    component: BudgetOptimizationComponent,
    data: { title: 'Budget Optimization & Recommendations' }
  },
  {
    path: ':id',
    component: BudgetOverviewComponent,
    data: { title: 'Budget Details' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BudgetsRoutingModule { }
