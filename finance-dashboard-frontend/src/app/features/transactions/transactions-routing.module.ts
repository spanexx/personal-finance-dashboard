import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { TransactionCategoryManagerComponent } from './transaction-category-manager/transaction-category-manager.component';
import { TransactionAnalyticsComponent } from './components/transaction-analytics.component';

const routes: Routes = [
  { path: '', component: TransactionListComponent },
  { path: 'new', component: TransactionFormComponent },
  { path: 'edit/:id', component: TransactionFormComponent },
  { path: 'categories', component: TransactionCategoryManagerComponent },
  { path: 'analytics', component: TransactionAnalyticsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TransactionsRoutingModule { }
